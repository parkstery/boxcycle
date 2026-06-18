import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityWorldMapDot, ActivityWorldMapRoute } from "../lib/activityWorldLod";
import {
  ACTIVITY_TRACE_LIVE_STRENGTH,
  resolveClosedPresenceOpacity,
} from "../lib/activityWorldTraceStyle";
import { BASIC_SHARED_HUB_IDS, fetchCourseRoutePayload, getBasicHubCoursePayload } from "../lib/firestoreCourses";
import {
  fetchPublicPublicationPresencesDetailed,
  PUBLICATION_PRESENCE_POLL_MS,
  type PublicationPresenceSnapshot,
} from "../lib/firestorePublicationPresence";
import type { LineStringGeometry } from "../lib/geo";
import { decimateLineStringVertices, maxLineStringVerticesForMapZoom } from "../lib/geoDecimate";

export type WorldPublicationPresenceOverlayStats = {
  activeCount: number;
  closedCount: number;
  anchorMissing: number;
  geometryReady: number;
  geometryLoading: number;
  fetchRowCount: number;
  lastFetchError: string | null;
};

const MAX_GEOMETRY_LOAD = 20;

type GeomEntry =
  | { status: "ready"; geometry: LineStringGeometry }
  | { status: "loading" }
  | { status: "missing" };

type UseWorldPublicationPresenceOverlayOpts = {
  enabled: boolean;
  mapZoom: number;
  /** 주행 중 추적 publication — geometry line 중복만 제거 (L2 dot 은 월드에 유지) */
  excludePublicationRoutesId?: string | null;
  refreshNonce?: number;
};

function presenceToDots(rows: readonly PublicationPresenceSnapshot[]): {
  pulseDots: ActivityWorldMapDot[];
  heatDots: ActivityWorldMapDot[];
  anchorMissing: number;
} {
  const pulseDots: ActivityWorldMapDot[] = [];
  const heatDots: ActivityWorldMapDot[] = [];
  let anchorMissing = 0;

  for (const row of rows) {
    const lngLat = row.representativePoint;
    if (!lngLat) {
      anchorMissing += 1;
      continue;
    }
    const publicationId = row.publicationId;
    const activeLive =
      row.status === "active" && (row.activeRiderCount > 0 || row.liveNow);
    if (activeLive) {
      const level = row.activeRiderCount > 0 ? row.activeRiderCount : 1;
      pulseDots.push({
        courseId: publicationId,
        lngLat,
        pulseLevel: Math.min(3, Math.max(1, level)),
        kind: "pulse",
        traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
      });
    } else if (row.status === "closed") {
      const traceStrength = resolveClosedPresenceOpacity(row.closedAtMs);
      if (traceStrength <= 0) continue;
      heatDots.push({
        courseId: publicationId,
        lngLat,
        pulseLevel: 1,
        kind: "heat",
        traceStrength,
      });
    }
  }

  return { pulseDots, heatDots, anchorMissing };
}

function ensureGeometryLoaded(
  publicationId: string,
  geomMap: Map<string, GeomEntry>,
  onReady: () => void,
): void {
  const existing = geomMap.get(publicationId);
  if (existing?.status === "ready" || existing?.status === "loading") return;

  geomMap.set(publicationId, { status: "loading" });
  const isBasic = (BASIC_SHARED_HUB_IDS as readonly string[]).includes(publicationId);
  void (async () => {
    try {
      const geometry: LineStringGeometry | null = isBasic
        ? getBasicHubCoursePayload(publicationId).geometry
        : (await fetchCourseRoutePayload(publicationId))?.geometry ?? null;
      if (!geometry?.coordinates?.length) {
        geomMap.set(publicationId, { status: "missing" });
      } else {
        geomMap.set(publicationId, { status: "ready", geometry });
      }
    } catch {
      geomMap.set(publicationId, { status: "missing" });
    }
    onReady();
  })();
}

/**
 * World Activity Presence (M1~M3) — `publicationPresence` 저빈도 폴링 + publication geometry line.
 */
export function useWorldPublicationPresenceOverlay(opts: UseWorldPublicationPresenceOverlayOpts): {
  pulseDots: ActivityWorldMapDot[];
  heatDots: ActivityWorldMapDot[];
  pulseRoutes: ActivityWorldMapRoute[];
  heatRoutes: ActivityWorldMapRoute[];
  presenceByPublicationId: ReadonlyMap<string, PublicationPresenceSnapshot>;
  overlayStats: WorldPublicationPresenceOverlayStats;
} {
  const { enabled, mapZoom, excludePublicationRoutesId = null, refreshNonce = 0 } = opts;
  const [rows, setRows] = useState<PublicationPresenceSnapshot[]>([]);
  const [lastFetchError, setLastFetchError] = useState<string | null>(null);
  const [overlayEpoch, setOverlayEpoch] = useState(0);
  const geomByPublicationRef = useRef<Map<string, GeomEntry>>(new Map());
  const bumpOverlay = useRef(() => setOverlayEpoch((n) => n + 1));

  useEffect(() => {
    bumpOverlay.current = () => setOverlayEpoch((n) => n + 1);
  });

  useEffect(() => {
    if (!enabled) {
      startTransition(() => {
        setRows([]);
        setLastFetchError(null);
      });
      geomByPublicationRef.current.clear();
      setOverlayEpoch((n) => n + 1);
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const { rows: list, activeQueryError, closedQueryError } =
          await fetchPublicPublicationPresencesDetailed();
        if (cancelled) return;
        const err = activeQueryError ?? closedQueryError;
        startTransition(() => {
          setRows(list);
          setLastFetchError(err);
        });
        if (import.meta.env.DEV && err) {
          console.warn("[PublicationPresence] fetch partial failure", {
            activeQueryError,
            closedQueryError,
            rowCount: list.length,
          });
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.warn("[PublicationPresence] fetch failed", e);
        }
        startTransition(() => {
          setRows([]);
          setLastFetchError(msg);
        });
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), PUBLICATION_PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || refreshNonce === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const { rows: list, activeQueryError, closedQueryError } =
          await fetchPublicPublicationPresencesDetailed();
        if (!cancelled) {
          startTransition(() => {
            setRows(list);
            setLastFetchError(activeQueryError ?? closedQueryError);
          });
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn("[PublicationPresence] refresh fetch failed", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce, enabled]);

  const geometryCandidateIds = useMemo(() => {
    const exclude = excludePublicationRoutesId?.trim() ?? "";
    const ids: string[] = [];
    for (const row of rows) {
      if (exclude && row.publicationId === exclude) continue;
      if (row.status === "active" && (row.activeRiderCount > 0 || row.liveNow)) {
        ids.push(row.publicationId);
      } else if (row.status === "closed") {
        ids.push(row.publicationId);
      }
    }
    return [...new Set(ids)].slice(0, MAX_GEOMETRY_LOAD);
  }, [rows, excludePublicationRoutesId]);

  useEffect(() => {
    if (!enabled || geometryCandidateIds.length === 0) {
      geomByPublicationRef.current.clear();
      setOverlayEpoch((n) => n + 1);
      return;
    }

    const keep = new Set(geometryCandidateIds);
    const geomMap = geomByPublicationRef.current;
    for (const key of [...geomMap.keys()]) {
      if (!keep.has(key)) geomMap.delete(key);
    }

    let kicked = false;
    const bump = () => bumpOverlay.current();
    for (const pid of geometryCandidateIds) {
      ensureGeometryLoaded(pid, geomMap, bump);
      kicked = true;
    }
    if (kicked) bump();
  }, [enabled, geometryCandidateIds.join(",")]);

  const presenceByPublicationId = useMemo(() => {
    const m = new Map<string, PublicationPresenceSnapshot>();
    for (const r of rows) m.set(r.publicationId, r);
    return m;
  }, [rows]);

  const { pulseDots, heatDots, pulseRoutes, heatRoutes, anchorMissing, geometryReady, geometryLoading } =
    useMemo(() => {
      const { pulseDots: pd, heatDots: hd, anchorMissing: am } = presenceToDots(rows);

      const pulseRoutes: ActivityWorldMapRoute[] = [];
      const heatRoutes: ActivityWorldMapRoute[] = [];
      const geomMap = geomByPublicationRef.current;
      let geometryReady = 0;
      let geometryLoading = 0;

      for (const pid of geometryCandidateIds) {
        const row = presenceByPublicationId.get(pid);
        if (!row) continue;
        const g = geomMap.get(pid);
        if (g?.status === "ready") geometryReady += 1;
        else if (g?.status === "loading") geometryLoading += 1;
        if (g?.status !== "ready") continue;

        const line = decimateLineStringVertices(g.geometry, maxLineStringVerticesForMapZoom(mapZoom));
        if (row.status === "active" && (row.activeRiderCount > 0 || row.liveNow)) {
          pulseRoutes.push({
            courseId: pid,
            geometry: line,
            kind: "pulse",
            traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
          });
        } else if (row.status === "closed") {
          const traceStrength = resolveClosedPresenceOpacity(row.closedAtMs);
          if (traceStrength <= 0) continue;
          heatRoutes.push({
            courseId: pid,
            geometry: line,
            kind: "heat",
            traceStrength,
          });
        }
      }

      return {
        pulseDots: pd,
        heatDots: hd,
        pulseRoutes,
        heatRoutes,
        anchorMissing: am,
        geometryReady,
        geometryLoading,
      };
    }, [
      rows,
      geometryCandidateIds,
      presenceByPublicationId,
      mapZoom,
      overlayEpoch,
    ]);

  const overlayStats = useMemo(
    (): WorldPublicationPresenceOverlayStats => ({
      activeCount: rows.filter(
        (r) => r.status === "active" && (r.activeRiderCount > 0 || r.liveNow),
      ).length,
      closedCount: rows.filter((r) => r.status === "closed").length,
      anchorMissing,
      geometryReady,
      geometryLoading,
      fetchRowCount: rows.length,
      lastFetchError,
    }),
    [rows, anchorMissing, geometryReady, geometryLoading, lastFetchError],
  );

  return { pulseDots, heatDots, pulseRoutes, heatRoutes, presenceByPublicationId, overlayStats };
}
