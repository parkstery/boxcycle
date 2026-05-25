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
import type { LngLat } from "./geo";
import { lastSeenAtToMillis, TRAIL_PRESENCE_STALE_MS } from "./firestoreTrail";

/** 전역 라이브 presence — courseId·trail·geometry 불필요 */
export const GLOBAL_LIVE_PRESENCE_COLLECTION = "livePresence";

export type GlobalLivePresenceRow = {
  uid: string;
  lat: number;
  lng: number;
  updatedAtMs: number | null;
  displayName: string | null;
};

export type GlobalLivePresenceDot = {
  id: string;
  lngLat: LngLat;
  label: string | null;
};

function livePresenceCollectionRef() {
  const db = getFirestore(getFirebaseApp());
  return collection(db, GLOBAL_LIVE_PRESENCE_COLLECTION);
}

function parseDoc(id: string, data: Record<string, unknown>): GlobalLivePresenceRow | null {
  const lat = data.lat;
  const lng = data.lng;
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return {
    uid: id,
    lat,
    lng,
    updatedAtMs: lastSeenAtToMillis(data.updatedAt),
    displayName: typeof data.displayName === "string" ? data.displayName : null,
  };
}

export function isGlobalLivePresenceFresh(row: GlobalLivePresenceRow): boolean {
  const ms = row.updatedAtMs;
  if (ms == null) return false;
  return Date.now() - ms <= TRAIL_PRESENCE_STALE_MS;
}

export function subscribeGlobalLivePresence(
  onChange: (rows: GlobalLivePresenceRow[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    livePresenceCollectionRef(),
    (snap) => {
      const rows: GlobalLivePresenceRow[] = [];
      for (const d of snap.docs) {
        const row = parseDoc(d.id, d.data() as Record<string, unknown>);
        if (row) rows.push(row);
      }
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}

export async function mergeGlobalLivePresence(user: User, lngLat: LngLat): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, GLOBAL_LIVE_PRESENCE_COLLECTION, user.uid);
  const [lng, lat] = lngLat;
  await setDoc(
    ref,
    {
      lat,
      lng,
      displayName: getPresenceDisplayName(user),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteGlobalLivePresence(uid: string): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  await deleteDoc(doc(db, GLOBAL_LIVE_PRESENCE_COLLECTION, uid));
}

export function globalLivePresenceRowsToDots(
  rows: readonly GlobalLivePresenceRow[],
  opts: { myUid: string | null; excludeIds?: ReadonlySet<string>; /** solo 검증·world light */ includeSelf?: boolean },
): GlobalLivePresenceDot[] {
  const exclude = opts.excludeIds ?? new Set<string>();
  const out: GlobalLivePresenceDot[] = [];
  for (const row of rows) {
    if (opts.myUid && row.uid === opts.myUid && !opts.includeSelf) continue;
    if (exclude.has(row.uid)) continue;
    if (!isGlobalLivePresenceFresh(row)) continue;
    out.push({
      id: row.uid,
      lngLat: [row.lng, row.lat],
      label: row.displayName?.trim() || row.uid.slice(0, 6),
    });
  }
  return out;
}
