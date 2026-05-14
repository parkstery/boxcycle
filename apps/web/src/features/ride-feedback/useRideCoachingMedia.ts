import { useRideBgm } from "../../hooks/useRideBgm";
import { useRideCoaching } from "../../hooks/useRideCoaching";
import { useRouteElevationProfile, type RouteElevationProfileState } from "../../hooks/useRouteElevationProfile";
import { RIDE_BGM_PLAYLIST } from "../../lib/rideBgmConstants";
import type { CoachingData } from "../../lib/coachTypes";
import type { LineStringGeometry } from "../../lib/geo";
import type { RideSessionStatus } from "../../hooks/useVirtualRideSession";

/** 고도 프로필 → 코칭(TTS) → BGM 을 한 훅에서 연결 */
export function useRideCoachingMedia(opts: {
  routeGeometry: LineStringGeometry | null;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
  sessionStatus: RideSessionStatus;
  speedKmh: number;
  rideTtsEnabled: boolean;
  rideBgmEnabled: boolean;
}): {
  coachData: CoachingData | null;
  rideElevationProfile: RouteElevationProfileState;
  rideBgmCatalogConfigured: boolean;
} {
  const rideElevationProfile = useRouteElevationProfile(opts.routeGeometry);
  const { coachData } = useRideCoaching({
    routeGeometry: opts.routeGeometry,
    routeDistanceMeters: opts.routeDistanceMeters,
    virtualDistanceMeters: opts.virtualDistanceMeters,
    sessionStatus: opts.sessionStatus,
    speedKmh: opts.speedKmh,
    elevationM: rideElevationProfile.values,
    sampledCoords: rideElevationProfile.sampledCoords,
    ttsEnabled: opts.rideTtsEnabled,
  });
  useRideBgm({
    sessionActive: opts.sessionStatus !== "idle",
    musicEnabled: opts.rideBgmEnabled,
  });
  return {
    coachData,
    rideElevationProfile,
    rideBgmCatalogConfigured: RIDE_BGM_PLAYLIST.length > 0,
  };
}
