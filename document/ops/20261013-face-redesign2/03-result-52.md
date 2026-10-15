# 결과52 — 주행 설정의 입력·강도 버튼과 빈 공간 축소

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `face-redesign2`. HEAD `ca56e9b9b6b102aa15b2e6d06f435124361d5801`. 커밋 없음.

쓰기 소유: `apps/web/src/components/ride/RideSettingsSheet.css` 끝에 scoped 규칙만 추가. 기존 선언·TSX는 그대로.

모든 규칙은 `.ride-settings-sheet[aria-label="주행 설정"]` 하위.

- `.ride-settings-sheet__panel`: `width: min(26rem, calc(100vw - 1rem)); padding: 0.35rem 0.6rem 0.4rem; gap: 0.25rem`. `max-height`는 기존 규칙에 유지.
- `.ride-settings-panel`: `gap: 0.3rem`.
- `.ride-settings-sheet__group`: `gap: 0.15rem`.
- `.ride-settings-sheet__weight input`, `.ride-settings-sheet__chip`: `box-sizing: border-box; height: 22px; min-height: 22px; padding-top: 0; padding-bottom: 0`. 주석에 Chief 2026-10-15 주행 설정 한정 22px 예외를 기록.

명령: `git diff --check -- apps/web/src/components/ride/RideSettingsSheet.css` exit 0.

미검증: 네 viewport와 1020×460, 칼로리 유무/로딩/BGM 미설정/긴 설명·모든 옵션, 22px 입력·3강도·폰트 불변·면적/높이 전후·본문 스크롤/잘림/공유 CSS 영향 없음·체중/강도/표시 4개/닫기/Escape 콜백. 실기기. Supervisor 재검증으로 남김.
