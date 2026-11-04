// 비용 L9 — 목록 대상이 아닌 Trail 은 예약 재계산을 건너뛴다. 혼자 비공개 주행에서 분당 삭제 3.6회였다(2026-11-04).
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  markTrailUnlistable,
  resetOpenTrailListingRefreshForTests,
  scheduleOpenTrailListingRefresh,
} from "../../src/lib/trail/repo/firestoreOpenTrailListings.ts";
import {
  TRAIL_ACTIVITY_TOUCH_MIN_INTERVAL_MS,
  TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS,
  TRAIL_PRESENCE_STALE_MS,
} from "../../src/lib/trail/trailLivePolicy.ts";

describe("L9 Listing 재계산", () => {
  let nowMs = 1_000_000;
  let timers: Array<() => void> = [];
  let runs: string[] = [];
  const flush = async () => {
    const t = timers;
    timers = [];
    for (const fn of t) fn();
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    nowMs = 1_000_000;
    timers = [];
    runs = [];
    resetOpenTrailListingRefreshForTests({
      clock: {
        now: () => nowMs,
        setTimeout: (fn: () => void) => {
          timers.push(fn);
          return timers.length;
        },
        clearTimeout: () => {},
      },
      refreshBody: async (id: string) => {
        runs.push(id);
      },
    });
  });

  it("M0 — 표시가 없으면 재계산이 예약된다(시험이 건너뜀을 구별한다)", async () => {
    scheduleOpenTrailListingRefresh("t1");
    await flush();
    assert.deepEqual(runs, ["t1"]);
  });

  it("목록 대상이 아닌 Trail 은 예약하지 않고, 10분 뒤 다시 본다", async () => {
    markTrailUnlistable("t1");
    scheduleOpenTrailListingRefresh("t1");
    assert.equal(timers.length, 0);
    nowMs += 600_000;
    scheduleOpenTrailListingRefresh("t1");
    await flush();
    assert.deepEqual(runs, ["t1"]);
  });

  it("주기 — 갱신이 「살아 있음」 240초 안에 두 번 들어오고 하트비트 두 번에 한 번 나간다", () => {
    assert.ok(TRAIL_ACTIVITY_TOUCH_MIN_INTERVAL_MS * 2 < TRAIL_PRESENCE_STALE_MS);
    assert.ok(TRAIL_ACTIVITY_TOUCH_MIN_INTERVAL_MS < TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS * 2);
    assert.ok(TRAIL_ACTIVITY_TOUCH_MIN_INTERVAL_MS > TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS);
  });
});
