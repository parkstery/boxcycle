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

type UnderlyingSubscribe = (
  trailId: string,
  onRows: RowsListener,
  onError?: ErrorListener,
) => () => void;

let underlyingSubscribe: UnderlyingSubscribe = subscribeTrailMotion;

let acquireTotal = 0;
let releaseTotal = 0;
let unsubCallTotal = 0;
let errorFanoutHits = 0;
let injectedFanoutHits = 0;

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
  slot.unsub = underlyingSubscribe(
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

/** Trail별 RTDB motion 단일 구독 — PublicationSharedPresence ingest fan-out */
export function acquireTrailMotionSubscription(
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
  ensureRtdbSubscription(tid, slot);
  onRows(slot.rows);

  return () => {
    slot.rowsListeners.delete(onRows);
    if (onError) slot.errorListeners.delete(onError);
    slot.refCount = Math.max(0, slot.refCount - 1);
    releaseTotal += 1;
    releaseSlot(tid, slot);
  };
}

export function debugRtdbMotionSubscriptionHub(): {
  slotCount: number;
  slots: Array<{ trailId: string; refCount: number; underlyingOpen: boolean; consumers: number }>;
  acquireTotal: number;
  releaseTotal: number;
  unsubCallTotal: number;
  errorFanoutHits: number;
  injectedFanoutHits: number;
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
    injectedFanoutHits,
  };
}

export function debugInjectRtdbMotionHubError(message = "s42-inject"): number {
  let hits = 0;
  const err = new Error(message);
  for (const slot of slots.values()) {
    injectedFanoutHits += slot.errorListeners.size;
    hits += slot.errorListeners.size;
    for (const listener of slot.errorListeners) listener(err);
  }
  return hits;
}

/** DEV·단위시험용. 제품 수명주기에서 호출하지 마라. */
export function resetRtdbMotionSubscriptionHubForTests(subscribe?: UnderlyingSubscribe): void {
  for (const slot of slots.values()) {
    slot.unsub?.();
  }
  slots.clear();
  acquireTotal = 0;
  releaseTotal = 0;
  unsubCallTotal = 0;
  errorFanoutHits = 0;
  injectedFanoutHits = 0;
  underlyingSubscribe = subscribe ?? subscribeTrailMotion;
}
