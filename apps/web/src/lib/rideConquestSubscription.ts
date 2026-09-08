/**
 * S1-2: Ride conquest subscription controller
 * 
 * Extracted from useRideConquestResult to enable:
 * - Injectable subscribe/timer deps
 * - Testable lifecycle (activate/dispose)
 * - Generation/cancel guards in production callbacks
 */
import type { Firestore, DocumentSnapshot, Unsubscribe } from "firebase/firestore";
import { doc, onSnapshot } from "firebase/firestore";
import {
  EMPTY_CONQUEST_RESULT,
  parseConquestResult,
  isRideOwnedByUser,
  isRideIdMatch,
  type RideConquestResult,
} from "./rideConquestResult";

export type RideConquestSubscriptionKey = {
  userId: string;
  localRecordId: string;
  serverRideId: string;
};

export type RideConquestSubscriptionDeps = {
  firestore: Firestore;
  subscribe: typeof onSnapshot;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
};

export type RideConquestSubscriptionObserver = {
  onResult: (result: RideConquestResult) => void;
};

/**
 * Production subscription controller.
 * S1-2: Extracted from useRideConquestResult hook.
 */
export class RideConquestSubscription {
  private key: RideConquestSubscriptionKey | null = null;
  private unsubscribe: Unsubscribe | null = null;
  private generation = 0;
  private disposed = false;
  private deps: RideConquestSubscriptionDeps;
  private observer: RideConquestSubscriptionObserver;
  // S1-3: TODO - 15s delayed status + 60s subscription end timers
  private delayedStatusTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptionEndTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    deps: RideConquestSubscriptionDeps,
    observer: RideConquestSubscriptionObserver,
  ) {
    this.deps = deps;
    this.observer = observer;
  }

  /**
   * S1-2: Activate subscription with new key.
   * Prior key results will not surface after this call.
   */
  activate(key: RideConquestSubscriptionKey): void {
    // S1-2: New key → increment generation, dispose prior subscription
    this.generation++;
    this.dispose();

    this.key = key;
    this.disposed = false;

    // S1-2: Clear prior result
    this.observer.onResult(EMPTY_CONQUEST_RESULT);

    const docRef = doc(this.deps.firestore, "rides", this.key.serverRideId);
    const currentGeneration = this.generation;
    const activeKey = this.key;

    this.unsubscribe = this.deps.subscribe(
      docRef,
      (snap: DocumentSnapshot) => {
        // S1-2: Generation guard INSIDE production callback
        if (this.disposed || this.generation !== currentGeneration) {
          return; // Late callback from prior generation
        }

        if (!snap.exists()) {
          this.observer.onResult({ status: "error", newMeters: 0 });
          return;
        }

        const data = snap.data();

        // F5: userId guard
        if (!isRideOwnedByUser(data?.userId as string | undefined, activeKey.userId)) {
          this.observer.onResult({ status: "error", newMeters: 0 });
          return;
        }

        // F5: serverRideId guard
        if (!isRideIdMatch(activeKey.serverRideId, snap.id)) {
          this.observer.onResult({ status: "error", newMeters: 0 });
          return;
        }

        const conquestResult = data?.conquestResult as Record<string, unknown> | null | undefined;
        this.observer.onResult(parseConquestResult(conquestResult));
      },
      (error: Error) => {
        // S1-2: Error callback with generation guard
        if (this.disposed || this.generation !== currentGeneration) {
          return;
        }
        console.warn(`[RideConquestSubscription] rides/${activeKey.serverRideId} error:`, error);
        this.observer.onResult({ status: "error", newMeters: 0 });
      },
    );
  }

  /**
   * S1-2: Dispose subscription and timers.
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    // S1-3: Clear timers
    if (this.delayedStatusTimer) {
      this.deps.clearTimeout(this.delayedStatusTimer);
      this.delayedStatusTimer = null;
    }
    if (this.subscriptionEndTimer) {
      this.deps.clearTimeout(this.subscriptionEndTimer);
      this.subscriptionEndTimer = null;
    }
    this.disposed = true;
  }

  isActive(): boolean {
    return !this.disposed && this.unsubscribe !== null;
  }
}
