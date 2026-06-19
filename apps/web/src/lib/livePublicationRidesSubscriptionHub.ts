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
      for (const listener of slot.errorListeners) listener(err);
    },
  );
}

function releaseSlot(tid: string, slot: TrailSlot): void {
  if (slot.refCount > 0) return;
  slot.unsub?.();
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
  slot.rowsListeners.add(onRows);
  if (onError) slot.errorListeners.add(onError);
  ensureFirestoreSubscription(tid, slot);
  onRows(slot.rows);

  return () => {
    slot.rowsListeners.delete(onRows);
    if (onError) slot.errorListeners.delete(onError);
    slot.refCount = Math.max(0, slot.refCount - 1);
    releaseSlot(tid, slot);
  };
}

/** DEV — hub 슬롯 수 */
export function debugTrailLivePublicationRidesSubscriptionCount(): number {
  return slots.size;
}
