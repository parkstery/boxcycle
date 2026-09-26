/**
 * 제품 표면 용어 — 단일 진실: `document/260517-제품-용어-Trailhead-Trail.md`
 * Firestore 경로 `trails/`. `rides.trailId` = Trail ID (레거시 문서는 `roomId` 폴백).
 * Trailhead = `DEFAULT_TRAIL_ID` Trail 인스턴스 — 「어느 Trail에 있는가」 범주에 포함.
 */
export const TRAILHEAD_LABEL = "Trailhead";
export const TRAIL_LABEL = "Trail";

/*
 * 2026-09-26 (Phase 6-D3): `DEFAULT_TRAIL_ID` 편의 re-export 를 지웠다.
 * **아무도 이 모듈을 경유해 쓰지 않았고**(소비자는 전부 trail 쪽을 직접 본다),
 * 그 한 줄 때문에 leaf 도메인인 terms 가 Trail 저장소를 import 하고 있었다.
 * 값의 자리는 `trail/trailId.ts` 다.
 */
