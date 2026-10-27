/** 거리 지배 주행 카메라의 HUD ± 한 단계(약 Map zoom 1단계 체감). */
const RIDE_USER_ZOOM_DISTANCE_FACTOR = 1.25;

/**
 * HUD `−`는 라이더와 카메라 사이 거리를 계속 늘린다.
 * 제품 임의 상한을 두지 않는다. 실제 렌더 하한은 Mapbox `minZoom`이 맡는다.
 */
export function nextRideUserZoomOutDistanceM(currentDistanceM: number): number {
  const next = currentDistanceM * RIDE_USER_ZOOM_DISTANCE_FACTOR;
  return Math.round(next * 10) / 10;
}

/** HUD `+`는 반대 방향으로 같은 비율만큼 거리를 줄인다. */
export function nextRideUserZoomInDistanceM(currentDistanceM: number): number {
  const next = currentDistanceM / RIDE_USER_ZOOM_DISTANCE_FACTOR;
  return Math.round(next * 10) / 10;
}
