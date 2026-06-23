/** 가상 주행 예상 시간(초) — 거리 ÷ 세션 속도 */
export function estimateVirtualRideDurationSec(distanceMeters: number, speedKmh: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return 0;
  return (distanceMeters / 1000 / speedKmh) * 3600;
}

/** 참고 UI 형식 — `0:27` (시:분, 분만 있을 때도 시 자리 0) */
export function formatVirtualRideDurationLabel(distanceMeters: number, speedKmh: number): string {
  const totalSec = estimateVirtualRideDurationSec(distanceMeters, speedKmh);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}
