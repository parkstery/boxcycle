import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getPresenceDisplayName } from "./authDisplay";
import { getFirebaseApp } from "./firebase";
import {
  DEFAULT_TRAIL_ID,
  isMemberRecentlySeen,
  lastSeenAtToMillis,
  sanitizeTrailId,
  TRAIL_PRESENCE_STALE_MS,
} from "./firestoreTrail";
import {
  TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION,
  TRAILS_COLLECTION,
} from "./firestoreTrailPaths";

/** publication 진행률만 주기적으로 올려 부담을 줄임 (좌표·geometry 미전송). */
export const TRAIL_LIVE_PUBLICATION_RIDE_WRITE_INTERVAL_MS = 4_000;

export type TrailLivePublicationRideRow = {
  uid: string;
  /** 출판 ID — 레거시 문서의 `courseId` 와 동일 값 */
  publicationId: string;
  progressRatio: number;
  lastSeenAtMs: number | null;
  displayName: string | null;
};

function readPublicationIdFromDoc(data: Record<string, unknown>): string {
  const pub = data.publicationId;
  if (typeof pub === "string" && pub.trim()) return pub.trim();
  const legacy = data.courseId;
  return typeof legacy === "string" ? legacy.trim() : "";
}

function liveRidesCollectionRef(trailId: string) {
  const db = getFirestore(getFirebaseApp());
  const rid = sanitizeTrailId(trailId);
  return collection(db, TRAILS_COLLECTION, rid, TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION);
}

export function subscribeTrailLivePublicationRides(
  trailId: string,
  onChange: (rows: TrailLivePublicationRideRow[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  const rid = sanitizeTrailId(trailId);
  return onSnapshot(
    liveRidesCollectionRef(rid),
    (snap) => {
      const rows: TrailLivePublicationRideRow[] = [];
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const publicationId = readPublicationIdFromDoc(data);
        const pr = data.progressRatio;
        const progressRatio =
          typeof pr === "number" && Number.isFinite(pr) ? Math.max(0, Math.min(1, pr)) : Number.NaN;
        if (!publicationId || Number.isNaN(progressRatio)) continue;
        rows.push({
          uid: d.id,
          publicationId,
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

export async function mergeTrailLivePublicationRideSnapshot(
  user: User,
  trailId: string,
  input: { publicationId: string; progressRatio: number },
): Promise<void> {
  const rid = sanitizeTrailId(trailId);
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, TRAILS_COLLECTION, rid, TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION, user.uid);
  await setDoc(
    ref,
    {
      publicationId: input.publicationId.trim(),
      progressRatio: Math.max(0, Math.min(1, input.progressRatio)),
      displayName: getPresenceDisplayName(user),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteTrailLivePublicationRide(uid: string, trailId: string): Promise<void> {
  const rid = sanitizeTrailId(trailId);
  const db = getFirestore(getFirebaseApp());
  await deleteDoc(doc(db, TRAILS_COLLECTION, rid, TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION, uid));
}

function liveRideFreshnessCutoff(): Timestamp {
  return Timestamp.fromMillis(Date.now() - TRAIL_PRESENCE_STALE_MS);
}

const LIVE_RIDES_COUNT_SCAN_LIMIT = 48;

/** Trail 에서 최근 활동(`lastSeenAt`) 있는 `livePublicationRides` — aggregation 없이 소량 getDocs */
export async function countTrailLiveRidersFresh(trailId: string): Promise<number> {
  const coll = liveRidesCollectionRef(trailId);
  const cutoffMs = Date.now() - TRAIL_PRESENCE_STALE_MS;
  const snap = await getDocs(query(coll, limit(LIVE_RIDES_COUNT_SCAN_LIMIT)));
  let n = 0;
  for (const d of snap.docs) {
    const ms = lastSeenAtToMillis((d.data() as Record<string, unknown>).lastSeenAt);
    if (ms != null && ms >= cutoffMs) n += 1;
  }
  return n;
}

/** Trail 에서 `livePublicationRides` 문서 수(레거시·stale 포함) */
export async function countTrailLiveRiders(trailId: string): Promise<number> {
  const snap = await getDocs(query(liveRidesCollectionRef(trailId), limit(LIVE_RIDES_COUNT_SCAN_LIMIT)));
  return snap.size;
}

const ACTIVE_LIVE_RIDE_TRAIL_SCAN_LIMIT = 80;

/**
 * 지금 주행 중인 Trail ID — `livePublicationRides` collection group 기준(최근 lastSeenAt).
 */
export async function fetchTrailIdsWithActiveLiveRides(): Promise<string[]> {
  const db = getFirestore(getFirebaseApp());
  const q = query(
    collectionGroup(db, TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION),
    where("lastSeenAt", ">", liveRideFreshnessCutoff()),
    orderBy("lastSeenAt", "desc"),
    limit(ACTIVE_LIVE_RIDE_TRAIL_SCAN_LIMIT),
  );
  const snap = await getDocs(q);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const d of snap.docs) {
    const trailId = d.ref.parent.parent?.id;
    if (!trailId || trailId === DEFAULT_TRAIL_ID || seen.has(trailId)) continue;
    seen.add(trailId);
    ids.push(trailId);
  }
  return ids;
}

export function isTrailLivePublicationRideRowFresh(row: TrailLivePublicationRideRow): boolean {
  return isMemberRecentlySeen(row.lastSeenAtMs);
}
