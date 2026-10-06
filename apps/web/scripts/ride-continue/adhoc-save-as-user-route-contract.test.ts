import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveAdhocSaveAppliedState,
  resolveAdhocSaveServerAction,
  type AdhocSaveProgressIntent,
  type AdhocSaveServerAction,
} from "../../src/lib/route/adhocSaveAsUserRoutePolicy.ts";
import { isRouteCompletion } from "../../src/lib/ride/rideRecordPolicy.ts";

/** 종전 버그: 몇 %든 promote — 계약이 이를 거부하는지 사보타주용 */
function alwaysPromote(_intent: AdhocSaveProgressIntent): AdhocSaveServerAction {
  return { action: "promote" };
}

describe("adhoc 「내 경로로 저장」 — 완주/미완주 판정", () => {
  it("30% 저장 → progress 0.30 (미완주)", () => {
    const intent = { completedRoute: false, progressRatio: 0.3 };
    assert.equal(resolveAdhocSaveServerAction(intent).action, "progress");
    const applied = resolveAdhocSaveAppliedState(null, intent);
    assert.equal(applied.completed, 0);
    assert.equal(applied.lastProgressRatio, 0.3);
  });

  it("99% → 완주(promote) — 임계 0.98 기존 산출", () => {
    assert.equal(isRouteCompletion(0.99), true);
    const intent = { completedRoute: isRouteCompletion(0.99), progressRatio: 0.99 };
    assert.equal(resolveAdhocSaveServerAction(intent).action, "promote");
    const applied = resolveAdhocSaveAppliedState(null, intent);
    assert.equal(applied.completed, 1);
    assert.equal(applied.lastProgressRatio, 1);
  });

  it("기존 완주 재저장 30% → 완주 유지", () => {
    const intent = { completedRoute: false, progressRatio: 0.3 };
    const applied = resolveAdhocSaveAppliedState(
      { completed: 1, lastProgressRatio: 1 },
      intent,
    );
    assert.equal(applied.completed, 1);
    assert.equal(applied.lastProgressRatio, 1);
    // 서버 action 은 progress 이지만 transaction 정책이 완주를 지킴
    assert.equal(resolveAdhocSaveServerAction(intent).action, "progress");
  });

  it("기존 60% 재저장 30% → 60% 유지", () => {
    const intent = { completedRoute: false, progressRatio: 0.3 };
    const applied = resolveAdhocSaveAppliedState(
      { completed: 0, lastProgressRatio: 0.6 },
      intent,
    );
    assert.equal(applied.completed, 0);
    assert.equal(applied.lastProgressRatio, 0.6);
  });

  it("사보타주: 무조건 promote 로 되돌리면 30% 미완주 계약이 실패한다", () => {
    const intent = { completedRoute: false, progressRatio: 0.3 };
    const sabotaged = alwaysPromote(intent);
    assert.equal(sabotaged.action, "promote", "사보타주 헬퍼는 promote");
    // 실제 판정은 progress — 사보타주와 달라야 계약이 살아 있다
    assert.notEqual(
      resolveAdhocSaveServerAction(intent).action,
      sabotaged.action,
      "실제 판정이 무조건 promote 이면 이 assertion 이 실패한다",
    );
    assert.equal(resolveAdhocSaveAppliedState(null, intent).completed, 0);
  });
});
