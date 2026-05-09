import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type FirestoreError,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseApp } from "./firebase";
import { LOBBY_STALE_MS } from "./firestoreLobby";

export type CourseMemberRow = {
  uid: string;
  displayName: string | null;
  lastSeenAt: Timestamp | undefined;
};

function membersCollectionRef(courseId: string) {
  const db = getFirestore(getFirebaseApp());
  return collection(db, "coursePresence", courseId, "members");
}

export function isCourseMemberActive(lastSeenAt: Timestamp | undefined): boolean {
  if (!lastSeenAt?.toMillis) return false;
  return Date.now() - lastSeenAt.toMillis() < LOBBY_STALE_MS;
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
          lastSeenAt: data.lastSeenAt as Timestamp | undefined,
        };
      });
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}
