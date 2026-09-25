export function isDirectionsDirectBypassConfigured(raw) {
  const s = (raw ?? "").toString().trim().toLowerCase();
  return s === "1" || s === "true";
}

export function assertDirectionsServerOnlyFromRaw(raw) {
  if (isDirectionsDirectBypassConfigured(raw)) {
    throw new Error(
      "VITE_DIRECTIONS_DIRECT 는 더 이상 지원되지 않습니다. apps/web/.env.local 에서 해당 줄을 제거하세요. Route 생성은 getMapboxDirections 서버만 사용합니다.",
    );
  }
}

export function formatRouteTokenSpendMessage(balance) {
  const n = Math.max(0, Math.floor(balance));
  return `Route Token -1 · 잔여 ${n}개`;
}
