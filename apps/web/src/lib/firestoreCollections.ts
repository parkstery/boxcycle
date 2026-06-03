/**
 * Firestore 컬렉션·서브컬렉션 경로 (P4 — Route 단일 용어).
 * @see document/260603-Route-용어-및-RTW-Pro-브랜딩-통합-전환-방안.md
 */

export const ROUTE_CATALOG_COLLECTION = "routeCatalog" as const;
export const ROUTE_ACTIVITY_COLLECTION = "routeActivity" as const;
export const ROUTE_PRESENCE_COLLECTION = "routePresence" as const;
export const ROUTE_PRESENCE_MEMBERS_SUBCOLLECTION = "members" as const;
export const LIVE_ROUTE_RIDES_SUBCOLLECTION = "liveRouteRides" as const;

/** P4 이전 경로 — 마이그레이션·읽기 폴백용 */
export const LEGACY_COURSES_COLLECTION = "courses" as const;
export const LEGACY_COURSE_ACTIVITY_COLLECTION = "courseActivity" as const;
export const LEGACY_COURSE_PRESENCE_COLLECTION = "coursePresence" as const;
export const LEGACY_LIVE_COURSE_RIDES_SUBCOLLECTION = "liveCourseRides" as const;
