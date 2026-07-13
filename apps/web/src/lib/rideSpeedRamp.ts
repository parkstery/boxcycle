export const RIDE_SPEED_ACCEL_KMH_PER_SEC = 3;
export const RIDE_SPEED_DECEL_KMH_PER_SEC = 5;

export function stepRideSpeedKmh(currentKmh: number, targetKmh: number, deltaMs: number): number {
  if (currentKmh === targetKmh) return targetKmh;
  const accelerating = targetKmh > currentKmh;
  const ratePerSec = accelerating ? RIDE_SPEED_ACCEL_KMH_PER_SEC : RIDE_SPEED_DECEL_KMH_PER_SEC;
  const maxStep = ratePerSec * (deltaMs / 1000);
  return accelerating
    ? Math.min(targetKmh, currentKmh + maxStep)
    : Math.max(targetKmh, currentKmh - maxStep);
}
