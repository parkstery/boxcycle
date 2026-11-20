import assert from "node:assert/strict";
import test from "node:test";
import { getPointOnRouteByDistance, type LineStringGeometry } from "../../src/lib/geo/geo.ts";
import { buildRideMilestones, readRideMilestoneProgress } from "../../src/lib/route/rideMilestones.ts";

const geometry: LineStringGeometry = {
  type: "LineString",
  coordinates: [[127, 37.5], [127.15, 37.5]],
};
const plan = buildRideMilestones(geometry, 10_000);

test("milestones use the same route position as the live rider, even when geometry length differs", () => {
  assert.deepEqual(plan.map((gate) => [gate.label, gate.distanceM]), [
    ["¼", 2500], ["HALF", 5000], ["¾", 7500], ["FINISH", 10000],
  ]);
  assert.deepEqual(plan[1].position, getPointOnRouteByDistance(geometry, 5000));
  assert.deepEqual(plan[3].position, getPointOnRouteByDistance(geometry, 10000));
  assert.ok(Math.abs(plan[1].headingDeg - 90) < 1);
  assert.deepEqual(buildRideMilestones(null, 10_000), []);
});

test("resuming skips passed milestones and each crossing plays once across distance corrections", () => {
  const resumed = readRideMilestoneProgress(plan, 5000, 5000);
  assert.equal(resumed.crossed, undefined);
  assert.equal(resumed.next?.label, "¾");

  const crossing = readRideMilestoneProgress(plan, 7499, 7500);
  assert.equal(crossing.crossed?.label, "¾");
  const corrected = readRideMilestoneProgress(plan, crossing.highWaterM, 7498);
  assert.equal(corrected.highWaterM, 7500);
  assert.equal(corrected.next?.label, "FINISH");
  assert.equal(readRideMilestoneProgress(plan, corrected.highWaterM, 7501).crossed, undefined);
});

test("sparse samples play only the most recent checkpoint and leave arrival to the ride lifecycle", () => {
  assert.equal(readRideMilestoneProgress(plan, 0, 7800).crossed?.label, "¾");
  const finish = readRideMilestoneProgress(plan, 9999, 10000);
  assert.equal(finish.next, undefined);
  assert.equal(finish.crossed, undefined);
});
