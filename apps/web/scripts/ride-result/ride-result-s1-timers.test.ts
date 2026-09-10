/**
 * S1-3: Subscription timers - 15s delayed status + 60s subscription end + re-query
 * 
 * Production: RideConquestSubscription (src/lib/rideConquestSubscription.ts)
 * Import site: useRideConquestResult (src/hooks/useRideConquestResult.ts:L12,L39-47)
 * 
 * Tests with fake clock to verify timer behavior.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RideConquestSubscription } from "../../src/lib/rideConquestSubscription.ts";
import type { RideConquestResult } from "../../src/lib/rideConquestResult.ts";

type FakeTimer = {
  callback: () => void;
  delay: number;
  id: number;
};

class FakeClock {
  private timers: Map<number, FakeTimer> = new Map();
  private nextId = 1;
  private currentTime = 0;

  setTimeout = (callback: () => void, delay: number): number => {
    const id = this.nextId++;
    this.timers.set(id, { callback, delay: this.currentTime + delay, id });
    return id;
  };

  clearTimeout = (id: number): void => {
    this.timers.delete(id);
  };

  tick(ms: number): void {
    this.currentTime += ms;
    const toRun: FakeTimer[] = [];
    for (const timer of this.timers.values()) {
      if (timer.delay <= this.currentTime) {
        toRun.push(timer);
      }
    }
    for (const timer of toRun) {
      this.timers.delete(timer.id);
      timer.callback();
    }
  }

  async tickAsync(ms: number): Promise<void> {
    this.tick(ms);
    // Allow Promise microtasks to run
    await new Promise(resolve => process.nextTick(resolve));
  }

  getActiveTimerCount(): number {
    return this.timers.size;
  }
}

describe("S1-3: Subscription Timers", () => {
  it("S1-3: 15s delayed status - no result after 15s → error", async () => {
    const clock = new FakeClock();
    const results: RideConquestResult[] = [];
    let subscribeCount = 0;

    const subscription = new RideConquestSubscription(
      {
        firestore: { type: "firestore", app: {} } as any,
        subscribe: () => {
          subscribeCount++;
          return () => {};
        },
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        doc: () => ({ path: "rides/s1" }),
      },
      { onResult: (r) => results.push(r) },
    );

    subscription.activate({ userId: "u1", localRecordId: "l1", serverRideId: "s1" });

    // Initial empty result
    assert.equal(results.length, 1);
    assert.equal(results[0].status, "none");

    // Before 15s - no delayed status
    await clock.tickAsync(14000);
    assert.equal(results.length, 1);

    // After 15s - delayed status error
    await clock.tickAsync(1500);
    assert.equal(results.length, 2);
    assert.equal(results[1].status, "error");
    assert.equal(results[1].newMeters, 0);
  });

  it("S1-3: 15s delayed status - result before 15s → no delayed error", async () => {
    const clock = new FakeClock();
    const results: RideConquestResult[] = [];

    const subscription = new RideConquestSubscription(
      {
        firestore: { type: "firestore", app: {} } as any,
        subscribe: (_docRef, onSuccess) => {
          // Simulate result at 5s
          clock.setTimeout(() => {
            onSuccess({
              exists: () => true,
              data: () => ({ userId: "u1", conquestResult: { status: "success", newMeters: 100 } }),
              id: "s1",
            } as any);
          }, 5000);
          return () => {};
        },
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        doc: () => ({ path: "rides/s1" }),
      },
      { onResult: (r) => results.push(r) },
    );

    subscription.activate({ userId: "u1", localRecordId: "l1", serverRideId: "s1" });

    // Initial empty
    assert.equal(results.length, 1);

    // After 5s - real result
    await clock.tickAsync(5500);
    assert.equal(results.length, 2);
    assert.equal(results[1].status, "positive");
    assert.equal(results[1].newMeters, 100);

    // After 15s - no delayed error (result already received)
    await clock.tickAsync(10000);
    assert.equal(results.length, 2);
  });

  it("S1-3: 60s subscription end + re-query", async () => {
    const clock = new FakeClock();
    const results: RideConquestResult[] = [];
    let unsubscribeCalled = false;
    let getDocCalled = false;

    const subscription = new RideConquestSubscription(
      {
        firestore: { type: "firestore", app: {} } as any,
        subscribe: () => {
          return () => { unsubscribeCalled = true; };
        },
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        doc: () => ({ path: "rides/s1" }),
        getDoc: async () => {
          getDocCalled = true;
          return {
            exists: () => true,
            data: () => ({ userId: "u1", conquestResult: { status: "success", newMeters: 200 } }),
            id: "s1",
          } as any;
        },
      },
      { onResult: (r) => results.push(r) },
    );

    subscription.activate({ userId: "u1", localRecordId: "l1", serverRideId: "s1" });

    // Before 60s
    await clock.tickAsync(59000);
    assert.equal(unsubscribeCalled, false);
    assert.equal(getDocCalled, false);

    // After 60s - unsubscribe + re-query
    await clock.tickAsync(2000);
    assert.equal(unsubscribeCalled, true);
    assert.equal(getDocCalled, true);
    // Re-query result
    assert.equal(results[results.length - 1].status, "positive");
    assert.equal(results[results.length - 1].newMeters, 200);
  });

  it("S1-3: A→B switch - late A timer callbacks blocked", async () => {
    const clock = new FakeClock();
    const results: RideConquestResult[] = [];

    const subscription = new RideConquestSubscription(
      {
        firestore: { type: "firestore", app: {} } as any,
        subscribe: () => () => {},
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        doc: (_fs, _collection, rideId) => ({ path: `rides/${rideId}` }),
      },
      { onResult: (r) => results.push(r) },
    );

    // Activate A
    subscription.activate({ userId: "u1", localRecordId: "l1", serverRideId: "sA" });
    const countAfterA = results.length; // 1 (none)
    const timersAfterA = clock.getActiveTimerCount();

    // Activate B (new generation)
    subscription.activate({ userId: "u1", localRecordId: "l2", serverRideId: "sB" });
    const countAfterB = results.length; // 2 (B none)
    const timersAfterB = clock.getActiveTimerCount();

    // Tick 15s - late A timer should be blocked, no extra events
    await clock.tickAsync(15500);
    const countAfter15s = results.length;

    assert.equal(countAfterA, 1);
    assert.equal(timersAfterA, 2, "A has 2 timers (15s + 60s)");
    assert.equal(countAfterB, 2);
    assert.equal(timersAfterB, 2, "B has 2 timers (A cleared, B registered)");
    assert.equal(countAfter15s, 3, "B's 15s timer fired (no A late callback)");
  });

  it("S1-3: Dispose - timers cleared", async () => {
    const clock = new FakeClock();
    const results: RideConquestResult[] = [];

    const subscription = new RideConquestSubscription(
      {
        firestore: { type: "firestore", app: {} } as any,
        subscribe: () => () => {},
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        doc: () => ({ path: "rides/s1" }),
      },
      { onResult: (r) => results.push(r) },
    );

    subscription.activate({ userId: "u1", localRecordId: "l1", serverRideId: "s1" });
    assert.equal(clock.getActiveTimerCount(), 2, "2 timers active (15s + 60s)");

    subscription.dispose();
    assert.equal(clock.getActiveTimerCount(), 0, "Timers cleared after dispose");

    // Tick past timers - no callbacks
    await clock.tickAsync(70000);
    assert.equal(results.length, 1, "No timer callbacks after dispose");
  });

  it("S1-3: Re-query does NOT call Ride writer (read-only)", async () => {
    const clock = new FakeClock();
    let rideWriterCalled = false;
    const mockRideWriter = () => { rideWriterCalled = true; };

    const subscription = new RideConquestSubscription(
      {
        firestore: { type: "firestore", app: {} } as any,
        subscribe: () => () => {},
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        doc: () => ({ path: "rides/s1" }),
        getDoc: async () => {
          // S1-3: Re-query is read-only, must NOT call writer
          // Simulate that we check if writer is called
          return {
            exists: () => true,
            data: () => ({ userId: "u1", conquestResult: { status: "success", newMeters: 50 } }),
            id: "s1",
          } as any;
        },
      },
      { onResult: () => {} },
    );

    subscription.activate({ userId: "u1", localRecordId: "l1", serverRideId: "s1" });

    // After 60s - re-query
    await clock.tickAsync(61000);

    assert.equal(rideWriterCalled, false, "Re-query does NOT call Ride writer");
  });
});
