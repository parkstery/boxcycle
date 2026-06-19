import type { User } from "firebase/auth";
import { deleteGlobalLivePresence, mergeGlobalLivePresence } from "./firestoreGlobalLivePresence";
import {
  deleteTrailLiveCourseRide,
  mergeTrailLiveCourseRideSnapshot,
} from "./firestoreTrailLiveCourseRides";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "./firestoreTrail";
import { touchTrailInstanceActivity } from "./firestoreTrailInstance";
import type { LiveLocationSnapshot } from "./liveLocationSnapshot";

export type LiveLocationFanoutResult = {
  global: boolean;
  route: boolean;
};

/** global livePresence + (선택) liveCourseRides progress — 좌표는 global only */
export async function publishLiveLocationFanout(
  user: User,
  snapshot: LiveLocationSnapshot,
  opts: { publishGlobal: boolean; publishRoute: boolean },
): Promise<LiveLocationFanoutResult> {
  const result: LiveLocationFanoutResult = { global: false, route: false };

  if (opts.publishGlobal) {
    await mergeGlobalLivePresence(user, snapshot.lngLat);
    result.global = true;
  }

  if (opts.publishRoute && snapshot.routeReady && snapshot.courseId) {
    await mergeTrailLiveCourseRideSnapshot(user, snapshot.trailId, {
      publicationId: snapshot.courseId,
      progressRatio: snapshot.progressRatio,
    });
    if (snapshot.trailId !== DEFAULT_TRAIL_ID) {
      void touchTrailInstanceActivity(snapshot.trailId);
    }
    result.route = true;
  }

  return result;
}

export async function cleanupLiveLocationPublish(uid: string, trailId: string): Promise<void> {
  const tid = sanitizeTrailId(trailId);
  await Promise.all([
    deleteGlobalLivePresence(uid).catch(() => {}),
    deleteTrailLiveCourseRide(uid, tid).catch(() => {}),
  ]);
}
