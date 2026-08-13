import type { User } from "firebase/auth";
import { deleteGlobalLivePresence, mergeGlobalLivePresence } from "./firestoreGlobalLivePresence";
import { deleteTrailLivePublicationRide } from "./firestoreTrailLivePublicationRides";
import { sanitizeTrailId } from "./firestoreTrail";
import type { LiveLocationSnapshot } from "./liveLocationSnapshot";
import { isFirebaseDatabaseConfigured } from "./firebase";
import { deleteTrailMotion } from "./rtdbTrailMotion";
import { enqueueMotionPublish, peekMotionPublishEpoch } from "./peerMotion/motionPublishFlight";
import { enqueueRoutePublish } from "./peerMotion/routePublishFlight";
import type { LiveLocationPublishThrottleState } from "./liveLocationSnapshot";
import { markPeerMotionPublished, markRouteProgressPublished } from "./liveLocationSnapshot";

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
    routeThrottle?: LiveLocationPublishThrottleState;
    routeEpoch?: number;
    motionEpoch?: number;
    onRouteError?: (e: unknown) => void;
    onMotionError?: (e: unknown) => void;
  },
): Promise<LiveLocationFanoutResult> {
  const result: LiveLocationFanoutResult = { global: false, route: false, motion: false };

  if (
    opts.publishMotion &&
    isFirebaseDatabaseConfigured() &&
    snapshot.routeReady &&
    snapshot.publicationId
  ) {
    const motionEpoch =
      typeof opts.motionEpoch === "number" && Number.isFinite(opts.motionEpoch)
        ? opts.motionEpoch
        : peekMotionPublishEpoch();
    enqueueMotionPublish({
      user,
      trailId: snapshot.trailId,
      snapshot,
      epoch: motionEpoch,
      onWriteStart: () => {
        if (opts.motionThrottle) {
          markPeerMotionPublished(opts.motionThrottle, Date.now(), snapshot.speedMps);
        }
      },
      onError: opts.onMotionError,
    });
    result.motion = true;
  }

  if (opts.publishGlobal) {
    await mergeGlobalLivePresence(user, snapshot.lngLat);
    result.global = true;
  }

  if (opts.publishRoute && snapshot.routeReady && snapshot.publicationId) {
    const epoch = opts.routeEpoch;
    if (typeof epoch === "number" && Number.isFinite(epoch)) {
      enqueueRoutePublish({
        user,
        trailId: snapshot.trailId,
        snapshot,
        epoch,
        onWriteStart: () => {
          if (opts.routeThrottle) {
            markRouteProgressPublished(
              opts.routeThrottle,
              Date.now(),
              snapshot.progressRatio,
              snapshot.distMetersAlongRoute,
              snapshot.speedMps,
            );
          }
        },
        onError: opts.onRouteError,
      });
      result.route = true;
    }
  }

  return result;
}

export async function cleanupLiveLocationPublish(
  uid: string,
  trailId: string,
  opts?: { skipRouteDelete?: boolean; skipMotionDelete?: boolean },
): Promise<void> {
  const tid = sanitizeTrailId(trailId);
  const tasks: Promise<void>[] = [deleteGlobalLivePresence(uid).catch(() => {})];
  if (!opts?.skipRouteDelete) {
    tasks.push(deleteTrailLivePublicationRide(uid, tid).catch(() => {}));
  }
  if (!opts?.skipMotionDelete) {
    tasks.push(deleteTrailMotion(uid, tid));
  }
  await Promise.all(tasks);
}
