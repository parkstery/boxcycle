import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { ROUTE_ACTIVITY_COLLECTION } from "./routeActivityConstants.js";

const RIDES_COLLECTION = "rides";

function readEndedAt(raw: unknown): Timestamp | null {
  if (raw instanceof Timestamp) return raw;
  if (typeof raw === "object" && raw !== null && typeof (raw as Timestamp).toMillis === "function") {
    const ms = (raw as Timestamp).toMillis();
    return Number.isFinite(ms) ? (raw as Timestamp) : null;
  }
  return null;
}

export type BackfillLastCompletedRideAtResult = {
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
};

export async function backfillRouteActivityLastCompletedRideAt(input: {
  dryRun?: boolean;
  limit?: number;
  publicationId?: string;
}): Promise<BackfillLastCompletedRideAtResult> {
  const dryRun = input.dryRun === true;
  const limit = Math.min(200, Math.max(1, typeof input.limit === "number" ? input.limit : 50));
  const singlePublicationId = typeof input.publicationId === "string" ? input.publicationId.trim() : "";

  const db = getFirestore();
  const result: BackfillLastCompletedRideAtResult = { scanned: 0, updated: 0, skipped: 0, errors: 0 };

  let activityDocs: FirebaseFirestore.QueryDocumentSnapshot[];
  if (singlePublicationId) {
    const snap = await db.doc(`${ROUTE_ACTIVITY_COLLECTION}/${singlePublicationId}`).get();
    activityDocs = snap.exists ? [snap as FirebaseFirestore.QueryDocumentSnapshot] : [];
  } else {
    const snap = await db.collection(ROUTE_ACTIVITY_COLLECTION).limit(limit).get();
    activityDocs = snap.docs;
  }

  for (const activityDoc of activityDocs) {
    result.scanned += 1;
    const data = activityDoc.data();
    if (data.lastCompletedRideAt != null) {
      result.skipped += 1;
      continue;
    }

    try {
      const rideSnap = await db
        .collection(RIDES_COLLECTION)
        .where("publicationId", "==", activityDoc.id)
        .where("status", "==", "completed")
        .orderBy("endedAt", "desc")
        .limit(1)
        .get();

      if (rideSnap.empty) {
        result.skipped += 1;
        continue;
      }

      const endedAt = readEndedAt(rideSnap.docs[0].get("endedAt"));
      if (!endedAt) {
        result.skipped += 1;
        continue;
      }

      if (!dryRun) {
        await db.doc(`${ROUTE_ACTIVITY_COLLECTION}/${activityDoc.id}`).set(
          { lastCompletedRideAt: endedAt },
          { merge: true },
        );
      }
      result.updated += 1;
    } catch (e) {
      console.error("[backfillRouteActivityLastCompletedRideAt]", activityDoc.id, e);
      result.errors += 1;
    }
  }

  return result;
}
