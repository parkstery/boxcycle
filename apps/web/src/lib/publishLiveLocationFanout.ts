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
import {
  deleteTrailMotion,
  mergeTrailMotionSnapshot,
  snapshotToRtdbTrailMotionSnapshot,
} from "./rtdbTrailMotion";
import { nextPeerSyncChainSeq, peerSyncChainLog } from "./peerMotion/peerSyncChainLog";

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
  opts: { publishGlobal: boolean; publishRoute: boolean; publishMotion?: boolean },
): Promise<LiveLocationFanoutResult> {
  const result: LiveLocationFanoutResult = { global: false, route: false, motion: false };

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

  if (
    opts.publishMotion &&
    isFirebaseDatabaseConfigured() &&
    snapshot.routeReady &&
    snapshot.publicationId
  ) {
    let seq: number | undefined;
    let snapshotCapturedAt: number | undefined;
    if (import.meta.env.DEV) {
      seq = nextPeerSyncChainSeq();
      const cap = snapshot.diagCapture;
      snapshotCapturedAt = cap?.snapshotCapturedAt;
      // §2-2: ①② 는 스냅샷 생성 순간의 동기 레코드만 쓴다 (fanout 시점 peek 금지)
      peerSyncChainLog(1, seq, {
        capturedAt: cap?.snapshotCapturedAt ?? null,
        authDist: cap?.authDistAtCapture ?? null,
        snapshotDist: cap?.snapshotDistAtCapture ?? null,
        appliedKmh: cap?.appliedKmh ?? null,
        targetKmh: cap?.targetKmh ?? null,
        uid: user.uid.slice(0, 6),
      });
      peerSyncChainLog(2, seq, {
        capturedAt: cap?.snapshotCapturedAt ?? null,
        dist: cap?.snapshotDistAtCapture ?? snapshot.distMetersAlongRoute,
        authDist: cap?.authDistAtCapture ?? null,
        routeReady: snapshot.routeReady,
        routeLen: cap?.routeLen ?? null,
        geoLen: cap?.geoLen ?? null,
        uid: user.uid.slice(0, 6),
      });
    }
    const motion = await mergeTrailMotionSnapshot(
      user,
      snapshot.trailId,
      snapshotToRtdbTrailMotionSnapshot(snapshot),
      { seq, snapshotCapturedAt },
    );
    result.motion = true;
    result.motionOk = motion.ok;
    result.motionRttMs = motion.rttMs;
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
