/**
 * 라이더 3D 렌더 비용 계측 — **DEV 전용 진단**.
 *
 * 왜 (2026-09-27) — 카메라 4단계(5m·60m·200m·전체) 중 뒤 둘은 라이더가 점으로만 보이는데,
 * 렌더 경로에 **줌 판단이 한 줄도 없다.** 점 크기에서도 다리 IK 와 three.js 렌더를 매 프레임
 * 돌린다. 게다가 렌더 루프가 **라이더 한 명마다 전체 장면을 한 번씩** 그린다.
 *
 * 「아낄 수 있나」를 감으로 정하지 않기 위해 **먼저 잰다.** 기존 `mapTickProbe` 는 프레임
 * 전체만 재므로 라이더 몫을 떼어낼 수 없다.
 *
 * 운영 빌드에서는 아무 일도 하지 않는다(`import.meta.env.DEV` 가드).
 *
 *   window.__rtwRiderCost.reset()
 *   window.__rtwRiderCost.read()   → { frames, riders, totalMs, msPerFrame, msPerRider, ... }
 */

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

function reset(): void {
  frames = 0;
  riders = 0;
  totalMs = 0;
  maxFrameMs = 0;
  poseMs = 0;
  startedAt = performance.now();
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

/**
 * 라이더 렌더 한 프레임을 감싼다. **DEV 가 아니면 콜백만 부르고 끝난다.**
 * @param riderCount 이번 프레임에 그린 라이더 수
 */
export function measureRiderRenderFrame<T>(riderCount: number, run: () => T): T {
  if (!import.meta.env.DEV) return run();

  if (startedAt === 0) reset();
  const t0 = performance.now();
  try {
    return run();
  } finally {
    const ms = performance.now() - t0;
    frames += 1;
    riders += riderCount;
    totalMs += ms;
    if (ms > maxFrameMs) maxFrameMs = ms;
  }
}

/**
 * 자세 계산(IK) 한 번을 감싼다 — 렌더 전체 중 **얼마가 자세 계산인지** 가른다.
 * 이 비율에 따라 고칠 자리가 달라진다: 자세만 건너뛸지, 렌더까지 건너뛸지.
 */
export function measureRiderPose<T>(run: () => T): T {
  if (!import.meta.env.DEV) return run();
  const t0 = performance.now();
  try {
    return run();
  } finally {
    poseMs += performance.now() - t0;
  }
}

export function installRiderRenderCostProbe(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  if (window.__rtwRiderCost) return;
  reset();
  window.__rtwRiderCost = { reset, read };
}
