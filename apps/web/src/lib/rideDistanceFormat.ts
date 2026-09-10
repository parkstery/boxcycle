/**
 * 주행·새 도로 등 **같은 운동 거리 축**의 km 표기.
 * HUD 「거리」와 「새 도로」가 소수 자릿수 때문에 달라 보이지 않도록 통일한다.
 */
export const RIDE_DISTANCE_KM_FRACTION_DIGITS = 2;

/**
 * 주행 중 HUD 「새 도로」 표시 하한(m).
 * 0은 미표시(정복 축 0 미표시). 결과 시트 hero의 50m 하한과 분리 —
 * 라이브는 새 도로가 생기는 즉시(수 미터) 보이되, 종료 요약의 숫자 hero는 50m 정책을 유지한다.
 */
export const LIVE_NEW_ROAD_HUD_MIN_METERS = 1;

/** meters → "N.NN" (항상 소수 2자리). 비정상 입력은 "0.00". */
export function formatRideDistanceKmNumber(meters: number): string {
  const m = Number(meters);
  if (!Number.isFinite(m) || m < 0) return (0).toFixed(RIDE_DISTANCE_KM_FRACTION_DIGITS);
  return (m / 1000).toFixed(RIDE_DISTANCE_KM_FRACTION_DIGITS);
}
