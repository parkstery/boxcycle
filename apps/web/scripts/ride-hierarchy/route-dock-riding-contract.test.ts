import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { routeDockUiPolicy } from "../../src/lib/route/routeDockUiPolicy.ts";

describe("routeDock riding hierarchy", () => {
  /**
   * 2026-09-15 정정. 종전 계약은 주행 중 `hideStopsList: true` 를 요구했는데, 그것이
   * 펼친 패널을 빈 껍데기로 만들었다 — 경유지는 표시하되 조작만 잠근다(lockStopEditing).
   *
   * 2026-09-28 Chief. 자동 접힘(`autoCollapse`)을 없앴다. dock 헤더가 Go·일시정지·종료
   * 버튼 자리가 된 뒤로는, 접어 버리면 멈추려는 사용자가 버튼을 찾지 못한다.
   * 저장·삭제가 dock 에서 빠지면서 `hideEditActions`·`preRideCompact` 도 함께 사라졌다.
   */
  it("정책에는 자동 접힘·편집 액션 숨김 필드가 없다", () => {
    const keys = Object.keys(routeDockUiPolicy("riding")).sort();
    assert.deepEqual(keys, [
      "hideStopsList",
      "isActiveRide",
      "isPreRideReady",
      "lockStopEditing",
      "ridingDiet",
    ]);
  });

  it("riding/paused — 편집만 빼고, 경유지는 표시하되 조작 잠금", () => {
    for (const stage of ["riding", "paused"] as const) {
      const p = routeDockUiPolicy(stage);
      assert.equal(p.isActiveRide, true);
      assert.equal(p.ridingDiet, true, "편집 UI 다이어트는 유지");
      assert.equal(p.hideStopsList, false, "펼치면 경유지가 보여야 한다(빈 껍데기 금지)");
      assert.equal(p.lockStopEditing, true, "주행 중 경로 변형은 막는다");
    }
  });

  it("ready-to-start — Go·재개는 유지, 경유지 삭제 가능", () => {
    const p = routeDockUiPolicy("ready-to-start");
    assert.equal(p.isPreRideReady, true);
    assert.equal(p.hideStopsList, false);
    assert.equal(p.lockStopEditing, false, "주행 전에는 경유지 삭제 가능");
  });

  it("setup — 경유지 목록 노출·조작 가능", () => {
    const p = routeDockUiPolicy("setup");
    assert.equal(p.hideStopsList, false);
    assert.equal(p.lockStopEditing, false);
  });

  it("editLocked 이면 setup 에서도 경유지 조작 잠금", () => {
    const p = routeDockUiPolicy("setup", true);
    assert.equal(p.lockStopEditing, true);
    assert.equal(p.hideStopsList, false, "잠겨도 목록 자체는 보인다");
  });
});
