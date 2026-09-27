/**
 * 경로 진행 거리·진행률의 **경계 함수**(leaf 모듈, 순수).
 *
 * `liveForMap`(App)·publish 스냅샷·peer 외삽·이어 달리기 anchor 가 모두 이 함수들을 공유한다.
 * 별도 인덱스 보간을 새로 만들지 않기 위해, Firebase·peer 의존이 없는 이 모듈로 분리했다
 * (`liveLocationSnapshot` 은 하위 호환으로 그대로 re-export 한다).
 */

/** 본인·동행 공통 — geometry 위 주행 거리(m). `liveForMap`·rAF 샘플과 동일 */
export function rideDistanceAlongRoute(
  virtualDistanceMeters: number,
  routeDistanceMeters: number,
  geometryLengthMeters: number,
): number {
  const geoLen = geometryLengthMeters > 0 ? geometryLengthMeters : 0;
  const routeCap = routeDistanceMeters > 0 ? routeDistanceMeters : geoLen;
  if (geoLen <= 0 && routeCap <= 0) return Math.max(0, virtualDistanceMeters);
  const cap = geoLen > 0 ? Math.min(routeCap, geoLen) : routeCap;
  return Math.min(Math.max(0, virtualDistanceMeters), cap);
}

/**
 * 경로 진행률 — **geometry 길이 기준** (클라이언트별 Directions 거리 차이 무시).
 * publish·peer·본인 위치가 같은 fraction 을 쓰도록 한다.
 */
export function computeRouteProgressRatio(
  virtualDistanceMeters: number,
  routeDistanceMeters: number,
  geometryLengthMeters: number,
): number {
  const geoLen = geometryLengthMeters > 0 ? geometryLengthMeters : 0;
  const denom = geoLen > 0 ? geoLen : routeDistanceMeters > 0 ? routeDistanceMeters : 0;
  if (denom <= 0) return 0;
  const dist = rideDistanceAlongRoute(virtualDistanceMeters, routeDistanceMeters, geoLen);
  return Math.max(0, Math.min(1, dist / denom));
}

/** geometry fraction → 지도 거리(m) */
export function progressRatioToRouteDistanceMeters(
  progressRatio: number,
  geometryLengthMeters: number,
): number {
  const geoLen = geometryLengthMeters > 0 ? geometryLengthMeters : 0;
  if (geoLen <= 0) return 0;
  const p = Math.max(0, Math.min(1, progressRatio));
  return p * geoLen;
}
