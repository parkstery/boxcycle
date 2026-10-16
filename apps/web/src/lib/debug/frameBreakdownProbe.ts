/**
 * 프레임 시간 분해(`?perflab=1`).
 *
 * 쿼리가 없으면 모든 훅이 바로 반환하고 `performance.now()` 를 부르지 않는다.
 * 값은 패널에서 복사할 뿐 서버로 보내지 않는다.
 *
 * 지도 CPU 는 `map._render` 를 perflab 일 때만 감싼다. 래핑이 실패하면
 * `render`·`idle` 횟수만 남기고 앱 렌더는 그대로 둔다.
 * GPU 는 `EXT_disjoint_timer_query_webgl2` 가 있을 때만, 4프레임에 한 번.
 */

import { isPerfLabEnabled, percentileNearestRank, PERF_LAB_WINDOW_MS, readPerfLabFrameStats } from "./perfLab";
import { readRiderRenderMsOverlapping } from "./riderRenderCostProbe";

export const TICK_PHASES = [
  "self",
  "camera",
  "peer",
  "pacer",
  "markers",
  "spec",
  "sync",
  "nametag",
] as const;

export type TickPhase = (typeof TICK_PHASES)[number];

const GPU_SAMPLE_STRIDE = 4;

export type DurationStats = {
  samples: number;
  meanMs: number | null;
  p95Ms: number | null;
};

export type LoafStyleSource = "property" | "forced" | "derived" | "none";

export type LoafScriptLike = {
  sourceURL?: string;
  sourceFunctionName?: string;
  duration?: number;
  forcedStyleAndLayoutDuration?: number;
};

export type LoafEntryLike = {
  startTime: number;
  duration?: number;
  blockingDuration?: number;
  styleAndLayoutDuration?: number;
  styleAndLayoutStart?: number;
  scripts?: LoafScriptLike[];
};

export type FrameBudget = {
  frameMeanMs: number | null;
  tickMs: number;
  mapMs: number;
  reactMs: number;
  otherLoafMs: number;
  jsMs: number;
  waitMs: number | null;
};

export type FrameBreakdownTick = {
  mark(phase: TickPhase): void;
  end(): void;
};

type TickSample = {
  t: number;
  total: number;
  other: number;
  phases: Record<TickPhase, number>;
};

type MapSample = { t: number; mapMs: number; riderMs: number };

type ReactSample = { t: number; ms: number };

type LoafScriptRow = { key: string; ms: number };

type LoafSample = {
  t: number;
  blockingMs: number;
  styleMs: number;
  styleSource: LoafStyleSource;
  scripts: LoafScriptRow[];
};

type GpuSample = { t: number; ms: number };

export type MapProbeMethod = "unattached" | "map._render" | "events-only";

export type GpuSupport = "unprobed" | "supported" | "unsupported";

type ProbeMap = {
  _render?: (paintStartTimeStamp: number) => void;
  on?: (type: string, listener: () => void) => unknown;
  off?: (type: string, listener: () => void) => unknown;
  getCanvas?: () => HTMLCanvasElement;
  painter?: { context?: { gl?: WebGL2RenderingContext | null } | null } | null;
};

type TimerExt = {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
};

type PendingGpu = {
  gl: WebGL2RenderingContext;
  query: WebGLQuery;
  t: number;
};

const tickSamples: TickSample[] = [];
const mapSamples: MapSample[] = [];
const reactSamples: ReactSample[] = [];
const loafSamples: LoafSample[] = [];
const gpuSamples: GpuSample[] = [];

let mapMethod: MapProbeMethod = "unattached";
let renderEvents = 0;
let idleEvents = 0;
let loafObserver: PerformanceObserver | null = null;
let loafSupported: boolean | null = null;
let gpuSupport: GpuSupport = "unprobed";
let gpuGl: WebGL2RenderingContext | null = null;
let gpuExt: TimerExt | null = null;
let gpuFrameN = 0;
let gpuBeginFailures = 0;
let gpuPending: PendingGpu[] = [];
const mapRestorers: Array<() => void> = [];

const MAP_LIMIT =
  "지도 CPU는 map._render 한 번의 JS다. 커스텀 라이더 레이어와 render 리스너(네임태그 재투영)가 포함된다. exRiderMeanMs 는 그 호출 안의 라이더 레이어 시간을 뺀 값이다. 래핑이 실패하면 method 는 events-only 이고 시간은 없다. GPU 는 EXT_disjoint_timer_query_webgl2 로 4프레임마다 한 번이며, 실패·disjoint 샘플은 버린다.";

const SUMMARY_NOTE =
  "js = 틱 평균 + 지도 평균 + 프레임당 React + 기타 LoAF. 기타 LoAF = max(0, LoAF blocking/프레임 − 틱 − 지도 − React). 대기 = max(0, 프레임 간격 평균 − js). React 는 틱·지도 안에 겹칠 수 있어 js 가 간격을 넘으면 대기는 0 이다.";

function zeroPhases(): Record<TickPhase, number> {
  return {
    self: 0,
    camera: 0,
    peer: 0,
    pacer: 0,
    markers: 0,
    spec: 0,
    sync: 0,
    nametag: 0,
  };
}

function emptyDuration(): DurationStats {
  return { samples: 0, meanMs: null, p95Ms: null };
}

export function summarizeDurations(values: readonly number[]): DurationStats {
  const xs: number[] = [];
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) xs.push(value);
  }
  if (xs.length === 0) return emptyDuration();
  let sum = 0;
  for (const value of xs) sum += value;
  const sorted = xs.slice().sort((a, b) => a - b);
  return {
    samples: xs.length,
    meanMs: sum / xs.length,
    p95Ms: percentileNearestRank(sorted, 95),
  };
}

export function topByMs(
  rows: readonly { key: string; ms: number }[],
  n: number,
): { source: string; ms: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (typeof row.ms !== "number" || !Number.isFinite(row.ms) || row.ms < 0) continue;
    const key = row.key || "(unknown)";
    totals.set(key, (totals.get(key) ?? 0) + row.ms);
  }
  const limit = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return [...totals.entries()]
    .map(([source, ms]) => ({ source, ms }))
    .sort((a, b) => b.ms - a.ms || (a.source < b.source ? -1 : a.source > b.source ? 1 : 0))
    .slice(0, limit);
}

export function loafScriptLabel(script: LoafScriptLike): string {
  const raw = script.sourceURL ?? "";
  const path = raw.split("?")[0] ?? "";
  const file = path.split("/").pop() || path || "(no-url)";
  const fn = script.sourceFunctionName?.trim() || "";
  return fn ? `${fn} @ ${file}` : file;
}

export function loafStyleAndLayoutMs(entry: LoafEntryLike): { ms: number; source: LoafStyleSource } {
  if (typeof entry.styleAndLayoutDuration === "number" && Number.isFinite(entry.styleAndLayoutDuration)) {
    return { ms: Math.max(0, entry.styleAndLayoutDuration), source: "property" };
  }
  let forced = 0;
  let anyForced = false;
  for (const script of entry.scripts ?? []) {
    const value = script.forcedStyleAndLayoutDuration;
    if (typeof value === "number" && Number.isFinite(value)) {
      forced += Math.max(0, value);
      anyForced = true;
    }
  }
  if (anyForced) return { ms: forced, source: "forced" };
  if (
    typeof entry.styleAndLayoutStart === "number" &&
    Number.isFinite(entry.styleAndLayoutStart) &&
    typeof entry.duration === "number" &&
    Number.isFinite(entry.duration) &&
    typeof entry.startTime === "number" &&
    Number.isFinite(entry.startTime)
  ) {
    const derived = entry.startTime + entry.duration - entry.styleAndLayoutStart;
    if (derived > 0 && derived <= entry.duration) return { ms: derived, source: "derived" };
  }
  return { ms: 0, source: "none" };
}

/** 지도 프레임 JS 에서 같은 호출의 라이더 레이어 시간을 뺀다. */
export function mapExcludingRiderMs(mapMs: number, riderMs: number): number {
  if (typeof mapMs !== "number" || !Number.isFinite(mapMs) || mapMs < 0) return 0;
  const rider = typeof riderMs === "number" && Number.isFinite(riderMs) && riderMs > 0 ? riderMs : 0;
  return Math.max(0, mapMs - rider);
}

function finiteOrZero(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * 프레임 간격 ≈ JS(틱+지도+React+기타 LoAF) + 대기.
 * 측정이 없는 항은 0 으로 둔다. React 가 틱·지도 안에 있으면 대기가 0 으로 붙을 수 있다.
 */
export function composeFrameBudget(input: {
  frameMeanMs: number | null;
  frameSamples: number;
  tickMeanMs: number | null;
  mapMeanMs: number | null;
  reactSumMs: number;
  loafBlockingMs: number;
}): FrameBudget {
  const frames =
    typeof input.frameSamples === "number" && Number.isFinite(input.frameSamples) && input.frameSamples > 0
      ? input.frameSamples
      : 0;
  const tickMs = finiteOrZero(input.tickMeanMs);
  const mapMs = finiteOrZero(input.mapMeanMs);
  const reactMs =
    frames > 0 && Number.isFinite(input.reactSumMs) && input.reactSumMs > 0 ? input.reactSumMs / frames : 0;
  const blockingPerFrame =
    frames > 0 && Number.isFinite(input.loafBlockingMs) && input.loafBlockingMs > 0
      ? input.loafBlockingMs / frames
      : 0;
  const otherLoafMs = Math.max(0, blockingPerFrame - tickMs - mapMs - reactMs);
  const jsMs = tickMs + mapMs + reactMs + otherLoafMs;
  const frameMeanMs =
    typeof input.frameMeanMs === "number" && Number.isFinite(input.frameMeanMs) ? input.frameMeanMs : null;
  return {
    frameMeanMs,
    tickMs,
    mapMs,
    reactMs,
    otherLoafMs,
    jsMs,
    waitMs: frameMeanMs == null ? null : Math.max(0, frameMeanMs - jsMs),
  };
}

function pruneByTime<T extends { t: number }>(rows: T[], nowMs: number): void {
  const minT = nowMs - PERF_LAB_WINDOW_MS;
  let drop = 0;
  while (drop < rows.length && rows[drop]!.t < minT) drop += 1;
  if (drop > 0) rows.splice(0, drop);
}

function inWindow<T extends { t: number }>(rows: readonly T[], nowMs: number): T[] {
  const minT = nowMs - PERF_LAB_WINDOW_MS;
  const out: T[] = [];
  for (const row of rows) {
    if (row.t >= minT && row.t <= nowMs) out.push(row);
  }
  return out;
}

/** perflab 이 아니면 null. 호출부는 `?.` 로 표시만 한다. */
export function openFrameBreakdownTick(): FrameBreakdownTick | null {
  if (!isPerfLabEnabled()) return null;
  const t0 = performance.now();
  let cursor = t0;
  let closed = false;
  const phases = zeroPhases();
  return {
    mark(phase) {
      if (closed) return;
      const t = performance.now();
      const dt = t - cursor;
      if (dt > 0 && Number.isFinite(dt)) phases[phase] += dt;
      cursor = Number.isFinite(t) ? t : cursor;
    },
    end() {
      if (closed) return;
      closed = true;
      const t = performance.now();
      const totalRaw = t - t0;
      const total = totalRaw > 0 && Number.isFinite(totalRaw) ? totalRaw : 0;
      let marked = 0;
      for (const key of TICK_PHASES) marked += phases[key];
      tickSamples.push({ t, total, other: Math.max(0, total - marked), phases: { ...phases } });
      pruneByTime(tickSamples, t);
    },
  };
}

function noteMapSample(mapMs: number, riderMs: number): void {
  const t = performance.now();
  const map = mapMs > 0 && Number.isFinite(mapMs) ? mapMs : 0;
  const rider = riderMs > 0 && Number.isFinite(riderMs) ? riderMs : 0;
  mapSamples.push({ t, mapMs: map, riderMs: rider });
  pruneByTime(mapSamples, t);
}

function clearGlError(gl: WebGL2RenderingContext): void {
  try {
    gl.getError();
  } catch {
    /* 오류 플래그를 못 지워도 지도 렌더는 계속된다 */
  }
}

function resolveGl(map: ProbeMap): WebGL2RenderingContext | null {
  const internal = map.painter?.context?.gl;
  if (internal && typeof internal.beginQuery === "function") return internal;
  try {
    const canvas = map.getCanvas?.();
    const gl = canvas?.getContext("webgl2");
    if (gl && typeof gl.beginQuery === "function") return gl;
  } catch {
    return null;
  }
  return null;
}

function ensureGpuExt(map: ProbeMap): TimerExt | null {
  if (gpuSupport === "unsupported") return null;
  if (gpuExt && gpuGl) return gpuExt;
  const gl = resolveGl(map);
  if (!gl) return null;
  let ext: TimerExt | null;
  try {
    ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null;
  } catch {
    ext = null;
  }
  if (!ext || typeof ext.TIME_ELAPSED_EXT !== "number") {
    gpuSupport = "unsupported";
    gpuGl = null;
    gpuExt = null;
    return null;
  }
  gpuGl = gl;
  gpuExt = ext;
  gpuSupport = "supported";
  return ext;
}

function pollGpuQueries(): void {
  const gl = gpuGl;
  const ext = gpuExt;
  if (!gl || !ext || gpuPending.length === 0) return;
  let disjoint: boolean;
  try {
    disjoint = Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT));
  } catch {
    disjoint = true;
  }
  if (disjoint) {
    for (const item of gpuPending) {
      try {
        gl.deleteQuery(item.query);
      } catch {
        /* 버린 쿼리 */
      }
    }
    gpuPending = [];
    return;
  }
  const keep: PendingGpu[] = [];
  for (const item of gpuPending) {
    let available: boolean;
    try {
      available = Boolean(gl.getQueryParameter(item.query, gl.QUERY_RESULT_AVAILABLE));
    } catch {
      keep.push(item);
      continue;
    }
    if (!available) {
      keep.push(item);
      continue;
    }
    try {
      const ns = gl.getQueryParameter(item.query, gl.QUERY_RESULT) as number;
      if (typeof ns === "number" && Number.isFinite(ns) && ns >= 0) {
        gpuSamples.push({ t: item.t, ms: ns / 1e6 });
        pruneByTime(gpuSamples, item.t);
      }
    } catch {
      /* 결과 없음 */
    }
    try {
      gl.deleteQuery(item.query);
    } catch {
      /* 삭제 실패는 샘플에 영향 없다 */
    }
  }
  gpuPending = keep;
}

function beginGpuSample(map: ProbeMap, t: number): PendingGpu | null {
  gpuFrameN += 1;
  if (gpuFrameN % GPU_SAMPLE_STRIDE !== 0) return null;
  const ext = ensureGpuExt(map);
  const gl = gpuGl;
  if (!ext || !gl) return null;
  if (gpuPending.length >= 3) return null;
  let query: WebGLQuery | null = null;
  try {
    query = gl.createQuery();
    if (!query) return null;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    const err = gl.getError();
    if (err !== gl.NO_ERROR) {
      clearGlError(gl);
      try {
        gl.deleteQuery(query);
      } catch {
        /* 쿼리를 시작하지 못했다 */
      }
      gpuBeginFailures += 1;
      if (gpuBeginFailures >= 2) {
        gpuSupport = "unsupported";
        gpuExt = null;
        gpuGl = null;
      }
      return null;
    }
  } catch {
    if (query) {
      try {
        gl.deleteQuery(query);
      } catch {
        /* noop */
      }
    }
    gpuSupport = "unsupported";
    gpuExt = null;
    gpuGl = null;
    return null;
  }
  gpuBeginFailures = 0;
  return { gl, query, t };
}

function endGpuSample(slot: PendingGpu | null): void {
  if (!slot || !gpuExt || gpuSupport !== "supported") return;
  try {
    slot.gl.endQuery(gpuExt.TIME_ELAPSED_EXT);
    gpuPending.push(slot);
  } catch {
    try {
      slot.gl.deleteQuery(slot.query);
    } catch {
      /* noop */
    }
  }
}

/**
 * perflab 일 때만 지도 렌더를 감싼다. 끄면 리스너도 래핑도 없이 반환한다.
 * 반환된 함수는 원래 `_render` 로 되돌린다.
 */
export function attachMapRenderProbe(map: object): () => void {
  if (!isPerfLabEnabled()) return () => {};
  const probeMap = map as ProbeMap;
  const onRender = () => {
    renderEvents += 1;
  };
  const onIdle = () => {
    idleEvents += 1;
  };
  try {
    probeMap.on?.("render", onRender);
    probeMap.on?.("idle", onIdle);
  } catch {
    /* 이벤트 구독 실패여도 렌더 래핑은 시도한다 */
  }

  const original = probeMap._render;
  let wrapped: ((this: unknown, paintStartTimeStamp: number) => void) | null = null;
  if (typeof original === "function") {
    wrapped = function (this: unknown, paintStartTimeStamp: number) {
      pollGpuQueries();
      const t0 = performance.now();
      const gpuSlot = beginGpuSample(probeMap, t0);
      try {
        return original.call(this, paintStartTimeStamp);
      } finally {
        const mapMs = performance.now() - t0;
        noteMapSample(mapMs, readRiderRenderMsOverlapping(t0));
        endGpuSample(gpuSlot);
      }
    };
    try {
      probeMap._render = wrapped;
      mapMethod = "map._render";
    } catch {
      wrapped = null;
      mapMethod = "events-only";
    }
  } else {
    mapMethod = "events-only";
  }

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    if (wrapped && probeMap._render === wrapped && typeof original === "function") {
      try {
        probeMap._render = original;
      } catch {
        /* 되돌리기 실패여도 앱 렌더는 이미 돌고 있다 */
      }
    }
    try {
      probeMap.off?.("render", onRender);
      probeMap.off?.("idle", onIdle);
    } catch {
      /* 구독 해제는 실패해도 된다 */
    }
    const index = mapRestorers.indexOf(restore);
    if (index >= 0) mapRestorers.splice(index, 1);
  };
  mapRestorers.push(restore);
  return restore;
}

/** React `<Profiler onRender>` 의 actualDuration. perflab 이 아니면 즉시 반환. */
export function noteReactProfilerCommit(actualDuration: number, commitTime?: number): void {
  if (!isPerfLabEnabled()) return;
  const ms = typeof actualDuration === "number" && Number.isFinite(actualDuration) && actualDuration >= 0
    ? actualDuration
    : 0;
  const t =
    typeof commitTime === "number" && Number.isFinite(commitTime)
      ? commitTime
      : performance.now();
  reactSamples.push({ t, ms });
  pruneByTime(reactSamples, t);
}

/** Long Animation Frames 항목 하나. perflab 이 아니면 즉시 반환. */
export function acceptLoafEntry(entry: LoafEntryLike): void {
  if (!isPerfLabEnabled()) return;
  const t = typeof entry.startTime === "number" && Number.isFinite(entry.startTime) ? entry.startTime : 0;
  const blocking =
    typeof entry.blockingDuration === "number" && Number.isFinite(entry.blockingDuration)
      ? Math.max(0, entry.blockingDuration)
      : 0;
  const style = loafStyleAndLayoutMs(entry);
  const scripts: LoafScriptRow[] = [];
  for (const script of entry.scripts ?? []) {
    const ms = script.duration;
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) continue;
    scripts.push({ key: loafScriptLabel(script), ms });
  }
  loafSamples.push({
    t,
    blockingMs: blocking,
    styleMs: style.ms,
    styleSource: style.source,
    scripts,
  });
  pruneByTime(loafSamples, t);
}

/** perflab 일 때만 Long Animation Frames 관찰을 켠다. */
export function startFrameBreakdownObservers(): void {
  if (!isPerfLabEnabled()) return;
  if (loafObserver || loafSupported === false) return;
  if (typeof PerformanceObserver === "undefined") {
    loafSupported = false;
    return;
  }
  const types = PerformanceObserver.supportedEntryTypes;
  if (Array.isArray(types) && !types.includes("long-animation-frame")) {
    loafSupported = false;
    return;
  }
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) acceptLoafEntry(entry as LoafEntryLike);
    });
    obs.observe({ type: "long-animation-frame", buffered: true } as PerformanceObserverInit);
    loafObserver = obs;
    loafSupported = true;
  } catch {
    loafSupported = false;
    loafObserver = null;
  }
}

export function stopFrameBreakdownObservers(): void {
  if (!loafObserver) return;
  try {
    loafObserver.disconnect();
  } catch {
    /* 이미 끊긴 관찰자 */
  }
  loafObserver = null;
}

function styleSourceOf(rows: readonly LoafSample[]): LoafStyleSource | "mixed" {
  const seen = new Set<LoafStyleSource>();
  for (const row of rows) {
    if (row.styleSource !== "none") seen.add(row.styleSource);
  }
  if (seen.size === 0) return "none";
  if (seen.size === 1) return [...seen][0]!;
  return "mixed";
}

function emptyBreakdown() {
  const phases = {} as Record<TickPhase, DurationStats>;
  for (const key of TICK_PHASES) phases[key] = emptyDuration();
  return {
    windowMs: PERF_LAB_WINDOW_MS,
    tick: { ...emptyDuration(), other: emptyDuration(), phases },
    map: {
      method: "unattached" as MapProbeMethod,
      ...emptyDuration(),
      exRiderMeanMs: null as number | null,
      exRiderP95Ms: null as number | null,
      riderMeanMs: null as number | null,
      renderEvents: 0,
      idleEvents: 0,
      limit: MAP_LIMIT,
    },
    react: {
      commits: 0,
      commitsPerSec: 0,
      commitSumMs: 0,
      commitMeanMs: null as number | null,
    },
    loaf: {
      supported: false,
      count: 0,
      blockingMs: 0,
      styleAndLayoutMs: 0,
      styleAndLayoutSource: "none" as LoafStyleSource | "mixed",
      topScripts: [] as { source: string; ms: number }[],
    },
    gpu: {
      supported: false,
      reason: "unprobed" as GpuSupport,
      samples: 0,
      meanMs: null as number | null,
      p95Ms: null as number | null,
    },
    summary: composeFrameBudget({
      frameMeanMs: null,
      frameSamples: 0,
      tickMeanMs: null,
      mapMeanMs: null,
      reactSumMs: 0,
      loafBlockingMs: 0,
    }),
    note: SUMMARY_NOTE,
  };
}

export type FrameBreakdown = ReturnType<typeof emptyBreakdown>;

/** 최근 10 s. perflab 이 아니면 빈 분해이고 시계를 부르지 않는다. */
export function readFrameBreakdown(nowMs?: number): FrameBreakdown {
  if (!isPerfLabEnabled()) return emptyBreakdown();
  const now = nowMs ?? performance.now();
  const ticks = inWindow(tickSamples, now);
  const maps = inWindow(mapSamples, now);
  const reacts = inWindow(reactSamples, now);
  const loafs = inWindow(loafSamples, now);
  const gpus = inWindow(gpuSamples, now);
  const frame = readPerfLabFrameStats(now);
  const frameMean = frame.fps != null && frame.fps > 0 ? 1000 / frame.fps : null;

  const tickStats = summarizeDurations(ticks.map((row) => row.total));
  const phases = {} as Record<TickPhase, DurationStats>;
  for (const key of TICK_PHASES) phases[key] = summarizeDurations(ticks.map((row) => row.phases[key]));
  const other = summarizeDurations(ticks.map((row) => row.other));
  const mapStats = summarizeDurations(maps.map((row) => row.mapMs));
  const exRider = summarizeDurations(maps.map((row) => mapExcludingRiderMs(row.mapMs, row.riderMs)));
  const rider = summarizeDurations(maps.map((row) => Math.min(row.mapMs, row.riderMs)));
  let reactSum = 0;
  for (const row of reacts) reactSum += row.ms;
  let blocking = 0;
  let styleMs = 0;
  const scriptRows: LoafScriptRow[] = [];
  for (const row of loafs) {
    blocking += row.blockingMs;
    styleMs += row.styleMs;
    scriptRows.push(...row.scripts);
  }
  const gpuStats = summarizeDurations(gpus.map((row) => row.ms));
  const frameSamples = frame.samples > 0 ? frame.samples : tickStats.samples;
  const summary = composeFrameBudget({
    frameMeanMs: frameMean,
    frameSamples,
    tickMeanMs: tickStats.meanMs,
    mapMeanMs: mapStats.meanMs,
    reactSumMs: reactSum,
    loafBlockingMs: blocking,
  });

  return {
    windowMs: PERF_LAB_WINDOW_MS,
    tick: { ...tickStats, other, phases },
    map: {
      method: mapMethod,
      ...mapStats,
      exRiderMeanMs: exRider.meanMs,
      exRiderP95Ms: exRider.p95Ms,
      riderMeanMs: rider.meanMs,
      renderEvents,
      idleEvents,
      limit: MAP_LIMIT,
    },
    react: {
      commits: reacts.length,
      commitsPerSec: reacts.length / (PERF_LAB_WINDOW_MS / 1000),
      commitSumMs: reactSum,
      commitMeanMs: reacts.length > 0 ? reactSum / reacts.length : null,
    },
    loaf: {
      supported: loafSupported === true,
      count: loafs.length,
      blockingMs: blocking,
      styleAndLayoutMs: styleMs,
      styleAndLayoutSource: styleSourceOf(loafs),
      topScripts: topByMs(scriptRows, 5),
    },
    gpu: {
      supported: gpuSupport === "supported",
      reason: gpuSupport,
      samples: gpuStats.samples,
      meanMs: gpuStats.meanMs,
      p95Ms: gpuStats.p95Ms,
    },
    summary,
    note: SUMMARY_NOTE,
  };
}

/** 시험이 버퍼·래핑·관찰자를 비운다. 시계는 부르지 않는다. */
export function resetFrameBreakdownForTests(): void {
  for (const restore of mapRestorers.splice(0)) restore();
  stopFrameBreakdownObservers();
  tickSamples.length = 0;
  mapSamples.length = 0;
  reactSamples.length = 0;
  loafSamples.length = 0;
  gpuSamples.length = 0;
  mapMethod = "unattached";
  renderEvents = 0;
  idleEvents = 0;
  loafSupported = null;
  gpuSupport = "unprobed";
  gpuGl = null;
  gpuExt = null;
  gpuFrameN = 0;
  gpuBeginFailures = 0;
  gpuPending = [];
}
