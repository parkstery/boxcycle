# 결과46 — 주행 설정 창 밀도 정리

모델: Auto (Cursor agent router). session: CURSOR_CONVERSATION_ID `a29bb4a8-3d90-47ee-a930-f3762173a7ef`. branch `face-redesign2`. HEAD `51866a569698be3afb97ed842cd6b6314346dc12`.

소유 파일 `apps/web/src/components/ride/RideSettingsSheet.css` 끝에 scoped 블록만 추가. 기존 선언은 수정하지 않음. 다른 파일·브라우저·서버·tsc·전체 시험·commit·push 없음.

루트 `.ride-settings-sheet[aria-label="주행 설정"]` 아래만 적용. 이 파일의 패널 클래스는 `.ride-settings-sheet__panel` (지시의 `.ride-settings-panel` 과 동일 요소).

- 패널: `width: min(32rem, calc(100vw - 1rem))`, `max-height: calc(100vh - 1rem)` 다음 줄 `calc(100dvh - 1rem)`, `padding: 0.4rem 0.7rem 0.6rem`, `gap: 0.4rem`. `height` 없음. 기존 `overflow: auto` 유지.
- 같은 패널 다음 규칙: `display: flex`, `flex-direction: column`, `gap: 0.55rem`. 특이도가 같아 적용 gap 은 0.55rem. width·max-height·padding 은 앞 규칙이 유지된다.
- 핸들 `.ride-settings-sheet__handle`: `display: none`.
- 그룹 `.ride-settings-sheet__group`: `gap: 0.3rem`.

명령: `git diff --check -- apps/web/src/components/ride/RideSettingsSheet.css` exit 0. `git status --short` 해당 파일 `M` 한 줄.

미검증: 화면, 4 viewport, 칼로리 유무/선택/로딩, BGM 없음, 체중 변경, 4 toggle, 강도, 닫기, Escape, 전후 내용/폰트/컨트롤 크기/스크롤, 다른 공유 시트. Supervisor 검증으로 남김.
