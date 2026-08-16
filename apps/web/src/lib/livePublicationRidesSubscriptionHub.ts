import type { FirestoreError } from "firebase/firestore";
import { sanitizeTrailId } from "./firestoreTrail";
import {
  subscribeTrailLivePublicationRides,
  type TrailLivePublicationRideRow,
} from "./firestoreTrailLivePublicationRides";

type RowsListener = (rows: TrailLivePublicationRideRow[]) => void;
type ErrorListener = (err: FirestoreError) => void;

type TrailSlot = {
  refCount: number;
  rows: TrailLivePublicationRideRow[];
  rowsListeners: Set<RowsListener>;
  errorListeners: Set<ErrorListener>;
  unsub: (() => void) | null;
};

const slots = new Map<string, TrailSlot>();

let acquireTotal = 0;
let releaseTotal = 0;
let unsubCallTotal = 0;
let errorFanoutHits = 0;

function getOrCreateSlot(tid: string): TrailSlot {
  let slot = slots.get(tid);
  if (!slot) {
    slot = {
      refCount: 0,
      rows: [],
      rowsListeners: new Set(),
      errorListeners: new Set(),
      unsub: null,
    };
    slots.set(tid, slot);
  }
  return slot;
}

function ensureFirestoreSubscription(tid: string, slot: TrailSlot): void {
  if (slot.unsub) return;
  slot.unsub = subscribeTrailLivePublicationRides(
    tid,
    (rows) => {
      slot.rows = rows;
      for (const listener of slot.rowsListeners) listener(rows);
    },
    (err) => {
      errorFanoutHits += slot.errorListeners.size;
      for (const listener of slot.errorListeners) listener(err);
    },
  );
}

function releaseSlot(tid: string, slot: TrailSlot): void {
  if (slot.refCount > 0) return;
  if (slot.unsub) {
    slot.unsub();
    unsubCallTotal += 1;
  }
  slots.delete(tid);
}

/**
 * Trail별 `livePublicationRides` 단일 Firestore 구독 — spectator·world overlay 등 consumer fan-out.
 * trailId 당 onSnapshot 1개만 유지(refcount).
 */
export function acquireTrailLivePublicationRidesSubscription(
  trailId: string,
  onRows: RowsListener,
  onError?: ErrorListener,
): () => void {
  const tid = sanitizeTrailId(trailId);
  const slot = getOrCreateSlot(tid);
  slot.refCount += 1;
  acquireTotal += 1;
  slot.rowsListeners.add(onRows);
  if (onError) slot.errorListeners.add(onError);
  ensureFirestoreSubscription(tid, slot);
  onRows(slot.rows);

  return () => {
    slot.rowsListeners.delete(onRows);
    if (onError) slot.errorListeners.delete(onError);
    slot.refCount = Math.max(0, slot.refCount - 1);
    releaseTotal += 1;
    releaseSlot(tid, slot);
  };
}

/** DEV — hub 슬롯 수 */
export function debugTrailLivePublicationRidesSubscriptionCount(): number {
  return slots.size;
}

export function debugTrailLivePublicationRidesSubscriptionHub(): {
  slotCount: number;
  slots: Array<{ trailId: string; refCount: number; underlyingOpen: boolean; consumers: number }>;
  acquireTotal: number;
  releaseTotal: number;
  unsubCallTotal: number;
  errorFanoutHits: number;
} {
  return {
    slotCount: slots.size,
    slots: [...slots.entries()].map(([trailId, slot]) => ({
      trailId,
      refCount: slot.refCount,
      underlyingOpen: Boolean(slot.unsub),
      consumers: slot.rowsListeners.size,
    })),
    acquireTotal,
    releaseTotal,
    unsubCallTotal,
    errorFanoutHits,
  };
}

export function debugInjectTrailLivePublicationRidesHubError(message = "s42-inject"): number {
  let hits = 0;
  const err = { code: "internal", message, name: "FirebaseError" } as FirestoreError;
  for (const slot of slots.values()) {
    errorFanoutHits += slot.errorListeners.size;
    hits += slot.errorListeners.size;
    for (const listener of slot.errorListeners) listener(err);
  }
  return hits;
}
