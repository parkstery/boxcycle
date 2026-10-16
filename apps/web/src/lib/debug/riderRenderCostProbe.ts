/**
 * 라이더 3D 렌더 비용 계측.
 *
 * DEV 에서는 기존과 같이 수명 누적(`window.__rtwRiderCost`).
 * `?perflab=1` 이면 운영에서도 같은 누적과 최근 10 s 창을 남긴다.
 * 둘 다 아니면 콜백만 부르고 `performance.now()` 도 호출하지 않는다.
 *
 *   window.__rtwRiderCost.reset()
 *   window.__rtwRiderCost.read()   → { frames, riders, totalMs, msPerFrame, msPerRider, ... }
 */

import { isPerfLabEnabled, PERF_LAB_WINDOW_MS } from "./perfLab";

export type RiderRenderCostSnapshot = {
  /** render() 가 불린 횟수 = 프레임 수 */
  frames: number;
  /** 그린 라이더 총합 (프레임마다 사람 수만큼 누적) */
  riders: number;
  /** 누적 소요(ms) */
  totalMs: number;
  /** 프레임당 평균(ms) */
  msPerFrame: number | null;
  /** 라이더 1명당 평균(ms) */
  msPerRider: number | null;
  /** 프레임당 최대(ms) — 튀는 프레임을 놓치지 않기 위해 */
  maxFrameMs: number;
  /** 그중 **자세 계산(IK)** 누적(ms) — 나머지가 three.js 렌더·행렬·지형조회 */
  poseMs: number;
  /** 자세 계산이 차지하는 비율(%) */
  posePct: number | null;
  /** 계측 구간 길이(ms) */
  windowMs: number;
};

export type RiderLod2State = "none" | "loading" | "ready" | "error";

export type RiderCostSample = {
  t: number;
  riders: number;
  ms: number;
  poseMs: number;
};

export type RiderCostWindow = {
  frames: number;
  riders: number;
  msPerFrame: number | null;
  msPerRider: number | null;
  posePct: number | null;
  riderCount: number | null;
};

export type RiderPerfScene = {
  zoom: number | null;
  riderCount: number | null;
  lod2State: RiderLod2State | null;
};

declare global {
  interface Window {
    __rtwRiderCost?: {
      reset: () => void;
      read: () => RiderRenderCostSnapshot;
    };
  }
}

let frames = 0;
let riders = 0;
let totalMs = 0;
let maxFrameMs = 0;
let poseMs = 0;
let startedAt = 0;
let framePoseScratch = 0;
const riderSamples: RiderCostSample[] = [];
let lastScene: RiderPerfScene = { zoom: null, riderCount: null, lod2State: null };

/**
 * 시험이 운영 빌드(`import.meta.env.DEV === false`)를 흉내 낸다.
 * `undefined` 이면 빌드 플래그를 그대로 쓴다.
 */
let devOverride: boolean | undefined;

export function setRiderCostDevOverrideForTests(dev: boolean | undefined): void {
  devOverride = dev;
}

function devOn(): boolean {
  if (devOverride !== undefined) return devOverride;
  return import.meta.env.DEV;
}

function shouldMeasure(): boolean {
  return devOn() || isPerfLabEnabled();
}

function reset(): void {
  frames = 0;
  riders = 0;
  totalMs = 0;
  maxFrameMs = 0;
  poseMs = 0;
  startedAt = performance.now();
  framePoseScratch = 0;
  riderSamples.length = 0;
  lastScene = { zoom: null, riderCount: null, lod2State: null };
}

function read(): RiderRenderCostSnapshot {
  const windowMs = startedAt > 0 ? performance.now() - startedAt : 0;
  return {
    frames,
    riders,
    totalMs: Number(totalMs.toFixed(3)),
    msPerFrame: frames > 0 ? Number((totalMs / frames).toFixed(4)) : null,
    msPerRider: riders > 0 ? Number((totalMs / riders).toFixed(4)) : null,
    maxFrameMs: Number(maxFrameMs.toFixed(3)),
    poseMs: Number(poseMs.toFixed(3)),
    posePct: totalMs > 0 ? Number(((poseMs / totalMs) * 100).toFixed(1)) : null,
    windowMs: Number(windowMs.toFixed(0)),
  };
}

export function readRiderRenderCostSnapshot(): RiderRenderCostSnapshot {
  return read();
}

export function resetRiderRenderCostProbe(): void {
  reset();
}

function pruneRiderSamples(nowMs: number): void {
  const minT = nowMs - PERF_LAB_WINDOW_MS;
  let drop = 0;
  while (drop < riderSamples.length && riderSamples[drop]!.t < minT) drop += 1;
  if (drop > 0) riderSamples.splice(0, drop);
}

export function summarizeRiderCostSamples(
  samples: readonly RiderCostSample[],
  nowMs: number,
  windowMs = PERF_LAB_WINDOW_MS,
): RiderCostWindow {
  const minT = nowMs - windowMs;
  let windowFrames = 0;
  let windowRiders = 0;
  let windowTotal = 0;
  let windowPose = 0;
  let riderCount: number | null = null;
  for (const sample of samples) {
    if (sample.t < minT || sample.t > nowMs) continue;
    windowFrames += 1;
    windowRiders += sample.riders;
    windowTotal += sample.ms;
    windowPose += sample.poseMs;
    riderCount = sample.riders;
  }
  return {
    frames: windowFrames,
    riders: windowRiders,
    msPerFrame: windowFrames > 0 ? windowTotal / windowFrames : null,
    msPerRider: windowRiders > 0 ? windowTotal / windowRiders : null,
    posePct: windowTotal > 0 ? (windowPose / windowTotal) * 100 : null,
    riderCount,
  };
}

export function readRiderCostWindow(nowMs?: number): RiderCostWindow {
  if (!isPerfLabEnabled()) return summarizeRiderCostSamples([], 0);
  return summarizeRiderCostSamples(riderSamples, nowMs ?? performance.now());
}

export function readRiderPerfScene(): RiderPerfScene {
  return { ...lastScene };
}

/** 라이더가 0명이라 렌더 계측이 안 돌 때도 화면 상태를 남긴다. perflab 이 아니면 즉시 반환. */
export function noteRiderPerfScene(zoom: number, riderCount: number, lod2State: RiderLod2State): void {
  if (!isPerfLabEnabled()) return;
  lastScene = {
    zoom: Number.isFinite(zoom) ? zoom : null,
    riderCount,
    lod2State,
  };
}

/**
 * 라이더 렌더 한 프레임을 감싼다.
 * DEV 도 perflab 도 아니면 콜백만 부르고 끝난다.
 * @param riderCount 이번 프레임에 그린 라이더 수
 */
export function measureRiderRenderFrame<T>(
  riderCount: number,
  run: () => T,
  zoom?: number,
  lod2State?: RiderLod2State,
): T {
  if (!shouldMeasure()) return run();

  if (startedAt === 0) reset();
  framePoseScratch = 0;
  const t0 = performance.now();
  try {
    return run();
  } finally {
    const t1 = performance.now();
    const ms = t1 - t0;
    frames += 1;
    riders += riderCount;
    totalMs += ms;
    if (ms > maxFrameMs) maxFrameMs = ms;
    if (isPerfLabEnabled()) {
      riderSamples.push({ t: t1, riders: riderCount, ms, poseMs: framePoseScratch });
      pruneRiderSamples(t1);
      lastScene = {
        zoom: typeof zoom === "number" && Number.isFinite(zoom) ? zoom : lastScene.zoom,
        riderCount,
        lod2State: lod2State ?? lastScene.lod2State,
      };
    }
  }
}

/**
 * 자세 계산(IK) 한 번을 감싼다 — 렌더 전체 중 **얼마가 자세 계산인지** 가른다.
 * 이 비율에 따라 고칠 자리가 달라진다: 자세만 건너뛸지, 렌더까지 건너뛸지.
 */
export function measureRiderPose<T>(run: () => T): T {
  if (!shouldMeasure()) return run();
  const t0 = performance.now();
  try {
    return run();
  } finally {
    const dt = performance.now() - t0;
    poseMs += dt;
    framePoseScratch += dt;
  }
}

export function installRiderRenderCostProbe(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  if (window.__rtwRiderCost) return;
  reset();
  window.__rtwRiderCost = { reset, read };
}
