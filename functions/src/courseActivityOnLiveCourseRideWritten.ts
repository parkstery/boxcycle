import type { DocumentSnapshot } from "firebase-admin/firestore";

import { onDocumentWritten } from "firebase-functions/v2/firestore";

import {

  bumpCourseLiveSessionEnded,

  bumpCourseLiveSessionStarted,

  pulseLevelFromProgress,

  refreshWorldHighlightedCourses,

  touchCourseLiveProgressPulseOnly,

  touchCourseLiveProgressWithAnchor,

} from "./routeActivityAggregateCore.js";

import {

  bumpPublicationLiveSessionEnded,

  bumpPublicationLiveSessionStarted,

} from "./publicationPresenceCore.js";

import { readPublicationIdFromLiveRideData } from "./trailPaths.js";



/** 클라이언트 `TRAIL_LIVE_PROGRESS_MIN_DELTA` 와 동일 — 이보다 작은 progress 변화는 집계 생략 */

const PROGRESS_AGGREGATE_MIN_DELTA = 0.012;



/** 이 이상 progress 변화 시에만 geometry anchor 재계산 */

const PROGRESS_ANCHOR_REFRESH_DELTA = 0.08;



function readPublicationId(snap: DocumentSnapshot | undefined): string {

  if (!snap?.exists) return "";

  return readPublicationIdFromLiveRideData(snap.data() as Record<string, unknown>);

}



function readProgressRatio(snap: DocumentSnapshot | undefined): number {

  if (!snap?.exists) return 0;

  const pr = snap.get("progressRatio");

  return typeof pr === "number" && Number.isFinite(pr) ? Math.max(0, Math.min(1, pr)) : 0;

}



function progressDelta(before: number, after: number): number {

  return Math.abs(after - before);

}



/** `lastSeenAt`·displayName 만 바뀐 하트비트 — publicationId·progress 의미 동일 */

function isHeartbeatOnlyUpdate(before: DocumentSnapshot, after: DocumentSnapshot): boolean {

  if (readPublicationId(before) !== readPublicationId(after)) return false;

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

 * `trails/{trailId}/livePublicationRides/{uid}` 생성·갱신·삭제 시

 * `routeActivity` / `worldActivity` 의 live 집계를 서버에서만 갱신한다.

 */

export const courseActivityOnLiveCourseRideWritten = onDocumentWritten(

  { document: "trails/{trailId}/livePublicationRides/{uid}", region: "asia-northeast3" },

  async (event) => {

    const before = event.data?.before;

    const after = event.data?.after;

    const existedBefore = before?.exists ?? false;

    const existsAfter = after?.exists ?? false;



    if (!existedBefore && existsAfter) {

      const publicationId = readPublicationId(after);

      if (publicationId) {

        await bumpCourseLiveSessionStarted(publicationId);

        await bumpPublicationLiveSessionStarted(publicationId);

        await touchCourseLiveProgressWithAnchor(publicationId, readProgressRatio(after));

        await refreshWorldHighlightedCourses();

      }

      return;

    }



    if (existedBefore && !existsAfter) {

      const publicationId = readPublicationId(before);

      if (publicationId) {

        await bumpCourseLiveSessionEnded(publicationId);

        await bumpPublicationLiveSessionEnded(publicationId);

        await refreshWorldHighlightedCourses();

      }

      return;

    }



    if (existedBefore && existsAfter && before && after) {

      if (isHeartbeatOnlyUpdate(before, after)) {

        return;

      }



      const publicationIdBefore = readPublicationId(before);

      const publicationIdAfter = readPublicationId(after);

      const prBefore = readProgressRatio(before);

      const prAfter = readProgressRatio(after);



      if (publicationIdBefore && publicationIdAfter && publicationIdBefore !== publicationIdAfter) {

        await bumpCourseLiveSessionEnded(publicationIdBefore);

        await bumpPublicationLiveSessionEnded(publicationIdBefore);

        await bumpCourseLiveSessionStarted(publicationIdAfter);

        await bumpPublicationLiveSessionStarted(publicationIdAfter);

        await touchCourseLiveProgressWithAnchor(publicationIdAfter, prAfter);

        await refreshWorldHighlightedCourses();

        return;

      }



      if (!publicationIdAfter) return;



      const d = progressDelta(prBefore, prAfter);

      const pulseChanged =

        pulseLevelFromProgress(prBefore) !== pulseLevelFromProgress(prAfter);



      if (d < PROGRESS_AGGREGATE_MIN_DELTA && !pulseChanged) {

        return;

      }



      if (d >= PROGRESS_ANCHOR_REFRESH_DELTA) {

        await touchCourseLiveProgressWithAnchor(publicationIdAfter, prAfter);

      } else {

        await touchCourseLiveProgressPulseOnly(publicationIdAfter, prAfter);

      }

    }

  },

);

