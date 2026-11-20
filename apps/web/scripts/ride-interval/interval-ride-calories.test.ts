import test from "node:test";
import assert from "node:assert/strict";
import { IntervalWorkoutTracker } from "../../src/lib/ride/intervalWorkout";
import { estimateRideCaloriesWithIntervals } from "../../src/lib/ride/intervalRideCalories";
import { isDiscardableRideRecord, resolveRideEndDisposition } from "../../src/lib/ride/rideRecordPolicy";
import { isDiscardableRideRecord as serverDiscard } from "../../../../functions/src/rideRecordPolicy";
import { parseCaloriesMeta, isLegacyDistanceCalories } from "../../src/lib/ride/caloriesEstimate";

const config = { highSec: 30, lowSec: 30, repeats: 5, warmupSec: 0, cooldownSec: 0, rounds: 1, roundRestSec: 0 };
function workout(intensity: "light" | "moderate" | "vigorous" = "moderate") {
  const tracker = new IntervalWorkoutTracker();
  tracker.begin({ id: "workout", config, intensity, elapsedSec: 0, activeSec: 0, weightKg: 70 });
  tracker.advance({ elapsedSec: 300, activeSec: 300 });
  return tracker.snapshot();
}
const snapshot = { weightKg: 70, met: 6, intensityId: "moderate" as const };
test("interval energy replaces its baseline share and leaves later general riding intact", () => {
  const result = estimateRideCaloriesWithIntervals({ snapshot, activeSec: 600, signalGap: false, workouts: workout() });
  // 150s*6 + 150s*3.5 + remaining 300s*6; interval time is not added twice.
  assert.equal(result.caloriesEstimate, 63);
  assert.equal(result.caloriesMeta?.version, "MET-interval-v2");
  assert.equal(parseCaloriesMeta(result.caloriesMeta)?.version, "MET-interval-v2");
  assert.equal(isLegacyDistanceCalories(result), false);
});
test("same duration supports self-selected intensity, while absent sensor/weight remains unknown", () => {
  const estimate = (intensity: "light" | "vigorous") => estimateRideCaloriesWithIntervals({ snapshot, activeSec: 300, signalGap: false, workouts: workout(intensity) }).caloriesEstimate!;
  assert.ok(estimate("vigorous") > estimate("light"));
  assert.equal(estimateRideCaloriesWithIntervals({ snapshot, activeSec: null, signalGap: false, workouts: workout() }).caloriesEstimate, null);
  assert.equal(estimateRideCaloriesWithIntervals({ snapshot: null, activeSec: 300, signalGap: false, workouts: workout() }).caloriesEstimate, null);
});
test("ordinary riding retains the old method and interval gaps remain visible", () => {
  assert.equal(estimateRideCaloriesWithIntervals({ snapshot, activeSec: 1800, signalGap: false, workouts: [] }).caloriesEstimate, 210);
  assert.equal(estimateRideCaloriesWithIntervals({ snapshot, activeSec: 300, signalGap: true, workouts: workout() }).caloriesMeta?.signalGap, true);
});
test("meaningful interval survives short virtual distance without relaxing Claim eligibility", () => {
  const records = workout();
  for (const discard of [isDiscardableRideRecord, serverDiscard]) {
    assert.equal(discard(0, 300, records), false);
    assert.equal(discard(0, 300), true);
    assert.equal(discard(0, 100, records), true);
    assert.equal(discard(-1, 300, records), true);
    assert.equal(discard(0, 300, [{ version: 1, elapsedSec: Infinity }]), true);
  }
});

test("preserving a short-distance workout does not create saved Route progress", () => {
  const input = {
    distanceMeters: 0, elapsedSec: 300, intervalWorkouts: workout(),
    hasSavedRoute: true, previousProgressRatio: 0.4, completionRatio: 0.4,
  };
  assert.deepEqual(resolveRideEndDisposition(input), {
    discardRecord: false, qualifiesAsRide: false, applySavedRouteProgress: false,
  });
  assert.equal(resolveRideEndDisposition({ ...input, distanceMeters: 50, completionRatio: 0.41 }).applySavedRouteProgress, true);
});
