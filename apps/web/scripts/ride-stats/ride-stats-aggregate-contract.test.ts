// UserInfoSheet 통계 — 마지막 주행·일일 주행 집계 계약
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateRideStatsForLocalDay,
  aggregateRideStatsForPeriod,
  pickLastRide,
} from "../../src/lib/rideStatsAggregate.ts";
import type { StoredRideSession } from "../../src/lib/rideSessionsStorage.ts";

function session(id: string, endedAt: Date, extra: Partial<StoredRideSession> = {}) {
  return {
    id,
    endedAt: endedAt.toISOString(),
    elapsedSec: 600,
    distanceMeters: 3000,
    avgSpeedKmh: 18,
    caloriesEstimate: 100,
    routeDistanceMeters: 3000,
    routeDurationSec: 600,
    ...extra,
  } as StoredRideSession;
}

describe("pickLastRide · endedAt 최신 유효 Ride", () => {
  it("여러 건 중 endedAt 이 가장 늦은 유효 Ride 를 고른다", () => {
    const refDay = new Date(2026, 8, 13, 12, 0, 0, 0);
    const rows = [
      session("a", new Date(2026, 8, 13, 8, 0, 0, 0)),
      session("b", new Date(2026, 8, 13, 10, 30, 0, 0)),
      session("c", new Date(2026, 8, 12, 23, 0, 0, 0)),
    ];
    assert.equal(pickLastRide(rows)?.id, "b");
    assert.notEqual(pickLastRide(rows)?.id, "a");
    void refDay;
  });

  it("폐기 기준(100m 이하·5초 이하) Ride 는 후보에서 제외한다", () => {
    const rows = [
      session("discard", new Date(2026, 8, 13, 11, 0, 0, 0), { distanceMeters: 50, elapsedSec: 10 }),
      session("valid", new Date(2026, 8, 13, 9, 0, 0, 0)),
    ];
    assert.equal(pickLastRide(rows)?.id, "valid");
  });

  it("유효 Ride 가 없으면 null", () => {
    assert.equal(pickLastRide([]), null);
    assert.equal(
      pickLastRide([session("x", new Date(2026, 8, 13, 9, 0, 0, 0), { distanceMeters: 50, elapsedSec: 3 })]),
      null,
    );
  });
});

describe("aggregateRideStatsForLocalDay · 로컬 오늘 자정 경계", () => {
  const now = new Date(2026, 8, 13, 15, 0, 0, 0);

  it("오늘 00:00 이상·내일 00:00 미만 endedAt 만 집계한다", () => {
    const rows = [
      session("yesterday-late", new Date(2026, 8, 12, 23, 59, 59, 999)),
      session("today-early", new Date(2026, 8, 13, 0, 0, 0, 0)),
      session("today-noon", new Date(2026, 8, 13, 12, 0, 0, 0)),
      session("tomorrow", new Date(2026, 8, 14, 0, 0, 0, 0)),
    ];
    const { stats } = aggregateRideStatsForLocalDay(rows, now);
    assert.equal(stats.rides, 2);
    assert.equal(stats.distanceMeters, 6000);
    assert.equal(stats.elapsedSec, 1200);
  });

  it("0건이면 0 으로 집계한다", () => {
    const { stats } = aggregateRideStatsForLocalDay([], now);
    assert.equal(stats.rides, 0);
    assert.equal(stats.distanceMeters, 0);
    assert.equal(stats.elapsedSec, 0);
  });
});

describe("aggregateRideStatsForPeriod · 주간·월간·연간 회귀", () => {
  const now = new Date(2026, 8, 13, 12, 0, 0, 0);
  const rows = [session("w", new Date(2026, 8, 13, 9, 0, 0, 0))];

  it("week · month · year 모두 1건 이상 집계 가능", () => {
    for (const period of ["week", "month", "year"] as const) {
      const { stats } = aggregateRideStatsForPeriod(rows, period, now);
      assert.ok(stats.rides >= 1, period);
    }
  });
});
