/**
 * S4-4 — 상대 라이더 튐 재현용 DEV 링 버퍼.
 * 콘솔 체인 로그(1s 스로틀)로는 앞뒤 튐이 안 보여, 같은 시계로 다섯 축을 남긴다.
 * 제품 ingest 경로를 바꾸지 않는다. begin() 전에는 no-op.
 */

import type { PeerMotionPacket } from "./types";

export const JITTER_DIST_BACKTRACK_M = 0.5;
/** 화면에서 "조금씩"으로 보이는 최소 반전. 카메라 추종 드리프트와 구분 */
export const JITTER_SCREEN_REVERSE_PX = 8;
const MAX_EVENTS = 16_000;

export type JitterSourceSample = {
  recvAtMs: number;
  serverAtMs: number;
  distM: number;
  speedMps: number;
  phase: string;
  seq?: number;
};

export type JitterMergeNote = {
  invoked: boolean;
  choice: "rtdb-only" | "fs-fallback" | "none";
  reason: string;
  wouldDistM: number | null;
  wouldSpeedMps: number | null;
  wouldPhase: string | null;
  wouldServerAtMs: number | null;
};

export type JitterIngestEvent = {
  kind: "ingest";
  atMs: number;
  uid: string;
  rtdb: JitterSourceSample | null;
  fs: JitterSourceSample | null;
  merge: JitterMergeNote;
  ingest: {
    result: string;
    newestDistM: number;
    packetDistM: number;
  };
};

export type JitterDisplayEvent = {
  kind: "display";
  atMs: number;
  uid: string;
  displayDistM: number;
  lng: number;
  lat: number;
  screenX: number | null;
  screenY: number | null;
};

export type JitterEvent = JitterIngestEvent | JitterDisplayEvent;

export type JitterAxis = "distance" | "screen" | "none" | "undetermined";

export type JitterAxisJudgment = {
  axis: JitterAxis;
  maxDistBacktrackM: number;
  distBacktrackCount: number;
  maxScreenReversePx: number;
  screenReverseCount: number;
  /** 팔로우 카메라에서 앞뒤 ≈ screen Y. 좌우(X) 곡률과 구분한다. */
  maxAlongScreenReversePx: number;
  alongScreenReverseCount: number;
  displayFrames: number;
  ingestEvents: number;
  peerUids: string[];
  reason: string;
};

export type JitterCaptureDump = {
  windowStartedAt: number | null;
  windowEndedAt: number | null;
  recording: boolean;
  events: JitterEvent[];
  judgment: JitterAxisJudgment;
};

type MapProject = {
  project: (ll: { lng: number; lat: number }) => { x: number; y: number };
};

let recording = false;
let windowStartedAt: number | null = null;
let windowEndedAt: number | null = null;
const events: JitterEvent[] = [];

export function isPeerJitterCapturing(): boolean {
  return recording;
}

export function resetPeerJitterCaptureForTests(): void {
  recording = false;
  windowStartedAt = null;
  windowEndedAt = null;
  events.length = 0;
}

export function beginPeerJitterCapture(nowMs = Date.now()): void {
  events.length = 0;
  recording = true;
  windowStartedAt = nowMs;
  windowEndedAt = null;
}

export function snapshotPeerJitterCapture(nowMs = Date.now()): JitterCaptureDump {
  return {
    windowStartedAt,
    windowEndedAt: recording ? nowMs : windowEndedAt,
    recording,
    events: events.slice(),
    judgment: analyzeJitterAxis(events),
  };
}

export function endPeerJitterCapture(nowMs = Date.now()): JitterCaptureDump {
  recording = false;
  windowEndedAt = nowMs;
  return snapshotPeerJitterCapture(nowMs);
}

export function packetToJitterSource(
  packet: PeerMotionPacket | null,
  recvAtMs: number,
): JitterSourceSample | null {
  if (!packet) return null;
  return {
    recvAtMs,
    serverAtMs: packet.serverAtMs,
    distM: packet.distM,
    speedMps: packet.speedMps,
    phase: packet.phase,
    ...(packet.seq != null ? { seq: packet.seq } : {}),
  };
}

function pushEvent(ev: JitterEvent): void {
  if (!recording) return;
  if (events.length >= MAX_EVENTS) events.shift();
  events.push(ev);
}

export function noteJitterIngest(input: {
  atMs: number;
  uid: string;
  rtdb: JitterSourceSample | null;
  fs: JitterSourceSample | null;
  merge: JitterMergeNote;
  result: string;
  newestDistM: number;
  packetDistM: number;
}): void {
  if (!recording) return;
  pushEvent({
    kind: "ingest",
    atMs: input.atMs,
    uid: input.uid,
    rtdb: input.rtdb,
    fs: input.fs,
    merge: input.merge,
    ingest: {
      result: input.result,
      newestDistM: input.newestDistM,
      packetDistM: input.packetDistM,
    },
  });
}

export function noteJitterDisplay(input: {
  atMs: number;
  uid: string;
  displayDistM: number;
  lng: number;
  lat: number;
}): void {
  if (!recording) return;
  let screenX: number | null = null;
  let screenY: number | null = null;
  if (typeof window !== "undefined") {
    const map = (window as Window & { __RTW_MAP__?: MapProject }).__RTW_MAP__;
    if (map && typeof map.project === "function") {
      const p = map.project({ lng: input.lng, lat: input.lat });
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
        screenX = p.x;
        screenY = p.y;
      }
    }
  }
  pushEvent({
    kind: "display",
    atMs: input.atMs,
    uid: input.uid,
    displayDistM: input.displayDistM,
    lng: input.lng,
    lat: input.lat,
    screenX,
    screenY,
  });
}

export function analyzeJitterAxis(log: readonly JitterEvent[]): JitterAxisJudgment {
  const ingestEvents = log.filter((e): e is JitterIngestEvent => e.kind === "ingest").length;
  const display = log.filter((e): e is JitterDisplayEvent => e.kind === "display");
  const peerUids = [...new Set(log.map((e) => e.uid))];

  if (display.length < 3) {
    return {
      axis: "undetermined",
      maxDistBacktrackM: 0,
      distBacktrackCount: 0,
      maxScreenReversePx: 0,
      screenReverseCount: 0,
      maxAlongScreenReversePx: 0,
      alongScreenReverseCount: 0,
      displayFrames: display.length,
      ingestEvents,
      peerUids,
      reason: "display 프레임이 부족하다 (3 미만). 캡처 창을 넓히거나 동행이 보이는지 확인.",
    };
  }

  let maxDistBacktrackM = 0;
  let distBacktrackCount = 0;
  let maxScreenReversePx = 0;
  let screenReverseCount = 0;
  let maxAlongScreenReversePx = 0;
  let alongScreenReverseCount = 0;

  const byUid = new Map<string, JitterDisplayEvent[]>();
  for (const ev of display) {
    const list = byUid.get(ev.uid) ?? [];
    list.push(ev);
    byUid.set(ev.uid, list);
  }

  for (const series of byUid.values()) {
    let prev: JitterDisplayEvent | null = null;
    let prevScreenDx = 0;
    let prevScreenDy = 0;
    for (const ev of series) {
      if (prev) {
        const back = prev.displayDistM - ev.displayDistM;
        if (back > 0.01) {
          distBacktrackCount += 1;
          if (back > maxDistBacktrackM) maxDistBacktrackM = back;
        }
        if (
          prev.screenX != null &&
          prev.screenY != null &&
          ev.screenX != null &&
          ev.screenY != null
        ) {
          const dx = ev.screenX - prev.screenX;
          const dy = ev.screenY - prev.screenY;
          const reverse =
            (dx * prevScreenDx + dy * prevScreenDy < 0) &&
            Math.hypot(dx, dy) >= JITTER_SCREEN_REVERSE_PX &&
            Math.hypot(prevScreenDx, prevScreenDy) >= JITTER_SCREEN_REVERSE_PX;
          if (reverse) {
            screenReverseCount += 1;
            const mag = Math.hypot(dx, dy);
            if (mag > maxScreenReversePx) maxScreenReversePx = mag;
          }
          const alongReverse =
            dy * prevScreenDy < 0 &&
            Math.abs(dy) >= JITTER_SCREEN_REVERSE_PX &&
            Math.abs(prevScreenDy) >= JITTER_SCREEN_REVERSE_PX;
          if (alongReverse) {
            alongScreenReverseCount += 1;
            const mag = Math.abs(dy);
            if (mag > maxAlongScreenReversePx) maxAlongScreenReversePx = mag;
          }
          prevScreenDx = dx;
          prevScreenDy = dy;
        }
      }
      prev = ev;
    }
  }

  if (maxDistBacktrackM > JITTER_DIST_BACKTRACK_M) {
    return {
      axis: "distance",
      maxDistBacktrackM,
      distBacktrackCount,
      maxScreenReversePx,
      screenReverseCount,
      maxAlongScreenReversePx,
      alongScreenReverseCount,
      displayFrames: display.length,
      ingestEvents,
      peerUids,
      reason: `displayDistM 역행 최대 ${maxDistBacktrackM.toFixed(3)} m (> ${JITTER_DIST_BACKTRACK_M} m). 거리축.`,
    };
  }

  if (maxAlongScreenReversePx >= JITTER_SCREEN_REVERSE_PX && alongScreenReverseCount >= 3) {
    return {
      axis: "screen",
      maxDistBacktrackM,
      distBacktrackCount,
      maxScreenReversePx,
      screenReverseCount,
      maxAlongScreenReversePx,
      alongScreenReverseCount,
      displayFrames: display.length,
      ingestEvents,
      peerUids,
      reason: `displayDistM 역행 최대 ${maxDistBacktrackM.toFixed(3)} m (≤ ${JITTER_DIST_BACKTRACK_M} m) 인데 화면 앞뒤(Y) 반전 ${alongScreenReverseCount} 회·최대 ${maxAlongScreenReversePx.toFixed(1)} px. 화면축.`,
    };
  }

  return {
    axis: "none",
    maxDistBacktrackM,
    distBacktrackCount,
    maxScreenReversePx,
    screenReverseCount,
    maxAlongScreenReversePx,
    alongScreenReverseCount,
    displayFrames: display.length,
    ingestEvents,
    peerUids,
    reason:
      maxScreenReversePx >= JITTER_SCREEN_REVERSE_PX
        ? `거리축 역행 최대 ${maxDistBacktrackM.toFixed(3)} m. 화면 2D 반전은 있으나 앞뒤(Y)는 ${alongScreenReverseCount} 회(최대 ${maxAlongScreenReversePx.toFixed(1)} px) — 좌우(곡률·카메라 요)로 본다. 이 창에서 앞뒤 튐은 재현되지 않음.`
        : "이 창에서는 displayDistM 역행 ≤ 0.5 m 이고 화면 앞뒤 반전도 약하다. 증상 구간이 아니거나 조건을 바꿔야 한다.",
  };
}
