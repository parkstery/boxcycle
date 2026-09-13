import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { routeDockUiPolicy } from "../../src/lib/routeDockUiPolicy.ts";

describe("routeDock riding hierarchy", () => {
  it("riding/paused — 편집·경유지 숨김·자동 접힘", () => {
    for (const stage of ["riding", "paused"] as const) {
      const p = routeDockUiPolicy(stage);
      assert.equal(p.ridingDiet, true);
      assert.equal(p.hideEditActions, true);
      assert.equal(p.hideStopsList, true);
      assert.equal(p.autoCollapse, true);
    }
  });

  it("ready-to-start — Go·재개는 유지, 저장·삭제는 숨김", () => {
    const p = routeDockUiPolicy("ready-to-start");
    assert.equal(p.preRideCompact, true);
    assert.equal(p.hideEditActions, true);
    assert.equal(p.hideStopsList, false);
    assert.equal(p.autoCollapse, false);
  });

  it("setup — 편집 UI 기본 노출", () => {
    const p = routeDockUiPolicy("setup");
    assert.equal(p.hideEditActions, false);
    assert.equal(p.hideStopsList, false);
  });

  it("editLocked 이면 setup 에서도 편집 액션 숨김", () => {
    const p = routeDockUiPolicy("setup", true);
    assert.equal(p.hideEditActions, true);
  });
});
