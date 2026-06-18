import {
  FieldValue,
  getFirestore,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { COURSE_ACTIVITY_COLLECTION } from "./courseActivityAggregateCore.js";
import { ROUTE_ACTIVITY_COLLECTION } from "./routeActivityConstants.js";

const RIDES_COLLECTION = "rides";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 400;

/**
 * 최근 7일 `rides`(completed, courseId 있음)를 집계해
 * `courseActivity.recentRideCount7d` 를 increment 드리프트 없이 맞춘다.
 */
export const courseActivityHeatReconcile = onSchedule(
  {
    schedule: "every day 04:00",
    region: "asia-northeast3",
    timeZone: "Asia/Seoul",
  },
  async () => {
    const db = getFirestore();
    const since = Timestamp.fromMillis(Date.now() - SEVEN_DAYS_MS);
    const counts = new Map<string, number>();

    let last: QueryDocumentSnapshot | undefined;
    for (;;) {
      let q = db
        .collection(RIDES_COLLECTION)
        .where("status", "==", "completed")
        .where("endedAt", ">=", since)
        .orderBy("endedAt")
        .limit(PAGE_SIZE);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      if (snap.empty) break;
      for (const doc of snap.docs) {
        const publicationId = doc.get("publicationId");
        const courseId = doc.get("courseId");
        const raw =
          typeof publicationId === "string" && publicationId.trim().length > 0
            ? publicationId.trim()
            : typeof courseId === "string"
              ? courseId.trim()
              : "";
        if (!raw) continue;
        counts.set(raw, (counts.get(raw) ?? 0) + 1);
      }
      last = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE_SIZE) break;
    }

    const activitySnap = await db.collection(COURSE_ACTIVITY_COLLECTION).get();
    const toUpdate = new Set<string>([...counts.keys()]);
    for (const d of activitySnap.docs) {
      const prev =
        typeof d.data().recentRideCount7d === "number" && Number.isFinite(d.data().recentRideCount7d)
          ? Math.max(0, Math.floor(d.data().recentRideCount7d))
          : 0;
      if (prev > 0) toUpdate.add(d.id);
    }

    let batch = db.batch();
    let ops = 0;
    for (const courseId of toUpdate) {
      const next = counts.get(courseId) ?? 0;
      const heatPatch = {
        recentRideCount7d: next,
        updatedAt: FieldValue.serverTimestamp(),
      };
      batch.set(db.doc(`${COURSE_ACTIVITY_COLLECTION}/${courseId}`), heatPatch, { merge: true });
      batch.set(db.doc(`${ROUTE_ACTIVITY_COLLECTION}/${courseId}`), heatPatch, { merge: true });
      ops += 1;
      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    console.info("[courseActivityHeatReconcile]", {
      coursesWithRides7d: counts.size,
      coursesUpdated: toUpdate.size,
    });
  },
);
