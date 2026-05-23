import {
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import { TRAIL_PRESENCE_STALE_MS } from "./firestoreTrail";
import type { TrailInstance } from "./firestoreTrailInstance";

/** Trailhead 공개 목록 — CF가 유지, 클라이언트는 subscribe 만 */
export const OPEN_TRAIL_LISTINGS_COLLECTION = "openTrailListings";

const OPEN_TRAIL_LISTINGS_LIMIT = 40;

function listingToTrailInstance(
  trailId: string,
  data: Record<string, unknown>,
): TrailInstance {
  return {
    id: trailId,
    hostUid: typeof data.hostUid === "string" ? data.hostUid : "",
    displayNumber:
      typeof data.displayNumber === "number" && Number.isFinite(data.displayNumber)
        ? Math.max(1, Math.min(999, Math.floor(data.displayNumber)))
        : 1,
    courseId: typeof data.courseId === "string" ? data.courseId : null,
    regionLabel:
      typeof data.regionLabel === "string" && data.regionLabel.trim()
        ? data.regionLabel.trim()
        : null,
    distanceKm:
      typeof data.distanceKm === "number" && Number.isFinite(data.distanceKm)
        ? data.distanceKm
        : null,
    visibility: "open",
    status: "open",
    createdAtMs: null,
    lastActivityAtMs: null,
    liveRiderCount:
      typeof data.riderCount === "number" && Number.isFinite(data.riderCount)
        ? Math.max(0, Math.floor(data.riderCount))
        : 0,
  };
}

function timestampToMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as { toMillis?: () => number }).toMillis === "function"
  ) {
    const ms = (raw as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/**
 * 공개 Trail 목록 realtime — `onSnapshot(openTrailListings)`.
 * loading 깜빡임 없음: 최초 스냅샷 1회만 loading.
 */
export function subscribeOpenTrailListings(
  onChange: (rows: TrailInstance[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  const db = getFirestore(getFirebaseApp());
  const q = query(
    collection(db, OPEN_TRAIL_LISTINGS_COLLECTION),
    orderBy("updatedAt", "desc"),
    limit(OPEN_TRAIL_LISTINGS_LIMIT),
  );
  return onSnapshot(
    q,
    (snap) => {
      const cutoff = Date.now() - TRAIL_PRESENCE_STALE_MS;
      const rows = snap.docs
        .map((d) => ({
          row: listingToTrailInstance(d.id, d.data() as Record<string, unknown>),
          updatedMs: timestampToMs(d.data().updatedAt),
        }))
        .filter(({ updatedMs }) => updatedMs == null || updatedMs >= cutoff)
        .map(({ row }) => row)
        .sort((a, b) => (b.liveRiderCount ?? 0) - (a.liveRiderCount ?? 0));
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}
