import { useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import {
  buildLiveLocationSnapshot,
  createLiveLocationPublishThrottleState,
  markGlobalPresencePublished,
  markPeerMotionPublished,
  markRouteProgressPublished,
  shouldPublishGlobalPresence,
  shouldPublishPeerMotion,
  shouldPublishRouteProgress,
  type LiveLocationPublishInput,
} from "../lib/liveLocationSnapshot";
import { isFirebaseDatabaseConfigured } from "../lib/firebase";
import { cleanupLiveLocationPublish, publishLiveLocationFanout } from "../lib/publishLiveLocationFanout";
import { mergeGlobalLivePresence } from "../lib/firestoreGlobalLivePresence";
import { setPeerSyncSelfDistM } from "../lib/peerMotion/peerSyncDebug";
import {
  finalizeAndDeleteTrailLivePublicationRide,
  deleteTrailLivePublicationRide,
} from "../lib/firestoreTrailLivePublicationRides";
import { flushRideJoinPresenceBurst } from "../lib/rideJoinPresenceBurst";
import { sanitizeTrailId } from "../lib/firestoreTrail";
import { deleteTrailMotion } from "../lib/rtdbTrailMotion";
import {
  awaitRouteFlightSettled,
  cancelRoutePublish,
  isRouteSessionLive,
  nextRoutePublishEpoch,
  requestRouteRowCleanup,
} from "../lib/peerMotion/routePublishFlight";
import {
  awaitMotionFlightSettled,
  cancelMotionPublish,
  isMotionSessionLive,
  nextMotionPublishEpoch,
  requestMotionNodeCleanup,
} from "../lib/peerMotion/motionPublishFlight";
import { MOTION_FLIGHT_DRAIN_TIMEOUT_MS, ROUTE_FLIGHT_DRAIN_TIMEOUT_MS } from "../lib/rideSyncPolicy";

const PUBLISH_TICK_MS = 100;

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
  speedKmh?: number;
  /** running=live, paused=paused */
  routeRidePhase?: "live" | "paused";
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
    speedKmh = 0,
    routeRidePhase = "live",
    joinBurstNonce = 0,
    onError,
  } = opts;

  const userRef = useRef(user);
  const onErrorRef = useRef(onError);

  const inputRef = useRef<LiveLocationPublishInput>({
    lngLat: null,
    trailId,
    publicationId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters,
    speedKmh,
    routeRidePhase,
  });

  const flagsRef = useRef({ globalEnabled, routeEnabled, pageVisible });

  useEffect(() => {
    userRef.current = user ?? null;
    onErrorRef.current = onError;
    inputRef.current = {
      lngLat,
      trailId,
      publicationId,
      routeGeometry,
      routeDistanceMeters,
      virtualDistanceMeters,
      speedKmh,
      routeRidePhase,
    };
    flagsRef.current = { globalEnabled, routeEnabled, pageVisible };
  }, [
    user,
    onError,
    lngLat,
    trailId,
    publicationId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters,
    speedKmh,
    routeRidePhase,
    globalEnabled,
    routeEnabled,
    pageVisible,
  ]);

  const throttleRef = useRef(createLiveLocationPublishThrottleState());
  const joinBurstDoneNonceRef = useRef(0);
  const publishBurstRef = useRef<(() => void) | null>(null);
  const routeEpochRef = useRef(0);
  const motionEpochRef = useRef(0);

  const reportErrorRef = useRef((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    onErrorRef.current?.(message);
  });

  /**
   * S4-1R / S4-1R2 — cancel → settle → (세션 소유권 확인) → delete.
   * 삭제가 정착보다 앞서지 않고, 시간 초과 시 안전 삭제는 **늦은 쓰기가 실제로 끝난 뒤**에 돈다.
   * 같은 세션 키의 새 세션이 이미 시작됐으면 옛 정리는 아무것도 하지 않는다.
   */
  async function drainRouteFlightThen(
    epoch: number,
    sessionKey: string,
    afterSettled: () => Promise<void>,
    safetyDelete?: () => Promise<void>,
  ): Promise<void> {
    cancelRoutePublish(epoch);
    const settled = await awaitRouteFlightSettled(ROUTE_FLIGHT_DRAIN_TIMEOUT_MS);
    if (isRouteSessionLive(sessionKey)) return; // 새 세션이 이 행의 주인이다
    await afterSettled();
    if (!settled && safetyDelete) {
      requestRouteRowCleanup({ epoch, sessionKey, run: safetyDelete });
    }
  }

  async function drainMotionFlightThen(
    epoch: number,
    sessionKey: string,
    afterSettled: () => Promise<void>,
    safetyDelete?: () => Promise<void>,
  ): Promise<void> {
    cancelMotionPublish(epoch);
    const settled = await awaitMotionFlightSettled(MOTION_FLIGHT_DRAIN_TIMEOUT_MS);
    if (!settled && safetyDelete) {
      requestMotionNodeCleanup({ epoch, sessionKey, run: safetyDelete });
    }
    if (isMotionSessionLive(sessionKey)) return;
    await afterSettled();
  }

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
      const { globalEnabled: ge, routeEnabled: re } = flagsRef.current;
      if (!ge && !re) return false;

      const snapshot = buildLiveLocationSnapshot(inputRef.current);
      if (!snapshot) return false;
      if (re && !snapshot.routeReady) return false;

      try {
        if (re) {
          await flushRideJoinPresenceBurst(u, snapshot);
        }
        if (ge) {
          await mergeGlobalLivePresence(u, snapshot.lngLat);
        }
        if (cancelled) return false;
        const now = Date.now();
        if (re) {
          markRouteProgressPublished(
            throttleRef.current,
            now,
            snapshot.progressRatio,
            snapshot.distMetersAlongRoute,
            snapshot.speedMps,
          );
          if (isFirebaseDatabaseConfigured()) {
            markPeerMotionPublished(throttleRef.current, now, snapshot.speedMps);
          }
        }
        if (ge) {
          markGlobalPresencePublished(throttleRef.current, now, snapshot.lngLat);
        }
        joinBurstDoneNonceRef.current = joinBurstNonce;
        if (import.meta.env.DEV) {
          console.debug("[LiveLocationPublish] join burst", {
            progressRatio: snapshot.progressRatio,
            distMeters: snapshot.distMetersAlongRoute,
            speedMps: snapshot.speedMps,
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
    if (!u) return;
    if (!globalEnabled && !routeEnabled) return;

    if (!pageVisible) {
      const epoch = routeEpochRef.current;
      const motionEpoch = motionEpochRef.current;
      const sessionKey = `${u.uid}|${sanitizeTrailId(trailId)}`;
      const tid = sanitizeTrailId(trailId);
      void Promise.all([
        drainRouteFlightThen(
          epoch,
          sessionKey,
          async () => {
            await cleanupLiveLocationPublish(u.uid, trailId, { skipMotionDelete: true }).catch(() => {});
          },
          async () => {
            await deleteTrailLivePublicationRide(u.uid, tid).catch(() => {});
          },
        ),
        drainMotionFlightThen(
          motionEpoch,
          sessionKey,
          async () => {
            await deleteTrailMotion(u.uid, tid);
          },
          async () => {
            await deleteTrailMotion(u.uid, tid);
          },
        ),
      ]);
      return;
    }

    const sessionKey = `${u.uid}|${sanitizeTrailId(trailId)}`;
    const epoch = nextRoutePublishEpoch(sessionKey);
    const motionEpoch = nextMotionPublishEpoch(sessionKey);
    routeEpochRef.current = epoch;
    motionEpochRef.current = motionEpoch;
    const throttle = throttleRef.current;
    let routeDocActive = false;

    const reportError = (e: unknown) => {
      reportErrorRef.current(e);
    };

    const tick = async () => {
      const u2 = userRef.current;
      if (!u2) return;
      const { globalEnabled: ge, routeEnabled: re, pageVisible: pv } = flagsRef.current;
      if (!pv || (!ge && !re)) return;

      const snapshot = buildLiveLocationSnapshot(inputRef.current);
      if (!snapshot) return;
      if (import.meta.env.DEV) setPeerSyncSelfDistM(snapshot.distMetersAlongRoute);

      const now = Date.now();
      const publishGlobal = ge && shouldPublishGlobalPresence(now, throttle, snapshot.lngLat);
      const publishMotion =
        re &&
        isFirebaseDatabaseConfigured() &&
        snapshot.routeReady &&
        shouldPublishPeerMotion(now, throttle, snapshot.speedMps);
      const publishRoute =
        re &&
        snapshot.routeReady &&
        shouldPublishRouteProgress(
          now,
          throttle,
          snapshot.progressRatio,
          snapshot.distMetersAlongRoute,
          snapshot.speedMps,
        );

      if (!publishGlobal && !publishRoute && !publishMotion) return;

      try {
        const result = await publishLiveLocationFanout(u2, snapshot, {
          publishGlobal,
          publishRoute,
          publishMotion,
          motionThrottle: throttle,
          routeThrottle: throttle,
          routeEpoch: epoch,
          motionEpoch,
          onRouteError: reportError,
          onMotionError: reportError,
        });
        if (publishGlobal) markGlobalPresencePublished(throttle, now, snapshot.lngLat);
        if (publishRoute) {
          routeDocActive = true;
        }
        if (import.meta.env.DEV && (result.global || result.route || result.motion)) {
          console.debug("[LiveLocationPublish]", {
            global: result.global,
            route: result.route,
            motion: result.motion,
            lngLat: snapshot.lngLat,
            progressRatio: snapshot.progressRatio,
            distMeters: snapshot.distMetersAlongRoute,
            speedMps: snapshot.speedMps,
            publicationId: snapshot.publicationId || null,
            trailId: snapshot.trailId,
            epoch,
          });
        }
      } catch (e) {
        reportError(e);
      }
    };

    void tick();
    publishBurstRef.current = () => {
      void tick();
    };
    const id = window.setInterval(() => {
      void tick();
    }, PUBLISH_TICK_MS);

    return () => {
      publishBurstRef.current = null;
      window.clearInterval(id);
      const tid = sanitizeTrailId(trailId);
      const snap = buildLiveLocationSnapshot(inputRef.current);
      const hadRoute = routeDocActive || flagsRef.current.routeEnabled;
      const sessionEpoch = epoch;
      const sessionMotionEpoch = motionEpoch;
      void Promise.all([
        drainRouteFlightThen(
          sessionEpoch,
          sessionKey,
          async () => {
            if (hadRoute && snap?.routeReady && snap.publicationId) {
              await finalizeAndDeleteTrailLivePublicationRide(u, tid, {
                publicationId: snap.publicationId,
                progressRatio: snap.progressRatio,
                distMeters: snap.distMetersAlongRoute,
              });
              await cleanupLiveLocationPublish(u.uid, trailId, {
                skipRouteDelete: true,
                skipMotionDelete: true,
              }).catch(() => {});
            } else {
              if (hadRoute) {
                await deleteTrailLivePublicationRide(u.uid, tid).catch(() => {});
              }
              await cleanupLiveLocationPublish(u.uid, trailId, { skipMotionDelete: true }).catch(
                () => {},
              );
            }
          },
          async () => {
            await deleteTrailLivePublicationRide(u.uid, tid).catch(() => {});
          },
        ),
        drainMotionFlightThen(
          sessionMotionEpoch,
          sessionKey,
          async () => {
            await deleteTrailMotion(u.uid, tid);
          },
          async () => {
            await deleteTrailMotion(u.uid, tid);
          },
        ),
      ]);
    };
  }, [globalEnabled, pageVisible, routeEnabled, trailId, publicationId, user?.uid]);

  /**
   * 목표 속도 변경 — 스로틀 우회 즉시 fan-out.
   * 케이던스 입력은 샘플마다 미세하게 흔들리므로 정수 km/h 가 바뀔 때만 burst 한다
   * (슬라이더 최소 단위가 1km/h 라 체험 모드 동작은 그대로다).
   */
  const speedBurstKmhRef = useRef<number | null>(null);
  useEffect(() => {
    const rounded = Math.round(speedKmh);
    if (speedBurstKmhRef.current == null) {
      speedBurstKmhRef.current = rounded;
      return;
    }
    if (speedBurstKmhRef.current === rounded) return;
    speedBurstKmhRef.current = rounded;
    const throttle = throttleRef.current;
    throttle.motionWriteAt = 0;
    throttle.motionSpeedMps = -1;
    throttle.routeWriteAt = 0;
    throttle.routeSpeedMps = -1;
    publishBurstRef.current?.();
  }, [speedKmh]);
}
