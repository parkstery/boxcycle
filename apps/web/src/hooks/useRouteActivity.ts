import type { User } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchRouteActivity,
  invalidateRouteActivityCache,
  markRouteActivityRideCompletedOptimistic,
  type RouteActivitySnapshot,
} from "../lib/firestoreRouteActivity";
import { resolveActivityWorldPollMode } from "../lib/activityWorldPollPolicy";
import { getActivityWorldPollSignals } from "../lib/activityWorldPollSignals";
import { useActivityWorldAdaptivePoll } from "./useActivityWorldAdaptivePoll";

export type UseRouteActivityOptions = {
  configured: boolean;
  user: User | null;
  publicationId: string | null;
  enabled: boolean;
  selfRideActive?: boolean;
};

/** publication 단위 routeActivity aggregate — adaptive getDoc polling */
export function useRouteActivity(options: UseRouteActivityOptions) {
  const { configured, user, publicationId, enabled, selfRideActive = false } = options;
  const [activity, setActivity] = useState<RouteActivitySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selfRideRef = useRef(selfRideActive);
  selfRideRef.current = selfRideActive;

  const reload = useCallback(async (opts?: { forceInvalidate?: boolean }) => {
    const id = publicationId?.trim();
    if (!configured || !user || !id) {
      setActivity(null);
      setError(null);
      return;
    }
    try {
      setError(null);
      if (opts?.forceInvalidate !== false) {
        invalidateRouteActivityCache([id]);
      }
      setActivity(await fetchRouteActivity(id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setActivity(null);
    }
  }, [configured, user, publicationId]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const applyRideCompletedOptimistic = useCallback(() => {
    const id = publicationId?.trim();
    if (!id) return;
    const row = markRouteActivityRideCompletedOptimistic(id);
    if (row) setActivity(row);
  }, [publicationId]);

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
