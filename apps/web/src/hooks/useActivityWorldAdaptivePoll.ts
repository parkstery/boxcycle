import { useEffect, useRef } from "react";
import {
  activityWorldPollIntervalMs,
  resolveActivityWorldPollMode,
  type ActivityWorldPollMode,
} from "../lib/activityWorldPollPolicy";
import { getActivityWorldPollSignals, reportActivityWorldPollSignals } from "../lib/activityWorldPollSignals";

export type UseActivityWorldAdaptivePollOpts = {
  enabled: boolean;
  selfRideActive: boolean;
  /** full fetch — catalog·batch 등. 완료 후 signals 갱신은 호출 측에서 report */
  onTick: () => void | Promise<void>;
  /** tick 직후 mode 결정용(미지정 시 getActivityWorldPollSignals + selfRideActive) */
  resolveModeAfterTick?: () => ActivityWorldPollMode;
};

/**
 * WO-A: idle 5분 / active 30초 가변 setTimeout 체인.
 * Probe(onSnapshot) 없음 — 순수 C.
 */
export function useActivityWorldAdaptivePoll(opts: UseActivityWorldAdaptivePollOpts): void {
  const { enabled, selfRideActive, onTick, resolveModeAfterTick } = opts;
  const onTickRef = useRef(onTick);
  const resolveModeRef = useRef(resolveModeAfterTick);
  const selfRideRef = useRef(selfRideActive);
  onTickRef.current = onTick;
  resolveModeRef.current = resolveModeAfterTick;
  selfRideRef.current = selfRideActive;

  useEffect(() => {
    reportActivityWorldPollSignals({ selfRideActive });
  }, [selfRideActive]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

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

      const mode =
        resolveModeRef.current?.() ??
        resolveActivityWorldPollMode({
          ...getActivityWorldPollSignals(),
          selfRideActive: selfRideRef.current,
        });

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

    void runTick();

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