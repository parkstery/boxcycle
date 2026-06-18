/** 주행 기록으로 남기지 않을 최소 거리(초과해야 유효). */
export const MIN_MEANINGFUL_RIDE_DISTANCE_METERS = 200;

/** 주행 기록으로 남기지 않을 최소 시간(초과해야 유효). */
export const MIN_MEANINGFUL_RIDE_DURATION_SEC = 3 * 60;

/**
 * 즉시 종료 등 가치 없는 주행 — 거리·시간 중 하나라도 기준 이하면 기록에서 제외.
 * (200m 이하 **또는** 3분 이하)
 */
export function isDiscardableRideRecord(distanceMeters: number, elapsedSec: number): boolean {
  const d = Number(distanceMeters);
  const t = Number(elapsedSec);
  if (!Number.isFinite(d) || !Number.isFinite(t)) return true;
  return d <= MIN_MEANINGFUL_RIDE_DISTANCE_METERS || t <= MIN_MEANINGFUL_RIDE_DURATION_SEC;
}
