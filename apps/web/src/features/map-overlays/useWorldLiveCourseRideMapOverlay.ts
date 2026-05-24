import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  collectionGroup,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type FirestoreError,
} from "firebase/firestore";
import type { ActivityWorldMapDot, ActivityWorldMapRoute } from "../../lib/activityWorldLod";
import { ACTIVITY_TRACE_LIVE_STRENGTH } from "../../lib/activityWorldTraceStyle";
import { resolveActivityWorldDotLngLat } from "../../lib/activityWorldAnchor";
import { getFirebaseApp } from "../../lib/firebase";
import {
  BASIC_SHARED_HUB_IDS,
  fetchCourseRoutePayload,
  getBasicHubCoursePayload,
} from "../../lib/firestoreCourses";
import type { CourseActivitySnapshot } from "../../lib/firestoreCourseActivity";
import {
  isTrailLiveCourseRideRowFresh,
  type TrailLiveCourseRideRow,
} from "../../lib/firestoreTrailLiveCourseRides";
import { TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION } from "../../lib/firestoreTrailPaths";
import { lastSeenAtToMillis, TRAIL_PRESENCE_STALE_MS } from "../../lib/firestoreTrail";
import type { LineStringGeometry } from "../../lib/geo";
import { decimateLineStringVertices, maxLineStringVerticesForMapZoom } from "../../lib/geoDecimate";
import type { CourseActivityMapOverlay } from "../../hooks/useCourseActivityMapOverlay";

const WORLD_LIVE_RIDES_QUERY_LIMIT = 48;

type CourseGeomState =
  | { status: "ready"; geometry: LineStringGeometry }
  | { status: "loading" }
  | { status: "missing" };

type LiveCourseAggregate = {
  courseId: string;
  progressRatio: number;
  riderCount: number;
};

function parseLiveCourseRideRow(uid: string, data: Record<string, unknown>): TrailLiveCourseRideRow | null {
  const courseId = typeof data.courseId === "string" ? data.courseId.trim() : "";
  const pr = data.progressRatio;
  const progressRatio =
    typeof pr === "number" && Number.isFinite(pr) ? Math.max(0, Math.min(1, pr)) : Number.NaN;
  if (!courseId || Number.isNaN(progressRatio)) return null;
  return {
    uid,
    courseId,
    progressRatio,
    lastSeenAtMs: lastSeenAtToMillis(data.lastSeenAt),
    displayName: typeof data.displayName === "string" ? data.displayName : null,
  };
}

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

function syntheticActivityRow(agg: LiveCourseAggregate): CourseActivitySnapshot {
  return {
    courseId: agg.courseId,
    activeRiderCount: agg.riderCount,
    recentRideCount7d: 0,
    recentLikeCount: 0,
    liveNow: true,
    pulseLevel: Math.min(3, Math.max(1, agg.riderCount)),
    updatedAtMs: Date.now(),
    liveAnchorLngLat: null,
    liveAnchorProgressRatio: agg.progressRatio,
  };
}

/**
 * `liveCourseRides` collection group → Activity World pulse dot/line.
 * `courseActivity` 집계 지연·앵커 누락 시에도 주행 중인 코스를 지도에 표시한다.
 */
export function useWorldLiveCourseRideMapOverlay(opts: {
  enabled: boolean;
  mapZoom: number;
  myUid: string | null;
  excludeCourseId: string | null;
}): CourseActivityMapOverlay & { liveCourseCount: number } {
  const { enabled, mapZoom, myUid, excludeCourseId } = opts;
  const [rows, setRows] = useState<TrailLiveCourseRideRow[]>([]);
  const [geomEpoch, setGeomEpoch] = useState(0);
  const geomByCourseRef = useRef<Map<string, CourseGeomState>>(new Map());

  useEffect(() => {
    if (!enabled) {
      startTransition(() => setRows([]));
      geomByCourseRef.current.clear();
      setGeomEpoch((n) => n + 1);
      return;
    }

    const db = getFirestore(getFirebaseApp());
    const cutoff = Timestamp.fromMillis(Date.now() - TRAIL_PRESENCE_STALE_MS);
    const q = query(
      collectionGroup(db, TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION),
      where("lastSeenAt", ">", cutoff),
      orderBy("lastSeenAt", "desc"),
      limit(WORLD_LIVE_RIDES_QUERY_LIMIT),
    );

    let cancelled = false;
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: TrailLiveCourseRideRow[] = [];
        for (const d of snap.docs) {
          const row = parseLiveCourseRideRow(d.id, d.data() as Record<string, unknown>);
          if (!row || !isTrailLiveCourseRideRowFresh(row)) continue;
          if (myUid && row.uid === myUid) continue;
          next.push(row);
        }
        if (!cancelled) startTransition(() => setRows(next));
      },
      (_err: FirestoreError) => {
        if (!cancelled) startTransition(() => setRows([]));
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [enabled, myUid]);

  const aggregates = useMemo(() => {
    const exclude = excludeCourseId?.trim() ?? "";
    const filtered = exclude ? rows.filter((r) => r.courseId.trim() !== exclude) : rows;
    return aggregateLiveCourses(filtered);
  }, [rows, excludeCourseId]);

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
    const pulseRoutes: ActivityWorldMapRoute[] = [];
    const pulseDots: ActivityWorldMapDot[] = [];
    const geomMap = geomByCourseRef.current;

    for (const agg of aggregates) {
      const g = geomMap.get(agg.courseId);
      if (!g || g.status !== "ready") continue;

      const activityRow = syntheticActivityRow(agg);
      const lngLat = resolveActivityWorldDotLngLat(activityRow, g.geometry);
      if (!lngLat) continue;

      pulseDots.push({
        courseId: agg.courseId,
        lngLat,
        pulseLevel: activityRow.pulseLevel,
        kind: "pulse",
        traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
      });

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
      pulseDots,
      heatDots: [],
    };
  }, [aggregates, mapZoom, geomEpoch]);

  return { ...overlay, liveCourseCount: aggregates.length };
}
