import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { ROUTE_ACTIVITY_COLLECTION } from "./routeActivityConstants.js";

const WORLD_ACTIVITY = "worldActivity";
const WORLD_GLOBAL_ID = "global";

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
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  },
);
