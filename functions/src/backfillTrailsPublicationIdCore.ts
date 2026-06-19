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

/** `trails`·`openTrailListings` — `courseId` → `publicationId` copy 후 `courseId` delete */
export async function backfillTrailsPublicationIdWithAdminSdk(input: {
  dryRun: boolean;
}): Promise<BackfillTrailsPublicationIdResult> {
  const trails = await processCollection("trails", input.dryRun);
  const listings = await processCollection("openTrailListings", input.dryRun);
  return { dryRun: input.dryRun, trails, listings };
}
