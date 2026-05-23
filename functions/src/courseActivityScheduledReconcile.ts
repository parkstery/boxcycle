import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  COURSE_ACTIVITY_COLLECTION,
  WORLD_ACTIVITY_COLLECTION,
  WORLD_GLOBAL_ID,
} from "./courseActivityAggregateCore.js";

/** 클라이언트 `LOBBY_STALE_MS`(240s)보다 짧게 — stale live 문서는 집계에서 제외 */
const LIVE_RIDE_FRESH_MS = 180_000;
const HIGHLIGHTED_COURSES_MAX = 24;

function lastSeenMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && typeof (raw as Timestamp).toMillis === "function") {
    const ms = (raw as Timestamp).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/**
 * `liveCourseRides` collection group 기준으로 코스별 activeRiderCount·world 집계를 재계산한다.
 * increment 기반 CF와 드리프트가 나면 주기적으로 맞춘다.
 */
export const courseActivityScheduledReconcile = onSchedule(
  {
    schedule: "every 6 hours",
    region: "asia-northeast3",
    timeZone: "Asia/Seoul",
  },
  async () => {
    const db = getFirestore();
    const now = Date.now();
    const byCourse = new Map<string, number>();
    let livePulseCount = 0;

    const liveSnap = await db.collectionGroup("liveCourseRides").get();
    for (const doc of liveSnap.docs) {
      const data = doc.data();
      const seenMs = lastSeenMs(data.lastSeenAt);
      if (seenMs == null || now - seenMs > LIVE_RIDE_FRESH_MS) continue;
      const courseId = typeof data.courseId === "string" ? data.courseId.trim() : "";
      if (!courseId) continue;
      livePulseCount += 1;
      byCourse.set(courseId, (byCourse.get(courseId) ?? 0) + 1);
    }

    const activitySnap = await db.collection(COURSE_ACTIVITY_COLLECTION).get();
    const batch = db.batch();
    let batchOps = 0;

    const writeCourse = (courseId: string, count: number) => {
      const ref = db.doc(`${COURSE_ACTIVITY_COLLECTION}/${courseId}`);
      batch.set(
        ref,
        {
          activeRiderCount: count,
          liveNow: count > 0,
          pulseLevel: count > 0 ? Math.min(3, Math.max(1, count)) : 0,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      batchOps += 1;
    };

    for (const [courseId, count] of byCourse) {
      writeCourse(courseId, count);
    }

    for (const d of activitySnap.docs) {
      if (byCourse.has(d.id)) continue;
      const prev = d.data();
      const hadLive =
        prev.liveNow === true ||
        (typeof prev.activeRiderCount === "number" && prev.activeRiderCount > 0);
      if (!hadLive) continue;
      writeCourse(d.id, 0);
    }

    const highlightedCourses = [...byCourse.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, HIGHLIGHTED_COURSES_MAX)
      .map(([id]) => id);

    batch.set(
      db.doc(`${WORLD_ACTIVITY_COLLECTION}/${WORLD_GLOBAL_ID}`),
      {
        livePulseCount,
        activeCourseCount: byCourse.size,
        highlightedCourses,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    batchOps += 1;

    if (batchOps > 0) {
      await batch.commit();
    }

    console.info("[courseActivityReconcile]", {
      livePulseCount,
      activeCourseCount: byCourse.size,
      highlightedCourses,
    });
  },
);
