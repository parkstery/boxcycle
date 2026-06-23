/**
 * 제품 표면 용어 — 단일 진실: `document/260517-제품-용어-Trailhead-Trail.md`
 * Firestore 경로 `trails/`. `rides.trailId` = Trail ID (레거시 문서는 `roomId` 폴백).
 * Trailhead = `DEFAULT_TRAIL_ID` Trail 인스턴스 — 「어느 Trail에 있는가」 범주에 포함.
 */
export const TRAILHEAD_LABEL = "Trailhead";
export const TRAIL_LABEL = "Trail";

/**
 * false — 「Trailhead로」·주행 종료 후 Trailhead 복귀·HUD Trailhead 접속 블록 비활성.
 * `openTrailListings` 공개 Trail 목록·합류는 유지. Firestore `DEFAULT_TRAIL_ID` presence 허브는 그대로.
 */
export const TRAILHEAD_NAV_ENABLED = false;

export { DEFAULT_TRAIL_ID } from "./firestoreTrail";
