import { getFirestore } from "firebase-admin/firestore";
import {
  LIVE_RIDE_SUBCOLLECTIONS,
  readPublicationIdFromLiveRideData,
} from "./trailPaths.js";

export type LiveRideScanRow = {
  publicationId: string;
  lastSeenAt: unknown;
};

/** Phase 5 전환 — `livePublicationRides` 우선, 레거시 `liveCourseRides` 포함 */
export async function scanAllLiveRideDocs(): Promise<LiveRideScanRow[]> {
  const db = getFirestore();
  const out: LiveRideScanRow[] = [];
  for (const group of LIVE_RIDE_SUBCOLLECTIONS) {
    const snap = await db.collectionGroup(group).get();
    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const publicationId = readPublicationIdFromLiveRideData(data);
      if (!publicationId) continue;
      out.push({ publicationId, lastSeenAt: data.lastSeenAt });
    }
  }
  return out;
}
