import assert from "node:assert/strict";
import test from "node:test";
import { IntervalWorkoutTracker, parseIntervalWorkouts } from "../../src/lib/ride/intervalWorkout.ts";

const config = { highSec: 10, lowSec: 10, repeats: 1, warmupSec: 10, cooldownSec: 10, rounds: 1, roundRestSec: 0 };
function begin(tracker: IntervalWorkoutTracker, overrides: Record<string, unknown> = {}) {
  tracker.begin({ id: "first", config, intensity: "moderate", elapsedSec: 0, activeSec: 0, weightKg: 70, ...overrides });
}

test("sample spanning phases distributes confirmed pedal time and clamps at completion", () => {
  const tracker = new IntervalWorkoutTracker(); begin(tracker);
  tracker.advance({ elapsedSec: 50, activeSec: 25 });
  const [record] = tracker.snapshot();
  assert.equal(record.status, "completed");
  assert.equal(record.elapsedSec, 40);
  assert.equal(record.activeSec, 20);
  assert.deepEqual(record.phaseSeconds, { warmup: 10, work: 10, recovery: 10, rest: 0, cooldown: 10 });
  assert.deepEqual(record.activePhaseSeconds, { warmup: 5, work: 5, recovery: 5, rest: 0, cooldown: 5 });
  assert.equal(record.caloriesEstimate, Math.round(70 * (15 * 3.5 + 5 * 6) / 3600));
  tracker.advance({ elapsedSec: 100, activeSec: 75 });
  assert.deepEqual(tracker.snapshot(), [record]);
});

test("same Ride activity time during pause does not advance workout", () => {
  const tracker = new IntervalWorkoutTracker(); begin(tracker);
  tracker.advance({ elapsedSec: 5, activeSec: 5 });
  tracker.advance({ elapsedSec: 5, activeSec: 5 });
  tracker.finish({ elapsedSec: 5, activeSec: 5 });
  assert.equal(tracker.snapshot()[0].elapsedSec, 5);
  assert.equal(tracker.snapshot()[0].activeSec, 5);
});

test("missing sensor stays unknown; first connection does not backfill missing activity", () => {
  const tracker = new IntervalWorkoutTracker(); begin(tracker, { activeSec: null });
  tracker.advance({ elapsedSec: 5, activeSec: null });
  assert.equal(tracker.snapshot()[0].caloriesEstimate, null);
  tracker.advance({ elapsedSec: 10, activeSec: 100 });
  tracker.advance({ elapsedSec: 15, activeSec: 103 });
  tracker.finish({ elapsedSec: 20, activeSec: null });
  const [record] = tracker.snapshot();
  assert.equal(record.activeSec, 3);
  assert.equal(record.signalGap, true);
  assert.deepEqual(record.activePhaseSeconds, { warmup: 0, work: 3, recovery: 0, rest: 0, cooldown: 0 });
});

test("counter reset is not invented activity and invalid/backward samples are ignored", () => {
  const tracker = new IntervalWorkoutTracker(); begin(tracker, { activeSec: 100 });
  tracker.advance({ elapsedSec: 5, activeSec: 105 });
  tracker.advance({ elapsedSec: Number.NaN, activeSec: 1000 });
  tracker.advance({ elapsedSec: 4, activeSec: 1000 });
  tracker.advance({ elapsedSec: 10, activeSec: 0 });
  tracker.finish({ elapsedSec: 15, activeSec: 3 });
  assert.equal(tracker.snapshot()[0].activeSec, 8);
  assert.equal(tracker.snapshot()[0].signalGap, true);
});

test("configuration restart preserves old execution, new config and nonzero start offset", () => {
  const tracker = new IntervalWorkoutTracker(); begin(tracker);
  tracker.begin({ id: "second", config: { ...config, repeats: 2 }, intensity: "vigorous", elapsedSec: 12, activeSec: 12, weightKg: 70 });
  tracker.finish({ elapsedSec: 22, activeSec: 22, status: "disabled" });
  const records = tracker.snapshot();
  assert.equal(records.length, 2);
  assert.equal(records[0].status, "reconfigured");
  assert.equal(records[0].elapsedSec, 12);
  assert.equal(records[1].startElapsedSec, 12);
  assert.equal(records[1].elapsedSec, 10);
  assert.equal(records[1].status, "disabled");
  assert.equal(records[1].config.repeats, 2);
  assert.equal(records[1].intensity, "vigorous");
});

test("snapshots are detached and preserve private estimate input; reset separates Rides", () => {
  const tracker = new IntervalWorkoutTracker(); begin(tracker);
  tracker.advance({ elapsedSec: 5, activeSec: 5 });
  const snapshot = tracker.snapshot();
  snapshot[0].config.highSec = 500;
  snapshot[0].phaseSeconds.warmup = 500;
  assert.equal(tracker.snapshot()[0].config.highSec, 10);
  assert.equal(tracker.snapshot()[0].phaseSeconds.warmup, 5);
  assert.equal(tracker.snapshot()[0].weightKg, 70);
  tracker.reset(); assert.deepEqual(tracker.snapshot(), []);
});

test("known zero activity estimates zero; no weight remains unknown", () => {
  const tracker = new IntervalWorkoutTracker(); begin(tracker);
  tracker.finish({ elapsedSec: 20, activeSec: 0 });
  assert.equal(tracker.snapshot()[0].caloriesEstimate, 0);
  tracker.reset(); begin(tracker, { weightKg: null });
  tracker.finish({ elapsedSec: 20, activeSec: 20 });
  assert.equal(tracker.snapshot()[0].caloriesEstimate, null);
});

test("same activity time uses selected work category and recovery category", () => {
  const a = new IntervalWorkoutTracker(); const b = new IntervalWorkoutTracker();
  begin(a, { intensity: "light" }); begin(b, { intensity: "vigorous" });
  a.finish({ elapsedSec: 40, activeSec: 40 }); b.finish({ elapsedSec: 40, activeSec: 40 });
  assert.ok(b.snapshot()[0].caloriesEstimate! > a.snapshot()[0].caloriesEstimate!);
});

test("historical parser roundtrips supported snapshots and strips unknown fields", () => {
  const tracker = new IntervalWorkoutTracker(); begin(tracker);
  tracker.finish({ elapsedSec: 40, activeSec: 20 });
  const record = tracker.snapshot()[0];
  assert.deepEqual(parseIntervalWorkouts([{ ...record, feedback: "harder", ignoredField: true }]), [{ ...record, feedback: "harder" }]);
  assert.deepEqual(parseIntervalWorkouts(undefined), []);
  assert.deepEqual(parseIntervalWorkouts([record, record]), [record]);
});

test("historical parser drops corrupt durations, counters, config and fake completion", () => {
  const tracker = new IntervalWorkoutTracker(); begin(tracker); tracker.finish({ elapsedSec: 15, activeSec: 10 });
  const record = tracker.snapshot()[0];
  for (const invalid of [
    { ...record, version: 2 }, { ...record, intensity: "elite" }, { ...record, elapsedSec: Number.NaN },
    { ...record, plannedSec: 50 }, { ...record, endElapsedSec: 20 }, { ...record, activeSec: 40 },
    { ...record, status: "completed" }, { ...record, caloriesEstimate: -1 },
    { ...record, config: { ...config, repeats: 0 } },
    { ...record, phaseSeconds: { ...record.phaseSeconds, work: 99 } },
  ]) assert.deepEqual(parseIntervalWorkouts([invalid]), []);
});

test("64 execution bound preserves history instead of discarding earlier records", () => {
  const tracker = new IntervalWorkoutTracker();
  for (let i = 0; i < 65; i++) {
    begin(tracker, { id: `workout-${i}`, elapsedSec: i * 40, activeSec: i * 40 });
    tracker.finish({ elapsedSec: (i + 1) * 40, activeSec: (i + 1) * 40 });
  }
  assert.equal(tracker.snapshot().length, 64);
  assert.equal(tracker.snapshot()[0].id, "workout-0");
  assert.equal(tracker.snapshot()[63].id, "workout-63");
});

test("zero-time StrictMode and batched configuration starts do not leave phantom history", () => {
  const tracker = new IntervalWorkoutTracker(); begin(tracker);
  tracker.begin({ id: "replacement", config, intensity: "light", elapsedSec: 0, activeSec: 0, weightKg: 70 });
  tracker.finish({ elapsedSec: 0, activeSec: 0 });
  assert.deepEqual(tracker.snapshot(), []);
});
