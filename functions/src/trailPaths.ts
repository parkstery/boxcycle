/** Firestore Trail 인스턴스 — `apps/web/src/lib/firestoreTrailPaths.ts` 와 동기 */
export const TRAILS_COLLECTION = "trails";
export const TRAIL_MEMBERS_SUBCOLLECTION = "members";
/** @deprecated Phase 5 — `livePublicationRides` 로 이전 */
export const TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION = "liveCourseRides";
export const TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION = "livePublicationRides";

/** Phase 7c C3 — 레거시 `liveCourseRides` 읽기 컷오버: 신규 경로만 스캔(audit `legacyTotal: 0` 확인). */
export const LIVE_RIDE_SUBCOLLECTIONS = [
  TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION,
] as const;

export function readPublicationIdFromLiveRideData(data: Record<string, unknown>): string {
  const pub = data.publicationId;
  return typeof pub === "string" ? pub.trim() : "";
}
