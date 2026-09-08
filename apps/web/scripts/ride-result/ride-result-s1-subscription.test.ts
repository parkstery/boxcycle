/**
 * S1-2: Ride conquest subscription lifecycle tests
 * 
 * Production controller: RideConquestSubscription (src/lib/rideConquestSubscription.ts)
 * Production import site: useRideConquestResult (src/hooks/useRideConquestResult.ts)
 * 
 * Tests capture REAL callback that subscribe received and forcibly invoke it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RideConquestSubscription } from "../../src/lib/rideConquestSubscription.ts";
import type { RideConquestResult } from "../../src/lib/rideConquestResult.ts";

type MockSnapshot = {
  exists: () => boolean;
  data: () => any;
  id: string;
};

describe("S1-2: Subscription Lifecycle (Production Controller)", () => {
  it("S1-2: Capture real callback + late A callback after B activation → no extra events", () => {
    let subscribeCount = 0;
    let unsubscribeCount = 0;
    const capturedCallbacks: Array<{ success: (snap: MockSnapshot) => void; error: (err: Error) => void }> = [];

    // Mock deps with REAL callback capture
    const mockDeps = {
      firestore: {} as any,
      subscribe: (docRef: any, onSuccess: any, onError: any) => {
        subscribeCount++;
        // S1-2: Capture REAL production callback
        capturedCallbacks.push({ success: onSuccess, error: onError });
        return () => { unsubscribeCount++; };
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };

    const results: RideConquestResult[] = [];
    const subscription = new RideConquestSubscription(mockDeps, {
      onResult: (r) => results.push(r),
    });

    // Activate A
    subscription.activate({ userId: "user-A", localRecordId: "rec-A", serverRideId: "srv-A" });
    const beforeActivateB = results.length;
    assert.equal(subscribeCount, 1, "Subscribe called once for A");
    assert.ok(capturedCallbacks.length === 1, "Captured A callback");

    // Activate B (same uid)
    subscription.activate({ userId: "user-A", localRecordId: "rec-B", serverRideId: "srv-B" });
    assert.equal(subscribeCount, 2, "Subscribe called again for B");
    assert.equal(unsubscribeCount, 1, "A unsubscribed");
    assert.ok(capturedCallbacks.length === 2, "Captured B callback");

    const beforeLatecallback = results.length;

    // S1-2: Forcibly invoke stored A success callback (late)
    const lateACallback = capturedCallbacks[0]!.success;
    const mockSnapA: MockSnapshot = {
      exists: () => true,
      data: () => ({ userId: "user-A", conquestResult: { newMeters: 500 } }),
      id: "srv-A",
    };
    lateACallback(mockSnapA);

    // Assert: NO extra B state events from late A callback
    const afterLateCallback = results.length;
    assert.equal(afterLateCallback, beforeLatecallback, "Late A callback did NOT produce extra events (generation guard blocked)");

    // B's real callback should still work
    const realBCallback = capturedCallbacks[1]!.success;
    const mockSnapB: MockSnapshot = {
      exists: () => true,
      data: () => ({ userId: "user-A", conquestResult: { newMeters: 300 } }),
      id: "srv-B",
    };
    realBCallback(mockSnapB);
    assert.ok(results.length > afterLateCallback, "B callback applied successfully");

    subscription.dispose();
    assert.equal(unsubscribeCount, 2, "B unsubscribed");
  });

  it("S1-2: Late A error callback after B activation → no extra events", () => {
    const capturedCallbacks: Array<{ success: (snap: MockSnapshot) => void; error: (err: Error) => void }> = [];

    const mockDeps = {
      firestore: {} as any,
      subscribe: (docRef: any, onSuccess: any, onError: any) => {
        capturedCallbacks.push({ success: onSuccess, error: onError });
        return () => {};
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };

    const results: RideConquestResult[] = [];
    const subscription = new RideConquestSubscription(mockDeps, {
      onResult: (r) => results.push(r),
    });

    subscription.activate({ userId: "user-A", localRecordId: "rec-A", serverRideId: "srv-A" });
    subscription.activate({ userId: "user-A", localRecordId: "rec-B", serverRideId: "srv-B" });

    const beforeLateError = results.length;

    // Late A error callback
    const lateAErrorCallback = capturedCallbacks[0]!.error;
    lateAErrorCallback(new Error("Late A error"));

    assert.equal(results.length, beforeLateError, "Late A error did NOT produce extra events");

    subscription.dispose();
  });

  it("S1-2: Dispose → late callbacks blocked", () => {
    const capturedCallbacks: Array<{ success: (snap: MockSnapshot) => void; error: (err: Error) => void }> = [];

    const mockDeps = {
      firestore: {} as any,
      subscribe: (docRef: any, onSuccess: any, onError: any) => {
        capturedCallbacks.push({ success: onSuccess, error: onError });
        return () => {};
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };

    const results: RideConquestResult[] = [];
    const subscription = new RideConquestSubscription(mockDeps, {
      onResult: (r) => results.push(r),
    });

    subscription.activate({ userId: "user-A", localRecordId: "rec-A", serverRideId: "srv-A" });
    subscription.dispose();

    const beforeLateCallback = results.length;

    // Late callback after dispose
    const lateCallback = capturedCallbacks[0]!.success;
    const mockSnap: MockSnapshot = {
      exists: () => true,
      data: () => ({ userId: "user-A", conquestResult: { newMeters: 500 } }),
      id: "srv-A",
    };
    lateCallback(mockSnap);

    assert.equal(results.length, beforeLateCallback, "Late callback after dispose blocked");
  });

  it("S1-2: Account switch (userId change) → late callbacks blocked", () => {
    const capturedCallbacks: Array<{ success: (snap: MockSnapshot) => void; error: (err: Error) => void }> = [];

    const mockDeps = {
      firestore: {} as any,
      subscribe: (docRef: any, onSuccess: any, onError: any) => {
        capturedCallbacks.push({ success: onSuccess, error: onError });
        return () => {};
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };

    const results: RideConquestResult[] = [];
    const subscription = new RideConquestSubscription(mockDeps, {
      onResult: (r) => results.push(r),
    });

    // User A
    subscription.activate({ userId: "user-A", localRecordId: "rec-A", serverRideId: "srv-A" });

    // User B (account switch)
    subscription.activate({ userId: "user-B", localRecordId: "rec-B", serverRideId: "srv-B" });

    const beforeLateCallback = results.length;

    // Late User A callback
    const lateACallback = capturedCallbacks[0]!.success;
    const mockSnapA: MockSnapshot = {
      exists: () => true,
      data: () => ({ userId: "user-A", conquestResult: { newMeters: 500 } }),
      id: "srv-A",
    };
    lateACallback(mockSnapA);

    assert.equal(results.length, beforeLateCallback, "Late User A callback blocked after account switch");

    subscription.dispose();
  });
});
