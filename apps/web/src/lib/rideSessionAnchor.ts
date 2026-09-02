import type { LineStringGeometry, LngLat } from "./geo";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "./geo";
import { computeRouteProgressRatio, rideDistanceAlongRoute } from "./liveLocationSnapshot";

export type RideSessionAnchor = {
  sessionStartLngLat: LngLat | null;
  sessionEndLngLat: LngLat | null;
  sessionStartRouteMeters: number | null;
  sessionEndRouteMeters: number | null;
  sessionStartProgressRatio: number | null;
  sessionEndProgressRatio: number | null;
};

/** geometry·routeDistance·virtualDistance에서 이번 세션 시작·종료 anchor를 계산한다. */
export function computeRideSessionAnchor(input: {
  geometry: LineStringGeometry | null;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
  startOffsetMeters: number;
}): RideSessionAnchor {
  const { geometry, routeDistanceMeters, virtualDistanceMeters, startOffsetMeters } = input;
  if (!geometry || geometry.coordinates.length < 2) {
    return {
      sessionStartLngLat: null,
      sessionEndLngLat: null,
      sessionStartRouteMeters: null,
      sessionEndRouteMeters: null,
      sessionStartProgressRatio: null,
      sessionEndProgressRatio: null,
    };
  }
  const geoLen = lineStringLengthMeters(geometry);
  const startDist = rideDistanceAlongRoute(startOffsetMeters, routeDistanceMeters, geoLen);
  const endDist = rideDistanceAlongRoute(virtualDistanceMeters, routeDistanceMeters, geoLen);
  const startRatio = computeRouteProgressRatio(startOffsetMeters, routeDistanceMeters, geoLen);
  const endRatio = computeRouteProgressRatio(virtualDistanceMeters, routeDistanceMeters, geoLen);
  return {
    sessionStartLngLat: getPointOnRouteByDistance(geometry, startDist),
    sessionEndLngLat: getPointOnRouteByDistance(geometry, endDist),
    sessionStartRouteMeters: startDist,
    sessionEndRouteMeters: endDist,
    sessionStartProgressRatio: startRatio,
    sessionEndProgressRatio: endRatio,
  };
}
