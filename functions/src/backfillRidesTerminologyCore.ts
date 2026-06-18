import { FieldPath, getFirestore } from "firebase-admin/firestore";

const PAGE_SIZE = 500;
const BATCH_LIMIT = 500;

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export type RideTerminologyBackfillPatch = {
  trailId?: string;
  routeId?: string;
  publicationId?: string;
};

export function buildRideTerminologyBackfillPatch(
  data: Record<string, unknown>,
): RideTerminologyBackfillPatch {
  const patch: RideTerminologyBackfillPatch = {};
  const roomId = trimOrNull(data.roomId);
  const trailId = trimOrNull(data.trailId);
  if (!trailId && roomId) patch.trailId = roomId;

  const userRouteId = trimOrNull(data.userRouteId);
  const routeId = trimOrNull(data.routeId);
  if (!routeId && userRouteId) patch.routeId = userRouteId;

  const courseId = trimOrNull(data.courseId);
  const publicationId = trimOrNull(data.publicationId);
  if (!publicationId && courseId) patch.publicationId = courseId;

  return patch;
}

export type BackfillRidesTerminologyResult = {
  dryRun: boolean;
  scanned: number;
  matched: number;
  updated: number;
  patches: {
    trailId: number;
    routeId: number;
    publicationId: number;
  };
};

export async function backfillRidesTerminologyWithAdminSdk(input: {
  dryRun: boolean;
}): Promise<BackfillRidesTerminologyResult> {
  const db = getFirestore();
  let scanned = 0;
  let matched = 0;
  let updated = 0;
  const patches = { trailId: 0, routeId: 0, publicationId: 0 };
  let lastId: string | undefined;

  while (true) {
    let q = db.collection("rides").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;

    const pending: Array<{ ref: FirebaseFirestore.DocumentReference; patch: RideTerminologyBackfillPatch }> = [];
    for (const doc of snap.docs) {
      scanned += 1;
      const patch = buildRideTerminologyBackfillPatch(doc.data() as Record<string, unknown>);
      if (Object.keys(patch).length === 0) continue;
      matched += 1;
      if (patch.trailId) patches.trailId += 1;
      if (patch.routeId) patches.routeId += 1;
      if (patch.publicationId) patches.publicationId += 1;
      if (!input.dryRun) pending.push({ ref: doc.ref, patch });
    }

    if (!input.dryRun) {
      for (let i = 0; i < pending.length; i += BATCH_LIMIT) {
        const chunk = pending.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const item of chunk) {
          batch.update(item.ref, item.patch);
        }
        await batch.commit();
        updated += chunk.length;
      }
    }

    lastId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }

  return {
    dryRun: input.dryRun,
    scanned,
    matched,
    updated: input.dryRun ? 0 : updated,
    patches,
  };
}
