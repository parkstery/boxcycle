import assert from "node:assert/strict";
import { describe, it } from "node:test";

function isDirectionsDirectBypassConfigured(raw) {
  const s = (raw ?? "").toString().trim().toLowerCase();
  return s === "1" || s === "true";
}

function assertDirectionsServerOnly(raw) {
  if (isDirectionsDirectBypassConfigured(raw)) {
    throw new Error(
      "VITE_DIRECTIONS_DIRECT 는 더 이상 지원되지 않습니다. apps/web/.env.local 에서 해당 줄을 제거하세요. Route 생성은 getMapboxDirections 서버만 사용합니다.",
    );
  }
}

function formatRouteTokenSpendMessage(balance) {
  const n = Math.max(0, Math.floor(balance));
  return `Route Token -1 · 잔여 ${n}개`;
}

describe("directions direct bypass guard", () => {
  it("VITE_DIRECTIONS_DIRECT=1 → 우회 설정으로 판정", () => {
    assert.equal(isDirectionsDirectBypassConfigured("1"), true);
    assert.equal(isDirectionsDirectBypassConfigured("true"), true);
    assert.equal(isDirectionsDirectBypassConfigured("0"), false);
    assert.equal(isDirectionsDirectBypassConfigured(""), false);
  });

  it("VITE_DIRECTIONS_DIRECT=1 → assertDirectionsServerOnly 실패", () => {
    assert.throws(() => assertDirectionsServerOnly("1"), /VITE_DIRECTIONS_DIRECT/);
  });

  it("formatRouteTokenSpendMessage", () => {
    assert.equal(formatRouteTokenSpendMessage(2), "Route Token -1 · 잔여 2개");
    assert.equal(formatRouteTokenSpendMessage(0), "Route Token -1 · 잔여 0개");
    assert.equal(formatRouteTokenSpendMessage(1.9), "Route Token -1 · 잔여 1개");
  });
});
