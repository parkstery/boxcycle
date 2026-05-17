import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  BASIC_SHARED_HUB_IDS,
  fetchCourseRoutePayload,
  getBasicHubCoursePayload,
} from "../lib/firestoreCourses";
import {
  fetchCourseActivitiesBatch,
  type CourseActivitySnapshot,
} from "../lib/firestoreCourseActivity";
import type { LineStringGeometry } from "../lib/geo";
import { decimateLineStringVertices, maxLineStringVerticesForMapZoom } from "../lib/geoDecimate";
import { COURSE_ACTIVITY_POLL_MS } from "../lib/rideSyncPolicy";
import type { CourseActivityMapOverlay } from "./useCourseActivityMapOverlay";

const MAX_MAP_GEOM_LOADS = 16;

type GeomEntry =
  | { status: "ready"; geometry: LineStringGeometry }
  | { status: "loading" }
  | { status: "missing" };

type UsePublishedCoursesActivityMapOverlayOpts = {
  courseIds: readonly string[];
  /** 현재 지도에 올린 코스 — 단일 코스 오버레이 훅과 중복 방지 */
  excludeCourseId: string | null;
  mapZoom: number;
  enabled: boolean;
};

function scoreActivity(a: CourseActivitySnapshot): number {
  if (a.liveNow) return 1000 + a.activeRiderCount * 10 + a.pulseLevel;
  return a.recentRideCount7d;
}

/**
 * 퍼블릭·입문 허브 등 카탈로그 코스의 activity aggregate + geometry(저빈도 getDoc).
 */
export function usePublishedCoursesActivityMapOverlay(
  opts: UsePublishedCoursesActivityMapOverlayOpts,
): CourseActivityMapOverlay & { activityByCourseId: ReadonlyMap<string, CourseActivitySnapshot | null> } {
  const { courseIds, excludeCourseId, mapZoom, enabled } = opts;
  const [activityByCourseId, setActivityByCourseId] = useState<
    ReadonlyMap<string, CourseActivitySnapshot | null>
  >(() => new Map());
  const [geomEpoch, setGeomEpoch] = useState(0);
  const geomByCourseRef = useRef<Map<string, GeomEntry>>(new Map());

  const courseIdsKey = useMemo(() => [...new Set(courseIds)].sort().join(","), [courseIds]);

  useEffect(() => {
    if (!enabled || courseIds.length === 0) {
      startTransition(() => setActivityByCourseId(new Map()));
      geomByCourseRef.current.clear();
      setGeomEpoch((n) => n + 1);
      return;
    }

    let cancelled = false;

    const tick = async () => {
      const map = await fetchCourseActivitiesBatch(courseIds);
      if (cancelled) return;
      startTransition(() => setActivityByCourseId(map));

      const exclude = excludeCourseId?.trim() ?? "";
      const candidates = [...map.entries()]
        .filter(([id, row]) => {
          if (!row || id === exclude) return false;
          return row.liveNow || row.recentRideCount7d > 0;
        })
        .sort((a, b) => scoreActivity(b[1]!) - scoreActivity(a[1]!))
        .slice(0, MAX_MAP_GEOM_LOADS);

      const geomMap = geomByCourseRef.current;
      const keep = new Set(candidates.map(([id]) => id));
      for (const key of [...geomMap.keys()]) {
        if (!keep.has(key)) geomMap.delete(key);
      }

      let scheduled = false;
      for (const [cid] of candidates) {
        if (geomMap.has(cid)) continue;
        geomMap.set(cid, { status: "loading" });
        scheduled = true;
        const isBasic = (BASIC_SHARED_HUB_IDS as readonly string[]).includes(cid);
        void (async () => {
          try {
            const geometry: LineStringGeometry | null = isBasic
              ? getBasicHubCoursePayload(cid).geometry
              : (await fetchCourseRoutePayload(cid))?.geometry ?? null;
            if (!geometry?.coordinates?.length) {
              geomByCourseRef.current.set(cid, { status: "missing" });
            } else {
              geomByCourseRef.current.set(cid, { status: "ready", geometry });
            }
          } catch {
            geomByCourseRef.current.set(cid, { status: "missing" });
          }
          if (!cancelled) setGeomEpoch((n) => n + 1);
        })();
      }
      if (scheduled) setGeomEpoch((n) => n + 1);
    };

    void tick();
    const id = window.setInterval(() => void tick(), COURSE_ACTIVITY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, courseIdsKey, excludeCourseId, courseIds]);

  const overlay = useMemo((): CourseActivityMapOverlay => {
    const pulseRoutes: LineStringGeometry[] = [];
    const heatRoutes: LineStringGeometry[] = [];
    const maxV = maxLineStringVerticesForMapZoom(mapZoom);
    const geomMap = geomByCourseRef.current;

    for (const [cid, row] of activityByCourseId) {
      if (!row || cid === excludeCourseId) continue;
      const g = geomMap.get(cid);
      if (!g || g.status !== "ready") continue;
      const line = decimateLineStringVertices(g.geometry, maxV);
      if (row.liveNow || row.pulseLevel > 0) {
        pulseRoutes.push(line);
      } else if (row.recentRideCount7d > 0) {
        heatRoutes.push(line);
      }
    }

    return { pulseRoutes, heatRoutes };
  }, [activityByCourseId, excludeCourseId, mapZoom, geomEpoch]);

  return { ...overlay, activityByCourseId };
}
