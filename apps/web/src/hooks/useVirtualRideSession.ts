import { useCallback, useEffect, useRef, useState } from "react";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "../lib/geo";
import { rideDistanceAlongRoute } from "../lib/liveLocationSnapshot";
import { stepRideSpeedKmh } from "../lib/rideSpeedRamp";
import { registerPeerSyncDistanceSamplers } from "../lib/peerMotion/peerSyncDistanceSamplers";

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
  appliedSpeedKmh: number;
};

const METRICS_UI_MS = 200;

export function useVirtualRideSession(options: UseVirtualRideSessionOptions) {
  const [status, setStatus] = useState<RideSessionStatus>("idle");
  const [metricsUi, setMetricsUi] = useState<RideMetricsUi>({
    virtualDistanceMeters: 0,
    accumulatedMs: 0,
    liveLngLat: null,
    appliedSpeedKmh: 0,
  });

  const statusRef = useRef(status);
  const speedRef = useRef(options.speedKmh);
  const appliedSpeedRef = useRef(0);
  const routeGeometryRef = useRef(options.routeGeometry);
  const routeDistanceRef = useRef(options.routeDistanceMeters);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    speedRef.current = options.speedKmh;
  }, [options.speedKmh]);

  const virtualDistanceRef = useRef(0);
  /**
   * 이어 달리기(§9.5.5 단위7) — 이번 세션의 경로상 시작 오프셋(m).
   * virtualDistance 는 「경로상 위치(누적)」, 이번 세션 실주행은 virtualDistance − startOffset.
   * 운동 인정·Claim 페이로드 분리는 종료 측(useRideEndAndPersistence)이 이 값을 읽어 수행한다.
   */
  const startOffsetMetersRef = useRef(0);
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
      appliedSpeedKmh: appliedSpeedRef.current,
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
      appliedSpeedRef.current = 0;
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

      appliedSpeedRef.current = stepRideSpeedKmh(appliedSpeedRef.current, speedRef.current, deltaMs);
      const virtualSpeedMetersPerSec = (appliedSpeedRef.current * 1000) / 3600;
      accumulatedMsRef.current += deltaMs;
      virtualDistanceRef.current += virtualSpeedMetersPerSec * (deltaMs / 1000);

      const geom = routeGeometryRef.current;
      const routeLen = routeDistanceRef.current;
      const geoLen = geom ? lineStringLengthMeters(geom) : 0;

      /**
       * 목적지 도달: 거리 캡 + 최종 flush 후 RAF 정지(다음 프레임 예약 안 함).
       * 상태(running) 전환은 호출 측(App.tsx)에서 메트릭 변화 useEffect로 마무리한다.
       */
      const capDist = rideDistanceAlongRoute(virtualDistanceRef.current, routeLen, geoLen);
      if (routeLen > 0 && virtualDistanceRef.current >= routeLen) {
        virtualDistanceRef.current = routeLen;
        const liveAtEnd = geom ? getPointOnRouteByDistance(geom, capDist) : null;
        flushUi(ts, liveAtEnd, true);
        rafRef.current = null;
        return;
      }

      const live = geom ? getPointOnRouteByDistance(geom, capDist) : null;

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

  /**
   * 거리 리셋. `startOffsetMeters` 를 주면 이어 달리기 — 경로상 offset 지점에서 시작한다.
   * 위치·도착판정·completionRatio(누적)는 시드된 virtualDistance 로 그대로 작동.
   */
  const resetDistances = useCallback((startOffsetMeters = 0) => {
    const offset = Math.max(0, startOffsetMeters);
    startOffsetMetersRef.current = offset;
    virtualDistanceRef.current = offset;
    accumulatedMsRef.current = 0;
    lastAnimTsRef.current = null;
    lastUiTsRef.current = null;
    appliedSpeedRef.current = 0;
    setMetricsUi({
      virtualDistanceMeters: offset,
      accumulatedMs: 0,
      liveLngLat: null,
      appliedSpeedKmh: 0,
    });
  }, []);

  /** 일시정지 직후 등, 마지막 위치만 반영 */
  const syncLiveFromDistance = useCallback(() => {
    const geom = routeGeometryRef.current;
    const routeLen = routeDistanceRef.current;
    const geoLen = geom ? lineStringLengthMeters(geom) : 0;
    const dist = rideDistanceAlongRoute(virtualDistanceRef.current, routeLen, geoLen);
    const live = geom ? getPointOnRouteByDistance(geom, dist) : null;
    setMetricsUi((prev) => ({ ...prev, liveLngLat: live }));
  }, []);

  /**
   * rAF 루프 내부 거리·경로 기준 위치 — React METRICS_UI_MS throttle 없이 맵 마커용.
   * idle 이면 null, paused 는 마지막 거리 고정.
   */
  const sampleLiveLngLat = useCallback((): LngLat | null => {
    if (statusRef.current === "idle") return null;
    const geom = routeGeometryRef.current;
    const routeLen = routeDistanceRef.current;
    const geoLen = geom ? lineStringLengthMeters(geom) : 0;
    const dist = rideDistanceAlongRoute(virtualDistanceRef.current, routeLen, geoLen);
    return geom ? getPointOnRouteByDistance(geom, dist) : null;
  }, []);

  /** rAF 원본 거리(m) — METRICS_UI_MS 상태와 무관. S3-DIAG ① */
  const sampleVirtualDistanceM = useCallback((): number => virtualDistanceRef.current, []);

  /** rAF 적용속도(km/h) — ① 로그용 */
  const sampleAppliedSpeedKmh = useCallback((): number => appliedSpeedRef.current, []);

  useEffect(() => {
    registerPeerSyncDistanceSamplers({
      sampleVirtualDistanceM,
      sampleAppliedSpeedKmh,
      sampleTargetSpeedKmh: () => speedRef.current,
      sampleRouteLens: () => {
        const geom = routeGeometryRef.current;
        return {
          routeLen: routeDistanceRef.current,
          geoLen: geom ? lineStringLengthMeters(geom) : 0,
        };
      },
    });
    return () =>
      registerPeerSyncDistanceSamplers({
        sampleVirtualDistanceM: null,
        sampleAppliedSpeedKmh: null,
        sampleTargetSpeedKmh: null,
        sampleRouteLens: null,
      });
  }, [sampleVirtualDistanceM, sampleAppliedSpeedKmh]);

  return {
    status,
    setStatus,
    metrics: metricsUi,
    resetDistances,
    syncLiveFromDistance,
    sampleLiveLngLat,
    sampleVirtualDistanceM,
    sampleAppliedSpeedKmh,
    startOffsetMetersRef,
  };
}
