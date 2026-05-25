import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityWorldMapRoute } from "../../lib/activityWorldLod";
import { ACTIVITY_TRACE_LIVE_STRENGTH } from "../../lib/activityWorldTraceStyle";
import {
  BASIC_SHARED_HUB_IDS,
  fetchCourseRoutePayload,
  getBasicHubCoursePayload,
} from "../../lib/firestoreCourses";
import {
  isTrailLiveCourseRideRowFresh,
  type TrailLiveCourseRideRow,
} from "../../lib/firestoreTrailLiveCourseRides";
import { acquireTrailLiveCourseRidesSubscription } from "../../lib/liveCourseRidesSubscriptionHub";
import { sanitizeTrailId } from "../../lib/firestoreTrail";
import type { LineStringGeometry } from "../../lib/geo";
import { decimateLineStringVertices, maxLineStringVerticesForMapZoom } from "../../lib/geoDecimate";
import type { CourseActivityMapOverlay } from "../../hooks/useCourseActivityMapOverlay";

type CourseGeomState =
  | { status: "ready"; geometry: LineStringGeometry }
  | { status: "loading" }
  | { status: "missing" };

type LiveCourseAggregate = {
  courseId: string;
  progressRatio: number;
  riderCount: number;
};

function aggregateLiveCourses(rows: readonly TrailLiveCourseRideRow[]): LiveCourseAggregate[] {
  const byCourse = new Map<string, { progressRatio: number; riderCount: number }>();
  for (const row of rows) {
    const courseId = row.courseId.trim();
    if (!courseId) continue;
    const cur = byCourse.get(courseId) ?? { progressRatio: 0, riderCount: 0 };
    cur.progressRatio = Math.max(cur.progressRatio, row.progressRatio);
    cur.riderCount += 1;
    byCourse.set(courseId, cur);
  }
  return [...byCourse.entries()].map(([courseId, v]) => ({
    courseId,
    progressRatio: v.progressRatio,
    riderCount: v.riderCount,
  }));
}

function mergeLiveRows(maps: Map<string, TrailLiveCourseRideRow>[]): TrailLiveCourseRideRow[] {
  const merged = new Map<string, TrailLiveCourseRideRow>();
  for (const m of maps) {
    for (const [uid, row] of m) {
      const prev = merged.get(uid);
      if (!prev || (row.lastSeenAtMs ?? 0) >= (prev.lastSeenAtMs ?? 0)) {
        merged.set(uid, row);
      }
    }
  }
  return [...merged.values()];
}

const EMPTY_LIVE_OVERLAY: CourseActivityMapOverlay = {
  pulseRoutes: [],
  heatRoutes: [],
  pulseDots: [],
  heatDots: [],
};

/**
 * `liveCourseRides` → Activity World **pulse line only** (per-user dot 은 global livePresence).
 * catalog·publication 에 라인이 없을 때 route geometry gap-fill.
 */
export function useWorldLiveCourseRideMapOverlay(opts: {
  enabled: boolean;
  mapZoom: number;
  myUid: string | null;
  excludeCourseId: string | null;
  /** 현재 Trail + openTrailListings */
  trailIds: readonly string[];
}): CourseActivityMapOverlay & { liveCourseCount: number; liveRideRowCount: number } {
  const { enabled, mapZoom, myUid, excludeCourseId, trailIds } = opts;
  const [rows, setRows] = useState<TrailLiveCourseRideRow[]>([]);
  const [geomEpoch, setGeomEpoch] = useState(0);
  const geomByCourseRef = useRef<Map<string, CourseGeomState>>(new Map());

  const trailIdsKey = useMemo(() => {
    const ids = new Set<string>();
    for (const raw of trailIds) {
      const tid = sanitizeTrailId(raw);
      if (tid) ids.add(tid);
    }
    return [...ids].sort().join(",");
  }, [trailIds]);

  useEffect(() => {
    if (!enabled || !trailIdsKey) {
      startTransition(() => setRows([]));
      geomByCourseRef.current.clear();
      setGeomEpoch((n) => n + 1);
      return;
    }

    const trailIdList = trailIdsKey.split(",").filter(Boolean);
    const rowMaps = trailIdList.map(() => new Map<string, TrailLiveCourseRideRow>());
    const emit = () => {
      startTransition(() => setRows(mergeLiveRows(rowMaps)));
    };

    const releases = trailIdList.map((tid, index) =>
      acquireTrailLiveCourseRidesSubscription(
        tid,
        (next) => {
          const map = rowMaps[index]!;
          map.clear();
          for (const row of next) {
            if (!isTrailLiveCourseRideRowFresh(row)) continue;
            map.set(row.uid, row);
          }
          emit();
        },
        (err) => {
          if (import.meta.env.DEV) {
            console.warn("[WorldLiveCourseRide] subscribe failed", tid, err.message);
          }
        },
      ),
    );

    return () => {
      for (const release of releases) release();
    };
  }, [enabled, trailIdsKey]);

  const aggregates = useMemo(() => {
    const exclude = excludeCourseId?.trim() ?? "";
    const filtered = rows.filter((r) => {
      if (exclude && r.courseId.trim() === exclude) return false;
      if (myUid && r.uid === myUid) return false;
      return true;
    });
    return aggregateLiveCourses(filtered);
  }, [rows, excludeCourseId, myUid]);

  useEffect(() => {
    if (!enabled) return;
    if (aggregates.length === 0) {
      geomByCourseRef.current.clear();
      setGeomEpoch((n) => n + 1);
      return;
    }

    const courseIds = aggregates.map((a) => a.courseId);
    const map = geomByCourseRef.current;
    let scheduled = false;

    for (const cid of courseIds) {
      if (map.has(cid)) continue;
      map.set(cid, { status: "loading" });
      scheduled = true;

      const isBasicHub = (BASIC_SHARED_HUB_IDS as readonly string[]).includes(cid);
      void (async () => {
        try {
          const geometry: LineStringGeometry | null = isBasicHub
            ? getBasicHubCoursePayload(cid).geometry
            : (await fetchCourseRoutePayload(cid))?.geometry ?? null;
          const cur = geomByCourseRef.current;
          if (!geometry?.coordinates?.length) {
            cur.set(cid, { status: "missing" });
            if (import.meta.env.DEV) {
              console.warn("[WorldLiveCourseRide] geometry missing", cid);
            }
          } else {
            cur.set(cid, { status: "ready", geometry });
          }
        } catch {
          geomByCourseRef.current.set(cid, { status: "missing" });
        }
        setGeomEpoch((n) => n + 1);
      })();
    }

    const keep = new Set(courseIds);
    for (const key of [...map.keys()]) {
      if (!keep.has(key)) map.delete(key);
    }

    if (scheduled) setGeomEpoch((n) => n + 1);
  }, [enabled, aggregates]);

  const overlay = useMemo((): CourseActivityMapOverlay => {
    if (aggregates.length === 0) return EMPTY_LIVE_OVERLAY;

    const pulseRoutes: ActivityWorldMapRoute[] = [];
    const geomMap = geomByCourseRef.current;

    for (const agg of aggregates) {
      const g = geomMap.get(agg.courseId);
      if (!g || g.status !== "ready") continue;

      pulseRoutes.push({
        courseId: agg.courseId,
        geometry: decimateLineStringVertices(g.geometry, maxLineStringVerticesForMapZoom(mapZoom)),
        kind: "pulse",
        traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
      });
    }

    return {
      pulseRoutes,
      heatRoutes: [],
      pulseDots: [],
      heatDots: [],
    };
  }, [aggregates, mapZoom, geomEpoch]);

  return {
    ...overlay,
    liveCourseCount: aggregates.length,
    liveRideRowCount: rows.length,
  };
}
