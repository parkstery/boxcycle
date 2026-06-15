import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityWorldMapDot, ActivityWorldMapRoute } from "../lib/activityWorldLod";
import {
  ACTIVITY_TRACE_LIVE_STRENGTH,
  resolveHeatTraceStrength,
} from "../lib/activityWorldTraceStyle";
import type { LngLat } from "../lib/geo";
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
  heatVisualWeight,
  isCourseActivityHeat,
  isCourseActivityLive,
  type CourseActivitySnapshot,
} from "../lib/firestoreCourseActivity";
import type { LineStringGeometry } from "../lib/geo";
import { decimateLineStringVertices, maxLineStringVerticesForMapZoom } from "../lib/geoDecimate";
import { resolveActivityWorldDotLngLat } from "../lib/activityWorldAnchor";
import type { CourseActivityMapOverlay } from "./useCourseActivityMapOverlay";

const MAX_LIVE_MAP_OVERLAY = 10;
const MAX_HEAT_MAP_OVERLAY = 10;

type GeomEntry =
  | { status: "ready"; geometry: LineStringGeometry }
  | { status: "loading" }
  | { status: "missing" };

type BoundsEntry =
  | { status: "ready"; lngLat: LngLat }
  | { status: "loading" }
  | { status: "missing" };

export type PublishedCoursesActivityOverlayStats = {
  boundsReady: number;
  geometryReady: number;
  boundsLoading: number;
  geometryLoading: number;
  activityRows: number;
  liveCandidates: number;
  heatCandidates: number;
  /** live/heat 후보인데 앵커 좌표 없음 (`courses`·bounds·liveAnchor) */
  anchorMissing: number;
};

type UsePublishedCoursesActivityMapOverlayOpts = {
  courseIds: readonly string[];
  excludeCourseId: string | null;
  mapZoom: number;
  enabled: boolean;
  /** false면 aggregate만 조회 — dot/line·geometry 로드 생략(publication presence 사용 시) */
  worldMapRenderEnabled?: boolean;
  /** 주행 종료 등 — 즉시 aggregate·bounds 재조회 */
  refreshNonce?: number;
  /** WO-A coordinator — 제공 시 내부 poll 생략 */
  externalSync?: {
    activityByCourseId: ReadonlyMap<string, CourseActivitySnapshot | null>;
    syncEpoch: number;
  };
};

function scoreLiveActivity(a: CourseActivitySnapshot): number {
  if (a.liveNow) return 1000 + a.activeRiderCount * 10 + a.pulseLevel;
  return 0;
}

function scoreHeatActivity(a: CourseActivitySnapshot): number {
  return a.recentRideCount7d;
}

function selectOverlayCandidateIds(
  map: ReadonlyMap<string, CourseActivitySnapshot | null>,
  excludeCourseId: string,
): string[] {
  const live: [string, CourseActivitySnapshot][] = [];
  const heat: [string, CourseActivitySnapshot][] = [];

  for (const [id, row] of map) {
    if (!row) continue;
    if (isCourseActivityLive(row)) {
      if (id !== excludeCourseId) live.push([id, row]);
      continue;
    }
    if (isCourseActivityHeat(row)) heat.push([id, row]);
  }

  live.sort((a, b) => scoreLiveActivity(b[1]) - scoreLiveActivity(a[1]));
  heat.sort((a, b) => scoreHeatActivity(b[1]) - scoreHeatActivity(a[1]));

  const liveIds = live.slice(0, MAX_LIVE_MAP_OVERLAY).map(([id]) => id);
  const heatIds = heat.slice(0, MAX_HEAT_MAP_OVERLAY).map(([id]) => id);
  return [...new Set([...liveIds, ...heatIds])];
}

function ensureBoundsLoaded(
  cid: string,
  row: CourseActivitySnapshot,
  boundsMap: Map<string, BoundsEntry>,
  onReady: () => void,
): void {
  const existing = boundsMap.get(cid);
  if (existing?.status === "ready" || existing?.status === "loading") return;

  if (row.liveAnchorLngLat) {
    boundsMap.set(cid, { status: "ready", lngLat: row.liveAnchorLngLat });
    onReady();
    return;
  }

  const hubBounds = getBasicHubCourseBounds(cid);
  if (hubBounds) {
    boundsMap.set(cid, { status: "ready", lngLat: boundsCenterLngLat(hubBounds) });
    onReady();
    return;
  }

  boundsMap.set(cid, { status: "loading" });
  void (async () => {
    try {
      const b = await fetchCourseBounds(cid);
      if (b) {
        boundsMap.set(cid, { status: "ready", lngLat: boundsCenterLngLat(b) });
      } else {
        const payload = await fetchCourseRoutePayload(cid);
        const geom = payload?.geometry;
        if (geom?.coordinates?.length) {
          const derived = resolveActivityWorldDotLngLat(row, geom);
          if (derived) {
            boundsMap.set(cid, { status: "ready", lngLat: derived });
          } else {
            boundsMap.set(cid, { status: "missing" });
          }
        } else {
          boundsMap.set(cid, { status: "missing" });
        }
      }
    } catch {
      boundsMap.set(cid, { status: "missing" });
    }
    onReady();
  })();
}

function ensureGeometryLoaded(
  cid: string,
  geomMap: Map<string, GeomEntry>,
  onReady: () => void,
): void {
  const existing = geomMap.get(cid);
  if (existing?.status === "ready" || existing?.status === "loading") return;

  geomMap.set(cid, { status: "loading" });
  const isBasic = (BASIC_SHARED_HUB_IDS as readonly string[]).includes(cid);
  void (async () => {
    try {
      const geometry: LineStringGeometry | null = isBasic
        ? getBasicHubCoursePayload(cid).geometry
        : (await fetchCourseRoutePayload(cid))?.geometry ?? null;
      if (!geometry?.coordinates?.length) {
        geomMap.set(cid, { status: "missing" });
      } else {
        geomMap.set(cid, { status: "ready", geometry });
      }
    } catch {
      geomMap.set(cid, { status: "missing" });
    }
    onReady();
  })();
}

/**
 * 퍼블릭·입문 허브 등 카탈로그 코스 activity aggregate.
 * 라이브·heat 후보 풀 분리 — live 최대 10 + heat 최대 10.
 */
export function usePublishedCoursesActivityMapOverlay(
  opts: UsePublishedCoursesActivityMapOverlayOpts,
): CourseActivityMapOverlay & {
  activityByCourseId: ReadonlyMap<string, CourseActivitySnapshot | null>;
  overlayStats: PublishedCoursesActivityOverlayStats;
} {
  const { courseIds, excludeCourseId, mapZoom, enabled, worldMapRenderEnabled = true, refreshNonce = 0, externalSync } = opts;
  const [activityByCourseId, setActivityByCourseId] = useState<
    ReadonlyMap<string, CourseActivitySnapshot | null>
  >(() => new Map());
  const [overlayCandidateIds, setOverlayCandidateIds] = useState<string[]>([]);
  const [overlayEpoch, setOverlayEpoch] = useState(0);
  const geomByCourseRef = useRef<Map<string, GeomEntry>>(new Map());
  const boundsByCourseRef = useRef<Map<string, BoundsEntry>>(new Map());
  const bumpOverlay = useRef(() => setOverlayEpoch((n) => n + 1));

  const courseIdsKey = useMemo(() => [...new Set(courseIds)].sort().join(","), [courseIds]);
  const useExternalSync = externalSync != null;

  const applyBatchMap = useCallback(
    (map: ReadonlyMap<string, CourseActivitySnapshot | null>) => {
      const exclude = excludeCourseId?.trim() ?? "";
      const candidateIds = worldMapRenderEnabled ? selectOverlayCandidateIds(map, exclude) : [];

      startTransition(() => {
        setActivityByCourseId(map);
        setOverlayCandidateIds(candidateIds);
      });

      if (!worldMapRenderEnabled) {
        geomByCourseRef.current.clear();
        boundsByCourseRef.current.clear();
        return;
      }

      const keep = new Set(candidateIds);
      const geomMap = geomByCourseRef.current;
      const boundsMap = boundsByCourseRef.current;

      for (const key of [...geomMap.keys()]) {
        if (!keep.has(key)) geomMap.delete(key);
      }
      for (const key of [...boundsMap.keys()]) {
        if (!keep.has(key)) boundsMap.delete(key);
      }

      let kicked = false;
      for (const cid of candidateIds) {
        const row = map.get(cid);
        if (!row) continue;
        ensureBoundsLoaded(cid, row, boundsMap, () => bumpOverlay.current());
        ensureGeometryLoaded(cid, geomMap, () => bumpOverlay.current());
        kicked = true;
      }

      if (kicked) bumpOverlay.current();
    },
    [excludeCourseId, worldMapRenderEnabled],
  );

  useEffect(() => {
    bumpOverlay.current = () => setOverlayEpoch((n) => n + 1);
  });

  useEffect(() => {
    if (!useExternalSync || !enabled) return;
    applyBatchMap(externalSync.activityByCourseId);
  }, [useExternalSync, enabled, externalSync?.syncEpoch, externalSync?.activityByCourseId, applyBatchMap]);

  useEffect(() => {
    if (useExternalSync || !enabled || courseIds.length === 0) {
      if (!enabled || courseIds.length === 0) {
        startTransition(() => {
          setActivityByCourseId(new Map());
          setOverlayCandidateIds([]);
        });
        geomByCourseRef.current.clear();
        boundsByCourseRef.current.clear();
        setOverlayEpoch((n) => n + 1);
      }
      return;
    }

    let cancelled = false;

    const tick = async () => {
      const map = await fetchCourseActivitiesBatch(courseIds, { refresh: false });
      if (cancelled) return;
      applyBatchMap(map);
    };

    void tick();
    return () => {
      cancelled = true;
    };
  }, [useExternalSync, enabled, courseIdsKey, courseIds, applyBatchMap]);

  useEffect(() => {
    if (useExternalSync) return;
    if (!enabled || refreshNonce === 0) return;
    let cancelled = false;
    void (async () => {
      const map = await fetchCourseActivitiesBatch(courseIds, { refresh: true });
      if (cancelled) return;
      applyBatchMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [useExternalSync, refreshNonce, enabled, courseIdsKey, courseIds, applyBatchMap]);

  const { overlay, overlayStats } = useMemo(() => {
    if (!worldMapRenderEnabled) {
      return {
        overlay: {
          pulseRoutes: [],
          heatRoutes: [],
          pulseDots: [],
          heatDots: [],
        } satisfies CourseActivityMapOverlay,
        overlayStats: {
          boundsReady: 0,
          geometryReady: 0,
          boundsLoading: 0,
          geometryLoading: 0,
          activityRows: 0,
          liveCandidates: 0,
          heatCandidates: 0,
          anchorMissing: 0,
        } satisfies PublishedCoursesActivityOverlayStats,
      };
    }

    const pulseRoutes: ActivityWorldMapRoute[] = [];
    const heatRoutes: ActivityWorldMapRoute[] = [];
    const pulseDots: ActivityWorldMapDot[] = [];
    const heatDots: ActivityWorldMapDot[] = [];

    const geomMap = geomByCourseRef.current;
    const boundsMap = boundsByCourseRef.current;

    let boundsReady = 0;
    let geometryReady = 0;
    let boundsLoading = 0;
    let geometryLoading = 0;
    let activityRows = 0;
    let liveCandidates = 0;
    let heatCandidates = 0;
    let anchorMissing = 0;

    for (const cid of overlayCandidateIds) {
      const row = activityByCourseId.get(cid);
      if (!row) continue;
      if (isCourseActivityLive(row)) liveCandidates += 1;
      else if (isCourseActivityHeat(row)) heatCandidates += 1;
      if (isCourseActivityLive(row) || isCourseActivityHeat(row)) activityRows += 1;

      const b = boundsMap.get(cid);
      if (b?.status === "ready") boundsReady += 1;
      else if (b?.status === "loading") boundsLoading += 1;
      const g = geomMap.get(cid);
      if (g?.status === "ready") geometryReady += 1;
      else if (g?.status === "loading") geometryLoading += 1;

      let lngLat: LngLat | null = row.liveAnchorLngLat;
      if (!lngLat && b?.status === "ready") lngLat = b.lngLat;
      const routeGeometry = g?.status === "ready" ? g.geometry : null;
      if (!lngLat && routeGeometry) {
        lngLat = resolveActivityWorldDotLngLat(row, routeGeometry);
      }
      if (isCourseActivityLive(row) || isCourseActivityHeat(row)) {
        if (!lngLat) anchorMissing += 1;
      }

      if (lngLat) {
        if (isCourseActivityLive(row)) {
          pulseDots.push({
            courseId: cid,
            lngLat,
            pulseLevel: row.pulseLevel > 0 ? row.pulseLevel : 1,
            kind: "pulse",
            traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
          });
        } else if (isCourseActivityHeat(row)) {
          const traceStrength = resolveHeatTraceStrength(row.updatedAtMs);
          heatDots.push({
            courseId: cid,
            lngLat,
            pulseLevel: heatVisualWeight(row.recentRideCount7d),
            kind: "heat",
            recentRideCount7d: row.recentRideCount7d,
            traceStrength,
          });
        }
      }

      if (g?.status === "ready") {
        const line = decimateLineStringVertices(g.geometry, maxLineStringVerticesForMapZoom(mapZoom));
        if (isCourseActivityLive(row)) {
          pulseRoutes.push({
            courseId: cid,
            geometry: line,
            kind: "pulse",
            traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
          });
        } else if (isCourseActivityHeat(row)) {
          heatRoutes.push({
            courseId: cid,
            geometry: line,
            kind: "heat",
            traceStrength: resolveHeatTraceStrength(row.updatedAtMs),
          });
        }
      }
    }

    return {
      overlay: { pulseRoutes, heatRoutes, pulseDots, heatDots } satisfies CourseActivityMapOverlay,
      overlayStats: {
        boundsReady,
        geometryReady,
        boundsLoading,
        geometryLoading,
        activityRows,
        liveCandidates,
        heatCandidates,
        anchorMissing,
      } satisfies PublishedCoursesActivityOverlayStats,
    };
  }, [activityByCourseId, overlayCandidateIds, mapZoom, overlayEpoch, worldMapRenderEnabled]);

  return { ...overlay, activityByCourseId, overlayStats };
}
