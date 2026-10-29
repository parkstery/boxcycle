/**
 * 인터벌 계산의 기준 속도 — 모든 인터벌 계산(간편 인터벌 목표 거리 등)이 이 함수 하나를 부른다.
 * 25를 다른 곳에 직접 적지 않는다. 나중에 개인 평균 속도로 바꿀 때 여기만 고친다(2026-10-29 Chief).
 */
export const INTERVAL_ROUTE_BASIS_KMH = 25;

export function resolveIntervalBasisKmh(): number {
  return INTERVAL_ROUTE_BASIS_KMH;
}
