import { useEffect, useRef, useState } from "react";
import { isFirebaseConfigured } from "../lib/firebase/app";
import { loadRideRegionTotal, type RideRegionTotal } from "../lib/conquest/repo/firestoreConquest";

export type RideRegionTotalState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "missing" }
  | ({ status: "ready" } & RideRegionTotal);

/**
 * 고른 지역(국가·행정구역 코드)의 주행 누적 — 지역을 고를 때만 문서 1건을 읽고,
 * 같은 계정·같은 지역에서 주행 합계가 그대로면 다시 읽지 않는다. 세계(scopeCode null)는 읽지 않는다.
 * 문서 없음·읽기 실패는 모두 `missing` (화면은 「—」).
 */
export function useRideRegionTotals(
  userId: string | null,
  open: boolean,
  scopeCode: string | null,
  totalMeters: number | null,
): RideRegionTotalState {
  const [state, setState] = useState<{ stamp: string; value: RideRegionTotalState } | null>(null);
  const loadedFor = useRef<string | null>(null);
  const stamp = userId && scopeCode ? `${userId}:${scopeCode}:${Math.round(totalMeters ?? -1)}` : null;
  useEffect(() => {
    if (!open || !userId || !scopeCode || stamp == null || !isFirebaseConfigured()) return;
    if (loadedFor.current === stamp) return;
    let alive = true;
    void loadRideRegionTotal(userId, scopeCode).then((r) => {
      if (!alive) return;
      loadedFor.current = stamp;
      setState({
        stamp,
        value: r && r.exists ? { status: "ready", meters: r.meters, sec: r.sec, rideCount: r.rideCount } : { status: "missing" },
      });
    });
    return () => {
      alive = false;
    };
  }, [open, userId, scopeCode, stamp]);
  if (stamp == null) return { status: "idle" };
  return state && state.stamp === stamp ? state.value : { status: "loading" };
}
