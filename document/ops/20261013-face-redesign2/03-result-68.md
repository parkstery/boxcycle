# 결과68 — 좁은폰 카메라행의 세로지도열 보호

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `main2`. HEAD `c48e2198d32fac59482dec6fa5a6cc1631557682`. 커밋·푸시 없음. 지시68 파일은 수정하지 않음. 작업 트리 `C:/20.HDev/boxcycle` (별도 worktree 없음).

변경: `apps/web/src/components/maphud/MapHud.css` 끝 지시67 미디어만. 다른 dirty(지시66 TSX·CSS, 지시67 스타일 padding)는 유지.

- `.map-hud:has(.hud-metrics__capsule) .hud-quick-camera` 의 `right: 0` → `right: 3rem`. `top: calc(100% + 1.2rem)`·`position: absolute` 유지.
- 같은 미디어의 `.map-hud:has(.hud-quick-camera):has(.hud-metrics__capsule) .map-hud__tr-under` 블록과 그 주석을 삭제해 기존 맵 버튼 `top` 을 유지.
- 관련 주석에 지시68로 우측 세로 지도열과 기존 맵 버튼 공간을 남긴다는 설명을 추가. 20% 확대·맵 순서·스타일 padding 은 이 턴에서 건드리지 않음.

명령: `git diff --check -- apps/web/src/components/maphud/MapHud.css` exit 0.

미검증: 브라우저·서버·selector/tsc/eslint·전체 시험 없음. 40상태 및 native 지도열 CSS 기반 mock·bounds·터치 좌표는 Supervisor 검증으로 남김.
