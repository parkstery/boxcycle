import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeSavedRouteProgressRatio } from "../../src/lib/firestoreSavedRoutes.ts";
import { isRouteCompletion, ROUTE_COMPLETION_RATIO_THRESHOLD } from "../../src/lib/rideRecordPolicy.ts";

describe("ride-continue §6 A — SavedRoute progress·완주 정합", () => {
  it("mergeSavedRouteProgressRatio — 31→43% = 43%", () => {
    assert.equal(mergeSavedRouteProgressRatio(0, 0.31, 0.43), 0.43);
  });

  it("mergeSavedRouteProgressRatio — 43→늦은 31% = 43%", () => {
    assert.equal(mergeSavedRouteProgressRatio(0, 0.43, 0.31), 0.43);
  });

  it("mergeSavedRouteProgressRatio — completed=1 이면 갱신 안 함", () => {
    assert.equal(mergeSavedRouteProgressRatio(1, 1, 0.2), null);
  });

  it("isRouteCompletion — 98%만 완주, 97%는 미완주", () => {
    assert.equal(isRouteCompletion(0.98), true);
    assert.equal(isRouteCompletion(0.97), false);
    assert.equal(ROUTE_COMPLETION_RATIO_THRESHOLD, 0.98);
  });
});
