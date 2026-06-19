import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";

const PAGE_SIZE = 400;
const BATCH_LIMIT = 400;

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export type BackfillTrailsPublicationIdResult = {
  dryRun: boolean;
  trails: { scanned: number; publicationIdSet: number; courseIdRemoved: number };
  listings: { scanned: number; publicationIdSet: number; courseIdRemoved: number };
  openTrailListingsRefreshed: number;
};

async function processCollection(
  collectionId: string,
  dryRun: boolean,
): Promise<{ scanned: number; publicationIdSet: number; courseIdRemoved: number }> {
  const db = getFirestore();
  let scanned = 0;
  let publicationIdSet = 0;
  let courseIdRemoved = 0;
  let lastId: string | undefined;

  while (true) {
    let q = db.collection(collectionId).orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;

    const pending: Array<{ ref: FirebaseFirestore.DocumentReference; patch: Record<string, unknown> }> =
      [];

    for (const doc of snap.docs) {
      scanned += 1;
      const data = doc.data() as Record<string, unknown>;
      const courseId = trimOrNull(data.courseId);
      const publicationId = trimOrNull(data.publicationId);
      const patch: Record<string, unknown> = {};

      if (!publicationId && courseId) {
        patch.publicationId = courseId;
        publicationIdSet += 1;
      }

      if (courseId) {
        patch.courseId = FieldValue.delete();
        courseIdRemoved += 1;
      }

      if (Object.keys(patch).length === 0) continue;
      if (!dryRun) pending.push({ ref: doc.ref, patch });
    }

    if (!dryRun) {
      for (let i = 0; i < pending.length; i += BATCH_LIMIT) {
        const chunk = pending.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const item of chunk) batch.update(item.ref, item.patch);
        await batch.commit();
      }
    }

    lastId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }

  return { scanned, publicationIdSet, courseIdRemoved };
}

/** 공개 Trail — `openTrailListings` upsert (라이더 0명도 목록 유지) */
async function refreshOpenTrailListingsFromTrails(
  dryRun: boolean,
): Promise<number> {
  const db = getFirestore();
  const snap = await db
    .collection("trails")
    .where("visibility", "==", "open")
    .where("status", "==", "open")
    .get();
  let refreshed = 0;
  const pending: Array<{ ref: FirebaseFirestore.DocumentReference; patch: Record<string, unknown> }> =
    [];

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const publicationId = trimOrNull(data.publicationId) ?? trimOrNull(data.courseId);
    if (!publicationId) continue;
    refreshed += 1;
    if (!dryRun) {
      pending.push({
        ref: db.collection("openTrailListings").doc(doc.id),
        patch: {
          trailId: doc.id,
          hostUid: typeof data.hostUid === "string" ? data.hostUid : "",
          displayNumber:
            typeof data.displayNumber === "number" && Number.isFinite(data.displayNumber)
              ? Math.max(1, Math.min(999, Math.floor(data.displayNumber)))
              : 1,
          regionLabel: typeof data.regionLabel === "string" ? data.regionLabel : null,
          distanceKm: typeof data.distanceKm === "number" ? data.distanceKm : null,
          publicationId,
          riderCount: 0,
          updatedAt: FieldValue.serverTimestamp(),
        },
      });
    }
  }

  if (!dryRun) {
    for (let i = 0; i < pending.length; i += BATCH_LIMIT) {
      const chunk = pending.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const item of chunk) batch.set(item.ref, item.patch, { merge: true });
      await batch.commit();
    }
  }

  return refreshed;
}

/** `trails`·`openTrailListings` — `courseId` → `publicationId` copy 후 `courseId` delete */
export async function backfillTrailsPublicationIdWithAdminSdk(input: {
  dryRun: boolean;
}): Promise<BackfillTrailsPublicationIdResult> {
  const trails = await processCollection("trails", input.dryRun);
  const listings = await processCollection("openTrailListings", input.dryRun);
  const openTrailListingsRefreshed = await refreshOpenTrailListingsFromTrails(input.dryRun);
  return { dryRun: input.dryRun, trails, listings, openTrailListingsRefreshed };
}
