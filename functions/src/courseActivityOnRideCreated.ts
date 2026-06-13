import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

const COURSE_ACTIVITY = "courseActivity";
const WORLD_ACTIVITY = "worldActivity";
const WORLD_GLOBAL_ID = "global";

/**
 * `rides` 완주 시 코스·월드 aggregate increment (클라이언트 write 없음).
 * 문서가 없으면 merge로 생성된다.
 */
export const courseActivityOnRideCreated = onDocumentCreated(
  { document: "rides/{rideId}", region: "asia-northeast3" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const courseId = typeof data.courseId === "string" ? data.courseId.trim() : "";
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

    if (!courseId) return;

    await db.doc(`${COURSE_ACTIVITY}/${courseId}`).set(
      {
        recentRideCount7d: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  },
);
