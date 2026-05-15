import type { User } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { getFirebaseApp } from "../lib/firebase";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { formatLngLat } from "../lib/geo";
import { MAX_ROUTE_WAYPOINTS } from "../lib/routeWaypoints";
import { fetchRouteByProfile, formatDuration, type RouteProfile } from "../services/mapboxDirections";
import { fetchMapboxReverseGeocodePlaceName } from "../services/mapboxReverseGeocode";
import { useVirtualRideSession } from "./useVirtualRideSession";

export type UseRoutePlanningOptions = {
  user: User | null;
  speedKmh: number;
  mapboxAccessToken: string;
  functionsRegion: string;
  /** 경로 재계산·핀 클리어 직후 저장 경로 ref·공식 코스 id 등 App 쪽 정리 */
  clearRouteArtifactsRef: MutableRefObject<() => void>;
  /** Directions 실패 시 공식 코스 id 등(저장 경로 ref 는 유지) */
  onRouteDirectionsErrorRef: MutableRefObject<() => void>;
};

/**
 * 출발/도착/경유, OSRM(Mapbox Directions Callable) 경로, 역지오코딩 라벨, 가상 주행 세션.
 */
export function useRoutePlanning(options: UseRoutePlanningOptions) {
  const { user, speedKmh, mapboxAccessToken, functionsRegion, clearRouteArtifactsRef, onRouteDirectionsErrorRef } =
    options;

  const [startLngLat, setStartLngLat] = useState<LngLat | null>(null);
  const [endLngLat, setEndLngLat] = useState<LngLat | null>(null);
  const [startPlaceLabel, setStartPlaceLabel] = useState<string | null>(null);
  const [endPlaceLabel, setEndPlaceLabel] = useState<string | null>(null);
  const [routeWaypoints, setRouteWaypoints] = useState<LngLat[]>([]);
  const [waypointPlaceLabels, setWaypointPlaceLabels] = useState<(string | null)[]>([]);
  const routeWaypointsGeocodeRef = useRef(routeWaypoints);
  routeWaypointsGeocodeRef.current = routeWaypoints;

  const [profile, setProfile] = useState<RouteProfile>("cycling");
  const [routeGeometry, setRouteGeometry] = useState<LineStringGeometry | null>(null);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState(0);
  const [routeDurationSec, setRouteDurationSec] = useState(0);
  const [routeSummary, setRouteSummary] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);

  const {
    status: rideStatus,
    setStatus: setRideStatus,
    metrics: rideMetrics,
    resetDistances: resetRide,
    syncLiveFromDistance,
  } = useVirtualRideSession({
    speedKmh,
    routeGeometry,
    routeDistanceMeters,
  });

  useEffect(() => {
    if (!startLngLat) {
      setStartPlaceLabel(null);
      return;
    }
    const token = mapboxAccessToken.trim();
    if (!token) {
      setStartPlaceLabel(formatLngLat(startLngLat));
      return;
    }
    const ac = new AbortController();
    setStartPlaceLabel(null);
    void (async () => {
      try {
        const name = await fetchMapboxReverseGeocodePlaceName(startLngLat, token, ac.signal);
        if (ac.signal.aborted) return;
        setStartPlaceLabel((name && name.trim()) || formatLngLat(startLngLat));
      } catch {
        if (ac.signal.aborted) return;
        setStartPlaceLabel(formatLngLat(startLngLat));
      }
    })();
    return () => ac.abort();
  }, [startLngLat, mapboxAccessToken]);

  useEffect(() => {
    if (!endLngLat) {
      setEndPlaceLabel(null);
      return;
    }
    const token = mapboxAccessToken.trim();
    if (!token) {
      setEndPlaceLabel(formatLngLat(endLngLat));
      return;
    }
    const ac = new AbortController();
    setEndPlaceLabel(null);
    void (async () => {
      try {
        const name = await fetchMapboxReverseGeocodePlaceName(endLngLat, token, ac.signal);
        if (ac.signal.aborted) return;
        setEndPlaceLabel((name && name.trim()) || formatLngLat(endLngLat));
      } catch {
        if (ac.signal.aborted) return;
        setEndPlaceLabel(formatLngLat(endLngLat));
      }
    })();
    return () => ac.abort();
  }, [endLngLat, mapboxAccessToken]);

  useEffect(() => {
    const wps = routeWaypoints;
    const snapshot = JSON.stringify(wps);
    const ac = new AbortController();

    if (wps.length === 0) {
      setWaypointPlaceLabels([]);
      return () => ac.abort();
    }

    const token = mapboxAccessToken.trim();
    if (!token) {
      setWaypointPlaceLabels(wps.map(formatLngLat));
      return () => ac.abort();
    }

    setWaypointPlaceLabels(wps.map(() => null));

    void (async () => {
      try {
        const resolved = await Promise.all(
          wps.map(async (wp) => {
            try {
              const name = await fetchMapboxReverseGeocodePlaceName(wp, token, ac.signal);
              if (ac.signal.aborted) return formatLngLat(wp);
              return (name && name.trim()) || formatLngLat(wp);
            } catch {
              return formatLngLat(wp);
            }
          }),
        );
        if (ac.signal.aborted) return;
        if (JSON.stringify(routeWaypointsGeocodeRef.current) !== snapshot) return;
        setWaypointPlaceLabels(resolved);
      } catch {
        if (ac.signal.aborted) return;
        if (JSON.stringify(routeWaypointsGeocodeRef.current) !== snapshot) return;
        setWaypointPlaceLabels(wps.map(formatLngLat));
      }
    })();

    return () => ac.abort();
  }, [routeWaypoints, mapboxAccessToken]);

  const startLabel = !startLngLat
    ? "미설정"
    : startPlaceLabel === null
      ? "주소 불러오는 중…"
      : startPlaceLabel;
  const endLabel = !endLngLat
    ? "미설정"
    : endPlaceLabel === null
      ? "주소 불러오는 중…"
      : endPlaceLabel;

  const waypointLabelsForPanel = useMemo(
    () =>
      routeWaypoints.map((wp, i) => {
        const lab = waypointPlaceLabels[i];
        if (lab === null) return "주소 불러오는 중…";
        if (typeof lab === "string") return lab;
        return formatLngLat(wp);
      }),
    [routeWaypoints, waypointPlaceLabels],
  );

  const generateRoute = useCallback(
    async (profileOverride?: RouteProfile) => {
      if (rideStatus !== "idle") {
        setRouteSummary("세션이 대기 상태일 때만 경로를 바꿀 수 있습니다. 종료 후 다시 시도하세요.");
        return;
      }
      if (!user) {
        setRouteSummary("경로 계산은 로그인(게스트 포함) 후에 사용할 수 있습니다.");
        return;
      }
      const start = startLngLat;
      const end = endLngLat;
      if (!start || !end) {
        setRouteSummary("");
        return;
      }

      const activeProfile = profileOverride ?? profile;

      setRouteLoading(true);
      setRouteSummary("경로 계산 중…");
      try {
        const functions = getFunctions(getFirebaseApp(), functionsRegion);
        const wps = routeWaypoints.slice(0, MAX_ROUTE_WAYPOINTS);
        const route = await fetchRouteByProfile(
          functions,
          user,
          start,
          end,
          activeProfile,
          wps.length ? wps : undefined,
        );
        setRouteGeometry(route.geometry);
        setRouteDistanceMeters(route.distance);
        setRouteDurationSec(route.duration);
        const viaNote = wps.length ? ` · 경과 ${wps.length}곳` : "";
        setRouteSummary(
          `거리 ${(route.distance / 1000).toFixed(2)} km / 예상 ${formatDuration(route.duration)}${viaNote}`,
        );
        resetRide();
        clearRouteArtifactsRef.current();
      } catch (e: unknown) {
        const fe = e as { code?: string; message?: string };
        const message =
          typeof fe?.message === "string"
            ? fe.message
            : e instanceof Error
              ? e.message
              : String(e);
        const hint =
          fe?.code === "functions/not-found"
            ? " Cloud Functions 가 배포되지 않았을 수 있습니다. 저장소 루트에서 firebase deploy --only functions 를 실행하고, MAPBOX_ACCESS_TOKEN 시크릿을 설정하세요."
            : "";
        setRouteSummary(message + hint);
        setRouteGeometry(null);
        setRouteDistanceMeters(0);
        setRouteDurationSec(0);
        onRouteDirectionsErrorRef.current();
      } finally {
        setRouteLoading(false);
      }
    },
    [
      rideStatus,
      startLngLat,
      endLngLat,
      routeWaypoints,
      profile,
      resetRide,
      user,
      functionsRegion,
    ],
  );

  const clearRoutePins = useCallback(
    (rideLocked: boolean) => {
      if (rideLocked) return;
      setStartLngLat(null);
      setEndLngLat(null);
      setRouteWaypoints([]);
      setRouteGeometry(null);
      setRouteDistanceMeters(0);
      setRouteDurationSec(0);
      setRouteSummary("");
      clearRouteArtifactsRef.current();
    },
    [],
  );

  const applyRouteProfileFromMapPopup = useCallback(
    (rideLocked: boolean, p: RouteProfile) => {
      if (rideLocked) return;
      setProfile(p);
      void generateRoute(p);
    },
    [generateRoute],
  );

  return {
    startLngLat,
    setStartLngLat,
    endLngLat,
    setEndLngLat,
    routeWaypoints,
    setRouteWaypoints,
    profile,
    setProfile,
    routeGeometry,
    setRouteGeometry,
    routeDistanceMeters,
    setRouteDistanceMeters,
    routeDurationSec,
    setRouteDurationSec,
    routeSummary,
    setRouteSummary,
    routeLoading,
    setRouteLoading,
    rideStatus,
    setRideStatus,
    rideMetrics,
    resetRide,
    syncLiveFromDistance,
    startLabel,
    endLabel,
    startPlaceLabel,
    endPlaceLabel,
    waypointLabelsForPanel,
    generateRoute,
    clearRoutePins,
    applyRouteProfileFromMapPopup,
  };
}
