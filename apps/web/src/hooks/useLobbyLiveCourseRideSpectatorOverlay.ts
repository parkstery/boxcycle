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
import { sanitizeRoomId } from "../lib/firestoreLobby";
import {
  isLobbyLiveCourseRideRowFresh,
  subscribeLobbyLiveCourseRides,
  type LobbyLiveCourseRideRow,
} from "../lib/firestoreLobbyLiveCourseRides";

export type LobbySpectatorDot = { id: string; lngLat: LngLat };

type UseLobbyLiveCourseRideSpectatorOverlayOpts = {
  user: User | null | undefined;
  roomId: string;
  /** 로비 참가 + 관전 모드(주행 idle) */
  enabled: boolean;
  mapZoom: number;
  /** 동행 스프라이트로 이미 표시 중인 uid — 중복 제거 */
  excludePeerIds: ReadonlySet<string>;
};

type CourseGeomState =
  | { status: "ready"; geometry: LineStringGeometry }
  | { status: "loading" }
  | { status: "missing" };

export function useLobbyLiveCourseRideSpectatorOverlay(opts: UseLobbyLiveCourseRideSpectatorOverlayOpts): {
  spectatorDots: LobbySpectatorDot[];
  spectatorRouteGeometries: LineStringGeometry[];
  error: string | null;
} {
  const { user, roomId, enabled, mapZoom, excludePeerIds } = opts;
  const [rows, setRows] = useState<LobbyLiveCourseRideRow[]>([]);
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

    const rid = sanitizeRoomId(roomId);
    let cancelled = false;
    startTransition(() => setError(null));

    const unsub = subscribeLobbyLiveCourseRides(
      rid,
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
  }, [enabled, roomId, user]);

  const activeRows = useMemo(() => {
    if (!myUid) return [];
    return rows.filter(
      (r) => r.uid !== myUid && isLobbyLiveCourseRideRowFresh(r) && !excludePeerIds.has(r.uid),
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

  const spectatorDots = useMemo((): LobbySpectatorDot[] => {
    const map = geomByCourseRef.current;
    const out: LobbySpectatorDot[] = [];
    for (const r of activeRows) {
      const g = map.get(r.courseId);
      if (!g || g.status !== "ready") continue;
      const len = lineStringLengthMeters(g.geometry);
      if (len <= 0) continue;
      const p = getPointOnRouteByDistance(g.geometry, r.progressRatio * len);
      if (p) out.push({ id: r.uid, lngLat: p });
    }
    return out;
  }, [activeRows, geomEpoch]);

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
