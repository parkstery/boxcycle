/**
 * S4-2 DEV 게이트 — 실제 Firebase 구독 개시·해지 지점에서만 센다.
 * 소비자 acquire 횟수를 여기 넣지 마라. 센티넬 0 을 관측치로 쓰지 마라.
 */

export type UnderlyingReadKind = "rtdbOnValue" | "trailOnSnapshot" | "collectionGroup";

export type UnderlyingReadMeter = {
  open: number;
  openTotal: number;
  closeTotal: number;
};

const meters: Record<UnderlyingReadKind, UnderlyingReadMeter> = {
  rtdbOnValue: { open: 0, openTotal: 0, closeTotal: 0 },
  trailOnSnapshot: { open: 0, openTotal: 0, closeTotal: 0 },
  collectionGroup: { open: 0, openTotal: 0, closeTotal: 0 },
};

/** `unsub` 는 실제 Firebase unsubscribe. 래퍼가 close 를 센다. */
export function trackUnderlyingReadSubscription(
  kind: UnderlyingReadKind,
  unsub: () => void,
): () => void {
  meters[kind].open += 1;
  meters[kind].openTotal += 1;
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    unsub();
    meters[kind].open = Math.max(0, meters[kind].open - 1);
    meters[kind].closeTotal += 1;
  };
}

export function snapshotUnderlyingReadSubscriptions(): {
  source: "readSubscriptionMeters";
  rtdbOnValue: UnderlyingReadMeter;
  trailOnSnapshot: UnderlyingReadMeter;
  collectionGroup: UnderlyingReadMeter;
} {
  return {
    source: "readSubscriptionMeters",
    rtdbOnValue: { ...meters.rtdbOnValue },
    trailOnSnapshot: { ...meters.trailOnSnapshot },
    collectionGroup: { ...meters.collectionGroup },
  };
}
