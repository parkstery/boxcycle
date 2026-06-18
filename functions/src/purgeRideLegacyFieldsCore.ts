import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";

const PAGE_SIZE = 500;
const BATCH_LIMIT = 500;

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export type PurgeRideLegacyFieldsResult = {
  dryRun: boolean;
  scanned: number;
  matched: number;
  updated: number;
  removed: {
    roomId: number;
    userRouteId: number;
  };
};

export async function purgeRideLegacyFieldsWithAdminSdk(input: {
  dryRun: boolean;
}): Promise<PurgeRideLegacyFieldsResult> {
  const db = getFirestore();
  let scanned = 0;
  let matched = 0;
  let updated = 0;
  const removed = { roomId: 0, userRouteId: 0 };
  let lastId: string | undefined;

  while (true) {
    let q = db.collection("rides").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;

    const pending: Array<{ ref: FirebaseFirestore.DocumentReference; patch: Record<string, unknown> }> = [];
    for (const doc of snap.docs) {
      scanned += 1;
      const data = doc.data() as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (trimOrNull(data.trailId) && trimOrNull(data.roomId)) {
        patch.roomId = FieldValue.delete();
        removed.roomId += 1;
      }
      if (trimOrNull(data.routeId) && trimOrNull(data.userRouteId)) {
        patch.userRouteId = FieldValue.delete();
        removed.userRouteId += 1;
      }
      if (Object.keys(patch).length === 0) continue;
      matched += 1;
      if (!input.dryRun) pending.push({ ref: doc.ref, patch });
    }

    if (!input.dryRun) {
      for (let i = 0; i < pending.length; i += BATCH_LIMIT) {
        const chunk = pending.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const item of chunk) batch.update(item.ref, item.patch);
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
    removed,
  };
}
