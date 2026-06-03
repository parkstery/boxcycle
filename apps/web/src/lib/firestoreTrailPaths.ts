import { LIVE_ROUTE_RIDES_SUBCOLLECTION } from "./firestoreCollections";

/** Firestore Trail 인스턴스 루트 컬렉션 (`rooms` → `trails` 마이그레이션 완료 후 단일 경로) */
export const TRAILS_COLLECTION = "trails" as const;

export const TRAIL_MEMBERS_SUBCOLLECTION = "members" as const;

/** P4 — Trail 주행 진행률 서브컬렉션 */
export const TRAIL_LIVE_ROUTE_RIDES_SUBCOLLECTION = LIVE_ROUTE_RIDES_SUBCOLLECTION;

/** @deprecated `TRAIL_LIVE_ROUTE_RIDES_SUBCOLLECTION` */
export const TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION = TRAIL_LIVE_ROUTE_RIDES_SUBCOLLECTION;
