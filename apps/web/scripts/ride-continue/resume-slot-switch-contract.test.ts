/**
 * 이어달리기 대상 교체 계약 — none / acquire / switch + ad-hoc 빈 슬롯만 확보.
 * 사보타주: switch 를 「해제 없이 확보」로 되돌리면 실패해야 한다.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySlotTransition,
  emptyRideResumeSlot,
  resolveAdhocSaveSlotAcquireAction,
  resolveResumeSlotSwitchAction,
  type ResumeSlotSwitchDecision,
} from "../../src/lib/ride/rideResumeSlotPolicy.ts";

/** 잘못된 구현: 점이면 무조건 acquire — switch 를 없앰 */
function acquireOnlyNeverSwitch(
  activeRouteId: string | null,
  targetRouteId: string,
): ResumeSlotSwitchDecision {
  if (activeRouteId === targetRouteId) return "none";
  return "acquire";
}

describe("resolveResumeSlotSwitchAction", () => {
  it("이미 활성 → none", () => {
    assert.equal(resolveResumeSlotSwitchAction("route-A", "route-A"), "none");
  });

  it("빈 슬롯 → acquire", () => {
    assert.equal(resolveResumeSlotSwitchAction(null, "route-B"), "acquire");
  });

  it("다른 경로 활성 → switch (해제 후 확보)", () => {
    assert.equal(resolveResumeSlotSwitchAction("route-A", "route-B"), "switch");
  });

  it("acquire 단독으로는 점유 슬롯을 교체하지 않는다", () => {
    let slot = emptyRideResumeSlot();
    slot = applySlotTransition(slot, { type: "markInitializedEmpty" });
    slot = applySlotTransition(slot, { type: "acquire", routeId: "route-A" });
    assert.equal(slot.activeRouteId, "route-A");
    const after = applySlotTransition(slot, { type: "acquire", routeId: "route-B" });
    assert.equal(after.activeRouteId, "route-A", "해제 없이 확보하면 A 유지");
  });

  it("switch 의미: abandon 후 acquire 로만 B 가 된다", () => {
    let slot = emptyRideResumeSlot();
    slot = applySlotTransition(slot, { type: "markInitializedEmpty" });
    slot = applySlotTransition(slot, { type: "acquire", routeId: "route-A" });
    const at = "2026-10-06T00:00:00.000Z";
    slot = applySlotTransition(slot, {
      type: "abandon",
      at,
      expectedRouteId: "route-A",
    });
    assert.equal(slot.activeRouteId, null);
    assert.equal(slot.lastProcessedEnd?.routeId, "route-A");
    slot = applySlotTransition(slot, { type: "acquire", routeId: "route-B" });
    assert.equal(slot.activeRouteId, "route-B");
  });

  it("사보타주: 교체를 「해제 없이 확보」로 되돌리면 점유 시 switch 계약이 실패한다", () => {
    const sabotaged = acquireOnlyNeverSwitch("route-A", "route-B");
    assert.equal(sabotaged, "acquire", "사보타주 헬퍼는 acquire");
    assert.notEqual(
      resolveResumeSlotSwitchAction("route-A", "route-B"),
      sabotaged,
      "실제 판정이 acquire-only 이면 이 assertion 이 실패한다",
    );
    assert.equal(resolveResumeSlotSwitchAction("route-A", "route-B"), "switch");
  });
});

describe("resolveAdhocSaveSlotAcquireAction", () => {
  it("빈 슬롯 → acquire", () => {
    assert.equal(resolveAdhocSaveSlotAcquireAction(null), "acquire");
  });

  it("이미 대상 있음 → skip (교체하지 않음)", () => {
    assert.equal(resolveAdhocSaveSlotAcquireAction("route-A"), "skip");
  });
});
