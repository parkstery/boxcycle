import type { User } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { useCallback, useMemo, useRef, useState } from "react";
import { getFirebaseApp } from "../lib/firebase";
import type { LngLat } from "../lib/geo";
import { formatLngLat } from "../lib/geo";
import {
  bearingFromOriginToPoint,
  circleLineString,
} from "../lib/distanceAutoRoute";
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

export type DistanceAutoRouteStartResult =
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

const DISTANCE_PRESETS_KM = [3, 5, 10, 15, 20, 30] as const;

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
  const [start, setStart] = useState<LngLat | null>(null);
  const [profile, setProfile] = useState<RouteProfile>("cycling");
  const [targetKm, setTargetKm] = useState(10);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bearingDeg, setBearingDeg] = useState<number | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

  const targetMeters = targetKm * 1000;

  const circleGeometry = useMemo(() => {
    if (
      !start ||
      step === "closed" ||
      step === "pick_start" ||
      step === "route_found"
    ) {
      return null;
    }
    return circleLineString(start, targetMeters);
  }, [start, targetMeters, step]);

  const open = useCallback(() => {
    if (rideLocked) {
      setStatusMessage("주행 중에는 자동 경로를 만들 수 없습니다.");
      return;
    }
    if (!user) {
      setStatusMessage("로그인(게스트 포함) 후 사용할 수 있습니다.");
      return;
    }
    if (routeTokenInsufficient) {
      setStatusMessage("Route Token 이 부족합니다.");
      return;
    }
    setStatusMessage(null);
    setBearingDeg(null);
    setStep("pick_start");
  }, [rideLocked, user, routeTokenInsufficient]);

  const close = useCallback(() => {
    setStep("closed");
    setStatusMessage(null);
    setBearingDeg(null);
    activeRequestIdRef.current = null;
  }, []);

  const startFromMapPopup = useCallback(
    (input: {
      start: LngLat;
      profile: RouteProfile;
      targetKm: number;
    }): DistanceAutoRouteStartResult => {
      if (rideLocked) {
        return { ok: false, message: "주행 중에는 자동 경로를 만들 수 없습니다." };
      }
      if (!user) {
        return { ok: false, message: "게스트 또는 로그인 세션에서 사용할 수 있습니다." };
      }
      if (routeTokenInsufficient) {
        return { ok: false, message: "Route Token 이 부족합니다." };
      }
      if (input.targetKm < 0.5 || input.targetKm > 120) {
        return { ok: false, message: "목표 거리는 0.5~120 km 입니다." };
      }

      setStart(input.start);
      setProfile(input.profile);
      setTargetKm(input.targetKm);
      setBearingDeg(null);
      activeRequestIdRef.current = null;
      setStatusMessage("지도를 클릭하여 주행 방향을 선택하세요.");
      setStep("pick_direction");
      return { ok: true };
    },
    [rideLocked, routeTokenInsufficient, user],
  );

  const confirmStart = useCallback(() => {
    if (!start) {
      setStatusMessage("지도에서 출발점을 선택하세요.");
      return;
    }
    setStatusMessage(null);
    setStep("pick_profile");
  }, [start]);

  const confirmProfile = useCallback(() => {
    setStep("pick_distance");
  }, []);

  const confirmDistance = useCallback(() => {
    if (targetKm < 0.5 || targetKm > 120) {
      setStatusMessage("목표 거리는 0.5~120 km 입니다.");
      return;
    }
    setStatusMessage("지도를 클릭하여 주행 방향을 선택하세요.");
    setStep("pick_direction");
  }, [targetKm]);

  const handleMapPick = useCallback(
    async (lngLat: LngLat): Promise<DistanceAutoRouteSearchResult | null> => {
      if (step === "pick_start") {
        setStart(lngLat);
        setStatusMessage(`출발: ${formatLngLat(lngLat)}`);
        return null;
      }
      if (step === "pick_direction" && start) {
        const bearing = bearingFromOriginToPoint(start, lngLat);
        setBearingDeg(bearing);
        setStep("searching");
        setStatusMessage(`목표 ${(targetMeters / 1000).toFixed(1)} km에 맞는 경로를 찾는 중입니다…`);

        const requestId =
          activeRequestIdRef.current ??
          (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID().replace(/-/g, "")
            : `auto_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
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

          if (response.status === "failed") {
            setStatusMessage(response.message);
            setStep("search_failed");
            return { status: "failed", message: response.message };
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

          setStatusMessage(response.summary);
          setStep("route_found");
          setBearingDeg(bearing);
          return { status: "found", message: response.summary };
        } catch (e) {
          const message =
            e instanceof Error ? e.message : "목표거리와 적합한 경로를 찾지 못했습니다.";
          setStatusMessage(message);
          setStep("search_failed");
          return { status: "failed", message };
        }
      }
      return null;
    },
    [
      step,
      start,
      targetMeters,
      profile,
      user,
      functionsRegion,
      onApplyRoute,
      onClearRouteArtifacts,
    ],
  );

  const retryDirection = useCallback(() => {
    activeRequestIdRef.current = null;
    setStatusMessage("지도를 클릭하여 주행 방향을 선택하세요.");
    setStep("pick_direction");
  }, []);

  const dismissResult = useCallback(() => {
    setStep("closed");
    setStatusMessage(null);
    activeRequestIdRef.current = null;
  }, []);

  const mapPickMode: "start" | "direction" | null =
    step === "pick_start" ? "start" : step === "pick_direction" ? "direction" : null;

  return {
    step,
    open,
    close,
    start,
    profile,
    setProfile,
    targetKm,
    setTargetKm,
    distancePresetsKm: DISTANCE_PRESETS_KM,
    statusMessage,
    bearingDeg,
    circleGeometry,
    mapPickMode,
    handleMapPick,
    confirmStart,
    confirmProfile,
    confirmDistance,
    startFromMapPopup,
    retryDirection,
    dismissResult,
    isOpen: step !== "closed",
    isSearching: step === "searching",
  };
}
