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
  Timestamp,
  updateDoc,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "./firebase";
import { countTrailMembersFresh } from "./firestoreTrail";
import { countTrailLiveRidersFresh } from "./firestoreTrailLivePublicationRides";
import { trailHasConfiguredRoute } from "./trailAccessPolicy";
import { TRAILS_COLLECTION } from "./firestoreTrailPaths";
import type { TrailInstance } from "./firestoreTrailInstance";
import { resolvePublicationIdFromDoc } from "./resolvePublicationIdFromDoc";

/** Trailhead 공개 목록 — realtime 단일 진실 (자문: openTrailInstances) */
export const OPEN_TRAIL_LISTINGS_COLLECTION = "openTrailListings";

const OPEN_TRAIL_LISTINGS_LIMIT = 40;

type OpenTrailListingDoc = {
  trailId: string;
  hostUid: string;
  displayNumber: number;
  regionLabel: string | null;
  distanceKm: number | null;
  publicationId: string;
  riderCount: number;
  /** Trail 생성 시각 — 목록 정렬용(불변) */
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
  updatedAt: ReturnType<typeof serverTimestamp>;
};

/** 공개 Trail 목록 — 최신 생성 우선, 동률 시 id 로 고정 */
export function compareOpenTrailsForListing(a: TrailInstance, b: TrailInstance): number {
  const aMs = a.createdAtMs ?? 0;
  const bMs = b.createdAtMs ?? 0;
  if (bMs !== aMs) return bMs - aMs;
  return a.id.localeCompare(b.id);
}

function resolveListingPublicationId(data: Record<string, unknown>): string | null {
  return resolvePublicationIdFromDoc(data);
}

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
    publicationId: resolveListingPublicationId(data),
    regionLabel:
      typeof data.regionLabel === "string" && data.regionLabel.trim() ? data.regionLabel.trim() : null,
    distanceKm:
      typeof data.distanceKm === "number" && Number.isFinite(data.distanceKm) ? data.distanceKm : null,
    visibility: data.visibility === "private" ? "private" : "open",
    status:
      data.status === "archived" ? "archived" : data.status === "closed" ? "closed" : "open",
    createdAtMs: timestampToMs(data.createdAt),
    lastActivityAtMs: timestampToMs(data.lastActivityAt),
    liveRiderCount:
      typeof data.liveRiderCount === "number" && Number.isFinite(data.liveRiderCount)
        ? Math.max(0, Math.floor(data.liveRiderCount))
        : undefined,
  };
}

/** MENU·Trailhead — 활성 라이더가 1명 이상인 listing 만 */
export function isActiveOpenTrailListing(trail: TrailInstance): boolean {
  return (trail.liveRiderCount ?? 0) > 0;
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
    publicationId: resolveListingPublicationId(data),
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
    createdAtMs: timestampToMs(data.createdAt),
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

export async function fetchOpenTrailListingPublicationId(trailId: string): Promise<string | null> {
  const snap = await getDoc(listingRef(trailId));
  if (!snap.exists()) return null;
  return resolveListingPublicationId(snap.data() as Record<string, unknown>);
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
  const authUid = getAuth(getFirebaseApp()).currentUser?.uid ?? null;
  const existingSnap = await getDoc(listingRef(trailId)).catch(() => null);
  const listingExists = existingSnap?.exists() ?? false;
  const existingCreated = listingExists ? existingSnap?.data()?.createdAt : undefined;
  const createdAt =
    existingCreated != null
      ? (existingCreated as Timestamp)
      : trail.createdAtMs != null
        ? Timestamp.fromMillis(trail.createdAtMs)
        : Timestamp.now();
  const payload: OpenTrailListingDoc = {
    trailId: trail.id,
    hostUid: trail.hostUid,
    displayNumber: trail.displayNumber,
    regionLabel: trail.regionLabel,
    distanceKm: trail.distanceKm,
    publicationId: trail.publicationId!,
    riderCount,
    createdAt,
    updatedAt: serverTimestamp(),
  };
  const ref = listingRef(trailId);
  if (!listingExists) {
    if (authUid !== trail.hostUid) return;
    await setDoc(ref, payload, { merge: true });
    return;
  }
  if (authUid === trail.hostUid) {
    await setDoc(ref, payload, { merge: true });
    return;
  }
  await updateDoc(ref, {
    riderCount,
    updatedAt: serverTimestamp(),
  }).catch(() => {});
}

const refreshScheduled = new Map<string, ReturnType<typeof setTimeout>>();
const createdAtBackfillScheduled = new Set<string>();

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

/** listing + `livePublicationRides` CG 보강 행 병합 — 주행 중 Trail MENU */
export function mergeActiveOpenTrailRows(
  fromListings: TrailInstance[],
  fromActiveRides: TrailInstance[],
): TrailInstance[] {
  const byId = new Map<string, TrailInstance>();
  for (const t of fromActiveRides) {
    if (t.status !== "open" || t.visibility !== "open") continue;
    if (!isActiveOpenTrailListing(t)) continue;
    byId.set(t.id, t);
  }
  for (const t of fromListings) {
    if (!isActiveOpenTrailListing(t)) continue;
    const base = byId.get(t.id);
    byId.set(
      t.id,
      base
        ? {
            ...base,
            ...t,
            id: t.id,
            liveRiderCount: Math.max(t.liveRiderCount ?? 0, base.liveRiderCount ?? 0),
          }
        : t,
    );
  }
  return [...byId.values()].sort(compareOpenTrailsForListing);
}

/**
 * Trailhead MENU — `openTrailListings` realtime (활성 라이더 1명 이상만).
 */
export function subscribeOpenTrailListings(
  onChange: (rows: TrailInstance[]) => void,
  onError?: (e: FirestoreError) => void,
): Unsubscribe {
  const db = getFirestore(getFirebaseApp());
  const listingsQuery = query(
    collection(db, OPEN_TRAIL_LISTINGS_COLLECTION),
    orderBy("updatedAt", "desc"),
    limit(OPEN_TRAIL_LISTINGS_LIMIT),
  );

  return onSnapshot(
    listingsQuery,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({
          row: listingToTrailInstance(d.id, d.data() as Record<string, unknown>),
          createdMs: timestampToMs(d.data().createdAt),
        }))
        .filter(({ row }) => isActiveOpenTrailListing(row))
        .map(({ row, createdMs }) => {
          if (createdMs == null && !createdAtBackfillScheduled.has(row.id)) {
            createdAtBackfillScheduled.add(row.id);
            scheduleOpenTrailListingRefresh(row.id, 500);
          }
          return row;
        })
        .sort(compareOpenTrailsForListing);
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}
