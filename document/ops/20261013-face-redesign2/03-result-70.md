# 결과70 — 좁은폰 카메라 right 4rem

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `main2`. HEAD `c48e2198d32fac59482dec6fa5a6cc1631557682`. 커밋·푸시 없음. 지시70 파일은 수정하지 않음. 작업 트리 `C:/20.HDev/boxcycle` (별도 worktree 없음).

변경: `apps/web/src/components/maphud/MapHud.css` 끝 `@media (max-width: 740px) and (max-height: 560px)` 안 카메라 `right` 한 값과 그 주석만. 기존 dirty(지시66~69 패딩·버튼 20%·`top`·이벤트·순서)는 유지.

- `.map-hud:has(.hud-metrics__capsule) .hud-quick-camera` 의 `right: 3rem` → `right: 4rem`.
- 같은 블록 주석 `지시68: 카메라 행만 right 3rem` → `right 4rem`. `position`·`top: calc(100% + 1.2rem)` 은 그대로.

명령: `git diff --check -- apps/web/src/components/maphud/MapHud.css` exit 0.

미검증: 브라우저·서버·selector/tsc/eslint·전체 시험 없음. 카메라 6과 맵트리거 시각 간격, 카메라·맵조작·계정·맵트리거 버튼 쌍 bbox 교차 0 검사는 Supervisor 검증으로 남김.
