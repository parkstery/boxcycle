import type { FirestoreError } from "firebase/firestore";
import { sanitizeTrailId } from "./firestoreTrail";
import { createTrailSubscriptionHub } from "../keyedSubscriptionHub";
import {
  subscribeTrailLivePublicationRides,
  type TrailLivePublicationRideRow,
} from "./firestoreTrailLivePublicationRides";
import { noteFsLiveRideUnderlyingDelivery } from "../../debug/trafficPublishMeters";

type RowsListener = (rows: TrailLivePublicationRideRow[]) => void;
type ErrorListener = (err: FirestoreError) => void;

type UnderlyingSubscribe = (
  trailId: string,
  onRows: RowsListener,
  onError?: ErrorListener,
  excludeUid?: string | null,
) => () => void;

// The viewer is part of the cache/subscription identity. A different account must never
// inherit a cached result with its own row included (or the previous viewer missing).
function scopedSubscribe(subscribe: UnderlyingSubscribe): UnderlyingSubscribe {
  return (key, onRows, onError) => {
    const [trailId, excludeUid] = JSON.parse(key) as [string, string | null];
    return subscribe(trailId, onRows, onError, excludeUid);
  };
}

const hub = createTrailSubscriptionHub<TrailLivePublicationRideRow, FirestoreError>({
  defaultSubscribe: scopedSubscribe(subscribeTrailLivePublicationRides),
  sanitizeTrailId: (key) => key,
  noteUnderlyingDelivery: noteFsLiveRideUnderlyingDelivery,
});

/**
 * Trail별 `livePublicationRides` 단일 Firestore 구독 — spectator·world overlay 등 consumer fan-out.
 * 같은 Trail·제외 uid 당 onSnapshot 1개만 유지(refcount). 동행·관전·세계 지도가 공유한다.
 */
export function acquireTrailLivePublicationRidesSubscription(
  trailId: string,
  onRows: RowsListener,
  onError?: ErrorListener,
  excludeUid?: string | null,
): () => void {
  return hub.acquire(JSON.stringify([sanitizeTrailId(trailId), excludeUid || null]), onRows, onError);
}

/** DEV — hub 슬롯 수 */
export function debugTrailLivePublicationRidesSubscriptionCount(): number {
  return hub.slotCount();
}

export function debugTrailLivePublicationRidesSubscriptionHub() {
  const snapshot = hub.debug();
  return {
    ...snapshot,
    slots: snapshot.slots.map((slot) => {
      const [trailId, excludeUid] = JSON.parse(slot.trailId) as [string, string | null];
      return { ...slot, trailId, excludeUid };
    }),
  };
}

export function debugInjectTrailLivePublicationRidesHubError(message = "s42-inject"): number {
  return hub.injectError({ code: "internal", message, name: "FirebaseError" } as FirestoreError);
}

/** DEV·단위시험용. 제품 수명주기에서 호출하지 마라. */
export function resetTrailLivePublicationRidesSubscriptionHubForTests(
  subscribe?: UnderlyingSubscribe,
): void {
  hub.resetForTests(subscribe ? scopedSubscribe(subscribe) : undefined);
}
