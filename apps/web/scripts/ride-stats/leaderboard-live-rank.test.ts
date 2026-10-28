import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeLeaderboardLiveRank,
  mergeLeaderboardLines,
  type LeaderboardLiveRow,
} from "../../src/components/leaderboard/leaderboardLiveRank.ts";

function row(
  rank: number,
  nickname: string,
  valueKm: number,
  isMe = false,
): LeaderboardLiveRow {
  return { rank, nickname, valueKm, isMe, liveTrailId: null };
}

describe("mergeLeaderboardLines", () => {
  it("top 과 around 중복을 제거한다", () => {
    const top = [row(1, "a", 10)];
    const around = [row(1, "a", 10), row(2, "b", 9, true)];
    const merged = mergeLeaderboardLines(top, around);
    assert.equal(merged.length, 2);
  });
});

describe("computeLeaderboardLiveRank", () => {
  it("10명 창은 상단·중간·마지막 내 순위를 포함하고 부족한 참가자를 만들지 않는다", () => {
    for (const mine of [0, 7, 14]) {
      const entries = Array.from({ length: 15 }, (_, i) => row(i + 1, `r${i}`, 20 - i, i === mine));
      const result = computeLeaderboardLiveRank(entries, 20 - mine, 0, 10);
      assert.equal(result.rows.length, 10);
      assert.ok(result.rows.some(r => r.isMe));
      assert.equal(result.rank, mine + 1);
    }
    const short = [row(1, "a", 10), row(2, "me", 9, true)];
    assert.equal(computeLeaderboardLiveRank(short, 9, 0, 10).rows.length, 2);
  });
  const board = [
    row(1, "geum", 17.1),
    row(2, "me", 16.6, true),
    row(3, "r3", 12.4),
    row(4, "r4", 9.8),
    row(5, "r5", 9.5),
    row(6, "r6", 8.7),
  ];

  it("한 명 추월 — 순위가 올라가고 주변 5줄을 준다", () => {
    const r = computeLeaderboardLiveRank(board, 16.6, 0.6);
    assert.equal(r.rank, 1);
    assert.equal(r.gapToNextKm, null);
    assert.equal(r.rows.find((x) => x.isMe)?.valueKm, 17.2);
  });

  it("동점 — 같은 순위 번호를 쓴다", () => {
    const tight = [
      row(1, "a", 10),
      row(2, "b", 9, true),
      row(3, "c", 8),
    ];
    const r = computeLeaderboardLiveRank(tight, 9, 0);
    assert.equal(r.rank, 2);
    const alsoNine = computeLeaderboardLiveRank(
      [row(1, "a", 10), row(2, "b", 9), row(3, "me", 9, true)],
      9,
      0,
    );
    assert.equal(alsoNine.rank, 2);
    const next = computeLeaderboardLiveRank(
      [row(1, "a", 10), row(2, "b", 9), row(3, "c", 8), row(4, "me", 8, true)],
      8,
      0.1,
    );
    assert.equal(next.rank, 3);
  });

  it("1위 — gap 과 aheadRank 가 null", () => {
    const r = computeLeaderboardLiveRank(board, 16.6, 0.5);
    assert.equal(r.rank, 1);
    assert.equal(r.gapToNextKm, null);
    assert.equal(r.aheadRank, null);
  });

  it("목록 밖에서 진입", () => {
    const others = [row(1, "a", 10), row(2, "b", 9), row(3, "c", 8)];
    const r = computeLeaderboardLiveRank(others, 0, 8.5);
    assert.equal(r.rank, 3);
    assert.ok(r.rows.some((x) => x.isMe));
  });

  it("addedKm 0 — 기존 순위 유지", () => {
    const r = computeLeaderboardLiveRank(board, 16.6, 0);
    assert.equal(r.rank, 2);
    assert.equal(r.rows.find((x) => x.isMe)?.valueKm, 16.6);
    assert.equal(r.gapToNextKm, 0.5);
    assert.equal(r.aheadRank, 1);
  });
});
