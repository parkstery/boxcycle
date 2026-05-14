import {
  collection,
  deleteDoc,
  doc,
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
import { isMemberRecentlySeen, lastSeenAtToMillis, sanitizeRoomId } from "./firestoreLobby";

/** 코스 진행률만 주기적으로 올려 부담을 줄임 (좌표·geometry 미전송). */
export const LOBBY_LIVE_COURSE_RIDE_WRITE_INTERVAL_MS = 4_000;

export type LobbyLiveCourseRideRow = {
  uid: string;
  courseId: string;
  progressRatio: number;
  lastSeenAtMs: number | null;
  displayName: string | null;
};

function liveRidesCollectionRef(roomId: string) {
  const db = getFirestore(getFirebaseApp());
  const rid = sanitizeRoomId(roomId);
  return collection(db, "rooms", rid, "liveCourseRides");
}

export function subscribeLobbyLiveCourseRides(
  roomId: string,
  onChange: (rows: LobbyLiveCourseRideRow[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  const rid = sanitizeRoomId(roomId);
  return onSnapshot(
    liveRidesCollectionRef(rid),
    (snap) => {
      const rows: LobbyLiveCourseRideRow[] = [];
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

export async function mergeLobbyLiveCourseRideSnapshot(
  user: User,
  roomId: string,
  input: { courseId: string; progressRatio: number },
): Promise<void> {
  const rid = sanitizeRoomId(roomId);
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, "rooms", rid, "liveCourseRides", user.uid);
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

export async function deleteLobbyLiveCourseRide(uid: string, roomId: string): Promise<void> {
  const rid = sanitizeRoomId(roomId);
  const db = getFirestore(getFirebaseApp());
  await deleteDoc(doc(db, "rooms", rid, "liveCourseRides", uid));
}

export function isLobbyLiveCourseRideRowFresh(row: LobbyLiveCourseRideRow): boolean {
  return isMemberRecentlySeen(row.lastSeenAtMs);
}
