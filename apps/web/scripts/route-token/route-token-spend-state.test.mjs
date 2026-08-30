import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRouteTokenSpendMessage } from "../../src/lib/directionsDirectGuard.core.mjs";
import {
  applyRouteSpend,
  applySubscribedBalance,
  bindUser,
  computeEffectiveBalance,
  createEmptySession,
  isInsufficient,
} from "../../src/lib/routeTokenSpendState.mjs";

describe("route token spend state", () => {
  it("Guest A 0 고착이 Guest B 온보딩 3에 영향 주지 않음", () => {
    let session = createEmptySession("guest-a");
    session = applySubscribedBalance(session, 3);
    session = applyRouteSpend(session, 0, "req_a_3", formatRouteTokenSpendMessage);
    assert.equal(isInsufficient(session), true);

    session = bindUser(session, "guest-b");
    session = applySubscribedBalance(session, 3);
    assert.equal(computeEffectiveBalance(session), 3);
    assert.equal(isInsufficient(session), false);
    assert.equal(session.lastSpendMessage, null);
  });

  it("응답 0 후 Firestore 적립 1+ → 즉시 재개", () => {
    let session = createEmptySession("guest-earn");
    session = applySubscribedBalance(session, 0);
    session = applyRouteSpend(session, 0, "req_zero", formatRouteTokenSpendMessage);
    assert.equal(isInsufficient(session), true);

    session = applySubscribedBalance(session, 1);
    assert.equal(computeEffectiveBalance(session), 1);
    assert.equal(isInsufficient(session), false);
  });

  it("구독이 응답 잔액에 수렴하면 임시 응답 해제", () => {
    let session = createEmptySession("guest-lag");
    session = applySubscribedBalance(session, 3);
    session = applyRouteSpend(session, 2, "req_one", formatRouteTokenSpendMessage);
    assert.equal(computeEffectiveBalance(session), 2);

    session = applySubscribedBalance(session, 2);
    assert.equal(computeEffectiveBalance(session), 2);
    assert.equal(session.routeResponseBalance, null);
  });

  it("Firestore 지연 중 즉시 차단", () => {
    let session = createEmptySession("guest-lag");
    session = applySubscribedBalance(session, 3);
    session = applyRouteSpend(session, 0, "req_three", formatRouteTokenSpendMessage);
    assert.equal(computeEffectiveBalance(session), 0);
    assert.equal(isInsufficient(session), true);
  });
});
