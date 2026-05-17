import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  isLngLatInViewport,
  type ActivityWorldMapDot,
  type MapViewportBounds,
} from "../lib/activityWorldLod";
import {
  BASIC_SHARED_HUB_IDS,
  boundsCenterLngLat,
  fetchCourseBounds,
  fetchCourseRoutePayload,
  getBasicHubCourseBounds,
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

const MAX_MAP_OVERLAY_LOADS = 16;

type GeomEntry =
  | { status: "ready"; geometry: LineStringGeometry }
  | { status: "loading" }
  | { status: "missing" };

type BoundsEntry =
  | { status: "ready"; lngLat: [number, number] }
  | { status: "loading" }
  | { status: "missing" };

type UsePublishedCoursesActivityMapOverlayOpts = {
  courseIds: readonly string[];
  /** 현재 지도에 올린 코스 — 단일 코스 오버레이 훅과 중복 방지 */
  excludeCourseId: string | null;
  mapZoom: number;
  lineMode: boolean;
  mapViewport: MapViewportBounds | null;
  enabled: boolean;
};

function scoreActivity(a: CourseActivitySnapshot): number {
  if (a.liveNow) return 1000 + a.activeRiderCount * 10 + a.pulseLevel;
  return a.recentRideCount7d;
}

/**
 * 퍼블릭·입문 허브 등 카탈로그 코스의 activity aggregate.
 * LINE 모드: geometry(저빈도 getDoc). DOT 모드: bounds 앵커만.
 */
export function usePublishedCoursesActivityMapOverlay(
  opts: UsePublishedCoursesActivityMapOverlayOpts,
): CourseActivityMapOverlay & { activityByCourseId: ReadonlyMap<string, CourseActivitySnapshot | null> } {
  const { courseIds, excludeCourseId, mapZoom, lineMode, mapViewport, enabled } = opts;
  const [activityByCourseId, setActivityByCourseId] = useState<
    ReadonlyMap<string, CourseActivitySnapshot | null>
  >(() => new Map());
  const [overlayEpoch, setOverlayEpoch] = useState(0);
  const geomByCourseRef = useRef<Map<string, GeomEntry>>(new Map());
  const boundsByCourseRef = useRef<Map<string, BoundsEntry>>(new Map());

  const courseIdsKey = useMemo(() => [...new Set(courseIds)].sort().join(","), [courseIds]);

  useEffect(() => {
    if (!enabled || courseIds.length === 0) {
      startTransition(() => setActivityByCourseId(new Map()));
      geomByCourseRef.current.clear();
      boundsByCourseRef.current.clear();
      setOverlayEpoch((n) => n + 1);
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
        .slice(0, MAX_MAP_OVERLAY_LOADS);

      const keep = new Set(candidates.map(([id]) => id));

      if (lineMode) {
        boundsByCourseRef.current.clear();
        const geomMap = geomByCourseRef.current;
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
            if (!cancelled) setOverlayEpoch((n) => n + 1);
          })();
        }
        if (scheduled) setOverlayEpoch((n) => n + 1);
      } else {
        geomByCourseRef.current.clear();
        const boundsMap = boundsByCourseRef.current;
        for (const key of [...boundsMap.keys()]) {
          if (!keep.has(key)) boundsMap.delete(key);
        }

        let scheduled = false;
        for (const [cid, row] of candidates) {
          if (row?.liveAnchorLngLat) {
            boundsMap.set(cid, { status: "ready", lngLat: row.liveAnchorLngLat });
            continue;
          }
          const hubBounds = getBasicHubCourseBounds(cid);
          if (hubBounds) {
            boundsMap.set(cid, { status: "ready", lngLat: boundsCenterLngLat(hubBounds) });
            continue;
          }
          if (boundsMap.has(cid)) continue;
          boundsMap.set(cid, { status: "loading" });
          scheduled = true;
          void (async () => {
            try {
              const b = await fetchCourseBounds(cid);
              if (b) {
                boundsByCourseRef.current.set(cid, {
                  status: "ready",
                  lngLat: boundsCenterLngLat(b),
                });
              } else {
                boundsByCourseRef.current.set(cid, { status: "missing" });
              }
            } catch {
              boundsByCourseRef.current.set(cid, { status: "missing" });
            }
            if (!cancelled) setOverlayEpoch((n) => n + 1);
          })();
        }
        if (scheduled) setOverlayEpoch((n) => n + 1);
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), COURSE_ACTIVITY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, courseIdsKey, excludeCourseId, courseIds, lineMode]);

  const overlay = useMemo((): CourseActivityMapOverlay => {
    const pulseRoutes: LineStringGeometry[] = [];
    const heatRoutes: LineStringGeometry[] = [];
    const pulseDots: ActivityWorldMapDot[] = [];
    const heatDots: ActivityWorldMapDot[] = [];

    if (lineMode) {
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
    } else {
      const boundsMap = boundsByCourseRef.current;
      for (const [cid, row] of activityByCourseId) {
        if (!row || cid === excludeCourseId) continue;
        const b = boundsMap.get(cid);
        if (!b || b.status !== "ready") continue;
        if (!isLngLatInViewport(b.lngLat, mapViewport)) continue;
        if (row.liveNow || row.pulseLevel > 0) {
          pulseDots.push({
            courseId: cid,
            lngLat: b.lngLat,
            pulseLevel: row.pulseLevel > 0 ? row.pulseLevel : 1,
            kind: "pulse",
          });
        } else if (row.recentRideCount7d > 0) {
          heatDots.push({
            courseId: cid,
            lngLat: b.lngLat,
            pulseLevel: 0,
            kind: "heat",
          });
        }
      }
    }

    return { pulseRoutes, heatRoutes, pulseDots, heatDots };
  }, [activityByCourseId, excludeCourseId, mapZoom, lineMode, mapViewport, overlayEpoch]);

  return { ...overlay, activityByCourseId };
}
