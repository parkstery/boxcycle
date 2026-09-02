import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSavedRouteProgressUpdate } from "../../src/lib/savedRouteProgressPolicy.ts";
import { isRouteCompletion, ROUTE_COMPLETION_RATIO_THRESHOLD } from "../../src/lib/rideRecordPolicy.ts";

describe("ride-continue §6 A — SavedRoute progress·완주 정합", () => {
  it("resolveSavedRouteProgressUpdate — 31→43% = 43%", () => {
    const d = resolveSavedRouteProgressUpdate(
      { completed: 0, lastProgressRatio: 0.31 },
      0.43,
    );
    assert.equal(d.shouldWrite, true);
    assert.equal(d.nextProgressRatio, 0.43);
  });

  it("resolveSavedRouteProgressUpdate — 43→늦은 31% = 43%", () => {
    const d = resolveSavedRouteProgressUpdate(
      { completed: 0, lastProgressRatio: 0.43 },
      0.31,
    );
    assert.equal(d.shouldWrite, false);
    assert.equal(d.nextProgressRatio, 0.43);
  });

  it("resolveSavedRouteProgressUpdate — completed=1 이면 갱신 안 함", () => {
    const d = resolveSavedRouteProgressUpdate({ completed: 1, lastProgressRatio: 1 }, 0.2);
    assert.equal(d.shouldWrite, false);
    assert.equal(d.nextProgressRatio, 1);
  });

  it("isRouteCompletion — 98%만 완주, 97%는 미완주", () => {
    assert.equal(isRouteCompletion(0.98), true);
    assert.equal(isRouteCompletion(0.97), false);
    assert.equal(ROUTE_COMPLETION_RATIO_THRESHOLD, 0.98);
  });
});
