import { useCallback, useEffect, useRef } from "react";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../lib/trail/repo/firestoreTrail";

/** 일시정지가 이만큼 이어지면 주행을 끝낸다(2026-11-05 Chief D7). Trail 에는 남는다(대기). */
export const PAUSE_AUTO_END_MS = 600_000;

export type TrailPresenceStatus = "trailhead" | "waiting" | "riding" | "paused";

type RideStatus = "idle" | "running" | "paused";

type Opts = {
  rideStatus: RideStatus;
  /** 네비 Trail(URL `?trail=`) */
  trailId: string;
  routeGeometry: unknown;
  /** 대기 중 다른 경로를 불러오거나 경로를 지웠을 때 — Trail 에서만 나온다(새 경로는 그대로 둔다). */
  onRouteLeftTrail: () => void;
  /** 일시정지 10분 — 주행 종료(기록 저장), Trail 은 유지 */
  onPauseTimeout: () => void;
  /** Trail 에서 나온 순간(어떤 길로든) — 「최근 내가 달린 Trail」 10분 시작 */
  onTrailLeft?: (trailId: string) => void;
};

/**
 * Trail 수명주기(2026-11-05 Chief 시안 ①~⑥, [묶음](../../../../document/ops/20261105-trail-lifecycle/README.md)).
 *
 * - **주행 종료 ≠ Trail 나가기**: 종료 후 같은 Trail 대기로 남는다(App 의 종료 정리가 Trailhead 로 보내지 않는다).
 * - **대기 중 경로가 바뀌면 Trail 에서 나온다**: 그대로 두면 다음 「주행 시작」 이 다른 경로로 이 Trail 에 합류한다.
 *   Trail 경로를 불러오는 쪽(합류·URL 진입)은 먼저 {@link markTrailRoutePending} 을 불러 그 변경을 Trail 경로로 받아들인다.
 * - **Trail 진입 검증은 Trail 마다 한 번**: 종전에는 `rideStatus` 가 idle 로 돌아올 때마다 다시 돌아 Trail 경로를
 *   다시 불러왔다(주행 상태 초기화). 종료 후 대기로 남으면 그 재실행이 결과를 지운다.
 */
export function useTrailLifecycle({ rideStatus, trailId, routeGeometry, onRouteLeftTrail, onPauseTimeout, onTrailLeft }: Opts) {
  const tid = sanitizeTrailId(trailId);
  const onTrail = tid !== DEFAULT_TRAIL_ID;

  /** 이 Trail 의 경로로 본 geometry. "pending" = 다음에 들어오는 경로를 Trail 경로로 받는다. */
  const trailRouteRef = useRef<unknown>(null);
  const gateDoneForRef = useRef<string | null>(null);
  const leftRef = useRef(onRouteLeftTrail);
  const timeoutRef = useRef(onPauseTimeout);
  const trailLeftRef = useRef(onTrailLeft);
  useEffect(() => {
    leftRef.current = onRouteLeftTrail;
    timeoutRef.current = onPauseTimeout;
    trailLeftRef.current = onTrailLeft;
  }, [onRouteLeftTrail, onPauseTimeout, onTrailLeft]);

  const prevTidRef = useRef(tid);
  useEffect(() => {
    const prev = prevTidRef.current;
    prevTidRef.current = tid;
    if (prev !== tid && prev !== DEFAULT_TRAIL_ID) trailLeftRef.current?.(prev);
  }, [tid]);

  useEffect(() => {
    if (!onTrail) {
      if (trailRouteRef.current !== "pending") trailRouteRef.current = null;
      return;
    }
    if (rideStatus !== "idle") {
      trailRouteRef.current = routeGeometry;
      return;
    }
    const known = trailRouteRef.current;
    if (known === "pending" || known == null) {
      if (routeGeometry) trailRouteRef.current = routeGeometry;
      return;
    }
    if (routeGeometry !== known) {
      trailRouteRef.current = null;
      leftRef.current();
    }
  }, [onTrail, tid, rideStatus, routeGeometry]);

  useEffect(() => {
    if (rideStatus !== "paused") return;
    const t = window.setTimeout(() => timeoutRef.current(), PAUSE_AUTO_END_MS);
    return () => window.clearTimeout(t);
  }, [rideStatus]);

  const markTrailRoutePending = useCallback(() => {
    trailRouteRef.current = "pending";
  }, []);
  const isTrailGateDone = useCallback((id: string) => gateDoneForRef.current === id, []);
  const markTrailGateDone = useCallback((id: string) => {
    gateDoneForRef.current = id;
  }, []);

  const status: TrailPresenceStatus = !onTrail
    ? "trailhead"
    : rideStatus === "running"
      ? "riding"
      : rideStatus === "paused"
        ? "paused"
        : "waiting";

  return { status, markTrailRoutePending, isTrailGateDone, markTrailGateDone };
}
