import { getFirestore } from "firebase-admin/firestore";
import { ROUTE_ACTIVITY_COLLECTION } from "./routeActivityConstants.js";

export type BackfillRouteActivityResult = {
  dryRun: boolean;
  scanned: number;
  copied: number;
  skipped: number;
};

export async function backfillRouteActivityFromCourseActivity(input: {
  dryRun: boolean;
}): Promise<BackfillRouteActivityResult> {
  const db = getFirestore();
  const snap = await db.collection("courseActivity").get();
  let copied = 0;

  if (!input.dryRun) {
    let batch = db.batch();
    let ops = 0;
    for (const doc of snap.docs) {
      const targetRef = db.collection(ROUTE_ACTIVITY_COLLECTION).doc(doc.id);
      batch.set(targetRef, doc.data(), { merge: true });
      copied += 1;
      ops += 1;
      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
  } else {
    copied = snap.size;
  }

  return {
    dryRun: input.dryRun,
    scanned: snap.size,
    copied,
    skipped: 0,
  };
}
