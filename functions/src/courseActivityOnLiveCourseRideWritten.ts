import type { DocumentSnapshot } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  bumpCourseLiveSessionEnded,
  bumpCourseLiveSessionStarted,
  pulseLevelFromProgress,
  refreshWorldHighlightedCourses,
  touchCourseLiveProgressPulseOnly,
  touchCourseLiveProgressWithAnchor,
} from "./courseActivityAggregateCore.js";
import {
  bumpPublicationLiveSessionEnded,
  bumpPublicationLiveSessionStarted,
} from "./publicationPresenceCore.js";

/** 클라이언트 `TRAIL_LIVE_PROGRESS_MIN_DELTA` 와 동일 — 이보다 작은 progress 변화는 집계 생략 */
const PROGRESS_AGGREGATE_MIN_DELTA = 0.012;

/** 이 이상 progress 변화 시에만 `courses` 를 읽어 map anchor 재계산 */
const PROGRESS_ANCHOR_REFRESH_DELTA = 0.08;

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

function progressDelta(before: number, after: number): number {
  return Math.abs(after - before);
}

/** `lastSeenAt`·displayName 만 바뀐 하트비트 — courseId·progress 의미 동일 */
function isHeartbeatOnlyUpdate(before: DocumentSnapshot, after: DocumentSnapshot): boolean {
  if (readCourseId(before) !== readCourseId(after)) return false;
  const d = progressDelta(readProgressRatio(before), readProgressRatio(after));
  if (d >= PROGRESS_AGGREGATE_MIN_DELTA) return false;
  if (
    pulseLevelFromProgress(readProgressRatio(before)) !==
    pulseLevelFromProgress(readProgressRatio(after))
  ) {
    return false;
  }
  return true;
}

/**
 * `trails/{trailId}/liveCourseRides/{uid}` 생성·갱신·삭제 시
 * `courseActivity` / `worldActivity` 의 live 집계를 서버에서만 갱신한다.
 *
 * `onDocumentWritten` 은 모든 write 마다 호출되므로, update 경로에서는
 * progress·pulse 의미 변화가 없으면 조기 return 한다 (Firestore 읽기/쓰기·CPU 절감).
 * `liveCourseRides` 문서에는 다시 쓰지 않는다 (self-write 루프 없음).
 */
export const courseActivityOnLiveCourseRideWritten = onDocumentWritten(
  { document: "trails/{trailId}/liveRouteRides/{uid}", region: "asia-northeast3" },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    const existedBefore = before?.exists ?? false;
    const existsAfter = after?.exists ?? false;

    if (!existedBefore && existsAfter) {
      const courseId = readCourseId(after);
      if (courseId) {
        await bumpCourseLiveSessionStarted(courseId);
        await bumpPublicationLiveSessionStarted(courseId);
        await touchCourseLiveProgressWithAnchor(courseId, readProgressRatio(after));
        await refreshWorldHighlightedCourses();
      }
      return;
    }

    if (existedBefore && !existsAfter) {
      const courseId = readCourseId(before);
      if (courseId) {
        await bumpCourseLiveSessionEnded(courseId);
        await bumpPublicationLiveSessionEnded(courseId);
        await refreshWorldHighlightedCourses();
      }
      return;
    }

    if (existedBefore && existsAfter && before && after) {
      if (isHeartbeatOnlyUpdate(before, after)) {
        return;
      }

      const courseIdBefore = readCourseId(before);
      const courseIdAfter = readCourseId(after);
      const prBefore = readProgressRatio(before);
      const prAfter = readProgressRatio(after);

      if (courseIdBefore && courseIdAfter && courseIdBefore !== courseIdAfter) {
        await bumpCourseLiveSessionEnded(courseIdBefore);
        await bumpPublicationLiveSessionEnded(courseIdBefore);
        await bumpCourseLiveSessionStarted(courseIdAfter);
        await bumpPublicationLiveSessionStarted(courseIdAfter);
        await touchCourseLiveProgressWithAnchor(courseIdAfter, prAfter);
        await refreshWorldHighlightedCourses();
        return;
      }

      if (!courseIdAfter) return;

      const d = progressDelta(prBefore, prAfter);
      const pulseChanged =
        pulseLevelFromProgress(prBefore) !== pulseLevelFromProgress(prAfter);

      if (d < PROGRESS_AGGREGATE_MIN_DELTA && !pulseChanged) {
        return;
      }

      if (d >= PROGRESS_ANCHOR_REFRESH_DELTA) {
        await touchCourseLiveProgressWithAnchor(courseIdAfter, prAfter);
      } else {
        await touchCourseLiveProgressPulseOnly(courseIdAfter, prAfter);
      }
    }
  },
);
