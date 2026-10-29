import { useCallback, useEffect, useRef, useState } from "react";
import { offsetLngLatByBearingMeters, type LngLat } from "../lib/geo/geo";
import { resolveDistanceAutoRouteGuideRadiusKm } from "../lib/route/distanceAutoRouteGuideRing";
import { resolveQuickIntervalTargetKm, runQuickIntervalAttempts } from "../lib/ride/quickIntervalRoute";
import type { RouteProfile } from "../services/mapboxDirections";
import type {
  DistanceAutoRouteArmResult,
  DistanceAutoRouteSearchResult,
  DistanceAutoRouteStep,
} from "./useDistanceAutoRoute";

export type QuickIntervalPhase = "idle" | "pick_start" | "searching" | "failed";

const QUICK_INTERVAL_PICK_START_MESSAGE = "출발 위치를 맵에서 클릭하세요";
const QUICK_INTERVAL_FAILED_MESSAGE =
  "이 근처에서 경로를 찾지 못했어요. 출발지를 바꿔 다시 시도하세요";
const FAILED_MESSAGE_VISIBLE_MS = 8000;

function formatQuickIntervalSearchingMessage(targetKm: number): string {
  return `목표 ${targetKm.toFixed(1)} km 경로를 찾는 중입니다…`;
}

export type UseQuickIntervalRideOptions = {
  /** 인터벌 총 시간(초) — 목표 거리(km)는 여기서 구한다 */
  intervalTotalSec: number;
  /** 행을 막는 조건 — 앞에서부터 처음 걸린 것이 비활성 사유가 된다 */
  blockedReason: {
    rideLocked: boolean;
    routeTokenInsufficient: boolean;
    signedOut: boolean;
    historyLoading: boolean;
  };
  /** 시작 직전 정리(메뉴 닫기 등). 마지막 주행 종료점이 있으면 그 좌표를 받는다 */
  onBeforeStart: (anchor: LngLat | null) => void;
  /** 마지막 유효 주행 종료점 — App 의 `lastRideEntryTarget` 과 같은 계산. 없으면 null */
  lastRideEnd: LngLat | null;
  /** useDistanceAutoRoute 의 step — 다른 경로 진입이 disarm 하면 안내를 거둔다 */
  autoRouteStep: DistanceAutoRouteStep;
  /** 출발 지점을 확정하고 App 상태(Start·End·이동수단)를 정리한다. 이동수단은 이어 달리기 승계 규칙을 따른다 */
  prepareStart: (
    anchor: LngLat,
    targetKm: number,
  ) => { ok: true; profile: RouteProfile } | { ok: false; message: string };
  armStartPick: (input: {
    message: string;
    onPicked: (lngLat: LngLat) => Promise<DistanceAutoRouteSearchResult | null>;
  }) => DistanceAutoRouteArmResult;
  searchTowardPoint: (input: {
    start: LngLat;
    point: LngLat;
    targetKm: number;
    profile: RouteProfile;
  }) => Promise<DistanceAutoRouteSearchResult | null>;
  disarm: () => void;
  /** 경로가 적용된 직후 — 인터벌을 켠다. 주행은 시작하지 않는다 */
  onFound: () => void;
  /** 시험 주입용. 기본 Math.random */
  random?: () => number;
};

/**
 * 간편 인터벌 주행 — 인터벌 길이에 맞는 경로를 무작위 방향으로 만든다.
 * 요청·적용은 `useDistanceAutoRoute.searchTowardPoint` 를 그대로 쓰고, 여기서는 순서만 맡는다.
 */
export function useQuickIntervalRide(options: UseQuickIntervalRideOptions) {
  const [phase, setPhase] = useState<QuickIntervalPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);
  /** 새 시작·취소마다 올려, 늦게 끝난 이전 실행이 상태를 덮지 않게 한다 */
  const runRef = useRef(0);
  const failedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFailedTimer = useCallback(() => {
    if (failedTimerRef.current) clearTimeout(failedTimerRef.current);
    failedTimerRef.current = null;
  }, []);

  const search = useCallback(
    async (anchor: LngLat, intervalTotalSec?: number): Promise<DistanceAutoRouteSearchResult | null> => {
      const { prepareStart } = optionsRef.current;
      const targetKm = resolveQuickIntervalTargetKm(intervalTotalSec ?? optionsRef.current.intervalTotalSec);
      const prepared = prepareStart(anchor, targetKm);
      if (!prepared.ok) {
        setPhase("failed");
        setMessage(prepared.message);
        return null;
      }
      const run = ++runRef.current;
      setPhase("searching");
      setMessage(formatQuickIntervalSearchingMessage(targetKm));
      const radiusMeters = resolveDistanceAutoRouteGuideRadiusKm(targetKm) * 1000;
      const result = await runQuickIntervalAttempts({
        random: optionsRef.current.random,
        search: async (bearingDeg) => {
          const point = offsetLngLatByBearingMeters(anchor, bearingDeg, radiusMeters);
          const outcome = await optionsRef.current.searchTowardPoint({
            start: anchor,
            point,
            targetKm,
            profile: prepared.profile,
          });
          if (runRef.current !== run || outcome === null) return "cancelled";
          return outcome.status === "found" ? "found" : "failed";
        },
      });
      if (runRef.current !== run) return null;
      if (result.status === "found") {
        optionsRef.current.disarm();
        optionsRef.current.onFound();
        setPhase("idle");
        setMessage(null);
        return { status: "found", message: "" };
      }
      if (result.status === "cancelled") {
        setPhase("idle");
        setMessage(null);
        return null;
      }
      optionsRef.current.disarm();
      setPhase("failed");
      setMessage(QUICK_INTERVAL_FAILED_MESSAGE);
      failedTimerRef.current = setTimeout(() => {
        if (runRef.current === run) {
          setPhase("idle");
          setMessage(null);
        }
      }, FAILED_MESSAGE_VISIBLE_MS);
      return { status: "failed", message: QUICK_INTERVAL_FAILED_MESSAGE };
    },
    [],
  );

  /**
   * 인터벌 운동 창 「간편 인터벌」. `intervalTotalSec` 은 창에서 막 적용한 값 —
   * 적용 직후 같은 틱에는 options 가 아직 옛 값이라 직접 넘긴다.
   */
  const start = useCallback((intervalTotalSec?: number) => {
    clearFailedTimer();
    runRef.current += 1;
    const { lastRideEnd, armStartPick, onBeforeStart } = optionsRef.current;
    onBeforeStart(lastRideEnd);
    if (lastRideEnd) {
      void search(lastRideEnd, intervalTotalSec);
      return;
    }
    const armed = armStartPick({
      message: QUICK_INTERVAL_PICK_START_MESSAGE,
      onPicked: (lngLat) => search(lngLat, intervalTotalSec),
    });
    if (!armed.ok) {
      setPhase("failed");
      setMessage(armed.message);
      return;
    }
    setPhase("pick_start");
    setMessage(QUICK_INTERVAL_PICK_START_MESSAGE);
  }, [clearFailedTimer, search]);

  const cancel = useCallback(() => {
    clearFailedTimer();
    runRef.current += 1;
    setPhase("idle");
    setMessage(null);
  }, [clearFailedTimer]);

  // 다른 경로 진입이 disarm 하면(step 이 closed) 대기·탐색 안내를 거둔다. 실패 안내는 그대로 둔다.
  const closedByOthers =
    options.autoRouteStep === "closed" && (phase === "pick_start" || phase === "searching");
  const visiblePhase: QuickIntervalPhase = closedByOthers ? "idle" : phase;

  const blocked = options.blockedReason;
  const disabledReason = blocked.rideLocked
    ? "주행 중에는 사용할 수 없어요"
    : blocked.routeTokenInsufficient
      ? "Route Token이 부족해요"
      : blocked.signedOut
        ? "게스트 시작 또는 로그인 후 사용할 수 있어요"
        : blocked.historyLoading
          ? "최근 주행 기록을 불러오는 중이에요"
          : null;

  return {
    disabledReason,
    phase: visiblePhase,
    message: visiblePhase === "idle" ? null : message,
    start,
    cancel,
  };
}
