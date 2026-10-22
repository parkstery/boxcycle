import { sanitizeTrailId } from "../../trail/trailId";
import { createTrailSubscriptionHub } from "../../trail/keyedSubscriptionHub";
import { subscribeTrailMotion, type RtdbTrailMotionRow } from "./rtdbTrailMotion";
import { noteRtdbMotionUnderlyingDelivery } from "../../debug/trafficPublishMeters";

type RowsListener = (rows: RtdbTrailMotionRow[]) => void;
type ErrorListener = (err: Error) => void;

type UnderlyingSubscribe = (
  trailId: string,
  onRows: RowsListener,
  onError?: ErrorListener,
) => () => void;

const hub = createTrailSubscriptionHub<RtdbTrailMotionRow, Error>({
  defaultSubscribe: subscribeTrailMotion,
  sanitizeTrailId,
  noteUnderlyingDelivery: noteRtdbMotionUnderlyingDelivery,
});

/** Trail별 RTDB motion 단일 구독 — PublicationSharedPresence ingest fan-out */
export function acquireTrailMotionSubscription(
  trailId: string,
  onRows: RowsListener,
  onError?: ErrorListener,
): () => void {
  return hub.acquire(trailId, onRows, onError);
}

export function debugRtdbMotionSubscriptionHub(): ReturnType<typeof hub.debug> {
  return hub.debug();
}

export function debugInjectRtdbMotionHubError(message = "s42-inject"): number {
  return hub.injectError(new Error(message));
}

/** DEV·단위시험용. 제품 수명주기에서 호출하지 마라. */
export function resetRtdbMotionSubscriptionHubForTests(subscribe?: UnderlyingSubscribe): void {
  hub.resetForTests(subscribe);
}
