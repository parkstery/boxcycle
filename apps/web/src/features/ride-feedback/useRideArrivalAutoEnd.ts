import { useEffect, useEffectEvent, useRef, useState, type MutableRefObject } from "react";
import type { RideSessionStatus } from "../../hooks/useVirtualRideSession";

const ARRIVAL_SCENE_MS = 2750;

/**
 * 가상 거리가 경로 길이에 도달하면 `endRideRef` 로 종료를 한 번 호출하고,
 * 결과 시트 등을 위해 `arrivalToastTick` 을 올린다.
 */
export function useRideArrivalAutoEnd(opts: {
  rideStatus: RideSessionStatus;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
  endRideRef: MutableRefObject<() => void>;
  showArrivalScene: boolean;
}): {
  arrivalToastTick: number;
  arrivalSceneStartedAt: number | null;
  /** 시트 닫기·adhoc 저장 완료 후 */
  resetArrivalToast: () => void;
  /** 새 주행 시작 시 게이트 리셋 */
  resetArrivalGate: () => void;
} {
  const [arrivalToastTick, setArrivalToastTick] = useState(0);
  const [arrivalSceneStartedAt, setArrivalSceneStartedAt] = useState<number | null>(null);
  const arrivalHandledRef = useRef(false);
  const onArrival = useEffectEvent(() => {
    if (opts.showArrivalScene && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setArrivalSceneStartedAt(performance.now());
    }
    opts.endRideRef.current();
    setArrivalToastTick((t) => t + 1);
  });

  useEffect(() => {
    if (arrivalSceneStartedAt == null) return;
    const timeout = window.setTimeout(
      () => setArrivalSceneStartedAt(null),
      Math.max(0, ARRIVAL_SCENE_MS - (performance.now() - arrivalSceneStartedAt)),
    );
    const cancelWhenHidden = () => {
      if (document.hidden) setArrivalSceneStartedAt(null);
    };
    document.addEventListener("visibilitychange", cancelWhenHidden);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", cancelWhenHidden);
    };
  }, [arrivalSceneStartedAt]);

  useEffect(() => {
    if (opts.rideStatus === "idle") {
      arrivalHandledRef.current = false;
      return;
    }
    if (opts.rideStatus !== "running") return;
    if (opts.routeDistanceMeters <= 0) return;
    if (opts.virtualDistanceMeters < opts.routeDistanceMeters) return;
    if (arrivalHandledRef.current) return;
    arrivalHandledRef.current = true;
    onArrival();
  }, [opts.rideStatus, opts.virtualDistanceMeters, opts.routeDistanceMeters]);

  return {
    arrivalToastTick,
    arrivalSceneStartedAt,
    resetArrivalToast: () => {
      setArrivalToastTick(0);
      setArrivalSceneStartedAt(null);
    },
    resetArrivalGate: () => {
      arrivalHandledRef.current = false;
      setArrivalSceneStartedAt(null);
    },
  };
}
