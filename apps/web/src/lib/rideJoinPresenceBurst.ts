import type { User } from "firebase/auth";
import { upsertPublicationSessionMember } from "./firestorePublicationSessionPresence";
import { mergeTrailLivePublicationRideSnapshot } from "./firestoreTrailLivePublicationRides";
import { DEFAULT_TRAIL_ID } from "./firestoreTrail";
import { touchTrailInstanceActivity } from "./firestoreTrailInstance";
import type { LiveLocationSnapshot } from "./liveLocationSnapshot";
import { isFirebaseDatabaseConfigured } from "./firebase";
import { enqueueMotionPublish, peekMotionPublishEpoch } from "./peerMotion/motionPublishFlight";

/** 주행 시작 직후 1회 — 세션 멤버 + livePublicationRides (스로틀 우회) */
export async function flushRideJoinPresenceBurst(
  user: User,
  snapshot: LiveLocationSnapshot,
): Promise<void> {
  if (!snapshot.routeReady || !snapshot.publicationId.trim()) return;

  await Promise.all([
    upsertPublicationSessionMember(user, snapshot.publicationId),
    mergeTrailLivePublicationRideSnapshot(user, snapshot.trailId, {
      publicationId: snapshot.publicationId,
      progressRatio: snapshot.progressRatio,
      distMeters: snapshot.distMetersAlongRoute,
      speedMps: snapshot.speedMps,
      ridePhase: snapshot.routeRidePhase,
    }),
  ]);
  // S3A: motion 은 single-flight. join burst 가 직접 set() 하면 tick 과 경쟁한다.
  if (isFirebaseDatabaseConfigured()) {
    enqueueMotionPublish({
      user,
      trailId: snapshot.trailId,
      snapshot,
      epoch: peekMotionPublishEpoch(),
    });
  }

  if (snapshot.trailId !== DEFAULT_TRAIL_ID) {
    void touchTrailInstanceActivity(snapshot.trailId);
  }
}
