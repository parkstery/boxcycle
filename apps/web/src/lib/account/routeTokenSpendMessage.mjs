/**
 * Route Token 차감 토스트 문구.
 *
 * 2026-09-26 (Phase 6-D3): `route/directionsDirectGuard.core.mjs` 에서 **그대로** 옮겨 왔다.
 * Directions 우회 가드와 같은 에픽에서 태어났다는 이유로 그 파일에 얹혀 있었고, 그래서
 * `account` 가 `route` 를 import 하고 있었다 — 이 문구는 경로 탐색과 아무 상관이 없다.
 * 완성 문자열은 종전과 같다(계약 시험이 이 문구를 그대로 본다).
 */

/**
 * @param {number} balance
 * @returns {string}
 */
export function formatRouteTokenSpendMessage(balance) {
  const n = Math.max(0, Math.floor(balance));
  return `Route Token -1 · 잔여 ${n}개`;
}
