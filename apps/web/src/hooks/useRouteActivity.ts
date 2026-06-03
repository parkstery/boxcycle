import type { User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import {
  fetchRouteActivity,
  invalidateRouteActivityCache,
  markRouteActivityRideCompletedOptimistic,
  type RouteActivitySnapshot,
} from "../lib/firestoreRouteActivity";
import { ROUTE_ACTIVITY_POLL_MS } from "../lib/rideSyncPolicy";

export type UseRouteActivityOptions = {
  configured: boolean;
  user: User | null;
  catalogRouteId: string | null;
  enabled: boolean;
};

/** 경로 단위 `routeActivity` aggregate — 저빈도 `getDoc` 폴링 */
export function useRouteActivity(options: UseRouteActivityOptions) {
  const { configured, user, catalogRouteId, enabled } = options;
  const [activity, setActivity] = useState<RouteActivitySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (options?: { forceInvalidate?: boolean }) => {
    const id = catalogRouteId?.trim();
    if (!configured || !user || !id) {
      setActivity(null);
      setError(null);
      return;
    }
    try {
      setError(null);
      if (options?.forceInvalidate !== false) {
        invalidateRouteActivityCache([id]);
      }
      const row = await fetchRouteActivity(id);
      setActivity(row);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setActivity(null);
    }
  }, [configured, user, catalogRouteId]);

  const applyRideCompletedOptimistic = useCallback(() => {
    const id = catalogRouteId?.trim();
    if (!id) return;
    const row = markRouteActivityRideCompletedOptimistic(id);
    if (row) setActivity(row);
  }, [catalogRouteId]);

  useEffect(() => {
    if (!enabled) {
      setActivity(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const tick = () => {
      void reload().then(() => {
        if (cancelled) return;
      });
    };
    tick();
    const id = window.setInterval(tick, ROUTE_ACTIVITY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, reload]);

  return { activity, error, reload, applyRideCompletedOptimistic };
}
