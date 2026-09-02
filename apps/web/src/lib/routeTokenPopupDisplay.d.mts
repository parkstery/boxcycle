export type RouteTokenPopupSecondaryVariant = "cost" | "insufficient" | "spend" | "pending";

export function resolveRouteTokenPopupSecondary(input: {
  insufficient: boolean;
  spendMessage: string | null;
  routePending: boolean;
}): { variant: RouteTokenPopupSecondaryVariant; text: string };

export function formatRouteTokenPopupLine(
  holding: string,
  secondary: { variant: RouteTokenPopupSecondaryVariant; text: string },
): string;

export const ROUTE_TOKEN_POPUP_SECONDARY_TEST_IDS: Record<
  RouteTokenPopupSecondaryVariant,
  string
>;
