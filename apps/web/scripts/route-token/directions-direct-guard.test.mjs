import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDirectionsServerOnlyFromRaw,
  formatRouteTokenSpendMessage,
  isDirectionsDirectBypassConfigured,
} from "../../src/lib/directionsDirectGuard.core.mjs";

describe("directions direct bypass guard (product core)", () => {
  it("VITE_DIRECTIONS_DIRECT=1 → 우회 설정으로 판정", () => {
    assert.equal(isDirectionsDirectBypassConfigured("1"), true);
    assert.equal(isDirectionsDirectBypassConfigured("true"), true);
    assert.equal(isDirectionsDirectBypassConfigured("0"), false);
    assert.equal(isDirectionsDirectBypassConfigured(""), false);
  });

  it("VITE_DIRECTIONS_DIRECT=1 → assertDirectionsServerOnly 실패", () => {
    assert.throws(() => assertDirectionsServerOnlyFromRaw("1"), /VITE_DIRECTIONS_DIRECT/);
  });

  it("formatRouteTokenSpendMessage", () => {
    assert.equal(formatRouteTokenSpendMessage(2), "Route Token -1 · 잔여 2개");
    assert.equal(formatRouteTokenSpendMessage(0), "Route Token -1 · 잔여 0개");
    assert.equal(formatRouteTokenSpendMessage(1.9), "Route Token -1 · 잔여 1개");
  });
});
