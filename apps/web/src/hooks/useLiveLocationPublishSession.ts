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
import { mergeGlobalLivePresence } from "../lib/firestoreGlobalLivePresence";
import { deleteTrailLivePublicationRide } from "../lib/firestoreTrailLivePublicationRides";
import { flushRideJoinPresenceBurst } from "../lib/rideJoinPresenceBurst";
import { sanitizeTrailId } from "../lib/firestoreTrail";

const PUBLISH_TICK_MS = 1_000;

export type UseLiveLocationPublishSessionOpts = {
  user: User | null | undefined;
  /** global livePresence publish */
  globalEnabled: boolean;
  /** trails/.../livePublicationRides progress publish */
  routeEnabled: boolean;
  pageVisible: boolean;
  lngLat: LngLat | null;
  trailId: string;
  publicationId: string | null;
  routeGeometry: LineStringGeometry | null;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
  /** 주행 시작( idle→running )마다 +1 — join burst 1회 */
  joinBurstNonce?: number;
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
    publicationId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters,
    joinBurstNonce = 0,
    onError,
  } = opts;

  const userRef = useRef(user);
  userRef.current = user ?? null;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const inputRef = useRef<LiveLocationPublishInput>({
    lngLat: null,
    trailId,
    publicationId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters,
  });
  inputRef.current = {
    lngLat,
    trailId,
    publicationId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters,
  };

  const flagsRef = useRef({ globalEnabled, routeEnabled, pageVisible });
  flagsRef.current = { globalEnabled, routeEnabled, pageVisible };

  const throttleRef = useRef(createLiveLocationPublishThrottleState());
  const joinBurstDoneNonceRef = useRef(0);

  const reportErrorRef = useRef((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    onErrorRef.current?.(message);
  });

  /** idle→running — 스로틀·ensure 대기 없이 세션+progress 즉시 1회 기록 */
  useEffect(() => {
    if (!joinBurstNonce || joinBurstNonce <= joinBurstDoneNonceRef.current) return;

    let cancelled = false;
    const reportError = (e: unknown) => {
      if (!cancelled) reportErrorRef.current(e);
    };

    const attempt = async (): Promise<boolean> => {
      const u = userRef.current;
      if (!u || !flagsRef.current.pageVisible) return false;
      const snapshot = buildLiveLocationSnapshot(inputRef.current);
      if (!snapshot?.routeReady) return false;
      try {
        await flushRideJoinPresenceBurst(u, snapshot);
        if (flagsRef.current.globalEnabled) {
          await mergeGlobalLivePresence(u, snapshot.lngLat);
        }
        if (cancelled) return false;
        const now = Date.now();
        markRouteProgressPublished(throttleRef.current, now, snapshot.progressRatio);
        if (flagsRef.current.globalEnabled) {
          markGlobalPresencePublished(throttleRef.current, now, snapshot.lngLat);
        }
        joinBurstDoneNonceRef.current = joinBurstNonce;
        if (import.meta.env.DEV) {
          console.debug("[LiveLocationPublish] join burst", {
            progressRatio: snapshot.progressRatio,
            publicationId: snapshot.publicationId,
            trailId: snapshot.trailId,
          });
        }
        return true;
      } catch (e) {
        reportError(e);
        return false;
      }
    };

    void attempt();
    const retryId = window.setInterval(() => {
      void attempt().then((ok) => {
        if (ok) window.clearInterval(retryId);
      });
    }, 300);
    const stopId = window.setTimeout(() => window.clearInterval(retryId), 4_000);

    return () => {
      cancelled = true;
      window.clearInterval(retryId);
      window.clearTimeout(stopId);
    };
  }, [joinBurstNonce, publicationId, routeGeometry, pageVisible, user?.uid]);

  useEffect(() => {
    const u = userRef.current;
    if (!u || !globalEnabled) return;

    if (!pageVisible) {
      void cleanupLiveLocationPublish(u.uid, trailId).catch(() => {});
      return;
    }

    const throttle = throttleRef.current;
    let routeDocActive = false;

    const reportError = (e: unknown) => {
      reportErrorRef.current(e);
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
            publicationId: snapshot.publicationId || null,
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
        void deleteTrailLivePublicationRide(u.uid, sanitizeTrailId(trailId)).catch(() => {});
      }
      void cleanupLiveLocationPublish(u.uid, trailId).catch(() => {});
    };
  }, [globalEnabled, pageVisible, routeEnabled, trailId, user?.uid]);
}
