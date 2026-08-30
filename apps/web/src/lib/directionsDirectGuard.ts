/** @deprecated VITE_DIRECTIONS_DIRECT — 프로덕션 Route 생성에서 제거됨. 하네스·회귀 시험용 파서. */
export function isDirectionsDirectBypassConfigured(
  raw: string | undefined = import.meta.env.VITE_DIRECTIONS_DIRECT,
): boolean {
  const s = (raw ?? "").toString().trim().toLowerCase();
  return s === "1" || s === "true";
}

export function assertDirectionsServerOnly(
  raw: string | undefined = import.meta.env.VITE_DIRECTIONS_DIRECT,
): void {
  if (isDirectionsDirectBypassConfigured(raw)) {
    throw new Error(
      "VITE_DIRECTIONS_DIRECT 는 더 이상 지원되지 않습니다. apps/web/.env.local 에서 해당 줄을 제거하세요. Route 생성은 getMapboxDirections 서버만 사용합니다.",
    );
  }
}

export function formatRouteTokenSpendMessage(balance: number): string {
  const n = Math.max(0, Math.floor(balance));
  return `Route Token -1 · 잔여 ${n}개`;
}
