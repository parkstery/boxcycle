import type { FirestoreError } from "firebase/firestore";
import { subscribeTrailIdsWithActiveLiveRides } from "./firestoreTrailLivePublicationRides";

type IdsListener = (trailIds: string[]) => void;
type ErrorListener = (err: FirestoreError) => void;

type UnderlyingSubscribe = (
  onChange: IdsListener,
  onError?: ErrorListener,
) => () => void;

let underlyingSubscribe: UnderlyingSubscribe = subscribeTrailIdsWithActiveLiveRides;

let refCount = 0;
let trailIds: string[] = [];
let hasSnapshot = false;
const idsListeners = new Set<IdsListener>();
const errorListeners = new Set<ErrorListener>();
let unsub: (() => void) | null = null;

let acquireTotal = 0;
let releaseTotal = 0;
let unsubCallTotal = 0;
let errorFanoutHits = 0;
let injectedFanoutHits = 0;

function ensureCollectionGroupSubscription(): void {
  if (unsub) return;
  unsub = underlyingSubscribe(
    (ids) => {
      trailIds = ids;
      hasSnapshot = true;
      for (const listener of idsListeners) listener(ids);
    },
    (err) => {
      errorFanoutHits += errorListeners.size;
      for (const listener of errorListeners) listener(err);
    },
  );
}

function releaseIfIdle(): void {
  if (refCount > 0) return;
  if (unsub) {
    unsub();
    unsub = null;
    unsubCallTotal += 1;
  }
  trailIds = [];
  hasSnapshot = false;
}

/**
 * `livePublicationRides` collectionGroup 단일 구독 —
 * useOpenTrails · useActiveLiveRideTrailIds consumer fan-out.
 * consumer 수와 무관하게 underlying onSnapshot 1개.
 */
export function acquireActiveLiveRideTrailIdsSubscription(
  onIds: IdsListener,
  onError?: ErrorListener,
): () => void {
  refCount += 1;
  acquireTotal += 1;
  idsListeners.add(onIds);
  if (onError) errorListeners.add(onError);
  ensureCollectionGroupSubscription();
  if (hasSnapshot) onIds(trailIds);

  return () => {
    idsListeners.delete(onIds);
    if (onError) errorListeners.delete(onError);
    refCount = Math.max(0, refCount - 1);
    releaseTotal += 1;
    releaseIfIdle();
  };
}

export function debugActiveLiveRideTrailIdsSubscriptionHub(): {
  refCount: number;
  consumers: number;
  underlyingOpen: boolean;
  acquireTotal: number;
  releaseTotal: number;
  unsubCallTotal: number;
  errorFanoutHits: number;
  injectedFanoutHits: number;
} {
  return {
    refCount,
    consumers: idsListeners.size,
    underlyingOpen: Boolean(unsub),
    acquireTotal,
    releaseTotal,
    unsubCallTotal,
    errorFanoutHits,
    injectedFanoutHits,
  };
}

export function debugInjectActiveLiveRideTrailIdsHubError(message = "s42-inject"): number {
  const err = { code: "internal", message, name: "FirebaseError" } as FirestoreError;
  injectedFanoutHits += errorListeners.size;
  const hits = errorListeners.size;
  for (const listener of errorListeners) listener(err);
  return hits;
}

/** DEV·단위시험용. 제품 수명주기에서 호출하지 마라. */
export function resetActiveLiveRideTrailIdsSubscriptionHubForTests(
  subscribe?: UnderlyingSubscribe,
): void {
  unsub?.();
  unsub = null;
  refCount = 0;
  trailIds = [];
  hasSnapshot = false;
  idsListeners.clear();
  errorListeners.clear();
  acquireTotal = 0;
  releaseTotal = 0;
  unsubCallTotal = 0;
  errorFanoutHits = 0;
  injectedFanoutHits = 0;
  underlyingSubscribe = subscribe ?? subscribeTrailIdsWithActiveLiveRides;
}
