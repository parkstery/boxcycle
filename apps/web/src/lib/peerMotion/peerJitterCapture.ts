/**
 * S4-4 / S4-4R — 상대 라이더 튐 DEV 링 버퍼.
 * 제품 ingest 경로는 바꾸지 않는다. begin() 전에는 no-op.
 *
 * S4-4R: 앞뒤는 화면 X/Y 고정이 아니라, displayDistM 전진 구간에서
 * 화면 좌표를 회귀해 구한 진행축 û 에 Δscreen 을 투영한 부호로 판정한다.
 */

import type { PeerMotionPacket } from "./types";

/** 라벨 밴드일 뿐 합격 기준이 아니다. px/m 근거가 있을 때만 구간에 표시. */
export const BAND_LABEL_PX = 8;
const MAX_EVENTS = 16_000;
const UHAT_HALF_WINDOW = 12;
const UHAT_MIN_DIST_SPAN_M = 2;
const UHAT_MIN_PX_PER_M = 0.4;

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
  conditionId: string | null;
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
  conditionId: string | null;
  displayDistM: number;
  lng: number;
  lat: number;
  screenX: number | null;
  screenY: number | null;
  localDistM: number | null;
  localScreenX: number | null;
  localScreenY: number | null;
  camBearing: number | null;
  camPitch: number | null;
  camLng: number | null;
  camLat: number | null;
};

export type JitterEvent = JitterIngestEvent | JitterDisplayEvent;

export type DominantSignal =
  | "undetermined"
  | "along-track-screen"
  | "distance"
  | "both"
  | "screen-2d-unprojected"
  | "quiet";

export type DistBacktrackHit = {
  atMs: number;
  uid: string;
  fromM: number;
  toM: number;
  backM: number;
};

export type AlongReverseHit = {
  atMs: number;
  uid: string;
  sPx: number;
  prevSPx: number;
  magPx: number;
  ux: number;
  uy: number;
  pxPerM: number;
  distDeltaM: number;
  absDx: number;
  absDy: number;
  relSPx: number | null;
  source: "absolute" | "relative";
};

export type JitterAxisJudgment = {
  /** @deprecated S4-4. dominantSignal 을 쓴다. none 을 합격으로 쓰지 마라. */
  axis: DominantSignal;
  dominantSignal: DominantSignal;
  alongTrackMethod: "forward-regression-window";
  maxDistBacktrackM: number;
  distBacktrackCount: number;
  distBacktracks: DistBacktrackHit[];
  maxScreenReversePx: number;
  screenReverseCount: number;
  alongReverseCount: number;
  maxAlongReversePx: number;
  alongPeakToPeakPx: number;
  alongNegativeCount: number;
  alongReverses: AlongReverseHit[];
  subThresholdAlongReverseCount: number;
  pxPerMMedian: number | null;
  bandLabelPx: number;
  bandPxEqualsM: number | null;
  startGapDistM: number | null;
  startGapScreenPx: number | null;
  hasLocalScreen: boolean;
  displayFrames: number;
  ingestEvents: number;
  peerUids: string[];
  reason: string;
};

export type JitterCaptureDump = {
  windowStartedAt: number | null;
  windowEndedAt: number | null;
  recording: boolean;
  conditionId: string | null;
  events: JitterEvent[];
  judgment: JitterAxisJudgment;
};

type MapProject = {
  project: (ll: { lng: number; lat: number }) => { x: number; y: number };
  getBearing?: () => number;
  getPitch?: () => number;
  getCenter?: () => { lng: number; lat: number };
};

let recording = false;
let windowStartedAt: number | null = null;
let windowEndedAt: number | null = null;
let conditionId: string | null = null;
const events: JitterEvent[] = [];

export function isPeerJitterCapturing(): boolean {
  return recording;
}

export function resetPeerJitterCaptureForTests(): void {
  recording = false;
  windowStartedAt = null;
  windowEndedAt = null;
  conditionId = null;
  events.length = 0;
}

export function beginPeerJitterCapture(
  nowMs = Date.now(),
  nextConditionId: string | null = null,
): void {
  events.length = 0;
  recording = true;
  windowStartedAt = nowMs;
  windowEndedAt = null;
  conditionId = nextConditionId;
}

export function snapshotPeerJitterCapture(nowMs = Date.now()): JitterCaptureDump {
  return {
    windowStartedAt,
    windowEndedAt: recording ? nowMs : windowEndedAt,
    recording,
    conditionId,
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
    conditionId,
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

function readMap(): MapProject | null {
  if (typeof window === "undefined") return null;
  const map = (window as Window & { __RTW_MAP__?: MapProject }).__RTW_MAP__;
  return map && typeof map.project === "function" ? map : null;
}

function projectLngLat(
  map: MapProject | null,
  lng: number | null | undefined,
  lat: number | null | undefined,
): { x: number; y: number } | null {
  if (!map || lng == null || lat == null || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  const p = map.project({ lng, lat });
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return p;
}

export function noteJitterDisplay(input: {
  atMs: number;
  uid: string;
  displayDistM: number;
  lng: number;
  lat: number;
  localDistM?: number | null;
  localLng?: number | null;
  localLat?: number | null;
}): void {
  if (!recording) return;
  const map = readMap();
  const peer = projectLngLat(map, input.lng, input.lat);
  const local = projectLngLat(map, input.localLng, input.localLat);
  let camBearing: number | null = null;
  let camPitch: number | null = null;
  let camLng: number | null = null;
  let camLat: number | null = null;
  if (map) {
    if (typeof map.getBearing === "function") camBearing = map.getBearing();
    if (typeof map.getPitch === "function") camPitch = map.getPitch();
    if (typeof map.getCenter === "function") {
      const c = map.getCenter();
      camLng = c.lng;
      camLat = c.lat;
    }
  }
  pushEvent({
    kind: "display",
    atMs: input.atMs,
    uid: input.uid,
    conditionId,
    displayDistM: input.displayDistM,
    lng: input.lng,
    lat: input.lat,
    screenX: peer?.x ?? null,
    screenY: peer?.y ?? null,
    localDistM: input.localDistM ?? null,
    localScreenX: local?.x ?? null,
    localScreenY: local?.y ?? null,
    camBearing,
    camPitch,
    camLng,
    camLat,
  });
}

function olsSlope(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    mx += xs[i]!;
    my += ys[i]!;
  }
  mx /= n;
  my /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - mx;
    num += dx * (ys[i]! - my);
    den += dx * dx;
  }
  if (Math.abs(den) < 1e-12) return null;
  return num / den;
}

export type AlongUnit = { ux: number; uy: number; pxPerM: number };

/** displayDistM 전진 창에서 screen~dist 회귀. 튐이 û 를 한 프레임으로 뒤집지 않게 창을 쓴다. */
export function estimateAlongTrackUnit(
  series: readonly JitterDisplayEvent[],
  index: number,
): AlongUnit | null {
  const lo = Math.max(0, index - UHAT_HALF_WINDOW);
  const hi = Math.min(series.length - 1, index + UHAT_HALF_WINDOW);
  const dist: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = lo; i <= hi; i += 1) {
    const ev = series[i]!;
    if (ev.screenX == null || ev.screenY == null) continue;
    dist.push(ev.displayDistM);
    xs.push(ev.screenX);
    ys.push(ev.screenY);
  }
  if (dist.length < 4) return null;
  const span = Math.max(...dist) - Math.min(...dist);
  if (span < UHAT_MIN_DIST_SPAN_M) return null;
  const sx = olsSlope(dist, xs);
  const sy = olsSlope(dist, ys);
  if (sx == null || sy == null) return null;
  const mag = Math.hypot(sx, sy);
  if (mag < UHAT_MIN_PX_PER_M) return null;
  return { ux: sx / mag, uy: sy / mag, pxPerM: mag };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function emptyJudgment(
  extra: Partial<JitterAxisJudgment> & Pick<JitterAxisJudgment, "dominantSignal" | "reason">,
): JitterAxisJudgment {
  return {
    axis: extra.dominantSignal,
    dominantSignal: extra.dominantSignal,
    alongTrackMethod: "forward-regression-window",
    maxDistBacktrackM: 0,
    distBacktrackCount: 0,
    distBacktracks: [],
    maxScreenReversePx: 0,
    screenReverseCount: 0,
    alongReverseCount: 0,
    maxAlongReversePx: 0,
    alongPeakToPeakPx: 0,
    alongNegativeCount: 0,
    alongReverses: [],
    subThresholdAlongReverseCount: 0,
    pxPerMMedian: null,
    bandLabelPx: BAND_LABEL_PX,
    bandPxEqualsM: null,
    startGapDistM: null,
    startGapScreenPx: null,
    hasLocalScreen: false,
    displayFrames: 0,
    ingestEvents: 0,
    peerUids: [],
    ...extra,
  };
}

export function analyzeJitterAxis(log: readonly JitterEvent[]): JitterAxisJudgment {
  const ingestEvents = log.filter((e): e is JitterIngestEvent => e.kind === "ingest").length;
  const display = log.filter((e): e is JitterDisplayEvent => e.kind === "display");
  const peerUids = [...new Set(log.map((e) => e.uid))];

  if (display.length < 3) {
    return emptyJudgment({
      dominantSignal: "undetermined",
      displayFrames: display.length,
      ingestEvents,
      peerUids,
      reason: "display 프레임이 부족하다 (3 미만).",
    });
  }

  const distBacktracks: DistBacktrackHit[] = [];
  const alongReverses: AlongReverseHit[] = [];
  const pxPerMAll: number[] = [];
  let maxScreenReversePx = 0;
  let screenReverseCount = 0;
  let alongNegativeCount = 0;
  let sMin = Infinity;
  let sMax = -Infinity;
  let hasLocalScreen = false;

  const first = display[0]!;
  const startGapDistM =
    first.localDistM != null ? first.displayDistM - first.localDistM : null;
  const startGapScreenPx =
    first.screenX != null &&
    first.screenY != null &&
    first.localScreenX != null &&
    first.localScreenY != null
      ? Math.hypot(first.screenX - first.localScreenX, first.screenY - first.localScreenY)
      : null;

  const byUid = new Map<string, JitterDisplayEvent[]>();
  for (const ev of display) {
    const list = byUid.get(ev.uid) ?? [];
    list.push(ev);
    byUid.set(ev.uid, list);
    if (ev.localScreenX != null && ev.localScreenY != null) hasLocalScreen = true;
  }

  for (const series of byUid.values()) {
    let prev: JitterDisplayEvent | null = null;
    let prevDx = 0;
    let prevDy = 0;
    let prevS: number | null = null;
    let lockedU: AlongUnit | null = null;
    for (let i = 0; i < series.length; i += 1) {
      const ev = series[i]!;
      const rawU = estimateAlongTrackUnit(series, i);
      let u = rawU;
      if (u && lockedU && u.ux * lockedU.ux + u.uy * lockedU.uy < 0) {
        u = { ux: -u.ux, uy: -u.uy, pxPerM: u.pxPerM };
      }
      if (u) {
        lockedU = u;
        pxPerMAll.push(u.pxPerM);
      }
      if (prev) {
        const back = prev.displayDistM - ev.displayDistM;
        if (back > 0) {
          distBacktracks.push({
            atMs: ev.atMs,
            uid: ev.uid,
            fromM: prev.displayDistM,
            toM: ev.displayDistM,
            backM: back,
          });
        }
        if (
          prev.screenX != null &&
          prev.screenY != null &&
          ev.screenX != null &&
          ev.screenY != null
        ) {
          const dx = ev.screenX - prev.screenX;
          const dy = ev.screenY - prev.screenY;
          const reverse2d =
            dx * prevDx + dy * prevDy < 0 &&
            Math.hypot(dx, dy) > 0 &&
            Math.hypot(prevDx, prevDy) > 0;
          if (reverse2d) {
            screenReverseCount += 1;
            const mag = Math.hypot(dx, dy);
            if (mag > maxScreenReversePx) maxScreenReversePx = mag;
          }
          if (u) {
            const s = dx * u.ux + dy * u.uy;
            if (s < 0) alongNegativeCount += 1;
            if (s < sMin) sMin = s;
            if (s > sMax) sMax = s;
            let relS: number | null = null;
            if (
              prev.localScreenX != null &&
              prev.localScreenY != null &&
              ev.localScreenX != null &&
              ev.localScreenY != null
            ) {
              const rdx =
                ev.screenX - ev.localScreenX - (prev.screenX - prev.localScreenX);
              const rdy =
                ev.screenY - ev.localScreenY - (prev.screenY - prev.localScreenY);
              relS = rdx * u.ux + rdy * u.uy;
            }
            if (prevS != null && s * prevS < 0) {
              alongReverses.push({
                atMs: ev.atMs,
                uid: ev.uid,
                sPx: s,
                prevSPx: prevS,
                magPx: Math.abs(s),
                ux: u.ux,
                uy: u.uy,
                pxPerM: u.pxPerM,
                distDeltaM: ev.displayDistM - prev.displayDistM,
                absDx: dx,
                absDy: dy,
                relSPx: relS,
                source: relS != null ? "relative" : "absolute",
              });
            }
            prevS = s;
          } else {
            prevS = null;
          }
          prevDx = dx;
          prevDy = dy;
        }
      }
      prev = ev;
    }
  }

  distBacktracks.sort((a, b) => b.backM - a.backM);
  const maxDistBacktrackM = distBacktracks[0]?.backM ?? 0;
  const maxAlongReversePx = alongReverses.reduce((m, h) => Math.max(m, h.magPx), 0);
  const pxPerMMedian = median(pxPerMAll);
  const bandPxEqualsM =
    pxPerMMedian != null && pxPerMMedian > 0 ? BAND_LABEL_PX / pxPerMMedian : null;
  const subThresholdAlongReverseCount = alongReverses.filter(
    (h) => h.magPx < BAND_LABEL_PX,
  ).length;
  const alongPeakToPeakPx = Number.isFinite(sMin) && Number.isFinite(sMax) ? sMax - sMin : 0;

  let dominantSignal: DominantSignal = "quiet";
  if (alongReverses.length > 0 && distBacktracks.length > 0) dominantSignal = "both";
  else if (alongReverses.length > 0) dominantSignal = "along-track-screen";
  else if (distBacktracks.length > 0) dominantSignal = "distance";
  else if (screenReverseCount > 0) dominantSignal = "screen-2d-unprojected";

  const reason = [
    `진행축=displayDistM 창 회귀. û 는 X/Y 고정이 아니다.`,
    `거리 역행 ${distBacktracks.length} 회 최대 ${maxDistBacktrackM.toFixed(3)} m (임계로 버리지 않음).`,
    `진행축 부호 반전 ${alongReverses.length} 회 최대 ${maxAlongReversePx.toFixed(1)} px, 음수 투영 ${alongNegativeCount} 스텝, peak-to-peak ${alongPeakToPeakPx.toFixed(1)} px.`,
    `2D 반전 ${screenReverseCount} 회 최대 ${maxScreenReversePx.toFixed(1)} px.`,
    `밴드 ${BAND_LABEL_PX}px 미만 진행축 반전 ${subThresholdAlongReverseCount} 회.`,
    pxPerMMedian != null
      ? `화면 스케일 중앙값 ${pxPerMMedian.toFixed(2)} px/m → ${BAND_LABEL_PX}px ≈ ${bandPxEqualsM?.toFixed(3)} m (라벨일 뿐 합격선 아님).`
      : `화면 스케일 미산출.`,
    hasLocalScreen ? `로컬 화면 좌표 있음.` : `로컬 화면 좌표 없음(기존 로그는 절대 좌표 투영).`,
  ].join(" ");

  return {
    axis: dominantSignal,
    dominantSignal,
    alongTrackMethod: "forward-regression-window",
    maxDistBacktrackM,
    distBacktrackCount: distBacktracks.length,
    distBacktracks,
    maxScreenReversePx,
    screenReverseCount,
    alongReverseCount: alongReverses.length,
    maxAlongReversePx,
    alongPeakToPeakPx,
    alongNegativeCount,
    alongReverses,
    subThresholdAlongReverseCount,
    pxPerMMedian,
    bandLabelPx: BAND_LABEL_PX,
    bandPxEqualsM,
    startGapDistM,
    startGapScreenPx,
    hasLocalScreen,
    displayFrames: display.length,
    ingestEvents,
    peerUids,
    reason,
  };
}
