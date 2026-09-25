export const ROUTE_TOKEN_COST_HINT = "경로 생성 시 1개 사용";

export const ROUTE_TOKEN_INSUFFICIENT_HINT = "경로 토큰 부족";

/**
 * 지점 팝업 첫 줄의 제목(2026-09-16 Chief). 잔액을 모르거나 아직 출발 핀을 안 찍었으면
 * 이 제목만 선다 — 팝업에 제목 행이 늘 있어야 긴 주소가 첫 줄에서 닫기 ✕ 를 덮지 않는다.
 */
export const ROUTE_TOKEN_TITLE = "경로 생성";

export function formatRouteTokenHoldingMessage(balance: number): string {
  const n = Math.max(0, Math.floor(balance));
  // 제목 + 잔액. 완성 문자열은 종전과 같다(계약 e2e 가 이 문구를 그대로 본다).
  return `${ROUTE_TOKEN_TITLE} 잔여 토큰 ${n}개`;
}
