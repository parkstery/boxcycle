// 동행 HUD 인원수 — max(aggregate, 1 + 실시간 다른 라이더).
// 폴링 주기·TTL 은 건드리지 않는다. 4B hasOtherLiveRiders 는 count > 0 파생.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companionDisplayedRiderCount,
  formatCompanionHudActivityLine,
} from "../../src/lib/companionHudCount.ts";
import {
  countOtherLiveRidePeers,
  hasOtherLiveRidePeer,
  shouldShowCompanionEmptyCopy,
} from "../../src/lib/peerHud.ts";

describe("companionDisplayedRiderCount", () => {
  it("aggregate=1, others=1, 주행 중 → 2", () => {
    assert.equal(
      companionDisplayedRiderCount({
        aggregateCount: 1,
        otherLiveRiderCount: 1,
        selfRiding: true,
      }),
      2,
    );
  });

  it("aggregate=3, others=1, 주행 중 → 3 (구독 밖 인원 유지)", () => {
    assert.equal(
      companionDisplayedRiderCount({
        aggregateCount: 3,
        otherLiveRiderCount: 1,
        selfRiding: true,
      }),
      3,
    );
  });

  it("주행 중 아님 → aggregate 그대로", () => {
    assert.equal(
      companionDisplayedRiderCount({
        aggregateCount: 1,
        otherLiveRiderCount: 1,
        selfRiding: false,
      }),
      1,
    );
    assert.equal(
      companionDisplayedRiderCount({
        aggregateCount: null,
        otherLiveRiderCount: 1,
        selfRiding: false,
      }),
      null,
    );
  });

  it("혼자 주행 · aggregate 아직 없음 → 1", () => {
    assert.equal(
      companionDisplayedRiderCount({
        aggregateCount: null,
        otherLiveRiderCount: 0,
        selfRiding: true,
      }),
      1,
    );
  });
});

describe("formatCompanionHudActivityLine", () => {
  it("지금 1명을 2명으로 올리고 좋아요 절은 유지", () => {
    assert.equal(
      formatCompanionHudActivityLine({
        aggregateHudLine: "지금 1명 주행 · 좋아요 3",
        displayedRiderCount: 2,
        selfRiding: true,
      }),
      "지금 2명 주행 · 좋아요 3",
    );
  });

  it("주행 중이 아니면 원문 유지", () => {
    assert.equal(
      formatCompanionHudActivityLine({
        aggregateHudLine: "지금 1명 주행",
        displayedRiderCount: 2,
        selfRiding: false,
      }),
      "지금 1명 주행",
    );
  });

  it("aggregate 줄이 없어도 주행 중이면 지금 N명", () => {
    assert.equal(
      formatCompanionHudActivityLine({
        aggregateHudLine: null,
        displayedRiderCount: 2,
        selfRiding: true,
      }),
      "지금 2명 주행",
    );
  });
});

describe("4B hasOtherLiveRiders 는 count > 0 파생", () => {
  it("다른 라이더 1명 → count 1, boolean true, 빈 문장 없음", () => {
    const rows = [{ uid: "self" }, { uid: "peer" }];
    const count = countOtherLiveRidePeers(rows, "self");
    const hasOther = hasOtherLiveRidePeer(rows, "self");
    assert.equal(count, 1);
    assert.equal(hasOther, count > 0);
    assert.equal(shouldShowCompanionEmptyCopy(0, hasOther), false);
  });

  it("나뿐 → count 0, boolean false, 빈 문장 표시", () => {
    const rows = [{ uid: "self" }];
    const count = countOtherLiveRidePeers(rows, "self");
    const hasOther = hasOtherLiveRidePeer(rows, "self");
    assert.equal(count, 0);
    assert.equal(hasOther, false);
    assert.equal(shouldShowCompanionEmptyCopy(0, hasOther), true);
  });
});
