/**
 * DEV — peer ingest / frame 짧은 in-memory 진단 (네트워크 쓰기·패킷마다 콘솔 스팸 없음).
 *
 * 단일 호출 수집:
 *   const r = await window.__rtwPeerIngestDiag.capture(20)
 *   window.__rtwPeerIngestDiag.download()   // 또는 r / .export()
 *
 * 레거시: reset() → 관측 → export() / read()
 *
 * 없는 것(이번 도구에 없음): Firebase 원본 콜백 시각 · 송신 큐 시각 · clock offset · camera.
 */
import {
  peekFrameDisplayRenderTimeMs,
  peekSelfDisplayRenderTimeMs,
} from "../peerMotion/commonDisplayClock";
import { sampleSelfDisplayDistM } from "../peerMotion/selfDisplayBuffer";

export type PeerIngestDiagSample = {
  atMs: number;
  uid: string;
  publicationId: string;
  source: "rtdb" | "fs";
  tSrvQuality: "capture" | "estimated" | "none";
  tSrv: number | null;
  distM: number;
  speedMps: number;
  serverTimeline: boolean;
  frameRenderMs: number | null;
  selfRawDistM: number | null;
};

export type PeerFrameDiagSample = {
  atMs: number;
  uid: string;
  peerRawDistM: number;
  selfRawDistM: number | null;
  relativeGapM: number | null;
  jumpM: number;
  dtMs: number | null;
  frameRenderMs: number | null;
  source: "rtdb" | "fs" | null;
  tSrvQuality: "capture" | "estimated" | "none" | null;
  serverTimeline: boolean;
};

/** 테스트·문서용 — capture 창 경계 */
export const PEER_INGEST_DIAG_CAPTURE = {
  defaultSec: 20,
  maxSec: 20,
  minSec: 1,
  /** 20s@~25Hz 상한 — RING_MAX(240) 덮어쓰기 방지 */
  frameCap: 500,
  ingestCap: 200,
  /** 프레임 표본 최소 간격(ms) — 메모리 상한과 함께 사용 */
  minFrameIntervalMs: 40,
  ringMaxLegacy: 240,
} as const;

const RING_MAX = PEER_INGEST_DIAG_CAPTURE.ringMaxLegacy;

const ingestRing: PeerIngestDiagSample[] = [];
const frameRing: PeerFrameDiagSample[] = [];
const lastPeerDistByUid = new Map<string, number>();
/** 직전 실제 프레임 시각 — dtMs 필드용(60fps면 ~16ms) */
const lastFrameAtByUid = new Map<string, number>();
/**
 * 직전 capture 저장 표본 시각 — 40ms 간격 판단용.
 * 실제 프레임 dt 와 분리: 60fps에서 dtMs가 40 미만이어도 약 25Hz 로 남긴다.
 */
const lastCapturedFrameAtByUid = new Map<string, number>();
const maxJumpByUid = new Map<string, number>();
const lastIngestMetaByUid = new Map<
  string,
  { source: "rtdb" | "fs"; tSrvQuality: "capture" | "estimated" | "none" }
>();

let fsPickCount = 0;
let estimatedCount = 0;
let captureCount = 0;

type CaptureMeta = {
  active: boolean;
  status: "idle" | "running" | "done" | "empty";
  durationSec: number | null;
  startedAtMs: number | null;
  endsAtMs: number | null;
  remainingMs: number | null;
  droppedFrameForCap: number;
  droppedIngestForCap: number;
  emptyReason: string | null;
  /** download/export 가 완료 capture 를 쓰는지 · live ring 인지 */
  payloadSource?: "live-ring" | "capture-active" | "last-completed" | "empty";
};

type DiagCounters = {
  fsPickCount: number;
  estimatedCount: number;
  captureCount: number;
  maxJumpByUid: Record<string, number>;
};

type DiagExport = {
  generatedAt: string;
  ingestCount: number;
  frameCount: number;
  fsPickCount: number;
  estimatedCount: number;
  captureCount: number;
  maxJumpByUid: Record<string, number>;
  /** 완료 capture export 시 현재 live 카운터(프레임 구간과 섞지 않기 위한 별도 필드) */
  liveCounters?: DiagCounters;
  lastIngestByUid: Record<string, PeerIngestDiagSample>;
  ingest: PeerIngestDiagSample[];
  frames: PeerFrameDiagSample[];
  capture: CaptureMeta;
  missing: string[];
};

type CaptureState = {
  startedAtMs: number;
  endsAtMs: number;
  durationSec: number;
  timer: ReturnType<typeof setTimeout> | null;
  resolve: ((payload: DiagExport) => void) | null;
  ingest: PeerIngestDiagSample[];
  frames: PeerFrameDiagSample[];
  droppedFrameForCap: number;
  droppedIngestForCap: number;
  status: "running" | "done" | "empty";
};

let captureState: CaptureState | null = null;
/** 완료된 capture(20) 전체 — live legacy ring(240) 덮어쓰기와 분리 */
let lastCompletedCapture: DiagExport | null = null;

export function clampCaptureSec(sec: number): number {
  if (!Number.isFinite(sec)) return PEER_INGEST_DIAG_CAPTURE.defaultSec;
  return Math.max(
    PEER_INGEST_DIAG_CAPTURE.minSec,
    Math.min(PEER_INGEST_DIAG_CAPTURE.maxSec, Math.floor(sec)),
  );
}

function clearCaptureTimer(): void {
  if (captureState?.timer != null) {
    clearTimeout(captureState.timer);
    captureState.timer = null;
  }
}

function snapshotMaxJump(): Record<string, number> {
  const maxJump: Record<string, number> = {};
  for (const [uid, j] of maxJumpByUid) maxJump[uid] = Math.round(j * 1000) / 1000;
  return maxJump;
}

function buildExportFrom(
  ingestSrc: PeerIngestDiagSample[],
  frameSrc: PeerFrameDiagSample[],
  captureMeta: CaptureMeta,
): DiagExport {
  const lastIngestByUid: Record<string, PeerIngestDiagSample> = {};
  for (const s of ingestSrc) {
    lastIngestByUid[s.uid] = s;
  }
  return {
    generatedAt: new Date().toISOString(),
    ingestCount: ingestSrc.length,
    frameCount: frameSrc.length,
    fsPickCount,
    estimatedCount,
    captureCount,
    maxJumpByUid: snapshotMaxJump(),
    lastIngestByUid,
    ingest: ingestSrc.slice(),
    frames: frameSrc.slice(),
    capture: captureMeta,
    missing: [
      "firebase-original-callback-time",
      "publish-queue-time",
      "clock-offset-ms",
      "camera-follow-state",
    ],
  };
}

function finishCapture(reason: "timer" | "manual"): DiagExport {
  clearCaptureTimer();
  const st = captureState;
  if (!st) {
    return exportDiag({ emptyReason: "no-capture" });
  }
  const empty = st.ingest.length === 0 && st.frames.length === 0;
  st.status = empty ? "empty" : "done";
  const emptyReason = empty
    ? reason === "timer"
      ? "capture-finished-empty"
      : "capture-stopped-empty"
    : null;
  // live ring 은 짧은 수동 export 용으로만 갱신(240 상한). 완료 payload 는 별도 보존.
  ingestRing.length = 0;
  frameRing.length = 0;
  for (const s of st.ingest) pushRing(ingestRing, s);
  for (const s of st.frames) pushRing(frameRing, s, PEER_INGEST_DIAG_CAPTURE.frameCap);
  const payload = buildExportFrom(st.ingest, st.frames, {
    active: false,
    status: st.status,
    durationSec: st.durationSec,
    startedAtMs: st.startedAtMs,
    endsAtMs: st.endsAtMs,
    remainingMs: null,
    droppedFrameForCap: st.droppedFrameForCap,
    droppedIngestForCap: st.droppedIngestForCap,
    emptyReason,
    payloadSource: empty ? "empty" : "last-completed",
  });
  if (!empty) {
    lastCompletedCapture = payload;
  }
  const resolve = st.resolve;
  st.resolve = null;
  captureState = null;
  resolve?.(payload);
  return payload;
}

function reset(nowMs = Date.now()): void {
  void nowMs;
  clearCaptureTimer();
  if (captureState?.resolve) {
    const st = captureState;
    captureState.resolve(
      buildExportFrom(st.ingest, st.frames, {
        active: false,
        status: "empty",
        durationSec: st.durationSec,
        startedAtMs: st.startedAtMs,
        endsAtMs: st.endsAtMs,
        remainingMs: null,
        droppedFrameForCap: st.droppedFrameForCap,
        droppedIngestForCap: st.droppedIngestForCap,
        emptyReason: "reset-during-capture",
        payloadSource: "empty",
      }),
    );
  }
  captureState = null;
  lastCompletedCapture = null;
  ingestRing.length = 0;
  frameRing.length = 0;
  lastPeerDistByUid.clear();
  lastFrameAtByUid.clear();
  lastCapturedFrameAtByUid.clear();
  maxJumpByUid.clear();
  lastIngestMetaByUid.clear();
  fsPickCount = 0;
  estimatedCount = 0;
  captureCount = 0;
}

function pushRing<T>(ring: T[], sample: T, max: number = RING_MAX): void {
  ring.push(sample);
  if (ring.length > max) ring.splice(0, ring.length - max);
}

function pushCaptureCapped<T>(
  ring: T[],
  sample: T,
  cap: number,
  onDrop: () => void,
): void {
  if (ring.length >= cap) {
    onDrop();
    ring.shift();
  }
  ring.push(sample);
}

/** sync 경로에서 호출 — DEV 전용. */
export function notePeerIngestDiag(sample: {
  atMs: number;
  uid: string;
  publicationId: string;
  source: "rtdb" | "fs";
  tSrvQuality: "capture" | "estimated" | "none";
  tSrv: number | null;
  distM: number;
  speedMps: number;
  serverTimeline: boolean;
}): void {
  if (!import.meta.env.DEV) return;
  install();

  if (sample.source === "fs") fsPickCount += 1;
  if (sample.tSrvQuality === "estimated") estimatedCount += 1;
  if (sample.tSrvQuality === "capture") captureCount += 1;
  lastIngestMetaByUid.set(sample.uid, {
    source: sample.source,
    tSrvQuality: sample.tSrvQuality,
  });

  const frameRenderMs = peekFrameDisplayRenderTimeMs();
  const selfRt = peekSelfDisplayRenderTimeMs();
  const selfRawDistM =
    selfRt != null ? sampleSelfDisplayDistM(selfRt) : null;

  const full: PeerIngestDiagSample = {
    ...sample,
    frameRenderMs,
    selfRawDistM,
  };

  pushRing(ingestRing, full);

  const cap = captureState;
  if (cap && sample.atMs >= cap.startedAtMs && sample.atMs <= cap.endsAtMs) {
    pushCaptureCapped(
      cap.ingest,
      full,
      PEER_INGEST_DIAG_CAPTURE.ingestCap,
      () => {
        cap.droppedIngestForCap += 1;
      },
    );
  }
}

/** Registry.step 에서 raw display 점프 추적 — DEV 전용. */
export function notePeerFrameDiag(sample: {
  atMs: number;
  uid: string;
  peerRawDistM: number;
  serverTimeline: boolean;
}): void {
  if (!import.meta.env.DEV) return;
  install();

  const prev = lastPeerDistByUid.get(sample.uid);
  const jumpM = prev != null ? Math.abs(sample.peerRawDistM - prev) : 0;
  lastPeerDistByUid.set(sample.uid, sample.peerRawDistM);
  const prevMax = maxJumpByUid.get(sample.uid) ?? 0;
  if (jumpM > prevMax) maxJumpByUid.set(sample.uid, jumpM);

  const prevAt = lastFrameAtByUid.get(sample.uid);
  const dtMs = prevAt != null ? sample.atMs - prevAt : null;
  lastFrameAtByUid.set(sample.uid, sample.atMs);

  const frameRenderMs = peekFrameDisplayRenderTimeMs();
  const selfRt = peekSelfDisplayRenderTimeMs();
  const selfRawDistM =
    selfRt != null ? sampleSelfDisplayDistM(selfRt) : null;
  const relativeGapM =
    selfRawDistM != null && Number.isFinite(selfRawDistM)
      ? sample.peerRawDistM - selfRawDistM
      : null;
  const meta = lastIngestMetaByUid.get(sample.uid) ?? null;

  const full: PeerFrameDiagSample = {
    atMs: sample.atMs,
    uid: sample.uid,
    peerRawDistM: sample.peerRawDistM,
    selfRawDistM,
    relativeGapM,
    jumpM,
    dtMs,
    frameRenderMs,
    source: meta?.source ?? null,
    tSrvQuality: meta?.tSrvQuality ?? null,
    serverTimeline: sample.serverTimeline,
  };

  // 레거시 ring — 덮어쓰기 허용(짧은 수동 export 용)
  pushRing(frameRing, full);

  const cap = captureState;
  if (!cap || sample.atMs < cap.startedAtMs || sample.atMs > cap.endsAtMs) return;
  // 40ms 간격은 직전 *capture 저장* 시각 기준. dtMs(실제 프레임)는 필드에만 남긴다.
  const lastCapAt = lastCapturedFrameAtByUid.get(sample.uid);
  if (
    lastCapAt != null &&
    sample.atMs - lastCapAt < PEER_INGEST_DIAG_CAPTURE.minFrameIntervalMs
  ) {
    return;
  }
  pushCaptureCapped(
    cap.frames,
    full,
    PEER_INGEST_DIAG_CAPTURE.frameCap,
    () => {
      cap.droppedFrameForCap += 1;
    },
  );
  lastCapturedFrameAtByUid.set(sample.uid, sample.atMs);
}

function exportDiag(opts?: {
  captureOnly?: boolean;
  /** true 면 완료 capture 무시하고 live ring 만 (시험용) */
  liveRingOnly?: boolean;
  emptyReason?: string;
}): DiagExport {
  const now = Date.now();
  const active = captureState?.status === "running";

  // 수집 중 — 진행 중 버퍼
  if (opts?.captureOnly === true && captureState != null) {
    return buildExportFrom(captureState.ingest, captureState.frames, {
      active: true,
      status: captureState.status,
      durationSec: captureState.durationSec,
      startedAtMs: captureState.startedAtMs,
      endsAtMs: captureState.endsAtMs,
      remainingMs: Math.max(0, captureState.endsAtMs - now),
      droppedFrameForCap: captureState.droppedFrameForCap,
      droppedIngestForCap: captureState.droppedIngestForCap,
      emptyReason: opts?.emptyReason ?? null,
      payloadSource: "capture-active",
    });
  }

  // 완료 capture 우선 — live ring 이 이후 수백로 줄어도 전체 창 유지.
  // 카운터/maxJump 는 저장 당시 값 유지(live 로 덮어쓰면 다른 시간 구간이 섞임).
  if (
    !opts?.liveRingOnly &&
    !active &&
    lastCompletedCapture &&
    (lastCompletedCapture.ingestCount > 0 || lastCompletedCapture.frameCount > 0)
  ) {
    return {
      ...lastCompletedCapture,
      generatedAt: new Date().toISOString(),
      liveCounters: {
        fsPickCount,
        estimatedCount,
        captureCount,
        maxJumpByUid: snapshotMaxJump(),
      },
      capture: {
        ...lastCompletedCapture.capture,
        active: false,
        payloadSource: "last-completed",
        emptyReason: opts?.emptyReason ?? lastCompletedCapture.capture.emptyReason,
      },
    };
  }

  let status: CaptureMeta["status"] = "idle";
  if (captureState) status = captureState.status;
  else if (opts?.emptyReason?.includes("empty")) status = "empty";
  else if (lastCompletedCapture?.capture.status === "done") status = "done";

  return buildExportFrom(ingestRing, frameRing, {
    active: !!active,
    status,
    durationSec: captureState?.durationSec ?? lastCompletedCapture?.capture.durationSec ?? null,
    startedAtMs:
      captureState?.startedAtMs ?? lastCompletedCapture?.capture.startedAtMs ?? null,
    endsAtMs: captureState?.endsAtMs ?? lastCompletedCapture?.capture.endsAtMs ?? null,
    remainingMs: active ? Math.max(0, captureState!.endsAtMs - now) : null,
    droppedFrameForCap:
      captureState?.droppedFrameForCap ??
      lastCompletedCapture?.capture.droppedFrameForCap ??
      0,
    droppedIngestForCap:
      captureState?.droppedIngestForCap ??
      lastCompletedCapture?.capture.droppedIngestForCap ??
      0,
    emptyReason: opts?.emptyReason ?? null,
    payloadSource:
      ingestRing.length === 0 && frameRing.length === 0 ? "empty" : "live-ring",
  });
}

function readSummary(): {
  ingestCount: number;
  frameCount: number;
  fsPickCount: number;
  estimatedCount: number;
  captureCount: number;
  maxJumpByUid: Record<string, number>;
  lastIngestByUid: Record<string, PeerIngestDiagSample>;
  capture: CaptureMeta;
  missing: string[];
} {
  const full = exportDiag();
  return {
    ingestCount: full.ingestCount,
    frameCount: full.frameCount,
    fsPickCount: full.fsPickCount,
    estimatedCount: full.estimatedCount,
    captureCount: full.captureCount,
    maxJumpByUid: full.maxJumpByUid,
    lastIngestByUid: full.lastIngestByUid,
    capture: full.capture,
    missing: full.missing,
  };
}

function capture(sec = PEER_INGEST_DIAG_CAPTURE.defaultSec): Promise<DiagExport> {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return Promise.resolve(
      exportDiag({ emptyReason: "not-dev-or-no-window" }),
    );
  }
  install();
  // 반복 호출 — 이전 timer 정리 후 새 창
  if (captureState) {
    finishCapture("manual");
  }
  const durationSec = clampCaptureSec(sec);
  const startedAtMs = Date.now();
  const endsAtMs = startedAtMs + durationSec * 1000;

  return new Promise((resolve) => {
    // capture 창마다 40ms 간격 추적 초기화(실제 프레임 dt 맵은 유지)
    lastCapturedFrameAtByUid.clear();
    captureState = {
      startedAtMs,
      endsAtMs,
      durationSec,
      timer: null,
      resolve,
      ingest: [],
      frames: [],
      droppedFrameForCap: 0,
      droppedIngestForCap: 0,
      status: "running",
    };
    captureState.timer = setTimeout(() => {
      finishCapture("timer");
    }, durationSec * 1000);
  });
}

function download(): {
  ok: boolean;
  reason?: string;
  bytes?: number;
  payloadSource?: CaptureMeta["payloadSource"];
} {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { ok: false, reason: "no-window" };
  }
  const payload = exportDiag(
    captureState?.status === "running" ? { captureOnly: true } : undefined,
  );
  if (payload.ingestCount === 0 && payload.frameCount === 0) {
    return {
      ok: false,
      reason:
        payload.capture.emptyReason ??
        (captureState?.status === "running"
          ? "capture-still-empty"
          : "no-samples — await capture(20) or reset+observe first"),
      payloadSource: payload.capture.payloadSource,
    };
  }
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rtw-peer-ingest-diag-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return {
    ok: true,
    bytes: text.length,
    payloadSource: payload.capture.payloadSource,
  };
}

function status(): CaptureMeta & {
  hasSamples: boolean;
  hasCompletedCapture: boolean;
  hint: string;
} {
  const full = exportDiag(
    captureState?.status === "running" ? { captureOnly: true } : undefined,
  );
  const hasSamples = full.ingestCount > 0 || full.frameCount > 0;
  const hasCompletedCapture =
    lastCompletedCapture != null &&
    (lastCompletedCapture.ingestCount > 0 || lastCompletedCapture.frameCount > 0);
  let hint: string;
  if (full.capture.active) {
    hint = `capturing ${full.capture.remainingMs}ms left — then download() or use returned Promise`;
  } else if (hasCompletedCapture) {
    hint =
      "completed capture ready — download() returns full lastCompletedCapture (not live ring)";
  } else if (!hasSamples) {
    hint =
      "no samples — capture(20) during dual ride, or API missing after reload (DEV only)";
  } else {
    hint = "ready — download() or export() (live ring)";
  }
  return { ...full.capture, hasSamples, hasCompletedCapture, hint };
}

const api = {
  reset,
  export: exportDiag,
  read: readSummary,
  capture,
  download,
  status,
};

let installed = false;

function install(): void {
  if (installed || !import.meta.env.DEV || typeof window === "undefined") return;
  installed = true;
  (
    window as Window & {
      __rtwPeerIngestDiag?: typeof api;
    }
  ).__rtwPeerIngestDiag = api;
}

export function installPeerIngestDiag(): void {
  if (!import.meta.env.DEV) return;
  install();
}

/** 시험·SSR — window API 없이 동일 상태로 초기화 */
export function resetPeerIngestDiagForTests(nowMs = Date.now()): void {
  reset(nowMs);
}
