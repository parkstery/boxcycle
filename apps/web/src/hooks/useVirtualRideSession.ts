import { useCallback, useEffect, useRef, useState } from "react";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { getPointOnRouteByDistance } from "../lib/geo";

export type RideSessionStatus = "idle" | "running" | "paused";

type UseVirtualRideSessionOptions = {
  speedKmh: number;
  routeGeometry: LineStringGeometry | null;
  routeDistanceMeters: number;
};

export type RideMetricsUi = {
  virtualDistanceMeters: number;
  accumulatedMs: number;
  liveLngLat: LngLat | null;
};

const METRICS_UI_MS = 200;

export function useVirtualRideSession(options: UseVirtualRideSessionOptions) {
  const [status, setStatus] = useState<RideSessionStatus>("idle");
  const [metricsUi, setMetricsUi] = useState<RideMetricsUi>({
    virtualDistanceMeters: 0,
    accumulatedMs: 0,
    liveLngLat: null,
  });

  const statusRef = useRef(status);
  const speedRef = useRef(options.speedKmh);
  const routeGeometryRef = useRef(options.routeGeometry);
  const routeDistanceRef = useRef(options.routeDistanceMeters);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    speedRef.current = options.speedKmh;
  }, [options.speedKmh]);

  const virtualDistanceRef = useRef(0);
  const accumulatedMsRef = useRef(0);
  const lastAnimTsRef = useRef<number | null>(null);
  const lastUiTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    routeGeometryRef.current = options.routeGeometry;
    routeDistanceRef.current = options.routeDistanceMeters;
  }, [options.routeGeometry, options.routeDistanceMeters]);

  /** rAF마다 setState 금지 — METRICS_UI_MS 간격으로만 React 상태 갱신 (무한 렌더 방지) */
  const flushUi = useCallback((ts: number, live: LngLat | null, forceFull: boolean) => {
    const shouldFlush =
      forceFull ||
      lastUiTsRef.current == null ||
      ts - lastUiTsRef.current >= METRICS_UI_MS;
    if (!shouldFlush) return;
    lastUiTsRef.current = ts;
    setMetricsUi({
      virtualDistanceMeters: virtualDistanceRef.current,
      accumulatedMs: accumulatedMsRef.current,
      liveLngLat: live,
    });
  }, []);

  useEffect(() => {
    if (status !== "running") {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastAnimTsRef.current = null;
      lastUiTsRef.current = null;
      return;
    }

    const loop = (ts: number) => {
      if (statusRef.current !== "running") {
        rafRef.current = null;
        return;
      }

      if (lastAnimTsRef.current == null) {
        lastAnimTsRef.current = ts;
        lastUiTsRef.current = ts;
      }

      const deltaMs = Math.max(0, ts - lastAnimTsRef.current);
      lastAnimTsRef.current = ts;

      const virtualSpeedMetersPerSec = (speedRef.current * 1000) / 3600;
      accumulatedMsRef.current += deltaMs;
      virtualDistanceRef.current += virtualSpeedMetersPerSec * (deltaMs / 1000);

      const geom = routeGeometryRef.current;
      const routeLen = routeDistanceRef.current;
      const vd = virtualDistanceRef.current;
      const capped = routeLen > 0 ? Math.min(vd, routeLen) : vd;
      const live = geom ? getPointOnRouteByDistance(geom, capped) : null;

      const forceFull =
        lastUiTsRef.current == null || ts - lastUiTsRef.current >= METRICS_UI_MS;
      flushUi(ts, live, forceFull);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastAnimTsRef.current = null;
      lastUiTsRef.current = null;
    };
  }, [status, flushUi]);

  const resetDistances = useCallback(() => {
    virtualDistanceRef.current = 0;
    accumulatedMsRef.current = 0;
    lastAnimTsRef.current = null;
    lastUiTsRef.current = null;
    setMetricsUi({
      virtualDistanceMeters: 0,
      accumulatedMs: 0,
      liveLngLat: null,
    });
  }, []);

  /** 일시정지 직후 등, 마지막 위치만 반영 */
  const syncLiveFromDistance = useCallback(() => {
    const geom = routeGeometryRef.current;
    const routeLen = routeDistanceRef.current;
    const vd = virtualDistanceRef.current;
    const capped = routeLen > 0 ? Math.min(vd, routeLen) : vd;
    const live = geom ? getPointOnRouteByDistance(geom, capped) : null;
    setMetricsUi((prev) => ({ ...prev, liveLngLat: live }));
  }, []);

  return {
    status,
    setStatus,
    metrics: metricsUi,
    resetDistances,
    syncLiveFromDistance,
  };
}
