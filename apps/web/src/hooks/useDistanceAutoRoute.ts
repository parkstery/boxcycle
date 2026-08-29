import type { User } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { useCallback, useMemo, useState } from "react";
import { getFirebaseApp } from "../lib/firebase";
import type { LngLat } from "../lib/geo";
import { formatLngLat, getDistanceMeters } from "../lib/geo";
import {
  bearingFromOriginToPoint,
  buildAutoRouteCandidates,
  circleLineString,
  isValidAutoRouteEnd,
  pickBestAutoRoute,
  scoreRouteDistanceError,
  type ScoredAutoRoute,
} from "../lib/distanceAutoRoute";
import { MAX_ROUTE_STRAIGHT_LINE_METERS } from "../lib/routeLimits";
import {
  fetchRouteByProfile,
  formatDuration,
  type RouteProfile,
} from "../services/mapboxDirections";

export type DistanceAutoRouteStep =
  | "closed"
  | "pick_start"
  | "pick_profile"
  | "pick_distance"
  | "pick_direction"
  | "searching";

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

  const targetMeters = targetKm * 1000;

  const circleGeometry = useMemo(() => {
    if (!start || step === "closed" || step === "pick_start") return null;
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
  }, []);

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
    setStatusMessage(null);
    setStep("pick_direction");
  }, [targetKm]);

  const handleMapPick = useCallback(
    async (lngLat: LngLat) => {
      if (step === "pick_start") {
        setStart(lngLat);
        setStatusMessage(`출발: ${formatLngLat(lngLat)}`);
        return;
      }
      if (step === "pick_direction" && start) {
        const bearing = bearingFromOriginToPoint(start, lngLat);
        setBearingDeg(bearing);
        setStep("searching");
        setStatusMessage("도로 경로를 탐색하는 중…");

        const candidates = buildAutoRouteCandidates(start, bearing, targetMeters).filter((c) =>
          isValidAutoRouteEnd(start, c.end),
        );
        if (candidates.length === 0) {
          setStatusMessage("후보 종점을 만들 수 없습니다. 거리를 조정해 보세요.");
          setStep("pick_direction");
          return;
        }

        const functions = getFunctions(getFirebaseApp(), functionsRegion);
        const scored: ScoredAutoRoute[] = [];

        for (const candidate of candidates) {
          const straight = getDistanceMeters(start, candidate.end);
          if (straight > MAX_ROUTE_STRAIGHT_LINE_METERS) continue;

          try {
            const requestId =
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID().replace(/-/g, "")
                : `auto_${Date.now()}`;
            const route = await fetchRouteByProfile(
              functions,
              user!,
              start,
              candidate.end,
              profile,
              undefined,
              requestId,
            );
            scored.push({
              candidate,
              route,
              errorMeters: scoreRouteDistanceError(route.distance, targetMeters),
            });
          } catch {
            /* 후보 실패는 건너뜀 */
          }
        }

        const best = pickBestAutoRoute(scored);
        if (!best) {
          setStatusMessage("도로로 연결되는 경로를 찾지 못했습니다. 방향이나 거리를 바꿔 보세요.");
          setStep("pick_direction");
          return;
        }

        const km = (best.route.distance / 1000).toFixed(2);
        const targetLabel = (targetMeters / 1000).toFixed(1);
        const summary = `자동 경로 · 목표 ${targetLabel} km → 실제 ${km} km / 예상 ${formatDuration(best.route.duration)}`;

        onClearRouteArtifacts();
        onApplyRoute({
          start,
          end: best.candidate.end,
          profile,
          distanceMeters: best.route.distance,
          durationSec: best.route.duration,
          geometry: best.route.geometry,
          summary,
        });

        setStatusMessage(summary);
        setStep("closed");
        setBearingDeg(bearing);
      }
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
    isOpen: step !== "closed",
    isSearching: step === "searching",
  };
}
