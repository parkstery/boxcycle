import {
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FieldValue,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseApp } from "./firebase";
import { pickRandomTrailDisplayNumber } from "./trailDisplayNumber";
import { TRAILS_COLLECTION } from "./firestoreTrailPaths";
import {
  removeOpenTrailListing,
  refreshOpenTrailListingFromTrail,
  scheduleOpenTrailListingRefresh,
} from "./firestoreOpenTrailListings";
import { assertPublicTrailHasRoute, trailHasConfiguredRoute } from "./trailAccessPolicy";

export type TrailVisibility = "open" | "private";
export type TrailStatus = "open" | "closed" | "archived";

export type TrailInstance = {
  id: string;
  hostUid: string;
  displayNumber: number;
  publicationId: string | null;
  regionLabel: string | null;
  distanceKm: number | null;
  visibility: TrailVisibility;
  status: TrailStatus;
  createdAtMs: number | null;
  lastActivityAtMs: number | null;
  /** `livePublicationRides` 서브컬렉션 문서 수(목록 UI용, best-effort) */
  liveRiderCount?: number;
};

type TrailInstanceDoc = {
  hostUid: string;
  displayNumber: number;
  publicationId?: string | null;
  regionLabel?: string | null;
  distanceKm?: number | null;
  visibility: TrailVisibility;
  status: TrailStatus;
  createdAt?: FieldValue;
  lastActivityAt?: FieldValue;
};

function resolveTrailPublicationId(data: Record<string, unknown>): string | null {
  const publicationId =
    typeof data.publicationId === "string" && data.publicationId.trim()
      ? data.publicationId.trim()
      : "";
  return publicationId || null;
}

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
    publicationId: resolveTrailPublicationId(data),
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
  publicationId: string | null;
  regionLabel: string;
  distanceKm: number | null;
  visibility?: TrailVisibility;
}): Promise<TrailInstance> {
  const visibility = input.visibility ?? "open";
  if (visibility === "open") {
    assertPublicTrailHasRoute(input.publicationId);
  }
  const db = getFirestore(getFirebaseApp());
  const ref = doc(collection(db, TRAILS_COLLECTION));
  const displayNumber = pickRandomTrailDisplayNumber();
  const publicationId = input.publicationId?.trim() || null;
  const payload: TrailInstanceDoc = {
    hostUid: input.hostUid,
    displayNumber,
    publicationId,
    regionLabel: input.regionLabel,
    distanceKm: input.distanceKm,
    visibility,
    status: "open",
    createdAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  const created: TrailInstance = {
    id: ref.id,
    hostUid: input.hostUid,
    displayNumber,
    publicationId,
    regionLabel: input.regionLabel,
    distanceKm: input.distanceKm,
    visibility: payload.visibility,
    status: "open",
    createdAtMs: Date.now(),
    lastActivityAtMs: Date.now(),
  };
  void refreshOpenTrailListingFromTrail(created.id);
  return created;
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
  void removeOpenTrailListing(trailId);
}

export async function touchTrailInstanceActivity(trailId: string): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  await updateDoc(doc(db, TRAILS_COLLECTION, trailId), {
    lastActivityAt: serverTimestamp(),
  }).catch(() => {});
  scheduleOpenTrailListingRefresh(trailId);
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
  void (visibility === "open"
    ? refreshOpenTrailListingFromTrail(trailId)
    : removeOpenTrailListing(trailId));
}

export function canUserManageTrail(trail: TrailInstance | null, user: User | null | undefined): boolean {
  if (!trail || !user) return false;
  return trail.hostUid === user.uid && trail.status === "open";
}
