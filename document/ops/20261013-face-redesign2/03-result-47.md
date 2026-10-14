# 결과47 — 주행 설정 그룹 간격 selector 정정

모델: Auto (Cursor agent router). session: `a29bb4a8-3d90-47ee-a930-f3762173a7ef`. branch `face-redesign2`. HEAD `51866a569698be3afb97ed842cd6b6314346dc12` (이번 턴 재조회 없음, 커밋 없음).

`apps/web/src/components/ride/RideSettingsSheet.css` 한 selector만 변경. `display: flex; flex-direction: column; gap: 0.55rem` 블록의 끝 클래스를 `.ride-settings-sheet__panel`에서 `.ride-settings-panel`로 바꿈.

첫 블록 `.ride-settings-sheet[aria-label="주행 설정"] .ride-settings-sheet__panel`의 width, max-height, padding, `gap: 0.4rem`은 그대로. 다른 값·파일은 그대로. 브라우저·서버·시험·커밋·푸시 없음.
