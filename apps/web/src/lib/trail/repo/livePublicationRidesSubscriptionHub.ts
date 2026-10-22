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
) => () => void;

const hub = createTrailSubscriptionHub<TrailLivePublicationRideRow, FirestoreError>({
  defaultSubscribe: subscribeTrailLivePublicationRides,
  sanitizeTrailId,
  noteUnderlyingDelivery: noteFsLiveRideUnderlyingDelivery,
});

/**
 * Trail별 `livePublicationRides` 단일 Firestore 구독 — spectator·world overlay 등 consumer fan-out.
 * trailId 당 onSnapshot 1개만 유지(refcount).
 */
export function acquireTrailLivePublicationRidesSubscription(
  trailId: string,
  onRows: RowsListener,
  onError?: ErrorListener,
): () => void {
  return hub.acquire(trailId, onRows, onError);
}

/** DEV — hub 슬롯 수 */
export function debugTrailLivePublicationRidesSubscriptionCount(): number {
  return hub.slotCount();
}

export function debugTrailLivePublicationRidesSubscriptionHub(): ReturnType<typeof hub.debug> {
  return hub.debug();
}

export function debugInjectTrailLivePublicationRidesHubError(message = "s42-inject"): number {
  return hub.injectError({ code: "internal", message, name: "FirebaseError" } as FirestoreError);
}

/** DEV·단위시험용. 제품 수명주기에서 호출하지 마라. */
export function resetTrailLivePublicationRidesSubscriptionHubForTests(
  subscribe?: UnderlyingSubscribe,
): void {
  hub.resetForTests(subscribe);
}
