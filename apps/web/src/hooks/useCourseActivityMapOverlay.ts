import { useMemo } from "react";
import {
  isLngLatInViewport,
  type ActivityWorldMapDot,
  type MapViewportBounds,
} from "../lib/activityWorldLod";
import { boundsCenterLngLat, boundsFromLineStringGeometry } from "../lib/firestoreCourses";
import type { CourseActivitySnapshot } from "../lib/firestoreCourseActivity";
import type { LineStringGeometry } from "../lib/geo";
import { decimateLineStringVertices, maxLineStringVerticesForMapZoom } from "../lib/geoDecimate";

export type CourseActivityMapOverlay = {
  /** 녹색 라이브 펄스 — `liveNow` / `pulseLevel` (LINE 모드) */
  pulseRoutes: LineStringGeometry[];
  /** 회색 최근 활동 — 7일 내 주행 흔적 (LINE 모드) */
  heatRoutes: LineStringGeometry[];
  /** 월드 뷰 DOT 모드 */
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
  /** false = DOT(앵커), true = LINE */
  lineMode: boolean;
  mapViewport: MapViewportBounds | null;
};

/** 현재 지도에 올린 코스 1건 — aggregate 펄스/heat */
export function useCourseActivityMapOverlay(
  opts: UseCourseActivityMapOverlayOpts,
): CourseActivityMapOverlay {
  const { activity, routeGeometry, mapZoom, lineMode, mapViewport } = opts;

  return useMemo(() => {
    if (!routeGeometry?.coordinates?.length || routeGeometry.coordinates.length < 2) {
      return EMPTY;
    }
    if (!activity) return EMPTY;

    if (!lineMode) {
      const lngLat =
        activity.liveAnchorLngLat ??
        (() => {
          const bounds = boundsFromLineStringGeometry(routeGeometry);
          return bounds ? boundsCenterLngLat(bounds) : null;
        })();
      if (!lngLat || !isLngLatInViewport(lngLat, mapViewport)) return EMPTY;
      const pulseDots: ActivityWorldMapDot[] =
        activity.liveNow || activity.pulseLevel > 0
          ? [
              {
                courseId: activity.courseId,
                lngLat,
                pulseLevel: activity.pulseLevel > 0 ? activity.pulseLevel : 1,
                kind: "pulse",
              },
            ]
          : [];
      const heatDots: ActivityWorldMapDot[] =
        !pulseDots.length && activity.recentRideCount7d > 0
          ? [{ courseId: activity.courseId, lngLat, pulseLevel: 0, kind: "heat" }]
          : [];
      return { ...EMPTY, pulseDots, heatDots };
    }

    const maxV = maxLineStringVerticesForMapZoom(mapZoom);
    const geom = decimateLineStringVertices(routeGeometry, maxV);

    const pulseRoutes: LineStringGeometry[] =
      activity.liveNow || activity.pulseLevel > 0 ? [geom] : [];
    const heatRoutes: LineStringGeometry[] =
      !pulseRoutes.length && activity.recentRideCount7d > 0 ? [geom] : [];

    return { pulseRoutes, heatRoutes, pulseDots: [], heatDots: [] };
  }, [activity, routeGeometry, mapZoom, lineMode, mapViewport]);
}
