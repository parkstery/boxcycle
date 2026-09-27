/** Firestore Trail 인스턴스 루트 컬렉션 (`rooms` → `trails` 마이그레이션 완료 후 단일 경로) */
export const TRAILS_COLLECTION = "trails" as const;

export const TRAIL_MEMBERS_SUBCOLLECTION = "members" as const;
export const TRAIL_LIVE_PUBLICATION_RIDES_SUBCOLLECTION = "livePublicationRides" as const;
