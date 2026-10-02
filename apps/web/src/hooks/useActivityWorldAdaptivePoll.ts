/* eslint-disable react-hooks/refs -- latest callback/mode refs for timeout chain (WO-A) */
import { useEffect, useRef } from "react";
import {
  activityWorldPollIntervalMs,
  resolveActivityWorldPollMode,
  type ActivityWorldPollMode,
} from "../lib/activity/activityWorldPollPolicy";
import {
  decideActivityWorldResume,
  type ActivityWorldResumeDecision,
} from "../lib/activity/activityWorldResumePolicy";
import { getActivityWorldPollSignals, reportActivityWorldPollSignals } from "../lib/activity/activityWorldPollSignals";

export type UseActivityWorldAdaptivePollOpts = {
  enabled: boolean;
  selfRideActive: boolean;
  /** full fetch — catalog·batch 등. 완료 후 signals 갱신은 호출 측에서 report */
  onTick: () => void | Promise<void>;
  /** tick 직후 mode 결정용(미지정 시 getActivityWorldPollSignals + selfRideActive) */
  resolveModeAfterTick?: () => ActivityWorldPollMode;
  /**
   * visibility 복귀 시 freshness — 미지정이면 항상 immediate (기존 동작).
   * lastSuccessAtMs 는 호출 측이 성공 tick 만 기록한다.
   */
  getLastSuccessAtMs?: () => number | null;
};

/**
 * WO-A: idle 10분 / active 60초 가변 setTimeout 체인.
 * Probe(onSnapshot) 없음 — 순수 C.
 * Fresh resume 은 즉시 tick 대신 남은 interval 을 스케줄한다.
 */
export function useActivityWorldAdaptivePoll(opts: UseActivityWorldAdaptivePollOpts): void {
  const { enabled, selfRideActive, onTick, resolveModeAfterTick, getLastSuccessAtMs } = opts;
  const onTickRef = useRef(onTick);
  const resolveModeRef = useRef(resolveModeAfterTick);
  const selfRideRef = useRef(selfRideActive);
  const getLastSuccessRef = useRef(getLastSuccessAtMs);
  onTickRef.current = onTick;
  resolveModeRef.current = resolveModeAfterTick;
  selfRideRef.current = selfRideActive;
  getLastSuccessRef.current = getLastSuccessAtMs;

  useEffect(() => {
    reportActivityWorldPollSignals({ selfRideActive });
  }, [selfRideActive]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const currentMode = (): ActivityWorldPollMode =>
      resolveModeRef.current?.() ??
      resolveActivityWorldPollMode({
        ...getActivityWorldPollSignals(),
        selfRideActive: selfRideRef.current,
      });

    const scheduleNext = (mode: ActivityWorldPollMode) => {
      if (cancelled) return;
      const delay = activityWorldPollIntervalMs(mode);
      timerId = window.setTimeout(() => {
        void runTick();
      }, delay);
    };

    const runTick = async () => {
      if (cancelled) return;
      reportActivityWorldPollSignals({ selfRideActive: selfRideRef.current });
      try {
        await onTickRef.current();
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn("[ActivityWorldPoll] tick failed", e);
        }
      }
      if (cancelled) return;

      const mode = currentMode();

      if (import.meta.env.DEV) {
        const sig = getActivityWorldPollSignals();
        console.debug("[ActivityWorldPoll]", {
          mode,
          nextMs: activityWorldPollIntervalMs(mode),
          livePulse: sig.worldLivePulseCount,
          batchLive: sig.lastBatchLiveCount,
          selfRide: selfRideRef.current,
        });
      }

      scheduleNext(mode);
    };

    const resumePlan = (): ActivityWorldResumeDecision => {
      const getter = getLastSuccessRef.current;
      if (!getter) return { action: "immediate" };
      return decideActivityWorldResume({
        lastSuccessAtMs: getter(),
        nowMs: Date.now(),
        freshnessIntervalMs: activityWorldPollIntervalMs(currentMode()),
        force: false,
      });
    };

    const plan = resumePlan();
    if (plan.action === "schedule") {
      timerId = window.setTimeout(() => {
        void runTick();
      }, plan.delayMs);
    } else {
      void runTick();
    }

    return () => {
      cancelled = true;
      if (timerId != null) window.clearTimeout(timerId);
    };
  }, [enabled, selfRideActive]);
}

/** refreshNonce 등 — 즉시 1회 tick (interval 리셋은 다음 scheduleNext) */
export function triggerActivityWorldPollImmediate(
  runTick: () => void | Promise<void>,
): void {
  void runTick();
}
