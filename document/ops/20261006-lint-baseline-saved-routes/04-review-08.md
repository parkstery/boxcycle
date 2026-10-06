# 검수 08 — useSavedRoutesWorkspace set-state-in-effect

- Supervisor: Claude · 판정: **APPROVED**
- effect → 「이전 user 비교」 렌더 중 clear(코드베이스 관례). 로그아웃 시 비움 의미 보존.
- 렌더 중 clear 가 effect cleanup 보다 먼저라 생기는 in-flight 로드 재충전 창을 `activeSavedRoutesUidRef`(layout 동기화)+`stillActive()` 로 차단 — 종전보다 엄격.
- eslint 1 error → 0, tsc 0, menu-a pass(결과 08). pre-commit 통과로 재확인(커밋).
