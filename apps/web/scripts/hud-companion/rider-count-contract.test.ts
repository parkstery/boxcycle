// 동행 HUD — Trail 실시간 단일 진실. 인원수와 빈 문장은 companionHudCopy 한 함수.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companionHudCopy,
  formatCompanionHudActivityLine,
} from "../../src/lib/companionHudCount.ts";
import {
  countOtherLiveRidePeers,
  hasOtherLiveRidePeer,
  shouldShowCompanionEmptyCopy,
} from "../../src/lib/peerHud.ts";

describe("companionHudCopy — §4.3 세 상태 + 불변식", () => {
  it("주행 중 · others=0 → 인원 1, 빈 문장 표시", () => {
    const c = companionHudCopy({
      otherLiveRiderCount: 0,
      selfRiding: true,
      coursePeerNamesLength: 0,
    });
    assert.equal(c.riderCount, 1);
    assert.equal(c.showEmptyCopy, true);
  });

  it("주행 중 · others=1 → 인원 2, 빈 문장 없음", () => {
    const c = companionHudCopy({
      otherLiveRiderCount: 1,
      selfRiding: true,
      coursePeerNamesLength: 0,
    });
    assert.equal(c.riderCount, 2);
    assert.equal(c.showEmptyCopy, false);
  });

  it("주행 안 함 · others=0 → 인원 절 없음, 빈 문장 표시", () => {
    const c = companionHudCopy({
      otherLiveRiderCount: 0,
      selfRiding: false,
      coursePeerNamesLength: 0,
    });
    assert.equal(c.riderCount, null);
    assert.equal(c.showEmptyCopy, true);
  });

  it("주행 안 함 · others=1 → 인원 절 없음, 빈 문장 없음", () => {
    const c = companionHudCopy({
      otherLiveRiderCount: 1,
      selfRiding: false,
      coursePeerNamesLength: 0,
    });
    assert.equal(c.riderCount, null);
    assert.equal(c.showEmptyCopy, false);
  });

  it("어떤 조합에서도 N≥2 와 빈 문장이 동시에 나오지 않는다", () => {
    for (const selfRiding of [true, false]) {
      for (const others of [0, 1, 2, 5]) {
        for (const names of [0, 1]) {
          const c = companionHudCopy({
            otherLiveRiderCount: others,
            selfRiding,
            coursePeerNamesLength: names,
          });
          if (c.riderCount != null && c.riderCount >= 2) {
            assert.equal(
              c.showEmptyCopy,
              false,
              `selfRiding=${selfRiding} others=${others} names=${names}`,
            );
          }
        }
      }
    }
  });
});

describe("이탈 최소 재현 · aggregate 2 · 실시간 0", () => {
  it("주행 중이면 1명이지 2명이 아니다", () => {
    const c = companionHudCopy({
      otherLiveRiderCount: 0,
      selfRiding: true,
      coursePeerNamesLength: 0,
    });
    assert.equal(c.riderCount, 1);
    assert.equal(c.showEmptyCopy, true);
    assert.equal(
      formatCompanionHudActivityLine({
        aggregateHudLine: "지금 2명 주행 · 최근 24시간 3회",
        displayedRiderCount: c.riderCount,
      }),
      "지금 1명 주행 · 최근 24시간 3회",
    );
  });

  it("주행 안 함이면 낡은 인원수 절을 빼 열만 남긴다", () => {
    const c = companionHudCopy({
      otherLiveRiderCount: 0,
      selfRiding: false,
      coursePeerNamesLength: 0,
    });
    assert.equal(c.riderCount, null);
    assert.equal(
      formatCompanionHudActivityLine({
        aggregateHudLine: "지금 2명 주행 · 최근 24시간 3회",
        displayedRiderCount: c.riderCount,
      }),
      "최근 24시간 3회",
    );
  });
});

describe("formatCompanionHudActivityLine — 인원수 절만 교체", () => {
  it("실시간 2명으로 올리고 좋아요 절은 유지", () => {
    assert.equal(
      formatCompanionHudActivityLine({
        aggregateHudLine: "지금 1명 주행 · 좋아요 3",
        displayedRiderCount: 2,
      }),
      "지금 2명 주행 · 좋아요 3",
    );
  });

  it("인원수가 없으면 인원수 절만 제거", () => {
    assert.equal(
      formatCompanionHudActivityLine({
        aggregateHudLine: "지금 1명 주행",
        displayedRiderCount: null,
      }),
      null,
    );
  });

  it("aggregate 줄이 없어도 주행 중이면 지금 N명", () => {
    assert.equal(
      formatCompanionHudActivityLine({
        aggregateHudLine: null,
        displayedRiderCount: 2,
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
    const c = companionHudCopy({
      otherLiveRiderCount: count,
      selfRiding: true,
      coursePeerNamesLength: 0,
    });
    assert.equal(c.showEmptyCopy, false);
  });

  it("나뿐 → count 0, boolean false, 빈 문장 표시", () => {
    const rows = [{ uid: "self" }];
    const count = countOtherLiveRidePeers(rows, "self");
    const hasOther = hasOtherLiveRidePeer(rows, "self");
    assert.equal(count, 0);
    assert.equal(hasOther, false);
    assert.equal(shouldShowCompanionEmptyCopy(0, hasOther), true);
    const c = companionHudCopy({
      otherLiveRiderCount: count,
      selfRiding: true,
      coursePeerNamesLength: 0,
    });
    assert.equal(c.showEmptyCopy, true);
  });
});
