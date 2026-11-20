import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateIntervalWorkoutStatsInRange,
  getRideStatsPeriodRange,
  shiftRideStatsReference,
} from "../../src/lib/ride/rideStatsAggregate.ts";
import type { IntervalWorkoutRecord } from "../../src/lib/ride/intervalWorkout.ts";
import type { StoredRideSession } from "../../src/lib/ride/rideSessionsStorage.ts";

function workout(overrides: Partial<IntervalWorkoutRecord> = {}): IntervalWorkoutRecord {
  return {
    version: 1, id: "workout-1", intensity: "moderate",
    config: { highSec: 30, lowSec: 30, repeats: 2, warmupSec: 0, cooldownSec: 0, rounds: 1, roundRestSec: 0 },
    startElapsedSec: 0, endElapsedSec: 120, plannedSec: 120, elapsedSec: 120, activeSec: 100,
    phaseSeconds: { warmup: 0, work: 60, recovery: 60, rest: 0, cooldown: 0 },
    activePhaseSeconds: { warmup: 0, work: 50, recovery: 50, rest: 0, cooldown: 0 },
    signalGap: false, status: "completed", caloriesEstimate: 10,
    ...overrides,
  };
}

function ride(id: string, intervalWorkouts?: IntervalWorkoutRecord[]): StoredRideSession {
  return {
    id, endedAt: new Date(2026, 10, 20, 12).toISOString(), elapsedSec: 1800,
    distanceMeters: 6000, avgSpeedKmh: 12, caloriesEstimate: 100,
    routeDistanceMeters: 10000, routeDurationSec: 3000,
    ...(intervalWorkouts === undefined ? {} : { intervalWorkouts }),
  };
}

test("분기는 로컬 달력의 1·4·7·10월에서 시작하고 종료 경계는 다음 분기 첫날이다", () => {
  const range = getRideStatsPeriodRange("quarter", new Date(2026, 10, 20));
  assert.equal(range.start.getTime(), new Date(2026, 9, 1).getTime());
  assert.equal(range.endExclusive.getTime(), new Date(2027, 0, 1).getTime());
  assert.match(range.labelKo, /2026년 4분기/);
});

test("월말과 윤년에도 이전·다음 기간 이동이 달을 건너뛰지 않는다", () => {
  assert.equal(shiftRideStatsReference("month", new Date(2024, 0, 31), 1).getTime(), new Date(2024, 1, 1).getTime());
  assert.equal(shiftRideStatsReference("quarter", new Date(2026, 10, 20), 1).getTime(), new Date(2027, 0, 1).getTime());
  assert.equal(shiftRideStatsReference("quarter", new Date(2027, 0, 31), -1).getTime(), new Date(2026, 9, 1).getTime());
  assert.equal(shiftRideStatsReference("year", new Date(2024, 1, 29), 1).getTime(), new Date(2025, 0, 1).getTime());
});

test("일요일의 이전 주 조회는 월요일 시작 기준이며 입력 Date를 바꾸지 않는다", () => {
  const reference = new Date(2026, 10, 22, 15);
  assert.equal(shiftRideStatsReference("week", reference, -1).getTime(), new Date(2026, 10, 9).getTime());
  assert.equal(reference.getTime(), new Date(2026, 10, 22, 15).getTime());
});

test("완료와 중도 종료는 모두 수행시간에 포함하고 주행 전체 시간과 칼로리를 재사용하지 않는다", () => {
  const range = getRideStatsPeriodRange("month", new Date(2026, 10, 20));
  const records = [workout(), workout({ id: "workout-2", intensity: "light", status: "stopped", elapsedSec: 60, caloriesEstimate: 4 })];
  const stats = aggregateIntervalWorkoutStatsInRange([ride("ride-1", records)], range.start, range.endExclusive);
  assert.equal(stats.started, 2);
  assert.equal(stats.completed, 1);
  assert.equal(stats.elapsedSec, 180);
  assert.equal(stats.caloriesEstimate, 14);
  assert.equal(stats.intensitySeconds.moderate, 120);
  assert.equal(stats.intensitySeconds.light, 60);
  assert.equal(stats.activityDays, 1);
});

test("로컬과 서버의 같은 수행을 중복 집계하지 않으며 다른 주행의 같은 id는 별개다", () => {
  const range = getRideStatsPeriodRange("month", new Date(2026, 10, 20));
  const remote = ride("server-1", [workout()]);
  const local = { ...ride("local-1", [workout()]), serverRideId: "server-1" };
  const stats = aggregateIntervalWorkoutStatsInRange([remote, local, ride("server-2", [workout()])], range.start, range.endExclusive);
  assert.equal(stats.started, 2);
  assert.equal(stats.elapsedSec, 240);
});

test("미산정과 실제 0을 구분하고 센서 누락을 보존한다", () => {
  const range = getRideStatsPeriodRange("month", new Date(2026, 10, 20));
  const stats = aggregateIntervalWorkoutStatsInRange([ride("ride-1", [
    workout({ activeSec: null, caloriesEstimate: null, signalGap: true }),
    workout({ id: "workout-2", activeSec: 0, caloriesEstimate: 0 }),
  ])], range.start, range.endExclusive);
  assert.equal(stats.activeSec, 0);
  assert.equal(stats.activeUnknownCount, 1);
  assert.equal(stats.caloriesEstimate, 0);
  assert.equal(stats.caloriesUnknownCount, 1);
  assert.equal(stats.signalGapCount, 1);
});

test("구분 없는 옛 기록은 인터벌 수행 0회로 변환하지 않고 미확인 자료로 센다", () => {
  const range = getRideStatsPeriodRange("month", new Date(2026, 10, 20));
  const stats = aggregateIntervalWorkoutStatsInRange([ride("legacy"), ride("new", [])], range.start, range.endExclusive);
  assert.equal(stats.started, 0);
  assert.equal(stats.unclassifiedRideCount, 1);
});

test("조회 기간은 시작 포함·종료 제외이고 주행 종료일로 귀속한다", () => {
  const range = getRideStatsPeriodRange("quarter", new Date(2026, 10, 20));
  const rows = [
    { ...ride("included", [workout()]), endedAt: range.start.toISOString() },
    { ...ride("excluded", [workout()]), endedAt: range.endExclusive.toISOString() },
    { ...ride("invalid", [workout()]), endedAt: "invalid" },
  ];
  const stats = aggregateIntervalWorkoutStatsInRange(rows, range.start, range.endExclusive);
  assert.equal(stats.started, 1);
  assert.equal(stats.entries[0].key, "included:workout-1");
});

test("시작 직후 0초 기록은 운동 횟수나 활동일을 부풀리지 않는다", () => {
  const range = getRideStatsPeriodRange("month", new Date(2026, 10, 20));
  const stats = aggregateIntervalWorkoutStatsInRange([ride("ride-1", [workout({ elapsedSec: 0 })])], range.start, range.endExclusive);
  assert.equal(stats.started, 0);
  assert.equal(stats.activityDays, 0);
});
