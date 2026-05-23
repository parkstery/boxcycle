import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { liveAnchorFromCourseData } from "./courseGeometryAnchor.js";

export const COURSE_ACTIVITY_COLLECTION = "courseActivity";
export const WORLD_ACTIVITY_COLLECTION = "worldActivity";
export const WORLD_GLOBAL_ID = "global";

export function pulseLevelFromProgress(progressRatio: number): number {
  if (!Number.isFinite(progressRatio)) return 1;
  const r = Math.max(0, Math.min(1, progressRatio));
  if (r >= 0.75) return 3;
  if (r >= 0.4) return 2;
  return 1;
}

export async function bumpCourseLiveSessionStarted(courseId: string): Promise<void> {
  const id = courseId.trim();
  if (!id) return;
  const db = getFirestore();
  await db.doc(`${COURSE_ACTIVITY_COLLECTION}/${id}`).set(
    {
      activeRiderCount: FieldValue.increment(1),
      liveNow: true,
      pulseLevel: 1,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await db.doc(`${WORLD_ACTIVITY_COLLECTION}/${WORLD_GLOBAL_ID}`).set(
    {
      livePulseCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function bumpCourseLiveSessionEnded(courseId: string): Promise<void> {
  const id = courseId.trim();
  if (!id) return;
  const db = getFirestore();
  const ref = db.doc(`${COURSE_ACTIVITY_COLLECTION}/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur =
      typeof snap.data()?.activeRiderCount === "number" && Number.isFinite(snap.data()!.activeRiderCount)
        ? Math.max(0, Math.floor(snap.data()!.activeRiderCount as number))
        : 0;
    const next = Math.max(0, cur - 1);
    const endedPatch: Record<string, unknown> = {
      activeRiderCount: next,
      liveNow: next > 0,
      pulseLevel: next > 0 ? 1 : 0,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (next === 0) {
      endedPatch.liveAnchorLngLat = FieldValue.delete();
      endedPatch.liveAnchorProgressRatio = FieldValue.delete();
    }
    tx.set(ref, endedPatch, { merge: true });
  });
  const worldRef = db.doc(`${WORLD_ACTIVITY_COLLECTION}/${WORLD_GLOBAL_ID}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(worldRef);
    const cur =
      typeof snap.data()?.livePulseCount === "number" && Number.isFinite(snap.data()!.livePulseCount)
        ? Math.max(0, Math.floor(snap.data()!.livePulseCount as number))
        : 0;
    const next = Math.max(0, cur - 1);
    tx.set(
      worldRef,
      {
        livePulseCount: next,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

export async function touchCourseLiveProgress(courseId: string, progressRatio: number): Promise<void> {
  const id = courseId.trim();
  if (!id) return;
  const db = getFirestore();
  const patch: Record<string, unknown> = {
    liveNow: true,
    pulseLevel: pulseLevelFromProgress(progressRatio),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const courseSnap = await db.doc(`courses/${id}`).get();
  if (courseSnap.exists) {
    const anchor = liveAnchorFromCourseData(
      courseSnap.data() as Record<string, unknown>,
      progressRatio,
    );
    if (anchor) {
      patch.liveAnchorLngLat = anchor.lngLat;
      patch.liveAnchorProgressRatio = anchor.progressRatio;
    }
  }

  await db.doc(`${COURSE_ACTIVITY_COLLECTION}/${id}`).set(patch, { merge: true });
}

const HIGHLIGHTED_COURSES_MAX = 24;

/** 라이브 코스 상위 N개를 `worldActivity/global.highlightedCourses`에 반영 */
export async function refreshWorldHighlightedCourses(): Promise<void> {
  const db = getFirestore();
  const snap = await db
    .collection(COURSE_ACTIVITY_COLLECTION)
    .where("liveNow", "==", true)
    .orderBy("activeRiderCount", "desc")
    .limit(32)
    .get();

  const ranked = snap.docs
    .map((d) => {
      const data = d.data();
      const count =
        typeof data.activeRiderCount === "number" && Number.isFinite(data.activeRiderCount)
          ? Math.max(0, Math.floor(data.activeRiderCount))
          : 0;
      return { id: d.id, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, HIGHLIGHTED_COURSES_MAX)
    .map((r) => r.id);

  let livePulseCount = 0;
  for (const d of snap.docs) {
    const c =
      typeof d.data().activeRiderCount === "number" && Number.isFinite(d.data().activeRiderCount)
        ? Math.max(0, Math.floor(d.data().activeRiderCount))
        : 0;
    livePulseCount += c;
  }

  await db.doc(`${WORLD_ACTIVITY_COLLECTION}/${WORLD_GLOBAL_ID}`).set(
    {
      highlightedCourses: ranked,
      activeCourseCount: snap.size,
      livePulseCount,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
