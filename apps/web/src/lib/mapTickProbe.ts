/**
 * U-2 DEV — 주행 중 맵 틱 계측. 센티넬(Infinity·축퇴 0)은 기록하지 않고 버린다.
 * 수정 전/후 같은 시계(performance.now)로 이벤트·경로 A/B·rAF 를 남긴다.
 */

export type MapTickLongFrame = { t: number; dt: number };
export type MapTickTimedMs = { t: number; ms: number };

export type MapTickSnapshot = {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  sentinelDropped: number;
  events: {
    move: number;
    zoom: number;
    moveend: number;
    zoomend: number;
    idle: number;
    perSec: Record<string, number>;
  };
  pathA: { enter: number; emit: number; enterAt: number[]; emitAt: number[] };
  pathB: { run: number; runAt: number[] };
  syncActivityMs: MapTickTimedMs[];
  moveToTopMs: MapTickTimedMs[];
  raf: {
    samples: number;
    p50: number | null;
    p95: number | null;
    over16_7: number;
    over16_7Rate: number;
    longFrames: MapTickLongFrame[];
  };
  headingFromMove: { hit: number; miss: number; maxStepM: number };
  followJumpTo: number;
};

type Probe = {
  active: boolean;
  startedAt: number;
  sentinelDropped: number;
  events: Record<"move" | "zoom" | "moveend" | "zoomend" | "idle", number>;
  pathAEnter: number;
  pathAEmit: number;
  pathAEnterAt: number[];
  pathAEmitAt: number[];
  pathBRun: number;
  pathBRunAt: number[];
  syncActivityMs: MapTickTimedMs[];
  moveToTopMs: MapTickTimedMs[];
  rafGaps: number[];
  longFrames: MapTickLongFrame[];
  lastRaf: number | null;
  headingHit: number;
  headingMiss: number;
  maxStepM: number;
  followJumpTo: number;
};

const EMPTY_EVENTS = { move: 0, zoom: 0, moveend: 0, zoomend: 0, idle: 0 };

let probe: Probe | null = null;
let followJumpDepth = 0;

function now(): number {
  return performance.now();
}

function finite(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n) < 1e12;
}

function dropSentinel(): void {
  if (probe) probe.sentinelDropped += 1;
}

export function isFollowCameraJump(): boolean {
  return followJumpDepth > 0;
}

export function beginFollowCameraJump(): void {
  followJumpDepth += 1;
}

export function endFollowCameraJump(): void {
  followJumpDepth = Math.max(0, followJumpDepth - 1);
}

export function startMapTickProbe(): void {
  if (!import.meta.env.DEV) return;
  probe = {
    active: true,
    startedAt: now(),
    sentinelDropped: 0,
    events: { ...EMPTY_EVENTS },
    pathAEnter: 0,
    pathAEmit: 0,
    pathAEnterAt: [],
    pathAEmitAt: [],
    pathBRun: 0,
    pathBRunAt: [],
    syncActivityMs: [],
    moveToTopMs: [],
    rafGaps: [],
    longFrames: [],
    lastRaf: null,
    headingHit: 0,
    headingMiss: 0,
    maxStepM: 0,
    followJumpTo: 0,
  };
  publish(null);
}

export function stopMapTickProbe(): MapTickSnapshot | null {
  if (!import.meta.env.DEV || !probe) return null;
  const snap = snapshotMapTickProbe();
  probe.active = false;
  publish(snap);
  return snap;
}

export function snapshotMapTickProbe(): MapTickSnapshot | null {
  if (!probe) return null;
  const endedAt = now();
  const durationMs = endedAt - probe.startedAt;
  const durSec = Math.max(0.001, durationMs / 1000);
  const sorted = [...probe.rafGaps].sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const over = probe.longFrames.length;
  return {
    startedAt: probe.startedAt,
    endedAt,
    durationMs,
    sentinelDropped: probe.sentinelDropped,
    events: {
      move: probe.events.move,
      zoom: probe.events.zoom,
      moveend: probe.events.moveend,
      zoomend: probe.events.zoomend,
      idle: probe.events.idle,
      perSec: {
        move: probe.events.move / durSec,
        zoom: probe.events.zoom / durSec,
        moveend: probe.events.moveend / durSec,
        zoomend: probe.events.zoomend / durSec,
        idle: probe.events.idle / durSec,
      },
    },
    pathA: {
      enter: probe.pathAEnter,
      emit: probe.pathAEmit,
      enterAt: probe.pathAEnterAt,
      emitAt: probe.pathAEmitAt,
    },
    pathB: { run: probe.pathBRun, runAt: probe.pathBRunAt },
    syncActivityMs: probe.syncActivityMs,
    moveToTopMs: probe.moveToTopMs,
    raf: {
      samples: sorted.length,
      p50,
      p95,
      over16_7: over,
      over16_7Rate: sorted.length ? over / sorted.length : 0,
      longFrames: probe.longFrames,
    },
    headingFromMove: {
      hit: probe.headingHit,
      miss: probe.headingMiss,
      maxStepM: probe.maxStepM,
    },
    followJumpTo: probe.followJumpTo,
  };
}

export function noteMapEvent(kind: keyof typeof EMPTY_EVENTS): void {
  if (!probe?.active) return;
  probe.events[kind] += 1;
}

export function noteLodScheduleEnter(): void {
  if (!probe?.active) return;
  const t = now();
  if (!finite(t)) {
    dropSentinel();
    return;
  }
  probe.pathAEnter += 1;
  probe.pathAEnterAt.push(t);
}

export function noteLodScheduleEmit(): void {
  if (!probe?.active) return;
  const t = now();
  if (!finite(t)) {
    dropSentinel();
    return;
  }
  probe.pathAEmit += 1;
  probe.pathAEmitAt.push(t);
}

export function notePathBInterval(): void {
  if (!probe?.active) return;
  const t = now();
  if (!finite(t)) {
    dropSentinel();
    return;
  }
  probe.pathBRun += 1;
  probe.pathBRunAt.push(t);
}

export function noteSyncActivityMs(ms: number): void {
  if (!probe?.active) return;
  const t = now();
  if (!finite(t) || !finite(ms) || ms < 0) {
    dropSentinel();
    return;
  }
  probe.syncActivityMs.push({ t, ms });
}

export function noteMoveToTopMs(ms: number): void {
  if (!probe?.active) return;
  const t = now();
  if (!finite(t) || !finite(ms) || ms < 0) {
    dropSentinel();
    return;
  }
  probe.moveToTopMs.push({ t, ms });
}

export function noteRafFrame(frameNow: number): void {
  if (!probe?.active) return;
  if (!finite(frameNow)) {
    dropSentinel();
    return;
  }
  if (probe.lastRaf != null) {
    const dt = frameNow - probe.lastRaf;
    if (!finite(dt) || dt <= 0 || dt > 5_000) {
      dropSentinel();
    } else {
      probe.rafGaps.push(dt);
      if (dt > 16.7) probe.longFrames.push({ t: frameNow, dt });
    }
  }
  probe.lastRaf = frameNow;
}

export function noteHeadingFromMove(stepM: number, used: boolean): void {
  if (!probe?.active) return;
  if (!finite(stepM) || stepM < 0) {
    dropSentinel();
    return;
  }
  if (used) probe.headingHit += 1;
  else probe.headingMiss += 1;
  if (stepM > probe.maxStepM) probe.maxStepM = stepM;
}

export function noteFollowJumpTo(): void {
  if (!probe?.active) return;
  probe.followJumpTo += 1;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i] ?? null;
}

function publish(snap: MapTickSnapshot | null): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const w = window as Window & {
    __RTW_MAP_TICK_PROBE__?: MapTickSnapshot | null;
    __RTW_MAP_TICK_START__?: () => void;
    __RTW_MAP_TICK_STOP__?: () => MapTickSnapshot | null;
    __RTW_MAP_TICK_SNAP__?: () => MapTickSnapshot | null;
  };
  w.__RTW_MAP_TICK_PROBE__ = snap;
  w.__RTW_MAP_TICK_START__ = startMapTickProbe;
  w.__RTW_MAP_TICK_STOP__ = stopMapTickProbe;
  w.__RTW_MAP_TICK_SNAP__ = snapshotMapTickProbe;
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  publish(null);
}

/** T0 — 표본 0 이 아니고 시각이 유한, 센티넬 0 */
export function assertMapTickT0(snap: MapTickSnapshot): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (snap.sentinelDropped !== 0) reasons.push(`sentinelDropped=${snap.sentinelDropped}`);
  if (snap.raf.samples <= 0) reasons.push("raf.samples=0");
  if (snap.durationMs < 1_000) reasons.push("durationMs<1000");
  const ev = snap.events.move + snap.events.zoom + snap.events.moveend + snap.events.zoomend + snap.events.idle;
  if (ev <= 0) reasons.push("map events=0");
  const times = [
    ...snap.pathA.emitAt,
    ...snap.pathB.runAt,
    ...snap.raf.longFrames.map((f) => f.t),
    ...snap.syncActivityMs.map((s) => s.t),
  ];
  if (times.some((t) => !finite(t))) reasons.push("non-finite timestamp");
  if (snap.raf.p50 != null && !finite(snap.raf.p50)) reasons.push("p50 sentinel");
  return { ok: reasons.length === 0, reasons };
}
