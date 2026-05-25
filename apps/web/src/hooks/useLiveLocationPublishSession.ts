import { useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import {
  buildLiveLocationSnapshot,
  createLiveLocationPublishThrottleState,
  markGlobalPresencePublished,
  markRouteProgressPublished,
  shouldPublishGlobalPresence,
  shouldPublishRouteProgress,
  type LiveLocationPublishInput,
} from "../lib/liveLocationSnapshot";
import { cleanupLiveLocationPublish, publishLiveLocationFanout } from "../lib/publishLiveLocationFanout";
import { deleteTrailLiveCourseRide } from "../lib/firestoreTrailLiveCourseRides";
import { sanitizeTrailId } from "../lib/firestoreTrail";

const PUBLISH_TICK_MS = 1_000;

export type UseLiveLocationPublishSessionOpts = {
  user: User | null | undefined;
  /** global livePresence publish */
  globalEnabled: boolean;
  /** trails/.../liveCourseRides progress publish */
  routeEnabled: boolean;
  pageVisible: boolean;
  lngLat: LngLat | null;
  trailId: string;
  courseId: string | null;
  routeGeometry: LineStringGeometry | null;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
  onError?: (message: string) => void;
};

/**
 * 위치·진행률 compute once → global presence + route progress fan-out.
 * 단일 tick / throttle state — drift 방지.
 */
export function useLiveLocationPublishSession(opts: UseLiveLocationPublishSessionOpts): void {
  const {
    user,
    globalEnabled,
    routeEnabled,
    pageVisible,
    lngLat,
    trailId,
    courseId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters,
    onError,
  } = opts;

  const userRef = useRef(user);
  userRef.current = user ?? null;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const inputRef = useRef<LiveLocationPublishInput>({
    lngLat: null,
    trailId,
    courseId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters,
  });
  inputRef.current = {
    lngLat,
    trailId,
    courseId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters,
  };

  const flagsRef = useRef({ globalEnabled, routeEnabled, pageVisible });
  flagsRef.current = { globalEnabled, routeEnabled, pageVisible };

  useEffect(() => {
    const u = userRef.current;
    if (!u || !globalEnabled) return;

    if (!pageVisible) {
      void cleanupLiveLocationPublish(u.uid, trailId).catch(() => {});
      return;
    }

    const throttle = createLiveLocationPublishThrottleState();
    let routeDocActive = false;

    const reportError = (e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      onErrorRef.current?.(message);
    };

    const tick = async () => {
      const u2 = userRef.current;
      if (!u2) return;
      const { globalEnabled: ge, routeEnabled: re, pageVisible: pv } = flagsRef.current;
      if (!ge || !pv) return;

      const snapshot = buildLiveLocationSnapshot(inputRef.current);
      if (!snapshot) return;

      const now = Date.now();
      const publishGlobal = shouldPublishGlobalPresence(now, throttle, snapshot.lngLat);
      const publishRoute =
        re &&
        snapshot.routeReady &&
        shouldPublishRouteProgress(now, throttle, snapshot.progressRatio);

      if (!publishGlobal && !publishRoute) return;

      try {
        const result = await publishLiveLocationFanout(u2, snapshot, { publishGlobal, publishRoute });
        if (publishGlobal) markGlobalPresencePublished(throttle, now, snapshot.lngLat);
        if (publishRoute) {
          markRouteProgressPublished(throttle, now, snapshot.progressRatio);
          routeDocActive = true;
        }
        if (import.meta.env.DEV && (result.global || result.route)) {
          console.debug("[LiveLocationPublish]", {
            global: result.global,
            route: result.route,
            lngLat: snapshot.lngLat,
            progressRatio: snapshot.progressRatio,
            courseId: snapshot.courseId || null,
            trailId: snapshot.trailId,
          });
        }
      } catch (e) {
        reportError(e);
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, PUBLISH_TICK_MS);

    return () => {
      window.clearInterval(id);
      if (routeDocActive || flagsRef.current.routeEnabled) {
        void deleteTrailLiveCourseRide(u.uid, sanitizeTrailId(trailId)).catch(() => {});
      }
      void cleanupLiveLocationPublish(u.uid, trailId).catch(() => {});
    };
  }, [globalEnabled, pageVisible, routeEnabled, trailId, user?.uid]);
}
