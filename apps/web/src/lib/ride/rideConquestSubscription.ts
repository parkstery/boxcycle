/**
 * S1-2/S1-3: Ride conquest subscription controller
 * 
 * Extracted from useRideConquestResult to enable:
 * - Injectable subscribe/timer deps
 * - Testable lifecycle (activate/dispose)
 * - Generation/cancel guards in production callbacks
 * - S1-3: 15s delayed status + 60s subscription end + re-query
 */
import type { Firestore, DocumentSnapshot, Unsubscribe } from "firebase/firestore";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
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
  getDoc?: (docRef: any) => Promise<DocumentSnapshot>;
  doc?: (firestore: Firestore, path: string, ...pathSegments: string[]) => any;
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
  // S1-3: 15s delayed status + 60s subscription end timers
  private delayedStatusTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptionEndTimer: ReturnType<typeof setTimeout> | null = null;
  private hasReceivedResult = false;

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
    this.hasReceivedResult = false;

    // S1-2: Clear prior result
    this.observer.onResult(EMPTY_CONQUEST_RESULT);

    const docFn = this.deps.doc || doc;
    const docRef = docFn(this.deps.firestore, "rides", this.key.serverRideId);
    const currentGeneration = this.generation;
    const activeKey = this.key;

    // S1-3: 15s delayed status - if no result after 15s, mark as error
    this.delayedStatusTimer = this.deps.setTimeout(() => {
      if (this.disposed || this.generation !== currentGeneration) {
        return;
      }
      if (!this.hasReceivedResult) {
        this.observer.onResult({ status: "error", newMeters: 0 });
      }
    }, 15000);

    // S1-3: 60s subscription end + same-doc re-query
    this.subscriptionEndTimer = this.deps.setTimeout(async () => {
      if (this.disposed || this.generation !== currentGeneration) {
        return;
      }
      // Unsubscribe from real-time updates
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
      // S1-3: Same-doc re-query (one-time read, does NOT call Ride writer)
      try {
        const getDocFn = this.deps.getDoc || getDoc;
        const snap = await getDocFn(docRef);
        if (this.disposed || this.generation !== currentGeneration) {
          return;
        }
        if (!snap.exists()) {
          this.observer.onResult({ status: "error", newMeters: 0 });
          return;
        }
        const data = snap.data() as any;
        if (!isRideOwnedByUser(data?.userId as string | undefined, activeKey.userId)) {
          this.observer.onResult({ status: "error", newMeters: 0 });
          return;
        }
        if (!isRideIdMatch(activeKey.serverRideId, snap.id)) {
          this.observer.onResult({ status: "error", newMeters: 0 });
          return;
        }
        const conquestResult = data?.conquestResult as Record<string, unknown> | null | undefined;
        this.observer.onResult(parseConquestResult(conquestResult));
      } catch (error) {
        if (this.disposed || this.generation !== currentGeneration) {
          return;
        }
        console.warn(`[RideConquestSubscription] re-query error:`, error);
        this.observer.onResult({ status: "error", newMeters: 0 });
      }
    }, 60000);

    this.unsubscribe = this.deps.subscribe(
      docRef,
      (snap: DocumentSnapshot) => {
        // S1-2: Generation guard INSIDE production callback
        if (this.disposed || this.generation !== currentGeneration) {
          return; // Late callback from prior generation
        }

        this.hasReceivedResult = true;

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
        this.hasReceivedResult = true;
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
