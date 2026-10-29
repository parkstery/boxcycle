import type { User } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { registerDistanceAutoRouteMapBridge, clearDistanceAutoRouteClickDebugMarker } from "../lib/map/distanceAutoRouteMapBridge";
import { getFirebaseApp } from "../lib/firebase/app";
import type { LngLat } from "../lib/geo/geo";
import { resolveDistanceAutoRouteGuideRadiusKm } from "../lib/route/distanceAutoRouteGuideRing";
import { formatLngLat } from "../lib/geo/geo";
import {
  bearingFromOriginToPoint,
  circleLineString,
} from "../lib/route/distanceAutoRoute";
import {
  formatDistanceAutoRouteDirectionClickHint,
  DISTANCE_AUTO_ROUTE_REROUTE_HINT,
  formatDistanceAutoRouteClientError,
  formatDistanceAutoRouteOfferedMessage,
  formatDistanceAutoRouteShortfallMessage,
  validateDistanceAutoRouteTargetKm,
  DISTANCE_AUTO_ROUTE_DEFAULT_KM,} from "../lib/route/distanceAutoRouteErrors";
import { fetchDistanceAutoRoute } from "../services/distanceAutoRouteApi";
import { prewarmRouteFunctions } from "../services/routeFunctionsPrewarm";
import type { RouteProfile } from "../services/mapboxDirections";
import type { ScoredAutoRoute } from "../lib/route/distanceAutoRoute";

export type DistanceAutoRouteStep =
  | "closed"
  | "pick_start"
  | "pick_profile"
  | "pick_distance"
  | "pick_direction"
  | "searching"
  | "route_found"
  | "search_failed";

export type DistanceAutoRouteArmResult =
  | { ok: true }
  | { ok: false; message: string };

export type DistanceAutoRouteSearchResult = {
  status: "found" | "failed";
  message: string;
  offered?: {
    directRoadMeters: number;
    targetKm: number;
    adjustLabel: string;
  };
};

/** offered 결과: 클릭 지점에 도달 불가, 앱이 D 지점을 제시한 상태 */
export type DistanceAutoRouteOfferedState = {
  clickLngLat: LngLat;
  directKm: number;
  targetKm: number;
};

export type UseDistanceAutoRouteOptions = {
  user: User | null;
  functionsRegion: string;
  rideLocked: boolean;
  routeTokenInsufficient: boolean;
  onApplyRoute: (result: {
    start: LngLat;
    end: LngLat;
    profile: RouteProfile;
    distanceMeters: number;
    durationSec: number;
    geometry: ScoredAutoRoute["route"]["geometry"];
    summary: string;
  }) => void;
  onClearRouteArtifacts: () => void;
};

function createRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : `auto_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useDistanceAutoRoute(options: UseDistanceAutoRouteOptions) {
  const {
    user,
    functionsRegion,
    rideLocked,
    routeTokenInsufficient,
    onApplyRoute,
    onClearRouteArtifacts,
  } = options;

  const [step, setStep] = useState<DistanceAutoRouteStep>("closed");
  const [sessionActive, setSessionActive] = useState(false);
  const [distanceDirectionMode, setDistanceDirectionModeState] = useState(false);
  const [popupPickBound, setPopupPickBound] = useState(false);
  const [hasSuccessfulRoute, setHasSuccessfulRoute] = useState(false);
  const [start, setStart] = useState<LngLat | null>(null);
  const [profile, setProfile] = useState<RouteProfile>("driving");
  const [targetKm, setTargetKm] = useState(DISTANCE_AUTO_ROUTE_DEFAULT_KM);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bearingDeg, setBearingDeg] = useState<number | null>(null);
  const [offeredState, setOfferedState] = useState<DistanceAutoRouteOfferedState | null>(null);
  const [circlePreviewState, setCirclePreviewState] = useState<{
    preview: { start: LngLat; targetKm: number } | null;
    fitToken: number;
  }>({ preview: null, fitToken: 0 });
  const activeRequestIdRef = useRef<string | null>(null);
  const lastClickRef = useRef<LngLat | null>(null);
  /** armDirectionPick 이 고른 Start — React state 커밋 전 map pick 이 와도 API 에 같은 좌표를 쓴다 */
  const pickStartRef = useRef<LngLat | null>(null);
  const overrideTargetKmRef = useRef<number | null>(null);
  /** `pick_start` 에서 클릭을 받으면 이어서 실행할 콜백 — 간편 인터벌 주행이 등록한다 */
  const startPickedRef = useRef<((lngLat: LngLat) => Promise<DistanceAutoRouteSearchResult | null>) | null>(null);
  /** 직전 자동 Route 세션의 이동수단·목표 거리 — 이어 달리기 anchor 진입 시 승계 */
  const lastSessionPrefsRef = useRef<{ profile: RouteProfile; targetKm: number }>({
    profile: "driving",
    targetKm: DISTANCE_AUTO_ROUTE_DEFAULT_KM,
  });

  const targetMeters = targetKm * 1000;
  const circlePreview = circlePreviewState.preview;
  const circleFitToken = circlePreviewState.fitToken;

  const circleGeometry = useMemo(() => {
    // 안내 원 = D (5A-R2c §2). 파선 하나. fitBounds도 이 원을 쓴다.
    if (circlePreview) {
      const radiusKm = resolveDistanceAutoRouteGuideRadiusKm(circlePreview.targetKm);
      return circleLineString(circlePreview.start, radiusKm * 1000);
    }
    if (!start || step === "closed" || step === "pick_start") {
      return null;
    }
    if (step === "pick_direction" || step === "searching") {
      const radiusKm = resolveDistanceAutoRouteGuideRadiusKm(targetMeters / 1000);
      return circleLineString(start, radiusKm * 1000);
    }
    return null;
  }, [circlePreview, start, targetMeters, step]);

  const previewCircleAt = useCallback((input: { start: LngLat; targetKm: number }) => {
    setCirclePreviewState((prev) => ({
      preview: input,
      fitToken: prev.fitToken + 1,
    }));
  }, []);

  const clearCirclePreview = useCallback(() => {
    setCirclePreviewState((prev) => ({ preview: null, fitToken: prev.fitToken }));
  }, []);

  const disarm = useCallback(() => {
    setStep("closed");
    setSessionActive(false);
    setPopupPickBound(false);
    setHasSuccessfulRoute(false);
    setStatusMessage(null);
    setBearingDeg(null);
    setOfferedState(null);
    setCirclePreviewState((prev) => ({ preview: null, fitToken: prev.fitToken }));
    activeRequestIdRef.current = null;
    lastClickRef.current = null;
    pickStartRef.current = null;
    startPickedRef.current = null;
    clearDistanceAutoRouteClickDebugMarker();
  }, []);

  const suspendPopupPick = useCallback(() => {
    setPopupPickBound(false);
  }, []);

  const releasePickArm = useCallback(() => {
    setPopupPickBound(false);
    setCirclePreviewState((prev) => ({ preview: null, fitToken: prev.fitToken }));
  }, []);

  /**
   * 「거리」 체크박스. **끄는 순간 세션까지 끝낸다**(2026-09-18 Chief).
   *
   * 종전에는 `releasePickArm()` 만 불러 **선호만 끄고 세션(`sessionActive`)은 살려 뒀다**.
   * 그런데 클릭 해석과 팝업 초기값은 세션을 본다 — 「여기에서 계속」으로 켜진 세션이 남아
   * 있으면 체크를 풀어도 지도 클릭이 계속 「방향 선택」으로 먹혀 End 를 직접 못 찍는다.
   * 이 체크박스는 preference 토글이 아니라 **확실한 ON/OFF 컨트롤**이어야 한다.
   *
   * 켤 때는 세션을 여기서 시작하지 않는다 — Start·목표 거리가 정해진 뒤 `armDirectionPick`
   * 이 연다. 끄는 쪽만 확실히 닫으면 된다.
   */
  const setDistanceDirectionMode = useCallback(
    (enabled: boolean) => {
      setDistanceDirectionModeState(enabled);
      if (!enabled) disarm();
    },
    [disarm],
  );

  const armDirectionPick = useCallback(
    (input: {
      start: LngLat;
      profile: RouteProfile;
      targetKm: number;
    }): DistanceAutoRouteArmResult => {
      if (rideLocked) {
        return { ok: false, message: "주행 중에는 자동 경로를 만들 수 없습니다." };
      }
      if (!user) {
        return { ok: false, message: "게스트 또는 로그인 세션에서 사용할 수 있습니다." };
      }
      if (routeTokenInsufficient) {
        return { ok: false, message: "Route Token 이 부족합니다." };
      }
      const validated = validateDistanceAutoRouteTargetKm(input.targetKm);
      if (!validated.ok) {
        return validated;
      }

      prewarmRouteFunctions(user, "getDistanceAutoRoute");
      setDistanceDirectionModeState(true);
      setSessionActive(true);
      setPopupPickBound(true);
      pickStartRef.current = input.start;
      setStart(input.start);
      setProfile(input.profile);
      setTargetKm(validated.km);
      setBearingDeg(null);
      setOfferedState(null);
      activeRequestIdRef.current = null;
      setCirclePreviewState((prev) => ({
        preview: { start: input.start, targetKm: validated.km },
        fitToken: prev.fitToken + 1,
      }));
      setStatusMessage(
        hasSuccessfulRoute
          ? DISTANCE_AUTO_ROUTE_REROUTE_HINT
          : formatDistanceAutoRouteDirectionClickHint(validated.km),
      );
      lastSessionPrefsRef.current = { profile: input.profile, targetKm: validated.km };
      setStep("pick_direction");
      return { ok: true };
    },
    [rideLocked, routeTokenInsufficient, user, hasSuccessfulRoute],
  );

  useEffect(() => {
    if (sessionActive) {
      lastSessionPrefsRef.current = { profile, targetKm };
    }
  }, [sessionActive, profile, targetKm]);

  const getLastSessionPrefs = useCallback(
    () => lastSessionPrefsRef.current,
    [],
  );


  const resumePickDirection = useCallback(() => {
    if (!sessionActive || !start || !distanceDirectionMode) return;
    setPopupPickBound(true);
    setStatusMessage(
      hasSuccessfulRoute
        ? DISTANCE_AUTO_ROUTE_REROUTE_HINT
        : formatDistanceAutoRouteDirectionClickHint(targetKm),
    );
    setStep("pick_direction");
    activeRequestIdRef.current = null;
  }, [distanceDirectionMode, hasSuccessfulRoute, sessionActive, start, targetKm]);

  /**
   * 한 방향 지점으로 탐색 요청을 보내고 결과를 적용하는 **단일 경로**.
   * 지도 클릭(`handleMapPick`)과 간편 인터벌 주행이 같은 요청·적용 코드를 쓴다.
   * 늦게 도착한 응답은 `activeRequestIdRef` 로 걸러 새 상태를 덮지 않는다(null 반환).
   */
  const searchTowardPoint = useCallback(
    async (input: {
      start: LngLat;
      point: LngLat;
      targetKm: number;
      profile: RouteProfile;
    }): Promise<DistanceAutoRouteSearchResult | null> => {
      const effectiveStart = input.start;
      const lngLat = input.point;
      const effectiveTargetKm = input.targetKm;
      const effectiveProfile = input.profile;
      const effectiveTargetMeters = effectiveTargetKm * 1000;

      if (routeTokenInsufficient) {
        const message = "Route Token 이 부족합니다.";
        setStatusMessage(message);
        return { status: "failed", message };
      }

      const bearing = bearingFromOriginToPoint(effectiveStart, lngLat);
      setBearingDeg(bearing);
      lastClickRef.current = lngLat;
      setStep("searching");
      setOfferedState(null);
      setStatusMessage(`목표 ${(effectiveTargetMeters / 1000).toFixed(1)} km에 맞는 경로를 찾는 중입니다…`);

      const requestId = createRequestId();
      activeRequestIdRef.current = requestId;

      const functions = getFunctions(getFirebaseApp(), functionsRegion);

      try {
        const response = await fetchDistanceAutoRoute(functions, user!, {
          start: effectiveStart,
          targetRoadPoint: lngLat,
          // 수단 클릭에서 arm 직후 탐색해도 React 커밋 전 기본값으로 요청하지 않는다.
          profile: effectiveProfile,
          targetDistanceMeters: effectiveTargetMeters,
          bearingDeg: bearing,
          requestId,
        });

        if (activeRequestIdRef.current !== requestId) return null;
        activeRequestIdRef.current = null;

        if (response.status === "failed") {
          const message = response.message;
          setStatusMessage(
            hasSuccessfulRoute ? DISTANCE_AUTO_ROUTE_REROUTE_HINT : message,
          );
          setStep("pick_direction");
          return { status: "failed", message };
        }

        if (import.meta.env.DEV) {
          console.info("[distanceAutoRoute]", {
            algorithmVersion: response.algorithmVersion ?? "(unknown — 프로덕션 Functions?)",
            endMissMeters: response.endMissMeters,
            directRoadMeters: response.directRoadMeters,
            outcome: response.outcome,
            targetRoadPoint: lngLat,
            end: response.end,
            emulator: import.meta.env.VITE_USE_EMULATOR === "1",
          });
        }

        onClearRouteArtifacts();
        onApplyRoute({
          start: effectiveStart,
          end: response.end,
          profile: effectiveProfile,
          distanceMeters: response.distance,
          durationSec: response.duration,
          geometry: response.geometry,
          summary: response.summary,
        });

        const isOffered = response.outcome === "offered";
        const isShortfall = response.outcome === "shortfall";
        if (isShortfall) {
          const shortfallMessage = formatDistanceAutoRouteShortfallMessage(
            effectiveTargetKm,
            response.distance,
          );
          setHasSuccessfulRoute(true);
          setStatusMessage(shortfallMessage);
          setStep("pick_direction");
          setBearingDeg(bearing);
          setCirclePreviewState((prev) => ({ preview: null, fitToken: prev.fitToken }));
          return { status: "found", message: shortfallMessage };
        }
        if (isOffered && response.directRoadMeters != null) {
          const directKm = response.directRoadMeters / 1000;
          const offeredMessage = formatDistanceAutoRouteOfferedMessage(
            response.directRoadMeters,
            effectiveTargetKm,
          );
          setOfferedState({ clickLngLat: lngLat, directKm, targetKm: effectiveTargetKm });
          setHasSuccessfulRoute(true);
          setStatusMessage(offeredMessage);
          setStep("pick_direction");
          setBearingDeg(bearing);
          setCirclePreviewState((prev) => ({ preview: null, fitToken: prev.fitToken }));
          return { status: "found", message: offeredMessage };
        }

        setHasSuccessfulRoute(true);
        setStatusMessage(DISTANCE_AUTO_ROUTE_REROUTE_HINT);
        setStep("pick_direction");
        setBearingDeg(bearing);
        setCirclePreviewState((prev) => ({ preview: null, fitToken: prev.fitToken }));
        return { status: "found", message: DISTANCE_AUTO_ROUTE_REROUTE_HINT };
      } catch (e) {
        if (activeRequestIdRef.current !== requestId) return null;
        activeRequestIdRef.current = null;
        const message = formatDistanceAutoRouteClientError(e);
        setStatusMessage(
          hasSuccessfulRoute ? DISTANCE_AUTO_ROUTE_REROUTE_HINT : message,
        );
        setStep("pick_direction");
        return { status: "failed", message };
      }
    },
    [
      user,
      functionsRegion,
      routeTokenInsufficient,
      hasSuccessfulRoute,
      onApplyRoute,
      onClearRouteArtifacts,
    ],
  );

  const handleMapPick = useCallback(
    async (lngLat: LngLat): Promise<DistanceAutoRouteSearchResult | null> => {
      if (step === "searching") {
        return null;
      }
      if (step === "pick_start") {
        pickStartRef.current = lngLat;
        setStart(lngLat);
        setStatusMessage(`출발: ${formatLngLat(lngLat)}`);
        const onPicked = startPickedRef.current;
        startPickedRef.current = null;
        return onPicked ? onPicked(lngLat) : null;
      }
      const effectiveStart = pickStartRef.current ?? start;
      if (step === "pick_direction" && popupPickBound && effectiveStart && distanceDirectionMode) {
        if (routeTokenInsufficient) {
          const message = "Route Token 이 부족합니다.";
          setStatusMessage(message);
          return { status: "failed", message };
        }

        const effectiveTargetKm = overrideTargetKmRef.current ?? lastSessionPrefsRef.current?.targetKm ?? targetKm;
        const effectiveProfile = lastSessionPrefsRef.current?.profile ?? profile;
        overrideTargetKmRef.current = null;

        return searchTowardPoint({
          start: effectiveStart,
          point: lngLat,
          targetKm: effectiveTargetKm,
          profile: effectiveProfile,
        });
      }
      return null;
    },
    [
      step,
      popupPickBound,
      start,
      targetKm,
      profile,
      routeTokenInsufficient,
      distanceDirectionMode,
      searchTowardPoint,
    ],
  );

  /**
   * 출발 지점 클릭 대기(`pick_start`) — 간편 인터벌 주행에서 마지막 주행 기록이 없을 때 쓴다.
   * 지도를 클릭하면 `onPicked` 가 바로 이어서 탐색한다(방향 클릭 단계는 건너뛴다).
   */
  const armStartPick = useCallback(
    (input: {
      message: string;
      onPicked: (lngLat: LngLat) => Promise<DistanceAutoRouteSearchResult | null>;
    }): DistanceAutoRouteArmResult => {
      if (rideLocked) {
        return { ok: false, message: "주행 중에는 자동 경로를 만들 수 없습니다." };
      }
      if (!user) {
        return { ok: false, message: "게스트 또는 로그인 세션에서 사용할 수 있습니다." };
      }
      if (routeTokenInsufficient) {
        return { ok: false, message: "Route Token 이 부족합니다." };
      }
      prewarmRouteFunctions(user, "getDistanceAutoRoute");
      pickStartRef.current = null;
      activeRequestIdRef.current = null;
      startPickedRef.current = input.onPicked;
      setStart(null);
      setBearingDeg(null);
      setOfferedState(null);
      setStatusMessage(input.message);
      setStep("pick_start");
      return { ok: true };
    },
    [rideLocked, routeTokenInsufficient, user],
  );

  const retryDirection = useCallback(() => {
    resumePickDirection();
  }, [resumePickDirection]);

  const dismissResult = useCallback(() => {
    disarm();
  }, [disarm]);

  const mapPickMode: "start" | "direction" | null =
    step === "pick_start"
      ? "start"
      : distanceDirectionMode && popupPickBound && step === "pick_direction"
        ? "direction"
        : null;

  const getArmedStart = useCallback(() => pickStartRef.current, []);

  const mapBridge = useMemo(
    () => ({
      sessionActive,
      targetKm,
      statusMessage,
      distanceDirectionMode,
      setDistanceDirectionMode,
      suspendPopupPick,
      releasePickArm,
      disarm,
      getArmedStart,
    }),
    [
      sessionActive,
      targetKm,
      statusMessage,
      distanceDirectionMode,
      setDistanceDirectionMode,
      suspendPopupPick,
      releasePickArm,
      disarm,
      getArmedStart,
    ],
  );

  useEffect(() => {
    registerDistanceAutoRouteMapBridge(mapBridge);
    return () => registerDistanceAutoRouteMapBridge(null);
  }, [mapBridge]);

  return {
    step,
    sessionActive,
    distanceDirectionMode,
    hasSuccessfulRoute,
    start,
    profile,
    setProfile,
    targetKm,
    setTargetKm,
    statusMessage,
    bearingDeg,
    circleGeometry,
    offeredState,
    circleFitToken,
    previewCircleAt,
    clearCirclePreview,
    mapPickMode,
    handleMapPick,
    searchTowardPoint,
    armStartPick,
    armDirectionPick,
    getLastSessionPrefs,
    setDistanceDirectionMode,
    suspendPopupPick,
    releasePickArm,
    retryDirection,
    dismissResult,
    disarm,
    isSearching: step === "searching",
  };
}
