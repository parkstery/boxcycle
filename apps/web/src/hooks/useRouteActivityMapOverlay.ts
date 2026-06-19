import { useMemo } from "react";
import type { ActivityWorldMapDot, ActivityWorldMapRoute } from "../lib/activityWorldLod";
import {
  ACTIVITY_TRACE_LIVE_STRENGTH,
  resolveHeatTraceStrength,
} from "../lib/activityWorldTraceStyle";
import { boundsCenterLngLat, boundsFromLineStringGeometry } from "../lib/firestoreCourses";
import {
  heatVisualWeight,
  isRouteActivityHeat,
  isRouteActivityLive,
  type RouteActivitySnapshot,
} from "../lib/firestoreRouteActivity";
import type { LineStringGeometry } from "../lib/geo";
import { decimateLineStringVertices, maxLineStringVerticesForMapZoom } from "../lib/geoDecimate";

export type RouteActivityMapOverlay = {
  pulseRoutes: ActivityWorldMapRoute[];
  heatRoutes: ActivityWorldMapRoute[];
  pulseDots: ActivityWorldMapDot[];
  heatDots: ActivityWorldMapDot[];
};

const EMPTY: RouteActivityMapOverlay = {
  pulseRoutes: [],
  heatRoutes: [],
  pulseDots: [],
  heatDots: [],
};

type UseRouteActivityMapOverlayOpts = {
  activity: RouteActivitySnapshot | null;
  routeGeometry: LineStringGeometry | null;
  mapZoom: number;
};

export function useRouteActivityMapOverlay(
  opts: UseRouteActivityMapOverlayOpts,
): RouteActivityMapOverlay {
  const { activity, routeGeometry, mapZoom } = opts;

  return useMemo(() => {
    if (!activity) return EMPTY;

    const hasRoute =
      Boolean(routeGeometry?.coordinates?.length && routeGeometry.coordinates.length >= 2);

    const lngLat =
      activity.liveAnchorLngLat ??
      (hasRoute
        ? (() => {
            const bounds = boundsFromLineStringGeometry(routeGeometry!);
            return bounds ? boundsCenterLngLat(bounds) : null;
          })()
        : null);

    if (!lngLat) return EMPTY;

    const heatStrength = resolveHeatTraceStrength(activity.updatedAtMs);
    const pubId = activity.publicationId;

    const pulseDots: ActivityWorldMapDot[] = isRouteActivityLive(activity)
      ? [
          {
            courseId: pubId,
            lngLat,
            pulseLevel: activity.pulseLevel > 0 ? activity.pulseLevel : 1,
            kind: "pulse",
            traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
          },
        ]
      : [];

    const heatDots: ActivityWorldMapDot[] = isRouteActivityHeat(activity)
      ? [
          {
            courseId: pubId,
            lngLat,
            pulseLevel: heatVisualWeight(activity.recentRideCount7d),
            kind: "heat",
            recentRideCount7d: activity.recentRideCount7d,
            traceStrength: heatStrength,
          },
        ]
      : [];

    if (!hasRoute) {
      return { pulseRoutes: [], heatRoutes: [], pulseDots, heatDots };
    }

    const maxV = maxLineStringVerticesForMapZoom(mapZoom);
    const geom = decimateLineStringVertices(routeGeometry!, maxV);

    const pulseRoutes: ActivityWorldMapRoute[] = isRouteActivityLive(activity)
      ? [{ courseId: pubId, geometry: geom, kind: "pulse", traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH }]
      : [];
    const heatRoutes: ActivityWorldMapRoute[] = isRouteActivityHeat(activity)
      ? [{ courseId: pubId, geometry: geom, kind: "heat", traceStrength: heatStrength }]
      : [];

    return { pulseRoutes, heatRoutes, pulseDots, heatDots };
  }, [activity, routeGeometry, mapZoom]);
}
