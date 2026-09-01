import type { User } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { registerDistanceAutoRouteMapBridge } from "../lib/distanceAutoRouteMapBridge";
import { getFirebaseApp } from "../lib/firebase";
import type { LngLat } from "../lib/geo";
import { formatLngLat } from "../lib/geo";
import {
  bearingFromOriginToPoint,
  circleLineString,
} from "../lib/distanceAutoRoute";
import {
  DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT,
  DISTANCE_AUTO_ROUTE_REROUTE_HINT,
  formatDistanceAutoRouteClientError,
  validateDistanceAutoRouteTargetKm,
} from "../lib/distanceAutoRouteErrors";
import { fetchDistanceAutoRoute } from "../services/distanceAutoRouteApi";
import type { RouteProfile } from "../services/mapboxDirections";
import type { ScoredAutoRoute } from "../lib/distanceAutoRoute";

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
  const [profile, setProfile] = useState<RouteProfile>("cycling");
  const [targetKm, setTargetKm] = useState(10);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bearingDeg, setBearingDeg] = useState<number | null>(null);
  const [circlePreviewState, setCirclePreviewState] = useState<{
    preview: { start: LngLat; targetKm: number } | null;
    fitToken: number;
  }>({ preview: null, fitToken: 0 });
  const activeRequestIdRef = useRef<string | null>(null);

  const targetMeters = targetKm * 1000;
  const circlePreview = circlePreviewState.preview;
  const circleFitToken = circlePreviewState.fitToken;

  const circleGeometry = useMemo(() => {
    if (circlePreview) {
      return circleLineString(circlePreview.start, circlePreview.targetKm * 1000);
    }
    if (!start || step === "closed" || step === "pick_start") {
      return null;
    }
    if (step === "pick_direction" || step === "searching") {
      return circleLineString(start, targetMeters);
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
    setCirclePreviewState((prev) => ({ preview: null, fitToken: prev.fitToken }));
    activeRequestIdRef.current = null;
  }, []);

  const suspendPopupPick = useCallback(() => {
    setPopupPickBound(false);
  }, []);

  const releasePickArm = useCallback(() => {
    setPopupPickBound(false);
    setCirclePreviewState((prev) => ({ preview: null, fitToken: prev.fitToken }));
  }, []);

  const setDistanceDirectionMode = useCallback((enabled: boolean) => {
    setDistanceDirectionModeState(enabled);
    if (!enabled) {
      releasePickArm();
    }
  }, [releasePickArm]);

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

      setDistanceDirectionModeState(true);
      setSessionActive(true);
      setPopupPickBound(true);
      setStart(input.start);
      setProfile(input.profile);
      setTargetKm(validated.km);
      setBearingDeg(null);
      activeRequestIdRef.current = null;
      setCirclePreviewState((prev) => ({
        preview: { start: input.start, targetKm: validated.km },
        fitToken: prev.fitToken + 1,
      }));
      setStatusMessage(
        hasSuccessfulRoute
          ? DISTANCE_AUTO_ROUTE_REROUTE_HINT
          : DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT,
      );
      setStep("pick_direction");
      return { ok: true };
    },
    [rideLocked, routeTokenInsufficient, user, hasSuccessfulRoute],
  );

  const resumePickDirection = useCallback(() => {
    if (!sessionActive || !start || !distanceDirectionMode) return;
    setPopupPickBound(true);
    setStatusMessage(
      hasSuccessfulRoute
        ? DISTANCE_AUTO_ROUTE_REROUTE_HINT
        : DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT,
    );
    setStep("pick_direction");
    activeRequestIdRef.current = null;
  }, [distanceDirectionMode, hasSuccessfulRoute, sessionActive, start]);

  const handleMapPick = useCallback(
    async (lngLat: LngLat): Promise<DistanceAutoRouteSearchResult | null> => {
      if (step === "searching") {
        return null;
      }
      if (step === "pick_start") {
        setStart(lngLat);
        setStatusMessage(`출발: ${formatLngLat(lngLat)}`);
        return null;
      }
      if (step === "pick_direction" && popupPickBound && start && distanceDirectionMode) {
        if (routeTokenInsufficient) {
          const message = "Route Token 이 부족합니다.";
          setStatusMessage(message);
          return { status: "failed", message };
        }

        const bearing = bearingFromOriginToPoint(start, lngLat);
        setBearingDeg(bearing);
        setStep("searching");
        setStatusMessage(`목표 ${(targetMeters / 1000).toFixed(1)} km에 맞는 경로를 찾는 중입니다…`);

        const requestId = createRequestId();
        activeRequestIdRef.current = requestId;

        const functions = getFunctions(getFirebaseApp(), functionsRegion);

        try {
          const response = await fetchDistanceAutoRoute(functions, user!, {
            start,
            profile,
            targetDistanceMeters: targetMeters,
            bearingDeg: bearing,
            requestId,
          });

          activeRequestIdRef.current = null;

          if (response.status === "failed") {
            const message = response.message;
            setStatusMessage(
              hasSuccessfulRoute ? DISTANCE_AUTO_ROUTE_REROUTE_HINT : message,
            );
            setStep("pick_direction");
            return { status: "failed", message };
          }

          onClearRouteArtifacts();
          onApplyRoute({
            start,
            end: response.end,
            profile,
            distanceMeters: response.distance,
            durationSec: response.duration,
            geometry: response.geometry,
            summary: response.summary,
          });

          setHasSuccessfulRoute(true);
          setStatusMessage(DISTANCE_AUTO_ROUTE_REROUTE_HINT);
          setStep("pick_direction");
          setBearingDeg(bearing);
          setCirclePreviewState((prev) => ({ preview: null, fitToken: prev.fitToken }));
          return { status: "found", message: DISTANCE_AUTO_ROUTE_REROUTE_HINT };
        } catch (e) {
          activeRequestIdRef.current = null;
          const message = formatDistanceAutoRouteClientError(e);
          setStatusMessage(
            hasSuccessfulRoute ? DISTANCE_AUTO_ROUTE_REROUTE_HINT : message,
          );
          setStep("pick_direction");
          return { status: "failed", message };
        }
      }
      return null;
    },
    [
      step,
      popupPickBound,
      start,
      targetMeters,
      profile,
      user,
      functionsRegion,
      routeTokenInsufficient,
      hasSuccessfulRoute,
      distanceDirectionMode,
      onApplyRoute,
      onClearRouteArtifacts,
    ],
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
    circleFitToken,
    previewCircleAt,
    clearCirclePreview,
    mapPickMode,
    handleMapPick,
    armDirectionPick,
    setDistanceDirectionMode,
    suspendPopupPick,
    releasePickArm,
    retryDirection,
    dismissResult,
    disarm,
    isSearching: step === "searching",
  };
}
