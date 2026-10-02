import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  deltaVisibilityReadMeters,
  resetVisibilityReadMeters,
  snapshotVisibilityReadMeters,
  trackVisibilityListener,
  noteVisibilityOneShot,
  noteTrailPresenceWriteProxy,
} from "../../src/lib/debug/visibilityReadMeters.ts";
import { createTrailheadIdleVisibilityHarness } from "./visibility-lifecycle-harness.ts";
import {
  setDocumentVisibilityOverrideForTests,
  getDocumentVisibilityOverrideForTests,
  resolveDocumentVisible,
} from "../../src/lib/debug/documentVisibilityOverride.ts";

describe("visibilityReadMeters", () => {
  beforeEach(() => {
    resetVisibilityReadMeters();
  });

  it("listener open/close totals and one-shot / presence are independent", () => {
    const u = trackVisibilityListener("trailMembers", () => {});
    noteVisibilityOneShot("catalogPublications");
    noteTrailPresenceWriteProxy();
    const mid = snapshotVisibilityReadMeters();
    assert.equal(mid.listeners.trailMembers.open, 1);
    assert.equal(mid.oneShots.catalogPublications, 1);
    assert.equal(mid.trailPresenceWrites, 1);
    u();
    const end = snapshotVisibilityReadMeters();
    assert.equal(end.listeners.trailMembers.open, 0);
    assert.equal(end.listeners.trailMembers.closeTotal, 1);
    assert.equal(end.oneShots.catalogPublications, 1);
    assert.equal(end.trailPresenceWrites, 1);
  });

  it("double unsub does not double closeTotal", () => {
    const u = trackVisibilityListener("economy", () => {});
    u();
    u();
    assert.equal(snapshotVisibilityReadMeters().listeners.economy.closeTotal, 1);
  });
});

describe("documentVisibilityOverride", () => {
  afterEach(() => {
    setDocumentVisibilityOverrideForTests(null);
  });

  it("DEV override flips resolveDocumentVisible without touching document", () => {
    setDocumentVisibilityOverrideForTests(false);
    assert.equal(getDocumentVisibilityOverrideForTests(), false);
    assert.equal(resolveDocumentVisible(), false);
    setDocumentVisibilityOverrideForTests(true);
    assert.equal(resolveDocumentVisible(), true);
    setDocumentVisibilityOverrideForTests(null);
    assert.equal(getDocumentVisibilityOverrideForTests(), null);
  });
});

describe("Trailhead idle visibility lifecycle harness", () => {
  const WORLD_N = 3;
  const LABEL_N = 4;

  beforeEach(() => {
    resetVisibilityReadMeters();
  });

  it("control 0 cycles: after settle, further window has zero app-controlled deltas", () => {
    const h = createTrailheadIdleVisibilityHarness({
      worldTrailCount: WORLD_N,
      catalogLabelCount: LABEL_N,
      routeGeometryGapFillCount: 1,
    });
    h.settleVisible();
    const before = snapshotVisibilityReadMeters();
    h.cycleVisibility(0);
    const delta = deltaVisibilityReadMeters(before, snapshotVisibilityReadMeters());
    for (const path of Object.keys(delta.listeners) as (keyof typeof delta.listeners)[]) {
      assert.equal(delta.listeners[path].openTotal, 0, `${path} openTotal`);
      assert.equal(delta.listeners[path].closeTotal, 0, `${path} closeTotal`);
    }
    for (const path of Object.keys(delta.oneShots) as (keyof typeof delta.oneShots)[]) {
      assert.equal(delta.oneShots[path], 0, `${path}`);
    }
    assert.equal(delta.trailPresenceWrites, 0);
  });

  it("10 cycles: app-resubscribe paths scale linearly; kept paths stay 0", () => {
    const h = createTrailheadIdleVisibilityHarness({
      worldTrailCount: WORLD_N,
      catalogLabelCount: LABEL_N,
      routeGeometryGapFillCount: 1,
    });
    h.settleVisible();
    const before = snapshotVisibilityReadMeters();
    h.cycleVisibility(10);
    const after = snapshotVisibilityReadMeters();
    const delta = deltaVisibilityReadMeters(before, after);

    // kept across visibility
    assert.equal(delta.listeners.openTrailListings.openTotal, 0);
    assert.equal(delta.listeners.openTrailListings.closeTotal, 0);
    assert.equal(delta.listeners.collectionGroupLiveRides.openTotal, 0);
    assert.equal(delta.listeners.collectionGroupLiveRides.closeTotal, 0);
    assert.equal(delta.listeners.users.openTotal, 0);
    assert.equal(delta.listeners.economy.openTotal, 0);
    assert.equal(delta.listeners.conquest.openTotal, 0);

    // app resubscribe
    assert.equal(delta.listeners.trailMembers.openTotal, 10);
    assert.equal(delta.listeners.trailMembers.closeTotal, 10);
    assert.equal(delta.listeners.trailLiveRides.openTotal, 10 * WORLD_N);
    assert.equal(delta.listeners.trailLiveRides.closeTotal, 10 * WORLD_N);

    assert.equal(delta.oneShots.activityWorldSummary, 10);
    assert.equal(delta.oneShots.activityWorldGlobal, 10);
    assert.equal(delta.oneShots.activityWorldLiveIds, 10);
    assert.equal(delta.oneShots.activityWorldBatchInvocation, 10);
    assert.equal(delta.oneShots.activityWorldRouteActivityGetDoc, 0);
    assert.equal(delta.oneShots.catalogPublications, 10);
    assert.equal(delta.oneShots.catalogLabels, 10 * LABEL_N);
    assert.equal(delta.oneShots.routeGeometryGapFill, 10);
    assert.equal(delta.trailPresenceWrites, 10);

    // open gauges return to settle levels
    assert.equal(after.listeners.trailMembers.open, before.listeners.trailMembers.open);
    assert.equal(after.listeners.trailLiveRides.open, before.listeners.trailLiveRides.open);
    assert.equal(after.classification.trailMembers, "app_resubscribe_on_visible");
    assert.equal(after.classification.openTrailListings, "kept_across_visibility");
  });

  it("repeat runs yield identical deltas (determinism)", () => {
    const run = () => {
      resetVisibilityReadMeters();
      const h = createTrailheadIdleVisibilityHarness({
        worldTrailCount: WORLD_N,
        catalogLabelCount: LABEL_N,
      });
      h.settleVisible();
      const before = snapshotVisibilityReadMeters();
      h.cycleVisibility(10);
      return deltaVisibilityReadMeters(before, snapshotVisibilityReadMeters());
    };
    const a = run();
    const b = run();
    assert.deepEqual(a.listeners, b.listeners);
    assert.deepEqual(a.oneShots, b.oneShots);
    assert.equal(a.trailPresenceWrites, b.trailPresenceWrites);
  });
});
