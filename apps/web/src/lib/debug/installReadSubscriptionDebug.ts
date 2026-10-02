import {
  resetUnderlyingReadMeters,
  snapshotUnderlyingReadSubscriptions,
} from "./readSubscriptionMeters";
import {
  resetVisibilityReadMeters,
  snapshotVisibilityReadMeters,
} from "./visibilityReadMeters";
import {
  getDocumentVisibilityOverrideForTests,
  setDocumentVisibilityOverrideForTests,
} from "./documentVisibilityOverride";
import {
  debugInjectActiveLiveRideTrailIdsHubError,
  debugActiveLiveRideTrailIdsSubscriptionHub,
} from "../trail/repo/activeLiveRideTrailIdsSubscriptionHub";
import {
  debugInjectRtdbMotionHubError,
  debugRtdbMotionSubscriptionHub,
} from "../peerMotion/repo/rtdbMotionSubscriptionHub";
import {
  debugInjectTrailLivePublicationRidesHubError,
  debugTrailLivePublicationRidesSubscriptionHub,
} from "../trail/repo/livePublicationRidesSubscriptionHub";

export function snapshotReadSubscriptions() {
  const underlying = snapshotUnderlyingReadSubscriptions();
  const motionHub = debugRtdbMotionSubscriptionHub();
  const ridesHub = debugTrailLivePublicationRidesSubscriptionHub();
  const activeLiveRideTrailIdsHub = debugActiveLiveRideTrailIdsSubscriptionHub();
  const visibility = snapshotVisibilityReadMeters();
  const motionUnsubMatchesRtdbClose =
    motionHub.unsubCallTotal === underlying.rtdbOnValue.closeTotal;
  const ridesUnsubMatchesTrailClose =
    ridesHub.unsubCallTotal === underlying.trailOnSnapshot.closeTotal;
  const cgUnsubMatchesCollectionGroupClose =
    activeLiveRideTrailIdsHub.unsubCallTotal === underlying.collectionGroup.closeTotal;
  return {
    atMs: Date.now(),
    source: "snapshotReadSubscriptions" as const,
    totalsAreCumulative: true as const,
    compareStatesUsing: "open" as const,
    underlying,
    visibility,
    motionHub,
    ridesHub,
    activeLiveRideTrailIdsHub,
    crossCheck: {
      motionUnsubCallTotalEqualsRtdbOnValueCloseTotal: motionUnsubMatchesRtdbClose,
      ridesUnsubCallTotalEqualsTrailOnSnapshotCloseTotal: ridesUnsubMatchesTrailClose,
      cgUnsubCallTotalEqualsCollectionGroupCloseTotal: cgUnsubMatchesCollectionGroupClose,
      ok:
        motionUnsubMatchesRtdbClose &&
        ridesUnsubMatchesTrailClose &&
        cgUnsubMatchesCollectionGroupClose,
    },
  };
}

export function installReadSubscriptionDebug(): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  const api = {
    snapshot: snapshotReadSubscriptions,
    resetMeters: () => {
      resetUnderlyingReadMeters();
      resetVisibilityReadMeters();
    },
    resetUnderlyingMeters: resetUnderlyingReadMeters,
    resetVisibilityMeters: resetVisibilityReadMeters,
    snapshotVisibility: snapshotVisibilityReadMeters,
    setVisibilityOverride: setDocumentVisibilityOverrideForTests,
    getVisibilityOverride: getDocumentVisibilityOverrideForTests,
    injectMotionError: debugInjectRtdbMotionHubError,
    injectRidesError: debugInjectTrailLivePublicationRidesHubError,
    injectCgError: debugInjectActiveLiveRideTrailIdsHubError,
  };
  (
    window as Window & {
      __rtwReadSubs?: typeof snapshotReadSubscriptions;
      __rtwReadSubsApi?: typeof api;
    }
  ).__rtwReadSubs = snapshotReadSubscriptions;
  (window as Window & { __rtwReadSubsApi?: typeof api }).__rtwReadSubsApi = api;
}
