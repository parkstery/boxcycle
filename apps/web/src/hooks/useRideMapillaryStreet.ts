import type { User } from "firebase/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import {
  densifyLineStringByIntervalM,
  distanceMetersToVertexIndexAtOrBefore,
  driveHeadingAtDistanceMeters,
  buildVertexCumulativeMeters,
  getDistanceMeters,
  pathPointAheadAlongLineString,
} from "../lib/geo";
import { mapillaryTokenConfigured } from "../lib/mapillaryToken";
import {
  MAPILLARY_QUERY_PATH_INTERVAL_M,
  MAPILLARY_STREET_LOOKAHEAD_SAMPLES_M,
  chooseMapillaryPickAlongPath,
  queryMapillaryAlongPathSamples,
  type MapillaryStreetPick,
} from "../services/mapillaryStreetView";

export type RideMapillaryStreetState = {
  imageKey: string;
  shownAtMs: number;
  isPano: boolean;
};

export type MapillaryRideSync = {
  lookAt: LngLat;
  driveHeadingDeg: number | null;
};

const FETCH_MIN_MOVE_M = 30;
const FETCH_THROTTLE_MS = 1200;
const NO_HIT_GRACE_MS = 9000;
const MIN_HOLD_MS = 1350;
const ANCHOR_JUMP_RESET_M = 130;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function useRideMapillaryStreet(options: {
  user: User | null;
  accessToken: string | null;
  routeGeometry: LineStringGeometry | null;
  routeTotalMeters: number;
  virtualDistanceMeters: number;
  sessionStatus: "idle" | "running" | "paused";
  speedKmh: number;
  riderLngLat: LngLat | null;
  /** false 면 조회·표시를 하지 않는다(기본 꺼짐 — 사용자가 맵 뷰 시트에서 켠다) */
  enabled: boolean;
}): {
  streetState: RideMapillaryStreetState | null;
  rideSync: MapillaryRideSync | null;
  dismissStreet: () => void;
} {
  const { user, accessToken, routeGeometry, routeTotalMeters, virtualDistanceMeters, sessionStatus, speedKmh, riderLngLat, enabled } =
    options;

  const [streetState, setStreetState] = useState<RideMapillaryStreetState | null>(null);

  const virtualDistanceRef = useRef(virtualDistanceMeters);
  const speedRef = useRef(speedKmh);
  const sessionRef = useRef(sessionStatus);
  const riderLngLatRef = useRef(riderLngLat);
  virtualDistanceRef.current = virtualDistanceMeters;
  speedRef.current = speedKmh;
  sessionRef.current = sessionStatus;
  riderLngLatRef.current = riderLngLat;

  const densePack = useMemo(() => {
    if (!routeGeometry || routeGeometry.coordinates.length < 2) return null;
    const dense = densifyLineStringByIntervalM(routeGeometry, MAPILLARY_QUERY_PATH_INTERVAL_M);
    const cumDense = buildVertexCumulativeMeters(dense);
    const totalDense = cumDense.length ? cumDense[cumDense.length - 1] : 0;
    return { dense, cumDense, totalDense };
  }, [routeGeometry]);

  const rideSync = useMemo((): MapillaryRideSync | null => {
    if (!densePack || routeTotalMeters <= 0 || !routeGeometry) return null;
    const d = Math.min(virtualDistanceMeters, routeTotalMeters);
    const lookAt =
      pathPointAheadAlongLineString(densePack.dense, d, 52) ?? pathPointAheadAlongLineString(routeGeometry, d, 52);
    if (!lookAt) return null;
    const denseIdx = distanceMetersToVertexIndexAtOrBefore(densePack.cumDense, d);
    const atVertex = densePack.cumDense[denseIdx] ?? d;
    const driveHeadingDeg = driveHeadingAtDistanceMeters(densePack.dense, atVertex, 14);
    return { lookAt, driveHeadingDeg };
  }, [densePack, routeGeometry, routeTotalMeters, virtualDistanceMeters]);

  const lastAnchorLngLatRef = useRef<LngLat | null>(null);
  const lastFetchMsRef = useRef(0);
  const fetchGenRef = useRef(0);
  const lastPickRef = useRef<MapillaryStreetPick | null>(null);
  const dismissedKeyRef = useRef<string | null>(null);
  const routeSigRef = useRef<string>("");
  const fetchInFlightRef = useRef(false);

  const resetRefs = () => {
    lastAnchorLngLatRef.current = null;
    lastFetchMsRef.current = 0;
    fetchGenRef.current += 1;
    lastPickRef.current = null;
    dismissedKeyRef.current = null;
  };

  useEffect(() => {
    const sig = routeGeometry
      ? `${routeGeometry.coordinates.length}:${routeGeometry.coordinates[0]?.join(",")}`
      : "";
    if (sig !== routeSigRef.current) {
      routeSigRef.current = sig;
      resetRefs();
      setStreetState(null);
    }
  }, [routeGeometry]);

  useEffect(() => {
    // 꺼져 있으면 조회 자체를 하지 않는다 — 기능은 유지하되 기본은 off.
    if (!enabled || !mapillaryTokenConfigured || !accessToken || !user) {
      resetRefs();
      setStreetState(null);
      return;
    }
    if (!routeGeometry || routeGeometry.coordinates.length < 2 || !densePack) {
      resetRefs();
      setStreetState(null);
      return;
    }

    if (sessionStatus === "idle") {
      resetRefs();
      setStreetState(null);
      return;
    }
    if (sessionStatus === "paused") {
      return;
    }

    const intervalMs = clamp(Math.floor(FETCH_THROTTLE_MS / 2), 400, 800);
    const ac = new AbortController();

    const tryFetch = async () => {
      if (sessionRef.current !== "running") return;
      if (ac.signal.aborted) return;
      if (fetchInFlightRef.current) return;

      const vd = Math.min(virtualDistanceRef.current, routeTotalMeters);
      const rider = riderLngLatRef.current;
      if (!rider) return;

      const now = performance.now();
      const anchor = lastAnchorLngLatRef.current;
      const moved = anchor ? getDistanceMeters(anchor, rider) : FETCH_MIN_MOVE_M;
      const timeOk = now - lastFetchMsRef.current >= FETCH_THROTTLE_MS;
      if (moved < FETCH_MIN_MOVE_M && !timeOk) return;

      if (anchor && moved >= ANCHOR_JUMP_RESET_M) {
        dismissedKeyRef.current = null;
        lastPickRef.current = null;
      }

      lastAnchorLngLatRef.current = rider;
      lastFetchMsRef.current = now;
      const gen = ++fetchGenRef.current;

      const dQuery = Math.min(vd, densePack.totalDense || routeTotalMeters);
      const driveHeading = driveHeadingAtDistanceMeters(densePack.dense, dQuery, 14);

      const samplePoints = MAPILLARY_STREET_LOOKAHEAD_SAMPLES_M.map((sampleM) => {
        const lngLat =
          pathPointAheadAlongLineString(densePack.dense, dQuery, sampleM) ??
          pathPointAheadAlongLineString(routeGeometry, vd, sampleM);
        return { sampleM, lngLat: lngLat! };
      }).filter((x) => x.lngLat != null);

      if (!samplePoints.length) return;

      fetchInFlightRef.current = true;
      let rows;
      try {
        rows = await queryMapillaryAlongPathSamples({ accessToken, user }, samplePoints, {
          signal: ac.signal,
          speedKmH: speedRef.current,
          driveHeadingDeg: driveHeading,
        });
      } catch {
        return;
      } finally {
        fetchInFlightRef.current = false;
      }
      if (ac.signal.aborted || gen !== fetchGenRef.current) return;

      const chosen = chooseMapillaryPickAlongPath({
        rows,
        dismissedId: dismissedKeyRef.current,
        prevPick: lastPickRef.current,
        riderLngLat: rider,
      });

      const nowMs = Date.now();

      if (!chosen) {
        setStreetState((prev) => {
          if (!prev) return null;
          if (nowMs - prev.shownAtMs >= NO_HIT_GRACE_MS) return null;
          return prev;
        });
        return;
      }

      setStreetState((prev) => {
        if (prev && prev.imageKey === chosen.id) {
          lastPickRef.current = chosen;
          return prev;
        }
        if (prev && nowMs - prev.shownAtMs < MIN_HOLD_MS) {
          return prev;
        }
        lastPickRef.current = chosen;
        return { imageKey: chosen.id, shownAtMs: nowMs, isPano: chosen.isPano };
      });
    };

    const id = window.setInterval(() => {
      void tryFetch();
    }, intervalMs);
    void tryFetch();

    return () => {
      window.clearInterval(id);
      ac.abort();
    };
  }, [enabled, user, accessToken, routeGeometry, densePack, routeTotalMeters, sessionStatus]);

  const dismissStreet = useMemo(
    () => () => {
      setStreetState((prev) => {
        if (prev) dismissedKeyRef.current = prev.imageKey;
        return null;
      });
    },
    [],
  );

  return { streetState, rideSync, dismissStreet };
}
