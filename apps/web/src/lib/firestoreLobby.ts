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
import { getPresenceDisplayName, getPresenceMemberType } from "./authDisplay";
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
export const LOBBY_STALE_MS = 240_000;

/** presence lastSeenAt 갱신 주기 (탭 절전·백그라운드 대비) */
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 12_000;

export type LobbyMemberRow = {
  uid: string;
  displayName: string | null;
  /** 스냅샷의 lastSeenAt 을 epoch ms 로 정규화한 값. 없으면 서버 타임스탬프 대기·형식 불명 */
  lastSeenAtMs: number | null;
};

/** Firestore Timestamp·{seconds,nanoseconds}·레거시 숫자 등을 ms 로 통일 */
export function lastSeenAtToMillis(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && typeof (raw as { toMillis?: () => number }).toMillis === "function") {
    const ms = (raw as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof raw === "object" && raw !== null && "seconds" in raw) {
    const o = raw as unknown as { seconds: unknown; nanoseconds?: unknown };
    if (typeof o.seconds !== "number") return null;
    const s = o.seconds;
    const n = typeof o.nanoseconds === "number" ? o.nanoseconds : 0;
    return s * 1000 + Math.floor(n / 1_000_000);
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw < 1e12) return Math.round(raw * 1000);
    return raw;
  }
  return null;
}

export function isMemberRecentlySeen(lastSeenAtMs: number | null): boolean {
  if (lastSeenAtMs == null) return true;
  return Date.now() - lastSeenAtMs < LOBBY_STALE_MS;
}

function membersCollectionRef(roomId: string) {
  const db = getFirestore(getFirebaseApp());
  return collection(db, "rooms", roomId, "members");
}

export const isLobbyMemberActive = isMemberRecentlySeen;

export async function upsertLobbyPresence(user: User, roomId: string): Promise<void> {
  const rid = sanitizeRoomId(roomId);
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, "rooms", rid, "members", user.uid);
  await setDoc(
    ref,
    {
      memberType: getPresenceMemberType(user),
      displayName: getPresenceDisplayName(user),
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
          lastSeenAtMs: lastSeenAtToMillis(data.lastSeenAt),
        };
      });
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}
