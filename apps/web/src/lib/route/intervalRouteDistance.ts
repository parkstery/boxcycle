/**
 * 인터벌 계산의 기준 속도 — 모든 인터벌 계산(간편 인터벌 목표 거리 등)이 이 함수 하나를 부른다.
 * 25를 다른 곳에 직접 적지 않는다. 나중에 개인 평균 속도로 바꿀 때 여기만 고친다(2026-10-29 Chief).
 */
export const INTERVAL_ROUTE_BASIS_KMH = 25;

export function resolveIntervalBasisKmh(): number {
  return INTERVAL_ROUTE_BASIS_KMH;
}

/** 부동소수 오차로 6.25 → 6.3 이 6.4 로 넘어가지 않게 올림 전에 뺀다 */
const CEIL_EPSILON = 1e-9;

/**
 * 인터벌을 마치는 데 필요한 최소 경로 거리(km) — 0.1 km 단위 올림.
 * 잘못된 입력(0·음수·NaN)은 0.
 */
export function intervalMinRouteKm(intervalSec: number, basisKmh: number = resolveIntervalBasisKmh()): number {
  if (!Number.isFinite(intervalSec) || intervalSec <= 0 || !Number.isFinite(basisKmh) || basisKmh <= 0) return 0;
  return Math.ceil((basisKmh * intervalSec) / 3600 * 10 - CEIL_EPSILON) / 10;
}

/** 어느 쪽이 마지막에 바뀌었나 — 안내 문구를 고른다(경로를 정함 / 인터벌을 켜거나 적용함) */
export type IntervalRouteHintVariant = "route" | "interval";

export type IntervalRouteShortfall = {
  /** 남은 경로가 인터벌을 마치기에 짧은가 */
  short: boolean;
  /** 화면에 보이는 최소 거리(km, 0.1 올림) */
  minKm: number;
  /** 화면에 보이는 지금 경로 거리(km, 0.1 내림 — 짧다고 판정한 경로가 최소 거리와 같은 숫자로 보이지 않게) */
  routeKm: number;
  /** 판정에 쓴 기준 속도(km/h) */
  basisKmh: number;
};

/**
 * 거리 부족 판정 — 안내창과 주행 시작 경고가 같이 쓴다.
 * 판정은 **화면에 보이는 최소 거리**로 한다: 6.3 km 로 맞춘 경로가 「짧다」로 나오면 안 된다.
 */
export function resolveIntervalRouteShortfall(input: {
  remainingMeters: number;
  intervalSec: number;
  basisKmh?: number;
}): IntervalRouteShortfall {
  const basisKmh = input.basisKmh ?? resolveIntervalBasisKmh();
  const minKm = intervalMinRouteKm(input.intervalSec, basisKmh);
  const validRoute = Number.isFinite(input.remainingMeters) && input.remainingMeters > 0;
  const routeKm = validRoute ? Math.floor(input.remainingMeters / 100 + CEIL_EPSILON) / 10 : 0;
  // 0.1 km 의 배수끼리 비교한다 — minKm×1000 의 부동소수 꼬리(6.3×1000 = 6300.000…01)에 흔들리지 않게.
  const short = validRoute && minKm > 0 && Math.round(input.remainingMeters * 1000) < Math.round(minKm * 10) * 100_000;
  return { short, minKm, routeKm, basisKmh };
}

/**
 * 「같은 경로인가」를 싸게 가르는 키 — 렌더마다 비교하므로 좌표 전체를 문자열로 만들지 않는다.
 * 점 개수·양 끝점·거리가 같으면 같은 경로로 본다.
 */
export function intervalRouteHintRouteKey(
  geometry: { coordinates: ReadonlyArray<ReadonlyArray<number>> } | null | undefined,
  distanceMeters: number,
): string | null {
  const coords = geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  return `${coords.length}:${first[0]},${first[1]}:${last[0]},${last[1]}:${Math.round(distanceMeters)}`;
}
