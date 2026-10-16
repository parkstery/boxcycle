/**
 * 운영 포함 실측(`?perflab=1`).
 *
 * 쿼리가 없으면 프레임 시계를 켜지 않고, 통계 함수는 빈 결과만 반환한다.
 * 값은 패널에서 복사할 뿐 서버로 보내지 않는다.
 */

import { readRiderMapTrueDevicePixelRatio } from "../map/rtwMapConfig";

export const PERF_LAB_WINDOW_MS = 10_000;

/** 탭이 숨은 뒤의 공백은 프레임 시간이 아니다. */
const MAX_FRAME_DT_MS = 5_000;

export type FrameIntervalSample = { t: number; dtMs: number };

export type PerfFrameStats = {
  samples: number;
  windowMs: number;
  fps: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  maxMs: number | null;
  /** dt > 33 ms 인 샘플 비율. 0–1 */
  over33Ratio: number | null;
  /** dt > 50 ms 인 샘플 비율. 0–1 */
  over50Ratio: number | null;
};

export type PerfLabWebGlInfo = {
  unmaskedRenderer: string | null;
  maxVertexUniformVectors: number | null;
  vertexHighFloatPrecision: number | null;
  vertexHighFloatRangeMin: number | null;
  vertexHighFloatRangeMax: number | null;
};

export type PerfLabDeviceInfo = {
  userAgent: string;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  devicePixelRatio: number | null;
  /** 지도 캔버스 실측 적용 비율 (canvas.width ÷ CSS 너비). 상한 설치 전이면 null. */
  mapPixelRatio: number | null;
  screenWidth: number | null;
  screenHeight: number | null;
  innerWidth: number | null;
  innerHeight: number | null;
  webgl: PerfLabWebGlInfo | null;
};

let enabledCache: boolean | undefined;

/** 페이지 수명 동안 쿼리를 한 번만 읽는다. */
export function isPerfLabEnabled(): boolean {
  if (enabledCache !== undefined) return enabledCache;
  enabledCache = readPerfLabSearch(currentSearch());
  return enabledCache;
}

export function readPerfLabSearch(search: string): boolean {
  try {
    return new URLSearchParams(search).get("perflab") === "1";
  } catch {
    return false;
  }
}

function currentSearch(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.location?.search ?? "";
  } catch {
    return "";
  }
}

/**
 * 정렬된 간격의 최근접 순위 백분위.
 * index = ceil(p/100 × n) − 1.
 */
export function percentileNearestRank(sortedAsc: readonly number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return Number.NaN;
  const rank = Math.ceil((p / 100) * n) - 1;
  const i = Math.min(n - 1, Math.max(0, rank));
  return sortedAsc[i]!;
}

export function summarizeFrameIntervals(
  samples: readonly FrameIntervalSample[],
  nowMs: number,
  windowMs = PERF_LAB_WINDOW_MS,
): PerfFrameStats {
  const minT = nowMs - windowMs;
  const dts: number[] = [];
  for (const sample of samples) {
    if (sample.t < minT || sample.t > nowMs) continue;
    if (!Number.isFinite(sample.dtMs) || sample.dtMs < 0) continue;
    dts.push(sample.dtMs);
  }
  if (dts.length === 0) {
    return {
      samples: 0,
      windowMs,
      fps: null,
      p50Ms: null,
      p95Ms: null,
      p99Ms: null,
      maxMs: null,
      over33Ratio: null,
      over50Ratio: null,
    };
  }
  const sorted = dts.slice().sort((a, b) => a - b);
  let sum = 0;
  let over33 = 0;
  let over50 = 0;
  for (const dt of dts) {
    sum += dt;
    if (dt > 33) over33 += 1;
    if (dt > 50) over50 += 1;
  }
  const mean = sum / dts.length;
  return {
    samples: dts.length,
    windowMs,
    fps: mean > 0 ? 1000 / mean : null,
    p50Ms: percentileNearestRank(sorted, 50),
    p95Ms: percentileNearestRank(sorted, 95),
    p99Ms: percentileNearestRank(sorted, 99),
    maxMs: sorted[sorted.length - 1]!,
    over33Ratio: over33 / dts.length,
    over50Ratio: over50 / dts.length,
  };
}

const frameSamples: FrameIntervalSample[] = [];
let rafHandle = 0;
let lastFrameT = 0;

function pruneFrameSamples(nowMs: number): void {
  const minT = nowMs - PERF_LAB_WINDOW_MS;
  let drop = 0;
  while (drop < frameSamples.length && frameSamples[drop]!.t < minT) drop += 1;
  if (drop > 0) frameSamples.splice(0, drop);
}

/** 켜졌을 때만 rAF 하나. 이미 돌고 있으면 그대로 둔다. */
export function startPerfLabFrameClock(): void {
  if (!isPerfLabEnabled() || rafHandle !== 0) return;
  if (typeof requestAnimationFrame !== "function") return;
  lastFrameT = 0;
  const tick = (t: number) => {
    if (!isPerfLabEnabled()) {
      rafHandle = 0;
      return;
    }
    if (lastFrameT > 0) {
      const dt = t - lastFrameT;
      if (dt > 0 && dt <= MAX_FRAME_DT_MS) {
        frameSamples.push({ t, dtMs: dt });
        pruneFrameSamples(t);
      }
    }
    lastFrameT = t;
    rafHandle = requestAnimationFrame(tick);
  };
  rafHandle = requestAnimationFrame(tick);
}

export function stopPerfLabFrameClock(): void {
  if (rafHandle !== 0 && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(rafHandle);
  }
  rafHandle = 0;
  lastFrameT = 0;
}

export function readPerfLabFrameStats(nowMs?: number): PerfFrameStats {
  if (!isPerfLabEnabled()) return summarizeFrameIntervals([], 0);
  return summarizeFrameIntervals(frameSamples, nowMs ?? performance.now());
}

export function readAppBuildId(): string {
  const mode = typeof import.meta.env.MODE === "string" ? import.meta.env.MODE : "";
  if (typeof document === "undefined") return mode || "unknown";
  const srcs: string[] = [];
  for (const script of Array.from(document.scripts)) srcs.push(script.src || "");
  for (const src of srcs) {
    const hashed = src.match(/\/assets\/index-([A-Za-z0-9_-]+)\.js(?:\?|$)/);
    if (hashed) return hashed[1]!;
  }
  if (srcs.some((src) => src.includes("/src/main.tsx"))) return mode || "dev";
  return mode || "unknown";
}

function readGlInfo(gl: WebGLRenderingContext | WebGL2RenderingContext): PerfLabWebGlInfo {
  let unmaskedRenderer: string | null = null;
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) {
      const raw = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      if (typeof raw === "string" && raw) unmaskedRenderer = raw;
    }
  } catch {
    unmaskedRenderer = null;
  }
  let maxVertexUniformVectors: number | null = null;
  try {
    const n = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    if (typeof n === "number" && Number.isFinite(n)) maxVertexUniformVectors = n;
  } catch {
    maxVertexUniformVectors = null;
  }
  let vertexHighFloatPrecision: number | null = null;
  let vertexHighFloatRangeMin: number | null = null;
  let vertexHighFloatRangeMax: number | null = null;
  try {
    const fmt = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
    if (fmt) {
      vertexHighFloatPrecision = fmt.precision;
      vertexHighFloatRangeMin = fmt.rangeMin;
      vertexHighFloatRangeMax = fmt.rangeMax;
    }
  } catch {
    /* 정밀도를 못 읽어도 나머지 기기 정보는 남긴다 */
  }
  return {
    unmaskedRenderer,
    maxVertexUniformVectors,
    vertexHighFloatPrecision,
    vertexHighFloatRangeMin,
    vertexHighFloatRangeMax,
  };
}

function contextOf(canvas: HTMLCanvasElement): WebGLRenderingContext | WebGL2RenderingContext | null {
  try {
    return canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  } catch {
    return null;
  }
}

let webglCache: PerfLabWebGlInfo | null = null;
let webglTempTried = false;

/*
 * 렌더 상한(P1)이 `window.devicePixelRatio` 의 JS 관측값을 min(실측, 상한) 으로
 * 고정하므로, 여기서 `window` 를 직접 읽으면 상한값이 나온다. 기기 정보의 DPR 은
 * 설치 때 스냅샷한 실측을 우선 보고한다. mapbox-gl 3.23.1 에 `map.getPixelRatio()`
 * 가 없어 실제 적용 비율은 지도 캔버스(canvas.width ÷ CSS 너비)로 잰다.
 */
function readTrueDevicePixelRatio(): number | null {
  try {
    const stashed = readRiderMapTrueDevicePixelRatio();
    if (stashed != null) return stashed;
  } catch {
    /* 상한 모듈을 못 읽으면 아래 window 직독으로 복귀 */
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = window.devicePixelRatio;
    return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  } catch {
    return null;
  }
}

function readMapCanvasPixelRatio(): number | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.querySelector("canvas.mapboxgl-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const cssWidth = canvas.clientWidth;
    if (!Number.isFinite(cssWidth) || cssWidth <= 0) return null;
    const ratio = canvas.width / cssWidth;
    if (!Number.isFinite(ratio) || ratio <= 0) return null;
    return Math.round(ratio * 100) / 100;
  } catch {
    return null;
  }
}
export function readPerfLabWebGlInfo(): PerfLabWebGlInfo | null {
  if (webglCache) return webglCache;
  if (typeof document === "undefined") return null;
  const mapCanvas = document.querySelector("canvas.mapboxgl-canvas");
  if (mapCanvas instanceof HTMLCanvasElement) {
    const gl = contextOf(mapCanvas);
    if (gl) {
      webglCache = readGlInfo(gl);
      return webglCache;
    }
  }
  if (webglTempTried) return webglCache;
  webglTempTried = true;
  const temp = document.createElement("canvas");
  const gl = contextOf(temp);
  if (!gl) return null;
  webglCache = readGlInfo(gl);
  try {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* 임시 컨텍스트 정리는 실패해도 된다 */
  }
  return webglCache;
}

export function readPerfLabDeviceInfo(): PerfLabDeviceInfo {
  const nav = typeof navigator === "undefined" ? null : navigator;
  const withMemory = nav as (Navigator & { deviceMemory?: number }) | null;
  const memory = withMemory?.deviceMemory;
  const screenOk = typeof screen !== "undefined";
  const viewOk = typeof window !== "undefined";
  return {
    userAgent: nav?.userAgent ?? "",
    hardwareConcurrency:
      nav != null && Number.isFinite(nav.hardwareConcurrency) ? nav.hardwareConcurrency : null,
    deviceMemory: typeof memory === "number" && Number.isFinite(memory) ? memory : null,
    devicePixelRatio: readTrueDevicePixelRatio(),
    mapPixelRatio: readMapCanvasPixelRatio(),
    screenWidth: screenOk && Number.isFinite(screen.width) ? screen.width : null,
    screenHeight: screenOk && Number.isFinite(screen.height) ? screen.height : null,
    innerWidth: viewOk && Number.isFinite(window.innerWidth) ? window.innerWidth : null,
    innerHeight: viewOk && Number.isFinite(window.innerHeight) ? window.innerHeight : null,
    webgl: readPerfLabWebGlInfo(),
  };
}

/** 시험이 쿼리 캐시·프레임 버퍼를 비운다. */
export function resetPerfLabForTests(): void {
  enabledCache = undefined;
  frameSamples.length = 0;
  stopPerfLabFrameClock();
  webglCache = null;
  webglTempTried = false;
}
