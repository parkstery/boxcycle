/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/purity */
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  BASIC_SHARED_HUB_IDS,
  fetchCourseRoutePayload,
  getBasicHubCoursePayload,
} from "../lib/firestoreCourses";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { decimateLineStringVertices, maxLineStringVerticesForMapZoom } from "../lib/geoDecimate";
import { acquireTrailLivePublicationRidesSubscription } from "../lib/livePublicationRidesSubscriptionHub";
import { sanitizeTrailId } from "../lib/firestoreTrail";
import {
  isTrailLivePublicationRideRowFresh,
  type TrailLivePublicationRideRow,
} from "../lib/firestoreTrailLivePublicationRides";
import { PEER_EXTRAP_DEFAULT_SPEED_KMH } from "../lib/rideSyncPolicy";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "../lib/geo";
import { progressRatioToRouteDistanceMeters } from "../lib/liveLocationSnapshot";

export type TrailSpectatorDot = { id: string; lngLat: LngLat; label: string };

type UseTrailLivePublicationRideSpectatorOverlayOpts = {
  user: User | null | undefined;
  trailId: string;
  trailLabel: string;
  enabled: boolean;
  mapZoom: number;
  excludePeerIds: ReadonlySet<string>;
};

type PublicationGeomState =
  | { status: "ready"; geometry: LineStringGeometry }
  | { status: "loading" }
  | { status: "missing" };

/**
 * 같은 Trail `livePublicationRides` → 동행 라이더 dot + 노선(line).
 * world 전역 dot 은 `livePresence` (MapView global layer).
 */
export function useTrailLivePublicationRideSpectatorOverlay(opts: UseTrailLivePublicationRideSpectatorOverlayOpts): {
  spectatorDots: TrailSpectatorDot[];
  spectatorRouteGeometries: LineStringGeometry[];
  livePublicationIds: string[];
  error: string | null;
} {
  const { user, trailId, trailLabel, enabled, mapZoom, excludePeerIds } = opts;
  const [rows, setRows] = useState<TrailLivePublicationRideRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [geomEpoch, setGeomEpoch] = useState(0);
  const geomByPublicationRef = useRef<Map<string, PublicationGeomState>>(new Map());

  const myUid = user?.uid ?? null;

  useEffect(() => {
    if (!enabled || !user) {
      startTransition(() => {
        setRows([]);
        setError(null);
      });
      return;
    }

    const tid = sanitizeTrailId(trailId);
    let cancelled = false;
    startTransition(() => setError(null));

    const release = acquireTrailLivePublicationRidesSubscription(
      tid,
      (next) => {
        if (!cancelled) startTransition(() => setRows(next));
      },
      (err) => {
        if (!cancelled) setError(err.message);
      },
    );

    return () => {
      cancelled = true;
      release();
    };
  }, [enabled, trailId, user]);

  const activeRows = useMemo(() => {
    if (!myUid) return [];
    return rows.filter(
      (r) => r.uid !== myUid && isTrailLivePublicationRideRowFresh(r) && !excludePeerIds.has(r.uid),
    );
  }, [rows, myUid, excludePeerIds]);

  const activeRowsKey = useMemo(
    () =>
      activeRows
        .map((r) => `${r.uid}\0${r.publicationId}\0${r.progressRatio.toFixed(5)}`)
        .sort()
        .join("|"),
    [activeRows],
  );

  useEffect(() => {
    if (!enabled) {
      geomByPublicationRef.current.clear();
      setGeomEpoch((n) => n + 1);
      return;
    }
    if (activeRows.length === 0) return;

    const publicationIds = [...new Set(activeRows.map((r) => r.publicationId))];
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
  }, [enabled, activeRowsKey]);

  const spectatorDots = useMemo((): TrailSpectatorDot[] => {
    const map = geomByPublicationRef.current;
    const out: TrailSpectatorDot[] = [];
    for (const r of activeRows) {
      const g = map.get(r.publicationId);
      if (!g || g.status !== "ready") continue;
      const len = lineStringLengthMeters(g.geometry);
      if (len <= 0) continue;
      const anchorDistM =
        typeof r.distMeters === "number" && Number.isFinite(r.distMeters)
          ? Math.max(0, Math.min(len, r.distMeters))
          : progressRatioToRouteDistanceMeters(r.progressRatio, len);
      const elapsedSec = Math.max(0, (Date.now() - r.receivedAtLocalMs) / 1000);
      const distM = Math.min(
        len,
        anchorDistM + (PEER_EXTRAP_DEFAULT_SPEED_KMH / 3.6) * elapsedSec,
      );
      const p = getPointOnRouteByDistance(g.geometry, distM);
      if (p) {
        const who = r.displayName?.trim() || r.uid.slice(0, 6);
        out.push({
          id: r.uid,
          lngLat: p,
          label: `${trailLabel} · ${who}`,
        });
      }
    }
    return out;
  }, [activeRows, geomEpoch, trailLabel]);

  const livePublicationIds = useMemo(
    () => [...new Set(activeRows.map((r) => r.publicationId.trim()).filter(Boolean))],
    [activeRowsKey],
  );

  const spectatorRouteGeometries = useMemo((): LineStringGeometry[] => {
    const map = geomByPublicationRef.current;
    const maxV = maxLineStringVerticesForMapZoom(mapZoom);
    const seen = new Set<string>();
    const out: LineStringGeometry[] = [];
    for (const r of activeRows) {
      if (seen.has(r.publicationId)) continue;
      seen.add(r.publicationId);
      const g = map.get(r.publicationId);
      if (!g || g.status !== "ready") continue;
      out.push(decimateLineStringVertices(g.geometry, maxV));
    }
    return out;
  }, [activeRows, mapZoom, geomEpoch]);

  return { spectatorDots, spectatorRouteGeometries, livePublicationIds, error };
}
