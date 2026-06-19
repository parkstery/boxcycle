import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import { countTrailMembersFresh, TRAIL_PRESENCE_STALE_MS } from "./firestoreTrail";
import { countTrailLiveRidersFresh } from "./firestoreTrailLivePublicationRides";
import { trailHasConfiguredRoute } from "./trailAccessPolicy";
import { TRAILS_COLLECTION } from "./firestoreTrailPaths";
import type { TrailInstance } from "./firestoreTrailInstance";

/** Trailhead 공개 목록 — realtime 단일 진실 (자문: openTrailInstances) */
export const OPEN_TRAIL_LISTINGS_COLLECTION = "openTrailListings";

const OPEN_TRAIL_LISTINGS_LIMIT = 40;

type OpenTrailListingDoc = {
  trailId: string;
  hostUid: string;
  displayNumber: number;
  regionLabel: string | null;
  distanceKm: number | null;
  courseId: string;
  riderCount: number;
  updatedAt: ReturnType<typeof serverTimestamp>;
};

function listingRef(trailId: string) {
  return doc(getFirestore(getFirebaseApp()), OPEN_TRAIL_LISTINGS_COLLECTION, trailId);
}

/** listing riderCount — RunAggregationQuery 없이 trail 메타·소량 scan */
async function countTrailActiveParticipantsForTrail(trail: TrailInstance): Promise<number> {
  const metaCount =
    typeof trail.liveRiderCount === "number" && Number.isFinite(trail.liveRiderCount)
      ? Math.max(0, Math.floor(trail.liveRiderCount))
      : 0;
  const [live, members] = await Promise.all([
    countTrailLiveRidersFresh(trail.id).catch(() => 0),
    countTrailMembersFresh(trail.id).catch(() => 0),
  ]);
  return Math.max(metaCount, live, members);
}

async function loadTrailForListing(trailId: string): Promise<TrailInstance | null> {
  const snap = await getDoc(doc(getFirestore(getFirebaseApp()), TRAILS_COLLECTION, trailId));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    hostUid: typeof data.hostUid === "string" ? data.hostUid : "",
    displayNumber:
      typeof data.displayNumber === "number" && Number.isFinite(data.displayNumber)
        ? Math.max(1, Math.min(999, Math.floor(data.displayNumber)))
        : 1,
    courseId: typeof data.courseId === "string" && data.courseId.trim() ? data.courseId.trim() : null,
    regionLabel:
      typeof data.regionLabel === "string" && data.regionLabel.trim() ? data.regionLabel.trim() : null,
    distanceKm:
      typeof data.distanceKm === "number" && Number.isFinite(data.distanceKm) ? data.distanceKm : null,
    visibility: data.visibility === "private" ? "private" : "open",
    status:
      data.status === "archived" ? "archived" : data.status === "closed" ? "closed" : "open",
    createdAtMs: null,
    lastActivityAtMs: null,
    liveRiderCount:
      typeof data.liveRiderCount === "number" && Number.isFinite(data.liveRiderCount)
        ? Math.max(0, Math.floor(data.liveRiderCount))
        : undefined,
  };
}

function isListableTrail(trail: TrailInstance): boolean {
  return (
    trail.status === "open" &&
    trail.visibility === "open" &&
    trailHasConfiguredRoute(trail)
  );
}

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

export async function removeOpenTrailListing(trailId: string): Promise<void> {
  await deleteDoc(listingRef(trailId)).catch(() => {});
}

/** `trails/{id}` 메타·활성 인원 기준으로 listing upsert 또는 제거 */
export async function refreshOpenTrailListingFromTrail(trailId: string): Promise<void> {
  const trail = await loadTrailForListing(trailId);
  if (!trail || !isListableTrail(trail)) {
    await removeOpenTrailListing(trailId);
    return;
  }
  const riderCount = await countTrailActiveParticipantsForTrail(trail).catch(() => 0);
  if (riderCount <= 0) {
    await removeOpenTrailListing(trailId);
    return;
  }
  const payload: OpenTrailListingDoc = {
    trailId: trail.id,
    hostUid: trail.hostUid,
    displayNumber: trail.displayNumber,
    regionLabel: trail.regionLabel,
    distanceKm: trail.distanceKm,
    courseId: trail.courseId!,
    riderCount,
    updatedAt: serverTimestamp(),
  };
  await setDoc(listingRef(trailId), payload, { merge: true });
}

const refreshScheduled = new Map<string, ReturnType<typeof setTimeout>>();

/** presence·liveCourseRides 갱신 시 listing debounce 동기화 */
export function scheduleOpenTrailListingRefresh(trailId: string, debounceMs = 2_500): void {
  const prev = refreshScheduled.get(trailId);
  if (prev) window.clearTimeout(prev);
  const id = window.setTimeout(() => {
    refreshScheduled.delete(trailId);
    void refreshOpenTrailListingFromTrail(trailId).catch(() => {});
  }, debounceMs);
  refreshScheduled.set(trailId, id);
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
