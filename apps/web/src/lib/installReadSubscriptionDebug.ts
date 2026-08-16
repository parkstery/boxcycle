import { snapshotUnderlyingReadSubscriptions } from "./readSubscriptionMeters";
import {
  debugInjectRtdbMotionHubError,
  debugRtdbMotionSubscriptionHub,
} from "./rtdbMotionSubscriptionHub";
import {
  debugInjectTrailLivePublicationRidesHubError,
  debugTrailLivePublicationRidesSubscriptionHub,
} from "./livePublicationRidesSubscriptionHub";

export function snapshotReadSubscriptions() {
  return {
    atMs: Date.now(),
    source: "snapshotReadSubscriptions" as const,
    underlying: snapshotUnderlyingReadSubscriptions(),
    motionHub: debugRtdbMotionSubscriptionHub(),
    ridesHub: debugTrailLivePublicationRidesSubscriptionHub(),
  };
}

export function installReadSubscriptionDebug(): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  const api = {
    snapshot: snapshotReadSubscriptions,
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
