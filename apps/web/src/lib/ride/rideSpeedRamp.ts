/**
 * 아마추어 라이더 실측 기준(사용자 확정 2026-07-14):
 * - 가속: 정지→20km/h ≈ 5~10초 → 중앙값 7.5초
 * - 제동: 20km/h→정지 ≈ 2~4초(반응+제동거리 포함) → 중앙값 3초
 */
export const RIDE_SPEED_ACCEL_KMH_PER_SEC = 20 / 7.5;
export const RIDE_SPEED_DECEL_KMH_PER_SEC = 20 / 3;

export function stepRideSpeedKmh(currentKmh: number, targetKmh: number, deltaMs: number): number {
  if (currentKmh === targetKmh) return targetKmh;
  const accelerating = targetKmh > currentKmh;
  const ratePerSec = accelerating ? RIDE_SPEED_ACCEL_KMH_PER_SEC : RIDE_SPEED_DECEL_KMH_PER_SEC;
  const maxStep = ratePerSec * (deltaMs / 1000);
  return accelerating
    ? Math.min(targetKmh, currentKmh + maxStep)
    : Math.max(targetKmh, currentKmh - maxStep);
}
