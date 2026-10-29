import {
  DISTANCE_AUTO_ROUTE_KM_MAX,
  DISTANCE_AUTO_ROUTE_KM_MIN,
} from "../route/distanceAutoRouteErrors";
import { resolveIntervalBasisKmh } from "../route/intervalRouteDistance";

/** 간편 인터벌 목표 거리 여유분 — 인터벌을 마치기 전에 경로가 끝나지 않게 한다 */
export const QUICK_INTERVAL_DISTANCE_MARGIN = 1.3;
/** 무작위 방향 탐색 최대 시도 횟수 */
export const QUICK_INTERVAL_MAX_ATTEMPTS = 3;
/** 실패한 방위와 다음 방위 사이 최소 각도(°) */
export const QUICK_INTERVAL_MIN_BEARING_GAP_DEG = 90;

/**
 * 인터벌 총 시간(초) → 목표 경로 거리(km).
 * `총시간(h) × 기준 속도 × 여유분`, 0.5~120 km 로 제한하고 소수 첫째 자리로 반올림한다.
 * 기준 속도는 `resolveIntervalBasisKmh()` 에서만 정한다(`basisKmh` 는 시험 주입용).
 */
export function resolveQuickIntervalTargetKm(
  intervalTotalSec: number,
  basisKmh: number = resolveIntervalBasisKmh(),
): number {
  const hours = Number.isFinite(intervalTotalSec) && intervalTotalSec > 0 ? intervalTotalSec / 3600 : 0;
  const raw = hours * basisKmh * QUICK_INTERVAL_DISTANCE_MARGIN;
  const clamped = Math.min(DISTANCE_AUTO_ROUTE_KM_MAX, Math.max(DISTANCE_AUTO_ROUTE_KM_MIN, raw));
  return Math.round(clamped * 10) / 10;
}

/** 두 방위 사이 각도 차(0~180°) */
export function bearingGapDeg(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

const BEARING_REJECTION_DRAWS = 32;
const BEARING_FALLBACK_STEP_DEG = 5;

/**
 * 다음 시도 방위. 실패한 방위들과 모두 90° 이상 떨어진 무작위 방위를 고른다.
 * 거절 표집이 실패하면(실패 방위 둘이 거의 반대편이면 90° 이상인 구간이 사라진다)
 * 실패 방위들과의 최소 간격이 가장 큰 방위로 대신한다.
 */
export function pickQuickIntervalBearing(
  failedBearings: readonly number[],
  random: () => number = Math.random,
): number {
  for (let i = 0; i < BEARING_REJECTION_DRAWS; i += 1) {
    const candidate = random() * 360;
    if (failedBearings.every((f) => bearingGapDeg(candidate, f) >= QUICK_INTERVAL_MIN_BEARING_GAP_DEG)) {
      return candidate;
    }
  }
  let best = random() * 360;
  let bestGap = -1;
  for (let deg = 0; deg < 360; deg += BEARING_FALLBACK_STEP_DEG) {
    const gap = Math.min(...failedBearings.map((f) => bearingGapDeg(deg, f)));
    if (gap > bestGap) {
      best = deg;
      bestGap = gap;
    }
  }
  return best;
}

export type QuickIntervalAttemptOutcome = "found" | "failed" | "cancelled";

export type QuickIntervalAttemptsResult = {
  status: QuickIntervalAttemptOutcome;
  /** 실제로 요청한 횟수 */
  attempts: number;
  /** 시도한 방위(순서대로) */
  bearings: number[];
};

/**
 * 무작위 방위 탐색 루프 — 실패하면 다른 방위로 최대 `QUICK_INTERVAL_MAX_ATTEMPTS` 회 다시 시도한다.
 * `search` 가 "cancelled" 를 돌려주면(늦은 응답·취소) 즉시 멈춘다.
 */
export async function runQuickIntervalAttempts(input: {
  search: (bearingDeg: number, attempt: number) => Promise<QuickIntervalAttemptOutcome>;
  random?: () => number;
}): Promise<QuickIntervalAttemptsResult> {
  const bearings: number[] = [];
  for (let attempt = 1; attempt <= QUICK_INTERVAL_MAX_ATTEMPTS; attempt += 1) {
    const bearing = pickQuickIntervalBearing(bearings, input.random);
    bearings.push(bearing);
    const outcome = await input.search(bearing, attempt);
    if (outcome !== "failed") return { status: outcome, attempts: attempt, bearings };
  }
  return { status: "failed", attempts: bearings.length, bearings };
}
