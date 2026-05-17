import type { DocumentSnapshot } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  bumpCourseLiveSessionEnded,
  bumpCourseLiveSessionStarted,
  refreshWorldHighlightedCourses,
  touchCourseLiveProgress,
} from "./courseActivityAggregateCore.js";

function readCourseId(snap: DocumentSnapshot | undefined): string {
  if (!snap?.exists) return "";
  const c = snap.get("courseId");
  return typeof c === "string" ? c.trim() : "";
}

function readProgressRatio(snap: DocumentSnapshot | undefined): number {
  if (!snap?.exists) return 0;
  const pr = snap.get("progressRatio");
  return typeof pr === "number" && Number.isFinite(pr) ? Math.max(0, Math.min(1, pr)) : 0;
}

/**
 * `trails/{trailId}/liveCourseRides/{uid}` 생성·갱신·삭제 시
 * `courseActivity` / `worldActivity` 의 live 집계를 서버에서만 갱신한다.
 */
export const courseActivityOnLiveCourseRideWritten = onDocumentWritten(
  { document: "trails/{trailId}/liveCourseRides/{uid}", region: "asia-northeast3" },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    const existedBefore = before?.exists ?? false;
    const existsAfter = after?.exists ?? false;

    if (!existedBefore && existsAfter) {
      const courseId = readCourseId(after);
      if (courseId) {
        await bumpCourseLiveSessionStarted(courseId);
        await touchCourseLiveProgress(courseId, readProgressRatio(after));
        await refreshWorldHighlightedCourses();
      }
      return;
    }

    if (existedBefore && !existsAfter) {
      const courseId = readCourseId(before);
      if (courseId) {
        await bumpCourseLiveSessionEnded(courseId);
        await refreshWorldHighlightedCourses();
      }
      return;
    }

    if (existedBefore && existsAfter) {
      const courseIdBefore = readCourseId(before);
      const courseIdAfter = readCourseId(after);
      if (courseIdBefore && courseIdAfter && courseIdBefore !== courseIdAfter) {
        await bumpCourseLiveSessionEnded(courseIdBefore);
        await bumpCourseLiveSessionStarted(courseIdAfter);
        await touchCourseLiveProgress(courseIdAfter, readProgressRatio(after));
        await refreshWorldHighlightedCourses();
        return;
      }
      if (courseIdAfter) {
        await touchCourseLiveProgress(courseIdAfter, readProgressRatio(after));
      }
    }
  },
);
