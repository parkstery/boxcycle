export const ROUTE_TOKEN_COST_HINT = "경로 생성 시 1개 사용";

export const ROUTE_TOKEN_INSUFFICIENT_HINT = "경로 토큰 부족 · 주행 완료 시 획득";

export function formatRouteTokenHoldingMessage(balance: number): string {
  const n = Math.max(0, Math.floor(balance));
  return `Route Token ${n}개`;
}
