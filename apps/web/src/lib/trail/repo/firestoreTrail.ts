import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getPresenceDisplayName, getPresenceMemberType } from "../../authDisplay";
import { getFirebaseFirestore } from "../../firebase/app";
import {
  TRAIL_MEMBERS_SUBCOLLECTION,
  TRAILS_COLLECTION,
} from "./firestoreTrailPaths";
import { noteListingRefreshRead, notePresenceHeartbeatWrite } from "../../touchActivityMeters";

// 식별자는 도메인 층(`../trailId`)이 갖는다 — 「ID 를 안다」와 「DB 를 읽는다」는 다르다(D6).
// 종전 이름으로 re-export 해 소비자를 건드리지 않는다.
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../trailId";
export { DEFAULT_TRAIL_ID, sanitizeTrailId };

/** 이 시간보다 오래된 lastSeenAt 은 “오프라인”으로 표시한다. */
export const TRAIL_PRESENCE_STALE_MS = 240_000;

/** presence lastSeenAt 갱신 주기 (탭 절전·백그라운드 대비) */
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 12_000;

export type TrailMemberRow = {
  uid: string;
  displayName: string | null;
  lastSeenAtMs: number | null;
};

// 변환기는 인프라 층(`../../firebase/converters`)이 갖는다 — Trail 과 무관하다(D6).
import { lastSeenAtToMillis } from "../../firebase/converters";
export { lastSeenAtToMillis };

export function isMemberRecentlySeen(lastSeenAtMs: number | null): boolean {
  if (lastSeenAtMs == null) return true;
  return Date.now() - lastSeenAtMs < TRAIL_PRESENCE_STALE_MS;
}

function membersCollectionRef(trailId: string) {
  const db = getFirebaseFirestore();
  return collection(db, TRAILS_COLLECTION, trailId, TRAIL_MEMBERS_SUBCOLLECTION);
}

export const isTrailMemberActive = isMemberRecentlySeen;

async function defaultPresenceUpsert(user: User, trailId: string): Promise<void> {
  const rid = sanitizeTrailId(trailId);
  const db = getFirebaseFirestore();
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

let presenceUpsertWriter = defaultPresenceUpsert;

/** DEV·단위시험용. 제품 수명주기에서 호출하지 마라. */
export function resetPresenceUpsertWriterForTests(
  writer?: (user: User, trailId: string) => Promise<void>,
): void {
  presenceUpsertWriter = writer ?? defaultPresenceUpsert;
}

export async function upsertTrailPresence(user: User, trailId: string): Promise<void> {
  notePresenceHeartbeatWrite();
  await presenceUpsertWriter(user, trailId);
}

export async function touchTrailPresence(user: User, trailId: string): Promise<void> {
  await upsertTrailPresence(user, trailId);
}

export async function deleteTrailPresence(uid: string, trailId: string): Promise<void> {
  const rid = sanitizeTrailId(trailId);
  const db = getFirebaseFirestore();
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
  noteListingRefreshRead();
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
