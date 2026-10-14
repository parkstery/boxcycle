# 결과18 — 메뉴 창 내용 높이로 정리

- 변경 파일: `apps/web/src/components/MenuPanel.css` 1개만 (TSX 변경 없음)
- 실제 변경 (`git diff` 확인):
  - `.menu-panel`: `bottom: 0` 제거 → 내용 높이로 끝남. `max-height: 100vh` + `max-height: 100dvh` 상한 추가 (fallback 순서 유지). `overflow: hidden` + `border-bottom-right-radius: 12px` 추가 (카드 끝 구분, 지시 허용). anchor(`top/left`)·폭·폰트·색·버튼·scrim·transition 보존.
  - `.menu-panel__head`: `flex: 0 0 auto` 추가 (상단 헤더 축소 방지). 나머지 보존.
  - `.menu-panel__body`: `flex: 1` → `flex: 1 1 auto` (내용 높이 기준, 상한 초과 시 축소 가능) + `min-width: 0` 추가. `min-height: 0`·`overflow: hidden`·flex column 보존 → 본문만 스크롤 구조 유지.
  - `.menu-panel__body > .ride-panel`: `flex: 1` → `flex: 1 1 auto` + `min-width: 0` 추가. `min-height: 0`·`overflow: auto`·`max-height: none`·`max-width: none`·`border-right: none` 보존 → 기존 scroll 경로 유지.
  - `.menu-panel__body > .trail-hub`: `flex-shrink: 0` 신규 (메뉴 한정, Trail 블록 찌그러짐 방지 → 긴 내용 시 ride-panel만 스크롤).
- 조사만 수행 (변경 없음): `MenuPanel.tsx` (head/body/children 구조 확인), `components/ride/RideRoutePanel.css/tsx` (ride-panel 자체 `max-height: min(85vh,720px)`가 메뉴 오버라이드로 `none`임 확인), `App.tsx` 메뉴 부분 (MenuPanel children = TrailHubPanel + RideRoutePanel 확인).
- 명령·종료코드:
  - `git diff --check` → 종료코드 0 (출력 없음, 1회)
  - `git diff -- apps/web/src/components/MenuPanel.css` → 위 diff 확인 (종료코드 0)
  - `git status --short` → MenuPanel.css 외 기존 dirty(MapView.css/MapHud.css/LocalFirstEntryCard.css, ops) 그대로 보존 확인. commit/push/merge/deploy 미수행.
- 미검증 사항 (Supervisor 수행): 740x300·667x300·844x390·1366x768 브라우저 검수 (짧은 메뉴 내용 높이 종료, 긴 내용 header 보존+본문 스크롤, 가로 잘림 없음, 버튼 크기 보존), `tsc` (본 작업 CSS만이라 TSX 영향 없음).
