import type { User } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCourseActivity,
  invalidateCourseActivityCache,
  markCourseActivityRideCompletedOptimistic,
  type CourseActivitySnapshot,
} from "../lib/firestoreCourseActivity";
import { resolveActivityWorldPollMode } from "../lib/activityWorldPollPolicy";
import { getActivityWorldPollSignals } from "../lib/activityWorldPollSignals";
import { useActivityWorldAdaptivePoll } from "./useActivityWorldAdaptivePoll";

export type UseCourseActivityOptions = {
  configured: boolean;
  user: User | null;
  courseId: string | null;
  /** 포그라운드·코스가 있을 때만 폴링 */
  enabled: boolean;
  /** WO-A: 본인 주행 중이면 active(30s) interval */
  selfRideActive?: boolean;
};

/**
 * 코스 단위 activity aggregate — WO-A adaptive `getDoc` (idle 5분 / active 30초).
 */
export function useCourseActivity(options: UseCourseActivityOptions) {
  const { configured, user, courseId, enabled, selfRideActive = false } = options;
  const [activity, setActivity] = useState<CourseActivitySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selfRideRef = useRef(selfRideActive);
  selfRideRef.current = selfRideActive;

  const reload = useCallback(async (options?: { forceInvalidate?: boolean }) => {
    const cid = courseId?.trim();
    if (!configured || !user || !cid) {
      setActivity(null);
      setError(null);
      return;
    }
    try {
      setError(null);
      if (options?.forceInvalidate !== false) {
        invalidateCourseActivityCache([cid]);
      }
      const row = await fetchCourseActivity(cid);
      setActivity(row);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setActivity(null);
    }
  }, [configured, user, courseId]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  /** `handleEndRide` 직후 — 캐시 낙관을 React state에 즉시 반영(비동기 reload 대기 없음) */
  const applyRideCompletedOptimistic = useCallback(() => {
    const cid = courseId?.trim();
    if (!cid) return;
    const row = markCourseActivityRideCompletedOptimistic(cid);
    if (row) setActivity(row);
  }, [courseId]);

  useEffect(() => {
    if (!enabled) {
      setActivity(null);
      setError(null);
    }
  }, [enabled]);

  useActivityWorldAdaptivePoll({
    enabled,
    selfRideActive,
    onTick: () => reloadRef.current({ forceInvalidate: false }),
    resolveModeAfterTick: () =>
      resolveActivityWorldPollMode({
        ...getActivityWorldPollSignals(),
        selfRideActive: selfRideRef.current,
      }),
  });

  return { activity, error, reload, applyRideCompletedOptimistic };
}
