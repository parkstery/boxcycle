import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RECENT_TRAIL_GRACE_MS,
  TRAIL_PROGRESS_KEEP_MS,
  formatRemainingMinutes,
  parseRecentTrails,
  trailProgressFor,
  visibleRecentTrails,
  withRideProgress,
  withTrailLeft,
} from "../../src/lib/trail/recentTrails.ts";

/** 2026-11-05 Chief D4·D5 — 최근 내가 달린 Trail(10분)·Trail 별 진행(이어 달리기) */
const meta = (id: string) => ({ trailId: id, displayNumber: 35, regionLabel: "남산", distanceKm: 4.2, publicationId: "p1" });
const T0 = 1_800_000_000_000;

describe("recentTrails", () => {
  it("빈 Trail 유예는 10분", () => {
    assert.equal(RECENT_TRAIL_GRACE_MS, 10 * 60_000);
  });

  it("주행 종료가 진행을 남기고, 나와야 최근 목록에 뜬다", () => {
    let e = withRideProgress([], meta("a"), 3200, 4200, T0);
    assert.equal(visibleRecentTrails(e, T0, new Set()).length, 0, "아직 안에 있음");
    e = withTrailLeft(e, "a", T0 + 1000);
    const v = visibleRecentTrails(e, T0 + 3 * 60_000, new Set());
    assert.equal(v.length, 1);
    assert.equal(formatRemainingMinutes(v[0].remainingMs), "8분 남음");
    assert.equal(visibleRecentTrails(e, T0 + 1000 + RECENT_TRAIL_GRACE_MS, new Set()).length, 0, "10분 지나면 사라짐");
  });

  it("지금 있는·지금 달리는 목록의 Trail 은 최근에서 뺀다", () => {
    const e = withTrailLeft(withRideProgress([], meta("a"), 10, 100, T0), "a", T0);
    assert.equal(visibleRecentTrails(e, T0 + 1, new Set(["a"])).length, 0);
  });

  it("완주(0.98 이상)는 completed — 처음부터 다시", () => {
    const e = withRideProgress([], meta("a"), 4150, 4200, T0);
    assert.equal(e[0].completed, true);
    assert.equal(e[0].progressMeters, 4200);
    assert.equal(withRideProgress([], meta("b"), 4000, 4200, T0)[0].completed, false);
  });

  it("진행은 24시간 동안 이어 달리기에 쓴다", () => {
    const e = withRideProgress([], meta("a"), 3200, 4200, T0);
    assert.equal(trailProgressFor(e, "a", T0 + TRAIL_PROGRESS_KEEP_MS)?.progressMeters, 3200);
    assert.equal(trailProgressFor(e, "a", T0 + TRAIL_PROGRESS_KEEP_MS + 1), null);
  });

  it("다시 달리면 나온 표시가 지워지고 맨 앞으로", () => {
    let e = withRideProgress([], meta("a"), 100, 1000, T0);
    e = withRideProgress(e, meta("b"), 100, 1000, T0 + 1);
    e = withTrailLeft(e, "a", T0 + 2);
    e = withRideProgress(e, meta("a"), 500, 1000, T0 + 3);
    assert.deepEqual(e.map((x) => x.trailId), ["a", "b"]);
    assert.equal(e[0].leftAtMs, null);
  });

  it("깨진 저장값은 버린다", () => {
    assert.deepEqual(parseRecentTrails("{"), []);
    assert.deepEqual(parseRecentTrails(JSON.stringify([{ trailId: 1 }])), []);
  });
});
