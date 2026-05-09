import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  GeoPoint,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseApp } from "./firebase";
import type { LngLat } from "./geo";
import { isMemberRecentlySeen, lastSeenAtToMillis } from "./firestoreLobby";

export type CourseMemberRow = {
  uid: string;
  displayName: string | null;
  lastSeenAtMs: number | null;
  /** 주행 중 지도에 표시할 위치 (없으면 목록만) */
  liveLngLat: LngLat | null;
};

/** 로비와 동일한 “최근 접속” 판정 */
export const isCourseMemberActive = isMemberRecentlySeen;

export const COURSE_LIVE_SHARE_INTERVAL_MS = 2000;

function membersCollectionRef(courseId: string) {
  const db = getFirestore(getFirebaseApp());
  return collection(db, "coursePresence", courseId, "members");
}

function parseLiveLngLat(data: Record<string, unknown>): LngLat | null {
  const lng = data.liveLng;
  const lat = data.liveLat;
  if (typeof lng === "number" && typeof lat === "number" && Number.isFinite(lng) && Number.isFinite(lat)) {
    return [lng, lat];
  }
  const gp = data.liveGeo;
  if (gp instanceof GeoPoint) {
    return [gp.longitude, gp.latitude];
  }
  return null;
}

export async function upsertCoursePresence(user: User, courseId: string): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, "coursePresence", courseId, "members", user.uid);
  await setDoc(
    ref,
    {
      displayName: user.displayName ?? user.email ?? user.uid,
      photoURL: user.photoURL ?? null,
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function touchCoursePresence(user: User, courseId: string): Promise<void> {
  await upsertCoursePresence(user, courseId);
}

/** 주행 중 내 위치를 같은 코스 멤버가 지도에서 볼 수 있게 갱신한다. */
export async function mergeCourseMemberLiveLocation(
  user: User,
  courseId: string,
  lngLat: LngLat | null,
): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, "coursePresence", courseId, "members", user.uid);
  if (lngLat) {
    await setDoc(
      ref,
      {
        displayName: user.displayName ?? user.email ?? user.uid,
        photoURL: user.photoURL ?? null,
        liveLng: lngLat[0],
        liveLat: lngLat[1],
        lastSeenAt: serverTimestamp(),
      },
      { merge: true },
    );
  } else {
    await setDoc(
      ref,
      {
        displayName: user.displayName ?? user.email ?? user.uid,
        photoURL: user.photoURL ?? null,
        liveLng: deleteField(),
        liveLat: deleteField(),
        lastSeenAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

export async function deleteCoursePresence(uid: string, courseId: string): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  await deleteDoc(doc(db, "coursePresence", courseId, "members", uid));
}

export function subscribeCourseMembers(
  courseId: string,
  onChange: (members: CourseMemberRow[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    membersCollectionRef(courseId),
    (snap) => {
      const rows: CourseMemberRow[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          uid: d.id,
          displayName: typeof data.displayName === "string" ? data.displayName : null,
          lastSeenAtMs: lastSeenAtToMillis(data.lastSeenAt),
          liveLngLat: parseLiveLngLat(data),
        };
      });
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}
