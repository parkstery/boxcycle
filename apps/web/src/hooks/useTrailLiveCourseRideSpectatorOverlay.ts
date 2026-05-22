import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  BASIC_SHARED_HUB_IDS,
  fetchCourseRoutePayload,
  getBasicHubCoursePayload,
} from "../lib/firestoreCourses";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "../lib/geo";
import { decimateLineStringVertices, maxLineStringVerticesForMapZoom } from "../lib/geoDecimate";
import { sanitizeTrailId } from "../lib/firestoreTrail";
import {
  isTrailLiveCourseRideRowFresh,
  subscribeTrailLiveCourseRides,
  type TrailLiveCourseRideRow,
} from "../lib/firestoreTrailLiveCourseRides";

export type TrailSpectatorDot = { id: string; lngLat: LngLat; /** 주행자 네임태그 — Trail 번호 포함 */ label: string };

/** @deprecated `TrailSpectatorDot` */
export type LobbySpectatorDot = TrailSpectatorDot;

type UseTrailLiveCourseRideSpectatorOverlayOpts = {
  user: User | null | undefined;
  trailId: string;
  /** 같은 Trail 방 이름 — `Trail 042` / `Trailhead` */
  trailRoomLabel: string;
  enabled: boolean;
  mapZoom: number;
  excludePeerIds: ReadonlySet<string>;
};

type CourseGeomState =
  | { status: "ready"; geometry: LineStringGeometry }
  | { status: "loading" }
  | { status: "missing" };

export function useTrailLiveCourseRideSpectatorOverlay(opts: UseTrailLiveCourseRideSpectatorOverlayOpts): {
  spectatorDots: TrailSpectatorDot[];
  spectatorRouteGeometries: LineStringGeometry[];
  error: string | null;
} {
  const { user, trailId, trailRoomLabel, enabled, mapZoom, excludePeerIds } = opts;
  const [rows, setRows] = useState<TrailLiveCourseRideRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [geomEpoch, setGeomEpoch] = useState(0);
  const geomByCourseRef = useRef<Map<string, CourseGeomState>>(new Map());

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

    const unsub = subscribeTrailLiveCourseRides(
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
      unsub();
    };
  }, [enabled, trailId, user]);

  const activeRows = useMemo(() => {
    if (!myUid) return [];
    return rows.filter(
      (r) => r.uid !== myUid && isTrailLiveCourseRideRowFresh(r) && !excludePeerIds.has(r.uid),
    );
  }, [rows, myUid, excludePeerIds]);

  useEffect(() => {
    if (!enabled) {
      geomByCourseRef.current.clear();
      setGeomEpoch((n) => n + 1);
      return;
    }
    if (activeRows.length === 0) return;

    const courseIds = [...new Set(activeRows.map((r) => r.courseId))];
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
  }, [enabled, activeRows]);

  const spectatorDots = useMemo((): TrailSpectatorDot[] => {
    const map = geomByCourseRef.current;
    const out: TrailSpectatorDot[] = [];
    for (const r of activeRows) {
      const g = map.get(r.courseId);
      if (!g || g.status !== "ready") continue;
      const len = lineStringLengthMeters(g.geometry);
      if (len <= 0) continue;
      const p = getPointOnRouteByDistance(g.geometry, r.progressRatio * len);
      if (p) {
        const who = r.displayName?.trim() || r.uid.slice(0, 6);
        out.push({
          id: r.uid,
          lngLat: p,
          label: `${trailRoomLabel} · ${who}`,
        });
      }
    }
    return out;
  }, [activeRows, geomEpoch, trailRoomLabel]);

  const spectatorRouteGeometries = useMemo((): LineStringGeometry[] => {
    const map = geomByCourseRef.current;
    const maxV = maxLineStringVerticesForMapZoom(mapZoom);
    const seen = new Set<string>();
    const out: LineStringGeometry[] = [];
    for (const r of activeRows) {
      if (seen.has(r.courseId)) continue;
      seen.add(r.courseId);
      const g = map.get(r.courseId);
      if (!g || g.status !== "ready") continue;
      out.push(decimateLineStringVertices(g.geometry, maxV));
    }
    return out;
  }, [activeRows, mapZoom, geomEpoch]);

  return { spectatorDots, spectatorRouteGeometries, error };
}

/** @deprecated `useTrailLiveCourseRideSpectatorOverlay` */
export const useLobbyLiveCourseRideSpectatorOverlay = useTrailLiveCourseRideSpectatorOverlay;
