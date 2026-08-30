import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveRouteTokenPopupSecondary,
  ROUTE_TOKEN_POPUP_SECONDARY_TEST_IDS,
} from "../../src/lib/routeTokenPopupDisplay.mjs";

describe("route token popup display", () => {
  it("생성 전에는 보유량 비용 안내를 보여 준다", () => {
    const result = resolveRouteTokenPopupSecondary({
      insufficient: false,
      spendMessage: null,
      routePending: false,
    });
    assert.equal(result.variant, "cost");
    assert.equal(result.text, "경로 생성 시 1개 사용");
    assert.equal(ROUTE_TOKEN_POPUP_SECONDARY_TEST_IDS.cost, "route-token-cost-hint");
  });

  it("잔액 0은 중립 부족 문구만 보여 준다", () => {
    const result = resolveRouteTokenPopupSecondary({
      insufficient: true,
      spendMessage: null,
      routePending: false,
    });
    assert.equal(result.variant, "insufficient");
    assert.equal(result.text, "경로 토큰 부족");
    assert.doesNotMatch(result.text, /획득|주행/);
  });

  it("성공 직후에는 차감 문구를 우선한다", () => {
    const result = resolveRouteTokenPopupSecondary({
      insufficient: false,
      spendMessage: "Route Token -1 · 잔여 2개",
      routePending: false,
    });
    assert.equal(result.variant, "spend");
    assert.equal(result.text, "Route Token -1 · 잔여 2개");
  });

  it("탐색 중에는 진행 문구를 보여 준다", () => {
    const result = resolveRouteTokenPopupSecondary({
      insufficient: false,
      spendMessage: null,
      routePending: true,
    });
    assert.equal(result.variant, "pending");
    assert.equal(result.text, "경로 생성 중…");
  });
});
