import {
  resetUnderlyingReadMeters,
  snapshotUnderlyingReadSubscriptions,
} from "./readSubscriptionMeters";
import {
  debugInjectRtdbMotionHubError,
  debugRtdbMotionSubscriptionHub,
} from "./rtdbMotionSubscriptionHub";
import {
  debugInjectTrailLivePublicationRidesHubError,
  debugTrailLivePublicationRidesSubscriptionHub,
} from "./livePublicationRidesSubscriptionHub";

export function snapshotReadSubscriptions() {
  const underlying = snapshotUnderlyingReadSubscriptions();
  const motionHub = debugRtdbMotionSubscriptionHub();
  const ridesHub = debugTrailLivePublicationRidesSubscriptionHub();
  const motionUnsubMatchesRtdbClose =
    motionHub.unsubCallTotal === underlying.rtdbOnValue.closeTotal;
  const ridesUnsubMatchesTrailClose =
    ridesHub.unsubCallTotal === underlying.trailOnSnapshot.closeTotal;
  return {
    atMs: Date.now(),
    source: "snapshotReadSubscriptions" as const,
    totalsAreCumulative: true as const,
    compareStatesUsing: "open" as const,
    underlying,
    motionHub,
    ridesHub,
    crossCheck: {
      motionUnsubCallTotalEqualsRtdbOnValueCloseTotal: motionUnsubMatchesRtdbClose,
      ridesUnsubCallTotalEqualsTrailOnSnapshotCloseTotal: ridesUnsubMatchesTrailClose,
      ok: motionUnsubMatchesRtdbClose && ridesUnsubMatchesTrailClose,
    },
  };
}

export function installReadSubscriptionDebug(): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  const api = {
    snapshot: snapshotReadSubscriptions,
    resetMeters: resetUnderlyingReadMeters,
    injectMotionError: debugInjectRtdbMotionHubError,
    injectRidesError: debugInjectTrailLivePublicationRidesHubError,
  };
  (
    window as Window & {
      __rtwReadSubs?: typeof snapshotReadSubscriptions;
      __rtwReadSubsApi?: typeof api;
    }
  ).__rtwReadSubs = snapshotReadSubscriptions;
  (window as Window & { __rtwReadSubsApi?: typeof api }).__rtwReadSubsApi = api;
}
