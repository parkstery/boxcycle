export const SESSION_SPEED_MIN_KMH = 5;
export const SESSION_SPEED_MAX_KMH = 50;

export function clampSessionSpeedKmh(n: number): number {
  if (!Number.isFinite(n)) return SESSION_SPEED_MIN_KMH;
  return Math.round(Math.min(SESSION_SPEED_MAX_KMH, Math.max(SESSION_SPEED_MIN_KMH, n)));
}
