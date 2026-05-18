import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getPresenceDisplayName } from "./authDisplay";
import { getFirebaseApp } from "./firebase";
import { isMemberRecentlySeen, lastSeenAtToMillis, sanitizeTrailId } from "./firestoreTrail";
import {
  TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION,
  TRAILS_COLLECTION,
} from "./firestoreTrailPaths";

/** 코스 진행률만 주기적으로 올려 부담을 줄임 (좌표·geometry 미전송). */
export const TRAIL_LIVE_COURSE_RIDE_WRITE_INTERVAL_MS = 4_000;

/** @deprecated `TRAIL_LIVE_COURSE_RIDE_WRITE_INTERVAL_MS` */
export const LOBBY_LIVE_COURSE_RIDE_WRITE_INTERVAL_MS = TRAIL_LIVE_COURSE_RIDE_WRITE_INTERVAL_MS;

export type TrailLiveCourseRideRow = {
  uid: string;
  courseId: string;
  progressRatio: number;
  lastSeenAtMs: number | null;
  displayName: string | null;
};

/** @deprecated `TrailLiveCourseRideRow` */
export type LobbyLiveCourseRideRow = TrailLiveCourseRideRow;

function liveRidesCollectionRef(trailId: string) {
  const db = getFirestore(getFirebaseApp());
  const rid = sanitizeTrailId(trailId);
  return collection(db, TRAILS_COLLECTION, rid, TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION);
}

export function subscribeTrailLiveCourseRides(
  trailId: string,
  onChange: (rows: TrailLiveCourseRideRow[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  const rid = sanitizeTrailId(trailId);
  return onSnapshot(
    liveRidesCollectionRef(rid),
    (snap) => {
      const rows: TrailLiveCourseRideRow[] = [];
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const courseId = typeof data.courseId === "string" ? data.courseId.trim() : "";
        const pr = data.progressRatio;
        const progressRatio =
          typeof pr === "number" && Number.isFinite(pr) ? Math.max(0, Math.min(1, pr)) : Number.NaN;
        if (!courseId || Number.isNaN(progressRatio)) continue;
        rows.push({
          uid: d.id,
          courseId,
          progressRatio,
          lastSeenAtMs: lastSeenAtToMillis(data.lastSeenAt),
          displayName: typeof data.displayName === "string" ? data.displayName : null,
        });
      }
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}

/** @deprecated `subscribeTrailLiveCourseRides` */
export const subscribeLobbyLiveCourseRides = subscribeTrailLiveCourseRides;

export async function mergeTrailLiveCourseRideSnapshot(
  user: User,
  trailId: string,
  input: { courseId: string; progressRatio: number },
): Promise<void> {
  const rid = sanitizeTrailId(trailId);
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, TRAILS_COLLECTION, rid, TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION, user.uid);
  await setDoc(
    ref,
    {
      courseId: input.courseId.trim(),
      progressRatio: Math.max(0, Math.min(1, input.progressRatio)),
      displayName: getPresenceDisplayName(user),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** @deprecated `mergeTrailLiveCourseRideSnapshot` */
export const mergeLobbyLiveCourseRideSnapshot = mergeTrailLiveCourseRideSnapshot;

export async function deleteTrailLiveCourseRide(uid: string, trailId: string): Promise<void> {
  const rid = sanitizeTrailId(trailId);
  const db = getFirestore(getFirebaseApp());
  await deleteDoc(doc(db, TRAILS_COLLECTION, rid, TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION, uid));
}

/** Trail 에서 `liveCourseRides` 문서 수(주행·대기 중 라이더 근사) */
export async function countTrailLiveRiders(trailId: string): Promise<number> {
  const rid = sanitizeTrailId(trailId);
  const db = getFirestore(getFirebaseApp());
  const coll = collection(db, TRAILS_COLLECTION, rid, TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION);
  const snap = await getCountFromServer(coll);
  return snap.data().count;
}

/** @deprecated `deleteTrailLiveCourseRide` */
export const deleteLobbyLiveCourseRide = deleteTrailLiveCourseRide;

export function isTrailLiveCourseRideRowFresh(row: TrailLiveCourseRideRow): boolean {
  return isMemberRecentlySeen(row.lastSeenAtMs);
}

/** @deprecated `isTrailLiveCourseRideRowFresh` */
export const isLobbyLiveCourseRideRowFresh = isTrailLiveCourseRideRowFresh;
