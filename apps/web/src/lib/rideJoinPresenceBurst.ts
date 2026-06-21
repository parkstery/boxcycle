import type { User } from "firebase/auth";
import { upsertPublicationSessionMember } from "./firestorePublicationSessionPresence";
import { mergeTrailLivePublicationRideSnapshot } from "./firestoreTrailLivePublicationRides";
import { DEFAULT_TRAIL_ID } from "./firestoreTrail";
import { touchTrailInstanceActivity } from "./firestoreTrailInstance";
import type { LiveLocationSnapshot } from "./liveLocationSnapshot";
import { isFirebaseDatabaseConfigured } from "./firebase";
import { mergeTrailMotionSnapshot, snapshotToRtdbTrailMotionSnapshot } from "./rtdbTrailMotion";

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
    isFirebaseDatabaseConfigured()
      ? mergeTrailMotionSnapshot(user, snapshot.trailId, snapshotToRtdbTrailMotionSnapshot(snapshot))
      : Promise.resolve(),
  ]);

  if (snapshot.trailId !== DEFAULT_TRAIL_ID) {
    void touchTrailInstanceActivity(snapshot.trailId);
  }
}
