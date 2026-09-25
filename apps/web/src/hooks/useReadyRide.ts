import type { User } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFirebaseApp } from "../lib/firebase/app";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { formatDistanceAutoRouteClientError } from "../lib/distanceAutoRouteErrors";
import {
  createReadyRideRequestId,
  READY_RIDE_GENERATING_LABEL,
  READY_RIDE_SLOW_GENERATE_MS,
  READY_RIDE_SLOW_GENERATING_LABEL,
} from "../lib/readyRide";
import { fetchDistanceAutoRoute } from "../services/distanceAutoRouteApi";
import type { RouteProfile } from "../services/mapboxDirections";

export type ReadyRideStatus = "idle" | "generating" | "failed";

/**
 * 마지막 생성 결과 — 지시03 §B2·§B3. 카드가 「순환 실패 → 편도」 안내 문구를 보여줄지,
 * 「다른 경로」가 어떤 시작 방위를 제외해야 할지 여기서 읽는다.
 */
export type ReadyRideLastResult = {
  closed: boolean;
  startBearingSampleDeg: number | null;
};

export type UseReadyRideOptions = {
  user: User | null;
  functionsRegion: string;
  rideLocked: boolean;
  routeTokenInsufficient: boolean;
  profile: RouteProfile;
  onApplyRoute: (result: {
    start: LngLat;
    end: LngLat;
    profile: RouteProfile;
    distanceMeters: number;
    durationSec: number;
    geometry: LineStringGeometry;
    summary: string;
  }) => void;
  onClearRouteArtifacts: () => void;
};

/**
 * Ready Ride 생성 — 지시02. 클릭 기반 `useDistanceAutoRoute` 와는 별개 상태 기계다.
 * 방향·거리를 사용자가 찍지 않으므로 그 훅의 pick_direction 단계 기계를 재사용하지 않는다.
 * 생성된 Route 는 `onApplyRoute` 로 **기존 Go 게이트**에 그대로 얹는다(새 시작 경로 없음).
 */
export function useReadyRide(options: UseReadyRideOptions) {
  const {
    user,
    functionsRegion,
    rideLocked,
    routeTokenInsufficient,
    profile,
    onApplyRoute,
    onClearRouteArtifacts,
  } = options;

  const [status, setStatus] = useState<ReadyRideStatus>("idle");
  const [slow, setSlow] = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ReadyRideLastResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    };
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
    setStatus("idle");
    setSlow(false);
    setFailMessage(null);
    setLastResult(null);
  }, []);

  const runGenerate = useCallback(
    async (input: { start: LngLat; targetDistanceMeters: number; excludeStartBearingDeg?: number }) => {
      if (rideLocked) {
        setStatus("failed");
        setFailMessage("주행 중에는 Ready Ride 를 만들 수 없습니다.");
        return;
      }
      if (!user) {
        setStatus("failed");
        setFailMessage("게스트 또는 로그인 세션에서 사용할 수 있습니다.");
        return;
      }
      if (routeTokenInsufficient) {
        setStatus("failed");
        setFailMessage("Route Token 이 부족합니다.");
        return;
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setStatus("generating");
      setSlow(false);
      setFailMessage(null);

      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      slowTimerRef.current = setTimeout(() => {
        if (!ac.signal.aborted) setSlow(true);
      }, READY_RIDE_SLOW_GENERATE_MS);

      const requestId = createReadyRideRequestId();
      const functions = getFunctions(getFirebaseApp(), functionsRegion);

      try {
        const response = await fetchDistanceAutoRoute(functions, user, {
          start: input.start,
          profile,
          targetDistanceMeters: input.targetDistanceMeters,
          // 지시05 — 기본은 단순 경로. closeLoop 를 보내지 않으면 서버가 readyOneway 로 처리한다.
          excludeStartBearingDeg: input.excludeStartBearingDeg,
          requestId,
          signal: ac.signal,
        });

        if (ac.signal.aborted) return;

        if (response.status === "failed") {
          setStatus("failed");
          setLastResult(null);
          setFailMessage(response.message);
          return;
        }

        onClearRouteArtifacts();
        onApplyRoute({
          start: input.start,
          end: response.end,
          profile,
          distanceMeters: response.distance,
          durationSec: response.duration,
          geometry: response.geometry,
          summary: response.summary,
        });
        setLastResult({
          closed: false,
          startBearingSampleDeg: response.startBearingSampleDeg ?? null,
        });
        setStatus("idle");
      } catch (e) {
        if (ac.signal.aborted) return;
        setStatus("failed");
        setLastResult(null);
        setFailMessage(formatDistanceAutoRouteClientError(e));
      } finally {
        if (slowTimerRef.current) {
          clearTimeout(slowTimerRef.current);
          slowTimerRef.current = null;
        }
      }
    },
    [rideLocked, user, routeTokenInsufficient, profile, functionsRegion, onApplyRoute, onClearRouteArtifacts],
  );

  const generate = useCallback(
    (input: { start: LngLat; targetDistanceMeters: number }) => runGenerate(input),
    [runGenerate],
  );

  /**
   * 「다른 경로」(지시03 §B3) — 직전에 쓴 시작 방위를 제외하고 다음 표본을 쓴다.
   * `lastResult` 가 없으면(첫 생성 전) 일반 생성과 같다.
   */
  const another = useCallback(
    (input: { start: LngLat; targetDistanceMeters: number }) =>
      runGenerate({
        ...input,
        excludeStartBearingDeg: lastResult?.startBearingSampleDeg ?? undefined,
      }),
    [runGenerate, lastResult],
  );

  const generatingLabel = slow ? READY_RIDE_SLOW_GENERATING_LABEL : READY_RIDE_GENERATING_LABEL;

  return {
    status,
    isGenerating: status === "generating",
    slow,
    generatingLabel,
    failMessage,
    lastResult,
    generate,
    another,
    cancel,
  };
}
