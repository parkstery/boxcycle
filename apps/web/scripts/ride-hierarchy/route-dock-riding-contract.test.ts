import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { routeDockUiPolicy } from "../../src/lib/route/routeDockUiPolicy.ts";

describe("routeDock riding hierarchy", () => {
  /**
   * 2026-09-15 정정. 종전 계약은 주행 중 `hideStopsList: true` 를 요구했는데, 그것이
   * 펼친 패널을 빈 껍데기로 만들었다. Chief 의도는 「지도 가림 최소화 = 접기」이지
   * 「정보 삭제」가 아니다 — 접기(autoCollapse)와 편집 제거(ridingDiet)만 남기고,
   * 경유지 목록은 표시하되 조작만 잠근다(lockStopEditing).
   */
  it("riding/paused — 접고 편집만 뺀다. 경유지는 표시하되 조작 잠금", () => {
    for (const stage of ["riding", "paused"] as const) {
      const p = routeDockUiPolicy(stage);
      assert.equal(p.ridingDiet, true, "편집 UI 다이어트는 유지");
      assert.equal(p.hideEditActions, true, "저장·삭제는 숨김");
      assert.equal(p.autoCollapse, true, "주행 시작 시 접힘");
      assert.equal(p.hideStopsList, false, "펼치면 경유지가 보여야 한다(빈 껍데기 금지)");
      assert.equal(p.lockStopEditing, true, "주행 중 경로 변형은 막는다");
    }
  });

  it("ready-to-start — Go·재개는 유지, 저장·삭제는 숨김", () => {
    const p = routeDockUiPolicy("ready-to-start");
    assert.equal(p.preRideCompact, true);
    assert.equal(p.hideEditActions, true);
    assert.equal(p.hideStopsList, false);
    assert.equal(p.autoCollapse, false);
    assert.equal(p.lockStopEditing, false, "주행 전에는 경유지 삭제 가능");
  });

  it("setup — 편집 UI 기본 노출", () => {
    const p = routeDockUiPolicy("setup");
    assert.equal(p.hideEditActions, false);
    assert.equal(p.hideStopsList, false);
  });

  it("editLocked 이면 setup 에서도 편집 액션 숨김·경유지 조작 잠금", () => {
    const p = routeDockUiPolicy("setup", true);
    assert.equal(p.hideEditActions, true);
    assert.equal(p.lockStopEditing, true);
    assert.equal(p.hideStopsList, false, "잠겨도 목록 자체는 보인다");
  });
});
