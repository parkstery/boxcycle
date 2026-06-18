import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getPresenceDisplayName, getPresenceMemberType } from "./authDisplay";
import { getFirebaseApp } from "./firebase";
import {
  TRAIL_MEMBERS_SUBCOLLECTION,
  TRAILS_COLLECTION,
} from "./firestoreTrailPaths";

/** URL·입장 시 기본 Trail ID (Firestore: `trails/default`) */
export const DEFAULT_TRAIL_ID = "default";

const TRAIL_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/** Firestore `trails/{id}` 경로용 Trail ID. 허용되지 않으면 `default` */
export function sanitizeTrailId(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t || !TRAIL_ID_RE.test(t)) return DEFAULT_TRAIL_ID;
  return t;
}

/** 이 시간보다 오래된 lastSeenAt 은 “오프라인”으로 표시한다. */
export const TRAIL_PRESENCE_STALE_MS = 240_000;

/** presence lastSeenAt 갱신 주기 (탭 절전·백그라운드 대비) */
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 12_000;

export type TrailMemberRow = {
  uid: string;
  displayName: string | null;
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
  return Date.now() - lastSeenAtMs < TRAIL_PRESENCE_STALE_MS;
}

function membersCollectionRef(trailId: string) {
  const db = getFirestore(getFirebaseApp());
  return collection(db, TRAILS_COLLECTION, trailId, TRAIL_MEMBERS_SUBCOLLECTION);
}

export const isTrailMemberActive = isMemberRecentlySeen;

export async function upsertTrailPresence(user: User, trailId: string): Promise<void> {
  const rid = sanitizeTrailId(trailId);
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, TRAILS_COLLECTION, rid, TRAIL_MEMBERS_SUBCOLLECTION, user.uid);
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

export async function touchTrailPresence(user: User, trailId: string): Promise<void> {
  await upsertTrailPresence(user, trailId);
}

export async function deleteTrailPresence(uid: string, trailId: string): Promise<void> {
  const rid = sanitizeTrailId(trailId);
  const db = getFirestore(getFirebaseApp());
  await deleteDoc(doc(db, TRAILS_COLLECTION, rid, TRAIL_MEMBERS_SUBCOLLECTION, uid));
}

const MEMBERS_COUNT_SCAN_LIMIT = 48;

/** Trail `members` 중 최근 접속(lastSeenAt) — aggregation 없이 소량 getDocs */
export async function countTrailMembersFresh(trailId: string): Promise<number> {
  const rid = sanitizeTrailId(trailId);
  if (rid === DEFAULT_TRAIL_ID) return 0;
  const coll = membersCollectionRef(rid);
  const cutoffMs = Date.now() - TRAIL_PRESENCE_STALE_MS;
  const snap = await getDocs(query(coll, limit(MEMBERS_COUNT_SCAN_LIMIT)));
  let n = 0;
  for (const d of snap.docs) {
    const ms = lastSeenAtToMillis((d.data() as Record<string, unknown>).lastSeenAt);
    if (ms != null && ms >= cutoffMs) n += 1;
  }
  return n;
}

export function subscribeTrailMembers(
  trailId: string,
  onChange: (members: TrailMemberRow[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  const rid = sanitizeTrailId(trailId);
  return onSnapshot(
    membersCollectionRef(rid),
    (snap) => {
      const rows: TrailMemberRow[] = snap.docs.map((d) => {
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
