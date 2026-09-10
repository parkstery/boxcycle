/**
 * S1-2: Real subscription lifecycle — capture production subscribe callbacks.
 *
 * Production: RideConquestSubscription (src/lib/rideConquestSubscription.ts)
 * Hook import/call: useRideConquestResult.ts creates controller and activate(key).
 *
 * Codex -05: store the real callback from subscribe(); A active → A result → B active →
 * force late A success/error; assert B gets no extra events from A; B normal works;
 * dispose/account switch; sub count 1/0.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RideConquestSubscription } from "../../src/lib/rideConquestSubscription.ts";
import type { RideConquestResult } from "../../src/lib/rideConquestResult.ts";

type SnapHandler = (snap: {
  id: string;
  exists: () => boolean;
  data: () => Record<string, unknown>;
}) => void;
type ErrHandler = (err: Error) => void;

function makeSnap(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: () => data != null,
    data: () => data as Record<string, unknown>,
  };
}

describe("S1-2: RideConquestSubscription real callback lifecycle", () => {
  it("captures subscribe callback; late A after B does not mutate B; B success applies", () => {
    const results: RideConquestResult[] = [];
    const unsubs: Array<() => void> = [];
    let liveHandlers: { ok: SnapHandler; err: ErrHandler } | null = null;
    let subscribeCount = 0;

    const subscription = new RideConquestSubscription(
      {
        firestore: { type: "firestore" } as unknown as import("firebase/firestore").Firestore,
        doc: (_db: unknown, _col: string, id: string) => ({ path: `rides/${id}`, id }),
        subscribe: ((_ref: unknown, onNext: SnapHandler, onErr?: ErrHandler) => {
          subscribeCount++;
          liveHandlers = { ok: onNext, err: onErr || (() => {}) };
          const unsub = () => {
            if (liveHandlers && liveHandlers.ok === onNext) liveHandlers = null;
          };
          unsubs.push(unsub);
          return unsub;
        }) as unknown as typeof import("firebase/firestore").onSnapshot,
        setTimeout: (() => 0) as unknown as typeof setTimeout,
        clearTimeout: (() => {}) as unknown as typeof clearTimeout,
        getDoc: (async () => makeSnap("noop", null)) as unknown as (
          docRef: unknown,
        ) => Promise<ReturnType<typeof makeSnap>>,
      },
      { onResult: (r) => results.push(r) },
    );

    // Activate A
    subscription.activate({ userId: "u1", localRecordId: "local-A", serverRideId: "ride-A" });
    assert.equal(subscribeCount, 1);
    const handlersA = liveHandlers;
    assert.ok(handlersA, "A subscribe callback captured");
    // Clear initial EMPTY push noise baseline length after A activate
    const afterAInit = results.length;

    handlersA!.ok(
      makeSnap("ride-A", { userId: "u1", conquestResult: { newMeters: 800 } }),
    );
    assert.equal(results[results.length - 1].status, "positive");
    assert.equal(results[results.length - 1].newMeters, 800);
    const afterAResult = results.length;

    // Activate B (same uid)
    subscription.activate({ userId: "u1", localRecordId: "local-B", serverRideId: "ride-B" });
    assert.equal(subscribeCount, 2);
    const handlersB = liveHandlers;
    assert.ok(handlersB, "B subscribe callback captured");
    assert.notEqual(handlersB, handlersA);
    const afterBInit = results.length;
    // prior clear → EMPTY
    assert.equal(results[afterBInit - 1].status, "none");

    // Force late A success + error — must not append B-visible conquest values
    handlersA!.ok(
      makeSnap("ride-A", { userId: "u1", conquestResult: { newMeters: 9999 } }),
    );
    handlersA!.err(new Error("late A error"));
    assert.equal(
      results.length,
      afterBInit,
      `late A must not push events (have ${results.length - afterBInit} extras)`,
    );

    // B normal success
    handlersB!.ok(
      makeSnap("ride-B", { userId: "u1", conquestResult: { newMeters: 120 } }),
    );
    assert.equal(results[results.length - 1].status, "positive");
    assert.equal(results[results.length - 1].newMeters, 120);

    // sanity: A did produce at least one real result before switch
    assert.ok(afterAResult > afterAInit);
  });

  it("dispose then late callback: no further results; active subs become 0", () => {
    const results: RideConquestResult[] = [];
    let live: SnapHandler | null = null;
    let activeSubs = 0;

    const subscription = new RideConquestSubscription(
      {
        firestore: { type: "firestore" } as unknown as import("firebase/firestore").Firestore,
        doc: (_db: unknown, _col: string, id: string) => ({ path: `rides/${id}`, id }),
        subscribe: ((_ref: unknown, onNext: SnapHandler) => {
          activeSubs++;
          live = onNext;
          return () => {
            activeSubs--;
            if (live === onNext) live = null;
          };
        }) as unknown as typeof import("firebase/firestore").onSnapshot,
        setTimeout: (() => 0) as unknown as typeof setTimeout,
        clearTimeout: (() => {}) as unknown as typeof clearTimeout,
        getDoc: (async () => makeSnap("noop", null)) as unknown as (
          docRef: unknown,
        ) => Promise<ReturnType<typeof makeSnap>>,
      },
      { onResult: (r) => results.push(r) },
    );

    subscription.activate({ userId: "u1", localRecordId: "l1", serverRideId: "s1" });
    assert.equal(activeSubs, 1);
    const cb = live!;
    const n = results.length;
    subscription.dispose();
    assert.equal(activeSubs, 0);
    cb(makeSnap("s1", { userId: "u1", conquestResult: { newMeters: 50 } }));
    assert.equal(results.length, n, "disposed generation rejects late snap");
  });

  it("account switch: prior user callback rejected by ownership+generation", () => {
    const results: RideConquestResult[] = [];
    let live: { ok: SnapHandler; err: ErrHandler } | null = null;

    const subscription = new RideConquestSubscription(
      {
        firestore: { type: "firestore" } as unknown as import("firebase/firestore").Firestore,
        doc: (_db: unknown, _col: string, id: string) => ({ path: `rides/${id}`, id }),
        subscribe: ((_ref: unknown, onNext: SnapHandler, onErr?: ErrHandler) => {
          live = { ok: onNext, err: onErr || (() => {}) };
          return () => {
            if (live && live.ok === onNext) live = null;
          };
        }) as unknown as typeof import("firebase/firestore").onSnapshot,
        setTimeout: (() => 0) as unknown as typeof setTimeout,
        clearTimeout: (() => {}) as unknown as typeof clearTimeout,
        getDoc: (async () => makeSnap("noop", null)) as unknown as (
          docRef: unknown,
        ) => Promise<ReturnType<typeof makeSnap>>,
      },
      { onResult: (r) => results.push(r) },
    );

    subscription.activate({ userId: "user-A", localRecordId: "l1", serverRideId: "r1" });
    const handlersA = live!;
    subscription.activate({ userId: "user-B", localRecordId: "l2", serverRideId: "r2" });
    const afterB = results.length;
    handlersA.ok(makeSnap("r1", { userId: "user-A", conquestResult: { newMeters: 1 } }));
    assert.equal(results.length, afterB);

    live!.ok(makeSnap("r2", { userId: "user-B", conquestResult: { newMeters: 40 } }));
    assert.equal(results[results.length - 1].newMeters, 40);
  });
});
