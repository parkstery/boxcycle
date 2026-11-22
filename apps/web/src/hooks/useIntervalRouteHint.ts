import { useState } from "react";
import { resolveIntervalRouteShortfall, type IntervalRouteHintVariant } from "../lib/route/intervalRouteDistance";

export type UseIntervalRouteHintInput = {
  /** 대기 상태(주행·일시정지 아님)에서만 안내한다 */
  idle: boolean;
  intervalEnabled: boolean;
  intervalSec: number;
  /** 인터벌 켜짐 + 설정을 가르는 키(`useRideInterval().runKey`) */
  intervalKey: string;
  /** 경로를 가르는 키. 경로 없음은 null */
  routeKey: string | null;
  /** 주행 시작 경고와 같은 남은 거리(m) — 이어 달리기 오프셋을 뺀 값 */
  remainingMeters: number;
  /** 간편 인터벌이 경로를 찾는 중 — 이때 적용된 경로에는 안내하지 않는다 */
  quickSearching: boolean;
  /** 인터벌 설정 창이 열려 있는 동안은 미룬다(창 위에 겹치지 않게) */
  deferred: boolean;
};

type Tracked = {
  routeKey: string | null;
  intervalKey: string;
  quickSearching: boolean;
  lastChanged: IntervalRouteHintVariant;
  /** 간편 인터벌이 만든 경로의 키 */
  quickRouteKey: string | null;
  /** 「확인」한 (경로 + 인터벌) 조합 — 같은 조합은 한 번만 */
  dismissed: readonly string[];
};

/**
 * 경로 거리 부족 안내(2026-10-29 Chief) — 인터벌을 마치기에 경로가 짧으면 대기 화면에서 한 번 알린다.
 * 「바뀜」은 effect 가 아니라 렌더 중 키 비교로 잡는다(useRideInterval 과 같은 방식).
 */
export function useIntervalRouteHint(input: UseIntervalRouteHintInput) {
  const [tracked, setTracked] = useState<Tracked>(() => ({
    routeKey: input.routeKey,
    intervalKey: input.intervalKey,
    quickSearching: input.quickSearching,
    lastChanged: "route",
    quickRouteKey: null,
    dismissed: [],
  }));

  let current = tracked;
  const routeChanged = tracked.routeKey !== input.routeKey;
  const intervalChanged = tracked.intervalKey !== input.intervalKey;
  if (routeChanged || intervalChanged || tracked.quickSearching !== input.quickSearching) {
    current = {
      ...tracked,
      routeKey: input.routeKey,
      intervalKey: input.intervalKey,
      quickSearching: input.quickSearching,
      lastChanged: routeChanged ? "route" : intervalChanged ? "interval" : tracked.lastChanged,
      // 탐색 종료와 경로 적용이 한 렌더에 묶여 와도 놓치지 않게 직전 값도 본다.
      quickRouteKey: routeChanged
        ? input.quickSearching || tracked.quickSearching
          ? input.routeKey
          : null
        : tracked.quickRouteKey,
    };
    setTracked(current);
  }

  const shortfall = resolveIntervalRouteShortfall({
    remainingMeters: input.remainingMeters,
    intervalSec: input.intervalSec,
  });
  const comboKey = input.routeKey == null ? null : `${input.routeKey}|${input.intervalKey}`;
  const open =
    input.idle &&
    input.intervalEnabled &&
    !input.deferred &&
    !input.quickSearching &&
    comboKey != null &&
    input.routeKey !== current.quickRouteKey &&
    shortfall.short &&
    !current.dismissed.includes(comboKey);

  return {
    open,
    variant: current.lastChanged,
    minKm: shortfall.minKm,
    routeKm: shortfall.routeKm,
    basisKmh: shortfall.basisKmh,
    dismiss: () => {
      if (comboKey == null) return;
      setTracked((prev) => (prev.dismissed.includes(comboKey) ? prev : { ...prev, dismissed: [...prev.dismissed, comboKey] }));
    },
  };
}
