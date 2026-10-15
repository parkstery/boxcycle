# 결과54 — 주행 설정 문구·체력 라벨·내용 폭

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `face-redesign2`. HEAD `9bcc2191807bfcc2632c2963453bec7413674da5`. 커밋 없음.

쓰기 소유: `apps/web/src/components/ride/RideSettingsPanel.tsx`, `apps/web/src/components/ride/RideSettingsSheet.css`.

- kicker 문구를 `주행 Kcal - 체중과 체력 설정하세요. (No 센서 No 측정)`로 바꾸고 `ride-settings-sheet__calorie-title` 추가.
- 칩 그룹 `aria-label="체력"`, 앞에 `체력` 라벨. `light` 표시·title만 `약함`. id·콜백·`CALORIE_INTENSITY_OPTIONS` 불변.
- 페달 시간으로 시작하던 설명 `p` 한 개 삭제. 토글·로딩·저장 순서 불변.
- 주행 설정 루트 하위 끝에 panel `width: max-content; max-width: calc(100vw - 1rem)`. 기존 `min(26rem, …)` 폭 선언 제거. calorie-title·calorie-row·chips·fitness-label은 지시 값. 22px 입력/칩 규칙 유지.

명령: `git diff --check -- apps/web/src/components/ride/RideSettingsPanel.tsx apps/web/src/components/ride/RideSettingsSheet.css` exit 0.

미검증: 4 viewport + 1020×460, 기존 20상태, 문구/삭제/체력 라벨/3버튼/22px/내용 폭/잘림/콜백. tsc, 해당 TSX eslint. 실기기·실주행. Supervisor 재검증으로 남김.
