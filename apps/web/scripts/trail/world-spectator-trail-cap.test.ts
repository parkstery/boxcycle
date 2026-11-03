import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickWorldSpectatorTrailIds,
  WORLD_SPECTATOR_TRAIL_LIMIT,
} from "../../src/features/map-overlays/listenerScopePolicy.ts";

/** 비용 절감 L3 — 세계 지도 관전 구독 Trail 수 상한(document/ops/20261103-cost-squeeze/01-audit.md). */
describe("pickWorldSpectatorTrailIds", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, liveRiderCount: i }));

  it("상한을 넘지 않는다", () => {
    const ids = pickWorldSpectatorTrailIds({ currentTrailId: null, openTrails: many, activeTrailIds: ["x", "y"] });
    assert.equal(ids.length, WORLD_SPECTATOR_TRAIL_LIMIT);
  });

  it("현재 Trail 은 라이더가 적어도 항상 들어간다", () => {
    const ids = pickWorldSpectatorTrailIds({ currentTrailId: "mine", openTrails: many, activeTrailIds: [] });
    assert.equal(ids[0], "mine");
    assert.ok(ids.length <= WORLD_SPECTATOR_TRAIL_LIMIT);
  });

  it("라이더 많은 순, 남는 자리에 안전망 Trail, 중복 없음", () => {
    const ids = pickWorldSpectatorTrailIds({
      currentTrailId: "t1",
      openTrails: [
        { id: "t1", liveRiderCount: 1 },
        { id: "t9", liveRiderCount: 9 },
        { id: "t5", liveRiderCount: 5 },
      ],
      activeTrailIds: ["t5", "z"],
      limit: 4,
    });
    assert.deepEqual(ids, ["t1", "t9", "t5", "z"]);
  });
});
