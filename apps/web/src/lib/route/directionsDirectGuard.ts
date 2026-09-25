import {
  assertDirectionsServerOnlyFromRaw,
  formatRouteTokenSpendMessage as formatRouteTokenSpendMessageCore,
  isDirectionsDirectBypassConfigured as isDirectionsDirectBypassConfiguredCore,
} from "./directionsDirectGuard.core.mjs";

/** @deprecated VITE_DIRECTIONS_DIRECT — 프로덕션 Route 생성에서 제거됨. */
export function isDirectionsDirectBypassConfigured(
  raw: string | undefined = import.meta.env.VITE_DIRECTIONS_DIRECT,
): boolean {
  return isDirectionsDirectBypassConfiguredCore(raw);
}

export function assertDirectionsServerOnly(
  raw: string | undefined = import.meta.env.VITE_DIRECTIONS_DIRECT,
): void {
  assertDirectionsServerOnlyFromRaw(raw);
}

export function formatRouteTokenSpendMessage(balance: number): string {
  return formatRouteTokenSpendMessageCore(balance);
}
