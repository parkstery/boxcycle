/**
 * 주행 기록으로 남기지 않을 최소 거리(초과해야 유효).
 * ⚠️ 테스트용 100m. 출시 전 200 으로 되돌릴 것 — document/출시 전 확인사항.md 참고.
 */
export const MIN_MEANINGFUL_RIDE_DISTANCE_METERS = 100;

/**
 * 주행 기록으로 남기지 않을 최소 시간(초과해야 유효).
 * ⚠️ 테스트용 5초. 출시 전 3 * 60(3분)으로 되돌릴 것 — document/출시 전 확인사항.md 참고.
 */
export const MIN_MEANINGFUL_RIDE_DURATION_SEC = 5;

/**
 * 즉시 종료 등 가치 없는 주행 — 거리·시간 중 하나라도 기준 이하면 기록에서 제외.
 * (200m 이하 **또는** 5초 이하 — 테스트 기준)
 */
export function isDiscardableRideRecord(distanceMeters: number, elapsedSec: number): boolean {
  const d = Number(distanceMeters);
  const t = Number(elapsedSec);
  if (!Number.isFinite(d) || !Number.isFinite(t)) return true;
  return d <= MIN_MEANINGFUL_RIDE_DISTANCE_METERS || t <= MIN_MEANINGFUL_RIDE_DURATION_SEC;
}
