import { sanitizeTrailId } from "./firestoreTrail";
import { subscribeTrailMotion, type RtdbTrailMotionRow } from "./rtdbTrailMotion";

type RowsListener = (rows: RtdbTrailMotionRow[]) => void;
type ErrorListener = (err: Error) => void;

type TrailSlot = {
  refCount: number;
  rows: RtdbTrailMotionRow[];
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

function ensureRtdbSubscription(tid: string, slot: TrailSlot): void {
  if (slot.unsub) return;
  slot.unsub = subscribeTrailMotion(
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

/** Trail별 RTDB motion 단일 구독 — PublicationSharedPresence ingest fan-out */
export function acquireTrailMotionSubscription(
  trailId: string,
  onRows: RowsListener,
  onError?: ErrorListener,
): () => void {
  const tid = sanitizeTrailId(trailId);
  const slot = getOrCreateSlot(tid);
  slot.refCount += 1;
  slot.rowsListeners.add(onRows);
  if (onError) slot.errorListeners.add(onError);
  ensureRtdbSubscription(tid, slot);
  onRows(slot.rows);

  return () => {
    slot.rowsListeners.delete(onRows);
    if (onError) slot.errorListeners.delete(onError);
    slot.refCount = Math.max(0, slot.refCount - 1);
    releaseSlot(tid, slot);
  };
}
