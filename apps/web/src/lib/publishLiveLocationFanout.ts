import type { User } from "firebase/auth";
import { deleteGlobalLivePresence, mergeGlobalLivePresence } from "./firestoreGlobalLivePresence";
import {
  deleteTrailLivePublicationRide,
  mergeTrailLivePublicationRideSnapshot,
} from "./firestoreTrailLivePublicationRides";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "./firestoreTrail";
import { touchTrailInstanceActivity } from "./firestoreTrailInstance";
import type { LiveLocationSnapshot } from "./liveLocationSnapshot";
import { isFirebaseDatabaseConfigured } from "./firebase";
import { deleteTrailMotion } from "./rtdbTrailMotion";
import { enqueueMotionPublish } from "./peerMotion/motionPublishFlight";
import type { LiveLocationPublishThrottleState } from "./liveLocationSnapshot";
import { markPeerMotionPublished } from "./liveLocationSnapshot";
import { peerSyncChainLog } from "./peerMotion/peerSyncChainLog";

export type LiveLocationFanoutResult = {
  global: boolean;
  route: boolean;
  motion: boolean;
  motionOk?: boolean;
  motionRttMs?: number;
};

/** global livePresence + Firestore 1Hz presence/heat + (선택) RTDB 5Hz motion */
export async function publishLiveLocationFanout(
  user: User,
  snapshot: LiveLocationSnapshot,
  opts: {
    publishGlobal: boolean;
    publishRoute: boolean;
    publishMotion?: boolean;
    motionThrottle?: LiveLocationPublishThrottleState;
  },
): Promise<LiveLocationFanoutResult> {
  const result: LiveLocationFanoutResult = { global: false, route: false, motion: false };

  // S3A: motion 은 Firestore await 앞에 독립 kick. fan-out 은 motion write 를 기다리지 않는다.
  if (
    opts.publishMotion &&
    isFirebaseDatabaseConfigured() &&
    snapshot.routeReady &&
    snapshot.publicationId
  ) {
    enqueueMotionPublish({
      user,
      trailId: snapshot.trailId,
      snapshot,
      onWriteStart: () => {
        if (opts.motionThrottle) {
          markPeerMotionPublished(opts.motionThrottle, Date.now(), snapshot.speedMps);
        }
      },
    });
    result.motion = true;
  }

  if (opts.publishGlobal) {
    await mergeGlobalLivePresence(user, snapshot.lngLat);
    result.global = true;
  }

  if (opts.publishRoute && snapshot.routeReady && snapshot.publicationId) {
    // S3B-2: Firestore 쓰기량 계측 (pt9). 텍스트 파싱 금지 — 방출 건수로 센다.
    const fsWriteStartAt = Date.now();
    try {
      await mergeTrailLivePublicationRideSnapshot(user, snapshot.trailId, {
        publicationId: snapshot.publicationId,
        progressRatio: snapshot.progressRatio,
        distMeters: snapshot.distMetersAlongRoute,
        speedMps: snapshot.speedMps,
        ridePhase: snapshot.routeRidePhase,
      });
      if (import.meta.env.DEV) {
        const fsWriteDoneAt = Date.now();
        peerSyncChainLog(9, null, {
          fsWriteStartAt,
          fsWriteDoneAt,
          fsWriteRttMs: fsWriteDoneAt - fsWriteStartAt,
          ok: 1,
          uid: user.uid.slice(0, 6),
        });
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        const fsWriteDoneAt = Date.now();
        peerSyncChainLog(9, null, {
          fsWriteStartAt,
          fsWriteDoneAt,
          fsWriteRttMs: fsWriteDoneAt - fsWriteStartAt,
          ok: 0,
          uid: user.uid.slice(0, 6),
        });
      }
      throw e;
    }
    if (snapshot.trailId !== DEFAULT_TRAIL_ID) {
      void touchTrailInstanceActivity(snapshot.trailId);
    }
    result.route = true;
  }

  return result;
}

export async function cleanupLiveLocationPublish(
  uid: string,
  trailId: string,
  opts?: { skipRouteDelete?: boolean },
): Promise<void> {
  const tid = sanitizeTrailId(trailId);
  const tasks: Promise<void>[] = [deleteGlobalLivePresence(uid).catch(() => {})];
  if (!opts?.skipRouteDelete) {
    tasks.push(deleteTrailLivePublicationRide(uid, tid).catch(() => {}));
  }
  tasks.push(deleteTrailMotion(uid, tid));
  await Promise.all(tasks);
}
