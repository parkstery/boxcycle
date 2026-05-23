import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type FieldValue,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseApp } from "./firebase";
import { pickRandomTrailDisplayNumber } from "./trailDisplayNumber";
import { TRAILS_COLLECTION } from "./firestoreTrailPaths";
import {
  countTrailLiveRidersFresh,
  fetchTrailIdsWithActiveLiveRides,
} from "./firestoreTrailLiveCourseRides";
import { assertPublicTrailHasRoute, trailHasConfiguredRoute } from "./trailAccessPolicy";

export type TrailVisibility = "open" | "private";
export type TrailStatus = "open" | "closed" | "archived";

export type TrailInstance = {
  id: string;
  hostUid: string;
  displayNumber: number;
  courseId: string | null;
  regionLabel: string | null;
  distanceKm: number | null;
  visibility: TrailVisibility;
  status: TrailStatus;
  createdAtMs: number | null;
  lastActivityAtMs: number | null;
  /** `liveCourseRides` 서브컬렉션 문서 수(목록 UI용, best-effort) */
  liveRiderCount?: number;
};

type TrailInstanceDoc = {
  hostUid: string;
  displayNumber: number;
  courseId?: string | null;
  regionLabel?: string | null;
  distanceKm?: number | null;
  visibility: TrailVisibility;
  status: TrailStatus;
  createdAt?: FieldValue;
  lastActivityAt?: FieldValue;
};

function timestampToMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && typeof (raw as { toMillis?: () => number }).toMillis === "function") {
    const ms = (raw as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function parseTrailInstance(id: string, data: Record<string, unknown>): TrailInstance {
  return {
    id,
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
      data.status === "archived"
        ? "archived"
        : data.status === "closed"
          ? "closed"
          : "open",
    createdAtMs: timestampToMs(data.createdAt),
    lastActivityAtMs: timestampToMs(data.lastActivityAt),
  };
}

export function buildTrailRegionLabel(input: {
  startPlaceLabel: string | null;
  endPlaceLabel: string | null;
  courseTitle?: string | null;
}): string {
  const start = input.startPlaceLabel?.trim();
  if (start) return start;
  const course = input.courseTitle?.trim();
  if (course) return course;
  const end = input.endPlaceLabel?.trim();
  if (end) return end;
  return "Ride";
}

export async function createTrailInstance(input: {
  hostUid: string;
  courseId: string | null;
  regionLabel: string;
  distanceKm: number | null;
  visibility?: TrailVisibility;
}): Promise<TrailInstance> {
  const visibility = input.visibility ?? "open";
  if (visibility === "open") {
    assertPublicTrailHasRoute(input.courseId);
  }
  const db = getFirestore(getFirebaseApp());
  const ref = doc(collection(db, TRAILS_COLLECTION));
  const displayNumber = pickRandomTrailDisplayNumber();
  const payload: TrailInstanceDoc = {
    hostUid: input.hostUid,
    displayNumber,
    courseId: input.courseId,
    regionLabel: input.regionLabel,
    distanceKm: input.distanceKm,
    visibility,
    status: "open",
    createdAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  return {
    id: ref.id,
    hostUid: input.hostUid,
    displayNumber,
    courseId: input.courseId,
    regionLabel: input.regionLabel,
    distanceKm: input.distanceKm,
    visibility: payload.visibility,
    status: "open",
    createdAtMs: Date.now(),
    lastActivityAtMs: Date.now(),
  };
}

export async function fetchTrailInstance(trailId: string): Promise<TrailInstance | null> {
  const db = getFirestore(getFirebaseApp());
  const snap = await getDoc(doc(db, TRAILS_COLLECTION, trailId));
  if (!snap.exists()) return null;
  return parseTrailInstance(snap.id, snap.data() as Record<string, unknown>);
}

export async function closeTrailInstance(trailId: string): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  await updateDoc(doc(db, TRAILS_COLLECTION, trailId), {
    status: "closed",
    closedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  });
}

export async function touchTrailInstanceActivity(trailId: string): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  await updateDoc(doc(db, TRAILS_COLLECTION, trailId), {
    lastActivityAt: serverTimestamp(),
  }).catch(() => {});
}

export async function setTrailVisibility(
  trailId: string,
  visibility: TrailVisibility,
): Promise<void> {
  if (visibility === "open") {
    const existing = await fetchTrailInstance(trailId);
    if (!existing || !trailHasConfiguredRoute(existing)) {
      throw new Error("공개 Trail은 경로(코스)가 설정된 후에만 가능합니다.");
    }
  }
  const db = getFirestore(getFirebaseApp());
  await updateDoc(doc(db, TRAILS_COLLECTION, trailId), {
    visibility,
    lastActivityAt: serverTimestamp(),
  });
}

const OPEN_TRAILS_CANDIDATE_LIMIT = 40;

function shouldFallbackOpenTrailsList(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (code === "permission-denied" || code === "failed-precondition") return true;
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("Missing or insufficient permissions") || msg.includes("requires an index");
}

async function enrichOpenTrailsWithLiveCounts(base: TrailInstance[]): Promise<TrailInstance[]> {
  const withCounts = await Promise.all(
    base.map(async (t) => {
      try {
        const liveRiderCount = await countTrailLiveRidersFresh(t.id);
        return { ...t, liveRiderCount };
      } catch {
        return { ...t, liveRiderCount: 0 };
      }
    }),
  );
  return withCounts
    .filter((t) => (t.liveRiderCount ?? 0) > 0)
    .sort((a, b) => (b.liveRiderCount ?? 0) - (a.liveRiderCount ?? 0));
}

/** collection group 실패 시: 공개 open Trail 후보를 훑고 fresh 라이더만 남김 */
async function fetchOpenTrailInstancesFromCandidates(): Promise<TrailInstance[]> {
  const db = getFirestore(getFirebaseApp());
  const q = query(
    collection(db, TRAILS_COLLECTION),
    where("status", "==", "open"),
    where("visibility", "==", "open"),
    orderBy("lastActivityAt", "desc"),
    limit(OPEN_TRAILS_CANDIDATE_LIMIT),
  );
  const snap = await getDocs(q);
  const base = snap.docs
    .map((d) => parseTrailInstance(d.id, d.data() as Record<string, unknown>))
    .filter((t) => trailHasConfiguredRoute(t));
  return enrichOpenTrailsWithLiveCounts(base);
}

async function fetchOpenTrailInstancesFromLiveRides(): Promise<TrailInstance[]> {
  const trailIds = await fetchTrailIdsWithActiveLiveRides();
  if (trailIds.length === 0) return [];

  const metas = await Promise.all(trailIds.map((id) => fetchTrailInstance(id)));
  const joinable = metas.filter(
    (t): t is TrailInstance =>
      t != null &&
      t.status === "open" &&
      t.visibility === "open" &&
      trailHasConfiguredRoute(t),
  );
  return enrichOpenTrailsWithLiveCounts(joinable);
}

/** Trailhead에서 합류 가능한 공개 Trail — 지금 `liveCourseRides` 가 살아 있는 Trail 만 */
export async function fetchOpenTrailInstances(): Promise<TrailInstance[]> {
  try {
    return await fetchOpenTrailInstancesFromLiveRides();
  } catch (e) {
    if (!shouldFallbackOpenTrailsList(e)) throw e;
    return fetchOpenTrailInstancesFromCandidates();
  }
}

export function canUserManageTrail(trail: TrailInstance | null, user: User | null | undefined): boolean {
  if (!trail || !user) return false;
  return trail.hostUid === user.uid && trail.status === "open";
}
