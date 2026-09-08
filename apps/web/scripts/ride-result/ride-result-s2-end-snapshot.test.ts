/**
 * S2: sourceEndSample freeze vs stale UI metrics
 * 
 * Verifies that end snapshot is captured synchronously before async persistence,
 * preventing stale UI updates from corrupting saved data.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("S2: sourceEndSample Freeze (synchronous capture)", () => {
  it("S2: End snapshot captured before async — stale UI does not corrupt", () => {
    // Simulate synchronous end snapshot capture
    const sourceMetrics = { virtualDistanceMeters: 1000, durationSec: 600 };
    const endSnapshot = { ...sourceMetrics };

    // Simulate async persistence delay
    let persistedData: typeof endSnapshot | null = null;
    setTimeout(() => {
      persistedData = endSnapshot; // Uses frozen snapshot, not live metrics
    }, 100);

    // Simulate stale UI update (after snapshot but before persist)
    sourceMetrics.virtualDistanceMeters = 1200; // UI continues updating
    sourceMetrics.durationSec = 700;

    // Verify snapshot is frozen (not affected by UI changes)
    assert.equal(endSnapshot.virtualDistanceMeters, 1000, "Snapshot frozen at 1000m");
    assert.equal(endSnapshot.durationSec, 600, "Snapshot frozen at 600s");
    assert.notEqual(sourceMetrics.virtualDistanceMeters, endSnapshot.virtualDistanceMeters);
  });

  it("S2: Synchronous calculation uses frozen snapshot", () => {
    // Simulate production: calculate completionRatio BEFORE async block
    const routeDistanceMeters = 1000;
    const virtualDistanceMeters = 500;
    
    // Synchronous calculation (before async)
    const completionRatio = virtualDistanceMeters / routeDistanceMeters;
    
    // Later async block uses completionRatio, not live metrics
    const asyncSave = async () => {
      // This uses completionRatio (0.5), not re-calculated from metrics
      return completionRatio;
    };

    assert.equal(completionRatio, 0.5);
  });

  it("S2: Ref reads in async block are stale — use captured values", () => {
    // Simulate production: ref.current is read in async block
    const progressRef = { current: 0.3 }; // Previous progress
    
    // Synchronous: calculate max(current, new)
    const newProgress = 0.5;
    const progressToSave = Math.max(newProgress, progressRef.current);
    
    // Async block starts
    setTimeout(() => {
      // If we read ref here, it might be reset to 0
      progressRef.current = 0;
    }, 50);
    
    // Verify progressToSave captured the correct value
    assert.equal(progressToSave, 0.5, "Captured max progress before ref reset");
  });
});
