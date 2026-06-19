import {
  type DocumentData,
  FieldValue,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";

import { TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION } from "./trailPaths.js";

export const TRAILS_COLLECTION = "trails";
export const OPEN_TRAIL_LISTINGS_COLLECTION = "openTrailListings";
const MEMBERS_SUB = "members";
const LIVE_SUB = TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION;

/** 클라이언트 `TRAIL_PRESENCE_STALE_MS` 와 동일 */
export const TRAIL_PRESENCE_STALE_MS = 240_000;

/** listing `updatedAt` 이 이보다 오래되면 sweeper 가 삭제 */
export const OPEN_TRAIL_LISTING_STALE_MS = 90_000;

export type RecomputeOpenTrailListingResult = "upserted" | "removed" | "skipped";

type TrailMeta = {
  id: string;
  hostUid: string;
  displayNumber: number;
  courseId: string | null;
  regionLabel: string | null;
  distanceKm: number | null;
  visibility: "open" | "private";
  status: "open" | "closed" | "archived";
};

function presenceCutoff(): Timestamp {
  return Timestamp.fromMillis(Date.now() - TRAIL_PRESENCE_STALE_MS);
}

function resolveTrailPublicationId(data: DocumentData | undefined): string | null {
  if (!data) return null;
  const publicationId =
    typeof data.publicationId === "string" && data.publicationId.trim()
      ? data.publicationId.trim()
      : "";
  if (publicationId) return publicationId;
  const legacy =
    typeof data.courseId === "string" && data.courseId.trim() ? data.courseId.trim() : "";
  return legacy || null;
}

function parseTrailMeta(trailId: string, data: DocumentData | undefined): TrailMeta | null {
  if (!data) return null;
  return {
    id: trailId,
    hostUid: typeof data.hostUid === "string" ? data.hostUid : "",
    displayNumber:
      typeof data.displayNumber === "number" && Number.isFinite(data.displayNumber)
        ? Math.max(1, Math.min(999, Math.floor(data.displayNumber)))
        : 1,
    courseId: resolveTrailPublicationId(data),
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
  };
}

function isListableTrail(trail: TrailMeta): boolean {
  return trail.status === "open" && trail.visibility === "open" && Boolean(trail.courseId?.trim());
}

async function countActiveParticipants(trailId: string): Promise<number> {
  const db = getFirestore();
  const cutoff = presenceCutoff();
  const trailRef = db.collection(TRAILS_COLLECTION).doc(trailId);
  const [membersSnap, liveSnap] = await Promise.all([
    trailRef.collection(MEMBERS_SUB).where("lastSeenAt", ">", cutoff).count().get(),
    trailRef.collection(LIVE_SUB).where("lastSeenAt", ">", cutoff).count().get(),
  ]);
  return Math.max(membersSnap.data().count, liveSnap.data().count);
}

/**
 * authoritative 컬렉션을 읽고 `openTrailListings/{trailId}` 전체 재계산(증감 없음).
 */
export async function recomputeOpenTrailListing(
  trailId: string,
): Promise<RecomputeOpenTrailListingResult> {
  if (!trailId || trailId === "default") return "skipped";

  const db = getFirestore();
  const listingRef = db.collection(OPEN_TRAIL_LISTINGS_COLLECTION).doc(trailId);
  const trailSnap = await db.collection(TRAILS_COLLECTION).doc(trailId).get();

  if (!trailSnap.exists) {
    await listingRef.delete().catch(() => {});
    return "removed";
  }

  const trail = parseTrailMeta(trailId, trailSnap.data());
  if (!trail || !isListableTrail(trail)) {
    await listingRef.delete().catch(() => {});
    return "removed";
  }

  const riderCount = await countActiveParticipants(trailId);
  if (riderCount <= 0) {
    await listingRef.delete().catch(() => {});
    return "removed";
  }

  await listingRef.set(
    {
      trailId: trail.id,
      hostUid: trail.hostUid,
      displayNumber: trail.displayNumber,
      regionLabel: trail.regionLabel,
      distanceKm: trail.distanceKm,
      publicationId: trail.courseId,
      riderCount,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return "upserted";
}

/** 유령 listing 정리 — `updatedAt` 기준 */
export async function purgeStaleOpenTrailListings(limit = 80): Promise<number> {
  const db = getFirestore();
  const cutoff = Timestamp.fromMillis(Date.now() - OPEN_TRAIL_LISTING_STALE_MS);
  const snap = await db
    .collection(OPEN_TRAIL_LISTINGS_COLLECTION)
    .where("updatedAt", "<", cutoff)
    .limit(limit)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  return snap.size;
}
