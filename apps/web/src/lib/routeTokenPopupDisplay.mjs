/** @typedef {"cost" | "insufficient" | "spend" | "pending"} RouteTokenPopupSecondaryVariant */

/**
 * @param {{ insufficient: boolean; spendMessage: string | null; routePending: boolean }} input
 * @returns {{ variant: RouteTokenPopupSecondaryVariant; text: string }}
 */
export function resolveRouteTokenPopupSecondary({ insufficient, spendMessage, routePending }) {
  if (routePending) {
    return { variant: "pending", text: "경로 생성 중…" };
  }
  if (spendMessage) {
    return { variant: "spend", text: spendMessage };
  }
  if (insufficient) {
    return { variant: "insufficient", text: "경로 토큰 부족" };
  }
  return { variant: "cost", text: "" };
}

/**
 * @param {string} holding
 * @param {{ variant: RouteTokenPopupSecondaryVariant; text: string }} secondary
 * @returns {string}
 */
export function formatRouteTokenPopupLine(holding, secondary) {
  if (!secondary.text) return holding;
  return `${holding} · ${secondary.text}`;
}

export const ROUTE_TOKEN_POPUP_SECONDARY_TEST_IDS = {
  cost: "route-token-cost-hint",
  insufficient: "route-token-insufficient",
  spend: "route-token-spend-toast",
  pending: "route-token-pending",
};
