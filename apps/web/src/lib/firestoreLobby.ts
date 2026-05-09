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

/** URL·입장 시 기본 방 */
export const DEFAULT_LOBBY_ROOM_ID = "default";

const ROOM_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/** Firestore 경로용. 허용되지 않으면 `default` */
export function sanitizeRoomId(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t || !ROOM_ID_RE.test(t)) return DEFAULT_LOBBY_ROOM_ID;
  return t;
}

/** 이 시간보다 오래된 lastSeenAt 은 “오프라인”으로 표시한다. */
export const LOBBY_STALE_MS = 90_000;

export type LobbyMemberRow = {
  uid: string;
  displayName: string | null;
  lastSeenAt: Timestamp | undefined;
};

function membersCollectionRef(roomId: string) {
  const db = getFirestore(getFirebaseApp());
  return collection(db, "rooms", roomId, "members");
}

export function isLobbyMemberActive(lastSeenAt: Timestamp | undefined): boolean {
  if (!lastSeenAt?.toMillis) return false;
  return Date.now() - lastSeenAt.toMillis() < LOBBY_STALE_MS;
}

export async function upsertLobbyPresence(user: User, roomId: string): Promise<void> {
  const rid = sanitizeRoomId(roomId);
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, "rooms", rid, "members", user.uid);
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

export async function touchLobbyPresence(user: User, roomId: string): Promise<void> {
  await upsertLobbyPresence(user, roomId);
}

export async function deleteLobbyPresence(uid: string, roomId: string): Promise<void> {
  const rid = sanitizeRoomId(roomId);
  const db = getFirestore(getFirebaseApp());
  await deleteDoc(doc(db, "rooms", rid, "members", uid));
}

export function subscribeLobbyMembers(
  roomId: string,
  onChange: (members: LobbyMemberRow[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  const rid = sanitizeRoomId(roomId);
  return onSnapshot(
    membersCollectionRef(rid),
    (snap) => {
      const rows: LobbyMemberRow[] = snap.docs.map((d) => {
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
