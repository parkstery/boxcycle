import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { RideSessionStatus } from "../../hooks/useVirtualRideSession";

/**
 * 가상 거리가 경로 길이에 도달하면 `endRideRef` 로 종료를 한 번 호출하고,
 * 결과 시트 등을 위해 `arrivalToastTick` 을 올린다.
 */
export function useRideArrivalAutoEnd(opts: {
  rideStatus: RideSessionStatus;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
  endRideRef: MutableRefObject<() => void>;
}): {
  arrivalToastTick: number;
  /** 시트 닫기·adhoc 저장 완료 후 */
  resetArrivalToast: () => void;
  /** 새 주행 시작 시 게이트 리셋 */
  resetArrivalGate: () => void;
} {
  const [arrivalToastTick, setArrivalToastTick] = useState(0);
  const arrivalHandledRef = useRef(false);

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
    opts.endRideRef.current();
    setArrivalToastTick((t) => t + 1);
  }, [opts.rideStatus, opts.virtualDistanceMeters, opts.routeDistanceMeters]);

  return {
    arrivalToastTick,
    resetArrivalToast: () => setArrivalToastTick(0),
    resetArrivalGate: () => {
      arrivalHandledRef.current = false;
    },
  };
}
