/** Firestore Trail 인스턴스 — `apps/web/src/lib/firestoreTrailPaths.ts` 와 동기 */
export const TRAILS_COLLECTION = "trails";
export const TRAIL_MEMBERS_SUBCOLLECTION = "members";
/** @deprecated Phase 5 — `livePublicationRides` 로 이전 */
export const TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION = "liveCourseRides";
export const TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION = "livePublicationRides";

export const LIVE_RIDE_SUBCOLLECTIONS = [
  TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION,
  TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION,
] as const;

export function readPublicationIdFromLiveRideData(data: Record<string, unknown>): string {
  const pub = data.publicationId;
  if (typeof pub === "string" && pub.trim()) return pub.trim();
  const legacy = data.courseId;
  return typeof legacy === "string" ? legacy.trim() : "";
}
