/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/purity */
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityWorldMapRoute } from "../../lib/activityWorldLod";
import { ACTIVITY_TRACE_LIVE_STRENGTH } from "../../lib/activityWorldTraceStyle";
import {
  BASIC_SHARED_HUB_IDS,
  fetchCourseRoutePayload,
  getBasicHubCoursePayload,
} from "../../lib/firestoreCourses";
import {
  isTrailLivePublicationRideRowFresh,
  type TrailLivePublicationRideRow,
} from "../../lib/firestoreTrailLivePublicationRides";
import { acquireTrailLivePublicationRidesSubscription } from "../../lib/livePublicationRidesSubscriptionHub";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../../lib/firestoreTrail";
import type { LineStringGeometry, LngLat } from "../../lib/geo";
import { spectatorPointOnRoute } from "../../lib/spectatorRideExtrap";
import type { TrailSpectatorDot } from "../../hooks/useTrailLivePublicationRideSpectatorOverlay";
import { decimateLineStringVertices, maxLineStringVerticesForMapZoom } from "../../lib/geoDecimate";
import type { RouteActivityMapOverlay } from "../../hooks/useRouteActivityMapOverlay";

type PublicationGeomState =
  | { status: "ready"; geometry: LineStringGeometry }
  | { status: "loading" }
  | { status: "missing" };

type LivePublicationAggregate = {
  publicationId: string;
  progressRatio: number;
  riderCount: number;
};

function aggregateLivePublications(rows: readonly TrailLivePublicationRideRow[]): LivePublicationAggregate[] {
  const byPublication = new Map<string, { progressRatio: number; riderCount: number }>();
  for (const row of rows) {
    const publicationId = row.publicationId.trim();
    if (!publicationId) continue;
    const cur = byPublication.get(publicationId) ?? { progressRatio: 0, riderCount: 0 };
    cur.progressRatio = Math.max(cur.progressRatio, row.progressRatio);
    cur.riderCount += 1;
    byPublication.set(publicationId, cur);
  }
  return [...byPublication.entries()].map(([publicationId, v]) => ({
    publicationId,
    progressRatio: v.progressRatio,
    riderCount: v.riderCount,
  }));
}

function mergeLiveRows(maps: Map<string, TrailLivePublicationRideRow>[]): TrailLivePublicationRideRow[] {
  const merged = new Map<string, TrailLivePublicationRideRow>();
  for (const m of maps) {
    for (const [uid, row] of m) {
      const prev = merged.get(uid);
      if (!prev || (row.receivedAtLocalMs ?? 0) >= (prev.receivedAtLocalMs ?? 0)) {
        merged.set(uid, row);
      }
    }
  }
  return [...merged.values()];
}

const EMPTY_LIVE_OVERLAY: RouteActivityMapOverlay = {
  pulseRoutes: [],
  heatRoutes: [],
  pulseDots: [],
  heatDots: [],
};

/**
 * `livePublicationRides` → Activity World **pulse line only** (per-user dot 은 global livePresence).
 * catalog·publication 에 라인이 없을 때 route geometry gap-fill.
 */
export function useWorldLivePublicationRideMapOverlay(opts: {
  enabled: boolean;
  mapZoom: number;
  myUid: string | null;
  excludePublicationId: string | null;
  /** 현재 Trail + openTrailListings */
  trailIds: readonly string[];
}): RouteActivityMapOverlay & {
  livePublicationCount: number;
  liveRideRowCount: number;
  lobbySpectatorDots: TrailSpectatorDot[];
  lobbySpectatorRoutes: LineStringGeometry[];
} {
  const { enabled, mapZoom, myUid, excludePublicationId, trailIds } = opts;
  const [rows, setRows] = useState<TrailLivePublicationRideRow[]>([]);
  const [geomEpoch, setGeomEpoch] = useState(0);
  const [spectatorTickMs, setSpectatorTickMs] = useState(() => Date.now());
  const geomByPublicationRef = useRef<Map<string, PublicationGeomState>>(new Map());

  const trailIdsKey = useMemo(() => {
    const ids = new Set<string>();
    for (const raw of trailIds) {
      const tid = sanitizeTrailId(raw);
      if (tid && tid !== DEFAULT_TRAIL_ID) ids.add(tid);
    }
    return [...ids].sort().join(",");
  }, [trailIds]);

  useEffect(() => {
    if (!enabled || !trailIdsKey) {
      startTransition(() => setRows([]));
      geomByPublicationRef.current.clear();
      setGeomEpoch((n) => n + 1);
      return;
    }

    const trailIdList = trailIdsKey.split(",").filter(Boolean);
    const rowMaps = trailIdList.map(() => new Map<string, TrailLivePublicationRideRow>());
    const emit = () => {
      startTransition(() => setRows(mergeLiveRows(rowMaps)));
    };

    const releases = trailIdList.map((tid, index) =>
      acquireTrailLivePublicationRidesSubscription(
        tid,
        (next) => {
          const map = rowMaps[index]!;
          map.clear();
          for (const row of next) {
            if (!isTrailLivePublicationRideRowFresh(row)) continue;
            map.set(row.uid, row);
          }
          emit();
        },
        (err) => {
          if (import.meta.env.DEV) {
            console.warn("[WorldLivePublicationRide] subscribe failed", tid, err.message);
          }
        },
      ),
    );

    return () => {
      for (const release of releases) release();
    };
  }, [enabled, trailIdsKey]);

  const aggregates = useMemo(() => {
    const exclude = excludePublicationId?.trim() ?? "";
    const filtered = rows.filter((r) => {
      if (exclude && r.publicationId.trim() === exclude) return false;
      if (myUid && r.uid === myUid) return false;
      return true;
    });
    return aggregateLivePublications(filtered);
  }, [rows, excludePublicationId, myUid]);

  useEffect(() => {
    if (!enabled) return;
    if (aggregates.length === 0) {
      geomByPublicationRef.current.clear();
      setGeomEpoch((n) => n + 1);
      return;
    }

    const publicationIds = aggregates.map((a) => a.publicationId);
    const map = geomByPublicationRef.current;
    let scheduled = false;

    for (const pid of publicationIds) {
      if (map.has(pid)) continue;
      map.set(pid, { status: "loading" });
      scheduled = true;

      const isBasicHub = (BASIC_SHARED_HUB_IDS as readonly string[]).includes(pid);
      void (async () => {
        try {
          const geometry: LineStringGeometry | null = isBasicHub
            ? getBasicHubCoursePayload(pid).geometry
            : (await fetchCourseRoutePayload(pid))?.geometry ?? null;
          const cur = geomByPublicationRef.current;
          if (!geometry?.coordinates?.length) {
            cur.set(pid, { status: "missing" });
            if (import.meta.env.DEV) {
              console.warn("[WorldLivePublicationRide] geometry missing", pid);
            }
          } else {
            cur.set(pid, { status: "ready", geometry });
          }
        } catch {
          geomByPublicationRef.current.set(pid, { status: "missing" });
        }
        setGeomEpoch((n) => n + 1);
      })();
    }

    const keep = new Set(publicationIds);
    for (const key of [...map.keys()]) {
      if (!keep.has(key)) map.delete(key);
    }

    if (scheduled) setGeomEpoch((n) => n + 1);
  }, [enabled, aggregates]);

  const lobbyActiveRowsKey = useMemo(() => {
    const exclude = excludePublicationId?.trim() ?? "";
    return rows
      .filter((r) => {
        if (!isTrailLivePublicationRideRowFresh(r)) return false;
        if (exclude && r.publicationId.trim() === exclude) return false;
        if (myUid && r.uid === myUid) return false;
        return true;
      })
      .map((r) => r.uid)
      .sort()
      .join("|");
  }, [rows, excludePublicationId, myUid]);

  useEffect(() => {
    if (!enabled || lobbyActiveRowsKey.length === 0) return;
    const id = window.setInterval(() => setSpectatorTickMs(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [enabled, lobbyActiveRowsKey]);

  const overlay = useMemo((): RouteActivityMapOverlay => {
    if (aggregates.length === 0) return EMPTY_LIVE_OVERLAY;

    const pulseRoutes: ActivityWorldMapRoute[] = [];
    const geomMap = geomByPublicationRef.current;

    for (const agg of aggregates) {
      const g = geomMap.get(agg.publicationId);
      if (!g || g.status !== "ready") continue;

      pulseRoutes.push({
        publicationId: agg.publicationId,
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

  const lobbySpectator = useMemo(() => {
    const exclude = excludePublicationId?.trim() ?? "";
    const activeRows = rows.filter((r) => {
      if (!isTrailLivePublicationRideRowFresh(r)) return false;
      if (exclude && r.publicationId.trim() === exclude) return false;
      if (myUid && r.uid === myUid) return false;
      return true;
    });
    if (activeRows.length === 0) {
      return { lobbySpectatorDots: [] as TrailSpectatorDot[], lobbySpectatorRoutes: [] as LineStringGeometry[] };
    }

    const geomMap = geomByPublicationRef.current;
    const maxV = maxLineStringVerticesForMapZoom(mapZoom);
    const seenPublications = new Set<string>();
    const lobbySpectatorRoutes: LineStringGeometry[] = [];
    const lobbySpectatorDots: TrailSpectatorDot[] = [];

    for (const r of activeRows) {
      const g = geomMap.get(r.publicationId);
      if (!g || g.status !== "ready") continue;
      if (!seenPublications.has(r.publicationId)) {
        seenPublications.add(r.publicationId);
        lobbySpectatorRoutes.push(decimateLineStringVertices(g.geometry, maxV));
      }
      const p = spectatorPointOnRoute(r, g.geometry, spectatorTickMs, { logPt10: true });
      if (p) {
        const who = r.displayName?.trim() || r.uid.slice(0, 6);
        lobbySpectatorDots.push({
          id: r.uid,
          lngLat: p as LngLat,
          label: who,
        });
      }
    }

    return { lobbySpectatorDots, lobbySpectatorRoutes };
  }, [rows, excludePublicationId, myUid, mapZoom, geomEpoch, spectatorTickMs]);

  return {
    ...overlay,
    livePublicationCount: aggregates.length,
    liveRideRowCount: rows.length,
    lobbySpectatorDots: lobbySpectator.lobbySpectatorDots,
    lobbySpectatorRoutes: lobbySpectator.lobbySpectatorRoutes,
  };
}
