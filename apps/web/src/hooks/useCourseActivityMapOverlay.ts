import { useMemo } from "react";
import type { CourseActivitySnapshot } from "../lib/firestoreCourseActivity";
import type { LineStringGeometry } from "../lib/geo";
import { decimateLineStringVertices, maxLineStringVerticesForMapZoom } from "../lib/geoDecimate";

export type CourseActivityMapOverlay = {
  /** 녹색 라이브 펄스 — `liveNow` / `pulseLevel` */
  pulseRoutes: LineStringGeometry[];
  /** 회색 최근 활동 — 7일 내 주행 흔적(aggregate만, rider dots 아님) */
  heatRoutes: LineStringGeometry[];
};

type UseCourseActivityMapOverlayOpts = {
  activity: CourseActivitySnapshot | null;
  routeGeometry: LineStringGeometry | null;
  mapZoom: number;
};

/** 현재 지도에 올린 코스 1건 — aggregate 펄스/heat */
export function useCourseActivityMapOverlay(
  opts: UseCourseActivityMapOverlayOpts,
): CourseActivityMapOverlay {
  const { activity, routeGeometry, mapZoom } = opts;

  return useMemo(() => {
    const empty = { pulseRoutes: [], heatRoutes: [] as LineStringGeometry[] };
    if (!routeGeometry?.coordinates?.length || routeGeometry.coordinates.length < 2) {
      return empty;
    }
    const maxV = maxLineStringVerticesForMapZoom(mapZoom);
    const geom = decimateLineStringVertices(routeGeometry, maxV);
    if (!activity) return empty;

    const pulseRoutes: LineStringGeometry[] =
      activity.liveNow || activity.pulseLevel > 0 ? [geom] : [];
    const heatRoutes: LineStringGeometry[] =
      !pulseRoutes.length && activity.recentRideCount7d > 0 ? [geom] : [];

    return { pulseRoutes, heatRoutes };
  }, [activity, routeGeometry, mapZoom]);
}
