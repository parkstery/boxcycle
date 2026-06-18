import { FieldPath, getFirestore } from "firebase-admin/firestore";
import { isDiscardableRideRecord } from "./rideRecordPolicy.js";

const PAGE_SIZE = 500;
const BATCH_LIMIT = 500;

export type PurgeDiscardableRidesResult = {
  dryRun: boolean;
  scanned: number;
  matched: number;
  deleted: number;
};

export async function purgeDiscardableRidesWithAdminSdk(input: {
  dryRun: boolean;
}): Promise<PurgeDiscardableRidesResult> {
  const db = getFirestore();
  let scanned = 0;
  let matched = 0;
  let deleted = 0;
  let lastId: string | undefined;

  while (true) {
    let q = db.collection("rides").orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;

    const refsToDelete: FirebaseFirestore.DocumentReference[] = [];
    for (const doc of snap.docs) {
      scanned += 1;
      const data = doc.data();
      const distanceMeters = Number(data.distanceMeters ?? 0);
      const elapsedSec = Number(data.elapsedSec ?? 0);
      if (!isDiscardableRideRecord(distanceMeters, elapsedSec)) continue;
      matched += 1;
      if (!input.dryRun) refsToDelete.push(doc.ref);
    }

    if (!input.dryRun) {
      for (let i = 0; i < refsToDelete.length; i += BATCH_LIMIT) {
        const chunk = refsToDelete.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const ref of chunk) batch.delete(ref);
        await batch.commit();
        deleted += chunk.length;
      }
    }

    lastId = snap.docs[snap.docs.length - 1]!.id;
    if (snap.size < PAGE_SIZE) break;
  }

  return {
    dryRun: input.dryRun,
    scanned,
    matched,
    deleted: input.dryRun ? 0 : deleted,
  };
}
