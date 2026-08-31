export const ROUTE_TOKEN_COST_HINT = "경로 생성 시 1개 사용";

export const ROUTE_TOKEN_INSUFFICIENT_HINT = "경로 토큰 부족";

export function formatRouteTokenHoldingMessage(balance: number): string {
  const n = Math.max(0, Math.floor(balance));
  return `경로 생성 잔여 토큰 ${n}개`;
}
