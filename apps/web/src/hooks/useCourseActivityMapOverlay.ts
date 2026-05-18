import { useMemo } from "react";
import type { ActivityWorldMapDot, ActivityWorldMapRoute } from "../lib/activityWorldLod";
import {
  ACTIVITY_TRACE_LIVE_STRENGTH,
  resolveHeatTraceStrength,
} from "../lib/activityWorldTraceStyle";
import { boundsCenterLngLat, boundsFromLineStringGeometry } from "../lib/firestoreCourses";
import {
  heatVisualWeight,
  isCourseActivityHeat,
  isCourseActivityLive,
  type CourseActivitySnapshot,
} from "../lib/firestoreCourseActivity";
import type { LineStringGeometry } from "../lib/geo";
import { decimateLineStringVertices, maxLineStringVerticesForMapZoom } from "../lib/geoDecimate";

export type CourseActivityMapOverlay = {
  pulseRoutes: ActivityWorldMapRoute[];
  heatRoutes: ActivityWorldMapRoute[];
  pulseDots: ActivityWorldMapDot[];
  heatDots: ActivityWorldMapDot[];
};

const EMPTY: CourseActivityMapOverlay = {
  pulseRoutes: [],
  heatRoutes: [],
  pulseDots: [],
  heatDots: [],
};

type UseCourseActivityMapOverlayOpts = {
  activity: CourseActivitySnapshot | null;
  routeGeometry: LineStringGeometry | null;
  mapZoom: number;
};

/** 현재 지도에 올린 코스 1건 — 라이브 펄스 + 종료 후 heat 흔적 */
export function useCourseActivityMapOverlay(
  opts: UseCourseActivityMapOverlayOpts,
): CourseActivityMapOverlay {
  const { activity, routeGeometry, mapZoom } = opts;

  return useMemo(() => {
    if (!routeGeometry?.coordinates?.length || routeGeometry.coordinates.length < 2) {
      return EMPTY;
    }
    if (!activity) return EMPTY;

    const lngLat =
      activity.liveAnchorLngLat ??
      (() => {
        const bounds = boundsFromLineStringGeometry(routeGeometry);
        return bounds ? boundsCenterLngLat(bounds) : null;
      })();

    if (!lngLat) return EMPTY;

    const heatStrength = resolveHeatTraceStrength(activity.updatedAtMs);

    const pulseDots: ActivityWorldMapDot[] = isCourseActivityLive(activity)
      ? [
          {
            courseId: activity.courseId,
            lngLat,
            pulseLevel: activity.pulseLevel > 0 ? activity.pulseLevel : 1,
            kind: "pulse",
            traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
          },
        ]
      : [];

    const heatDots: ActivityWorldMapDot[] =
      isCourseActivityHeat(activity)
        ? [
            {
              courseId: activity.courseId,
              lngLat,
              pulseLevel: heatVisualWeight(activity.recentRideCount7d),
              kind: "heat",
              recentRideCount7d: activity.recentRideCount7d,
              traceStrength: heatStrength,
            },
          ]
        : [];

    const maxV = maxLineStringVerticesForMapZoom(mapZoom);
    const geom = decimateLineStringVertices(routeGeometry, maxV);

    const pulseRoutes: ActivityWorldMapRoute[] = isCourseActivityLive(activity)
      ? [
          {
            courseId: activity.courseId,
            geometry: geom,
            kind: "pulse",
            traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
          },
        ]
      : [];
    const heatRoutes: ActivityWorldMapRoute[] = isCourseActivityHeat(activity)
      ? [
          {
            courseId: activity.courseId,
            geometry: geom,
            kind: "heat",
            traceStrength: heatStrength,
          },
        ]
      : [];

    return { pulseRoutes, heatRoutes, pulseDots, heatDots };
  }, [activity, routeGeometry, mapZoom]);
}
