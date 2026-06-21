import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { ROUTE_ACTIVITY_COLLECTION } from "./routeActivityConstants.js";

const WORLD_ACTIVITY = "worldActivity";
const WORLD_GLOBAL_ID = "global";

function readRideEndedAt(data: Record<string, unknown>): Timestamp | ReturnType<typeof FieldValue.serverTimestamp> {
  const raw = data.endedAt;
  if (raw instanceof Timestamp) return raw;
  if (typeof raw === "string") {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
  }
  if (typeof raw === "object" && raw !== null && typeof (raw as Timestamp).toMillis === "function") {
    return raw as Timestamp;
  }
  return FieldValue.serverTimestamp();
}

/**
 * `rides` 완주 시 publication·월드 aggregate increment (클라이언트 write 없음).
 */
export const routeActivityOnRideCreated = onDocumentCreated(
  { document: "rides/{rideId}", region: "asia-northeast3" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const publicationId =
      typeof data.publicationId === "string" ? data.publicationId.trim() : "";
    const activityKey = publicationId;
    const db = getFirestore();
    const lastCompletedRideAt = readRideEndedAt(data as Record<string, unknown>);

    await db
      .doc(`${WORLD_ACTIVITY}/${WORLD_GLOBAL_ID}`)
      .set(
        {
          recentRideCount30d: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    if (!activityKey) return;

    await db.doc(`${ROUTE_ACTIVITY_COLLECTION}/${activityKey}`).set(
      {
        recentRideCount7d: FieldValue.increment(1),
        lastCompletedRideAt,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  },
);
