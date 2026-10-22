/**
 * Trail 키별 참조 카운트 구독 허브 — 슬롯·리스너 집합·구독/해제·시험용 교체의 공통부.
 *
 * `rtdbMotionSubscriptionHub`(peerMotion)와 `livePublicationRidesSubscriptionHub`(trail/repo)가
 * 같은 모양이라 여기서 한 번만 만든다. 이 모듈은 아무 저장소도 import 하지 않는다 —
 * 실제 구독 함수·계측 호출·Trail ID 정리는 만드는 쪽이 주입한다.
 */

type TrailRowsSubscribe<Row, Err> = (
  trailId: string,
  onRows: (rows: Row[]) => void,
  onError?: (err: Err) => void,
) => () => void;

type TrailSubscriptionHubDebug = {
  slotCount: number;
  slots: Array<{ trailId: string; refCount: number; underlyingOpen: boolean; consumers: number }>;
  acquireTotal: number;
  releaseTotal: number;
  unsubCallTotal: number;
  errorFanoutHits: number;
  injectedFanoutHits: number;
};

type TrailSubscriptionHub<Row, Err> = {
  acquire: (
    trailId: string,
    onRows: (rows: Row[]) => void,
    onError?: (err: Err) => void,
  ) => () => void;
  slotCount: () => number;
  debug: () => TrailSubscriptionHubDebug;
  injectError: (err: Err) => number;
  resetForTests: (subscribe?: TrailRowsSubscribe<Row, Err>) => void;
};

export function createTrailSubscriptionHub<Row, Err>(deps: {
  defaultSubscribe: TrailRowsSubscribe<Row, Err>;
  sanitizeTrailId: (trailId: string) => string;
  noteUnderlyingDelivery: () => void;
}): TrailSubscriptionHub<Row, Err> {
  type RowsListener = (rows: Row[]) => void;
  type ErrorListener = (err: Err) => void;

  type TrailSlot = {
    refCount: number;
    rows: Row[];
    rowsListeners: Set<RowsListener>;
    errorListeners: Set<ErrorListener>;
    unsub: (() => void) | null;
  };

  const slots = new Map<string, TrailSlot>();

  let underlyingSubscribe: TrailRowsSubscribe<Row, Err> = deps.defaultSubscribe;

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

  function ensureSubscription(tid: string, slot: TrailSlot): void {
    if (slot.unsub) return;
    slot.unsub = underlyingSubscribe(
      tid,
      (rows) => {
        deps.noteUnderlyingDelivery();
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

  return {
    acquire(trailId, onRows, onError) {
      const tid = deps.sanitizeTrailId(trailId);
      const slot = getOrCreateSlot(tid);
      slot.refCount += 1;
      acquireTotal += 1;
      slot.rowsListeners.add(onRows);
      if (onError) slot.errorListeners.add(onError);
      ensureSubscription(tid, slot);
      onRows(slot.rows);

      return () => {
        slot.rowsListeners.delete(onRows);
        if (onError) slot.errorListeners.delete(onError);
        slot.refCount = Math.max(0, slot.refCount - 1);
        releaseTotal += 1;
        releaseSlot(tid, slot);
      };
    },

    slotCount() {
      return slots.size;
    },

    debug() {
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
    },

    injectError(err) {
      let hits = 0;
      for (const slot of slots.values()) {
        injectedFanoutHits += slot.errorListeners.size;
        hits += slot.errorListeners.size;
        for (const listener of slot.errorListeners) listener(err);
      }
      return hits;
    },

    resetForTests(subscribe) {
      for (const slot of slots.values()) {
        slot.unsub?.();
      }
      slots.clear();
      acquireTotal = 0;
      releaseTotal = 0;
      unsubCallTotal = 0;
      errorFanoutHits = 0;
      injectedFanoutHits = 0;
      underlyingSubscribe = subscribe ?? deps.defaultSubscribe;
    },
  };
}
