# 결과60 — 캐럿 행 높이 70%

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `face-redesign2`. HEAD `80fb6a6eefbf5408371bef4827b8224e15b8f68e`. 커밋 없음. 지시59 파일은 수정하지 않음.

실제 CSS: `apps/web/src/components/map/MapView.css` (worktree 내 유일).

- `.map-view__pick .map-view__pick-caret`: `min-height`·`height` 24px → 16.8px. padding 0, margin 0, width 100%, 정렬, 배경, 테두리, cursor 유지.
- `.map-view__pick .map-view__pick-caret-ico`: `height` 20px → 14px. `width` 20px 유지. path·색·다른 행·폰트·버튼·hover/focus 규칙 불변.
- 44px 미만은 지시60의 Chief 직접 높이 축소에 따른다.

명령: `git diff --check -- apps/web/src/components/map/MapView.css` exit 0.

미검증: pick fixture의 접힘/펼침·행 70%·svg 범위·값/콜백 보존, 브라우저·서버. Supervisor 재검증으로 남김.
