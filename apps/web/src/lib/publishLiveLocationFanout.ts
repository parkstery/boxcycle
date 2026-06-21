import type { User } from "firebase/auth";
import { deleteGlobalLivePresence, mergeGlobalLivePresence } from "./firestoreGlobalLivePresence";
import {
  deleteTrailLivePublicationRide,
  mergeTrailLivePublicationRideSnapshot,
} from "./firestoreTrailLivePublicationRides";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "./firestoreTrail";
import { touchTrailInstanceActivity } from "./firestoreTrailInstance";
import type { LiveLocationSnapshot } from "./liveLocationSnapshot";

export type LiveLocationFanoutResult = {
  global: boolean;
  route: boolean;
};

/** global livePresence + (선택) livePublicationRides progress — 좌표는 global only */
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

  if (opts.publishRoute && snapshot.routeReady && snapshot.publicationId) {
    await mergeTrailLivePublicationRideSnapshot(user, snapshot.trailId, {
      publicationId: snapshot.publicationId,
      progressRatio: snapshot.progressRatio,
      distMeters: snapshot.distMetersAlongRoute,
      speedMps: snapshot.speedMps,
      ridePhase: snapshot.routeRidePhase,
    });
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
  await Promise.all(tasks);
}
