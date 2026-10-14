# 결과31 — 모드 토글 한 행 toolbar 보정 (44px)

- 지시: `02-task-31.md` (재지시31, Supervisor REWORK_REQUIRED 후속. 지시30 PASS 위 보정).
- cwd: `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`, branch `face-redesign2`, HEAD `8fdedae`.
- 사전 dirty(메뉴/계정/두 목록·`UserInfoSheet.tsx`·PROGRESS/README·`MapView.css`·30 로직) 무변경·보존. 허용 외 파일 쓰기 없음. commit/push/merge/deploy/새 서버/하위 agent 없음.

## 1. 지시30 전체 변경 (재록, 이번에 손대지 않음)

- `mapPopupElements.ts`: `routeLocationExpanded`/`routeDistanceExpanded` 2플래그, 위치 패널(기존 pinRow 내용)/거리 패널(기존 distanceRow 내용), 토글 `type=button`+`aria-expanded`/`aria-controls`+caret `▾`/`▸`, 상태 슬롯 분리(접어도 오류·검색중·발견 가시, 펼침 reserve 유지), `applyDistanceDirectionMode` 단일 경로+패널 동기화+`syncProfileUi`, 거리 모드 중 Start/WP/End 누르면 `applyDistanceDirectionMode(false)` 후 기존 콜백, `setInlinePhase` 전 분기 슬롯 동기화·`syncAutoRouteUi` 펼침 리셋 없음·token 구독 펼침 보존·bridge 재동기 microtask 패널 동기화. 콜백/핀·거리 값/수단·토큰·탐색 불변.
- `MapView.css`: scoped `.map-view__pick [hidden]{display:none!important}`, 토글 기본 규칙(전체폭·`font-size 0.7rem`·hover·focus-visible·ellipsis·caret 축소), 위치 패널 margin·pin-row 이중 margin 정리·거리 패널 margin 0.

## 2. 이번 보정 (지시31, 허용 2파일만)

- `apps/web/src/components/map/mapPopupElements.ts`:
  1. 공통 한 행 `routeModeToolbar`(`div.map-view__pick-route-toolbar`, `role=group`·`aria-label=경로 탐색 모드`) 신설, 두 기존 토글(위치/거리, 문구·`aria-controls`/`aria-expanded`·caret·클릭 동작 그대로)을 순서대로 이동. 두 줄 쌓기 없음.
  2. 두 기존 패널은 content만: `routeLocationSection`은 `routeLocationContent`(pinRow)만, `routeDistanceSection`은 `routeDistanceContent`(distanceRow)만. 상태 슬롯 분리·`syncRouteLocationPanel`/`syncRouteDistancePanel`(둘 동시 펼침 가능)·`applyDistanceDirectionMode` 전환·Start/WP/End 정리 후 콜백·token 구독 보존 그대로.
  3. `syncAutoRouteUi`에서 `autoRouteSection.hidden`과 같이 `routeDistanceToggle.hidden = !available`(출발 prerequisite 없을 때 hidden). 위치 toggle은 항상 접근 가능. 펼침 상태 리셋 없음 유지.
  4. wrap 순서 `dragHandle,profileSection,routeModeToolbar,routeLocationSection,autoRouteSection` (지시 확정 순서).
- `apps/web/src/components/map/MapView.css` (pick 관련만):
  1. `.map-view__pick-route-toolbar{display:flex;flex-wrap:nowrap;align-items:stretch;gap:0.24rem;margin-top:0.14rem}` — gap 작게, 한 행 고정.
  2. toolbar 내 토글 `flex:1 1 0;width:auto;min-width:0;min-height:44px`, 베이스 토글에도 `min-height:44px` — 두 button 44px 터치 계약, 글자(`0.7rem`/700)·padding·hover·focus-visible·ellipsis/caret 보존.
  3. `route-panel--location{margin-top:0.06rem}`, location 내용 pin-row `margin-top:0.08rem`, `.map-view__pick-auto-route{margin-top:0.06rem;padding-top:0;border-top:0}` — 각 panel margin 최소, 거리 section 추가 테두리/여백만 정리. 새 44px을 세로로 쌓지 않아 높이 추가 최소화.

## 3. 검증 (Developer, 지정 2건)

- [x] `git diff --check` (작업 cwd): 출력 없음, `$? = True` → PASS.
- [x] `npx tsc -b --pretty false` (apps/web): 출력 없음, `$? = True` → PASS.
- [x] 변경 파일 확인: `git status --short` → 수정 10개 중 앱은 `MapView.css`·`mapPopupElements.ts`만(둘 다 허용 파일, 30에서 이미 dirty·신규 dirty 없음). 허용 외 TS/TSX 쓰기 없음.
- [x] 정적 자체 점검: toolbar 한 행·두 버튼 `flex:1/min-width:0/min-height:44px`·`aria-controls` 2개(`...-location-content`/`...-distance-content`)·`aria-expanded`·caret·둘 동시 펼침·`applyDistanceDirectionMode` 단일 경로·prerequisite hidden(`autoRouteSection`+`distanceToggle`)·위치 toggle 접근 가능·wrap 순서 — 소스상 확인.

## 4. 미검증 (Supervisor 재검수 대기)

- [ ] 4 viewport + 실제 2 (양쪽 펼침·모드 전환·값 보존·토큰·오류·폰 가로 overflow·44px 터치 높이 실측).
- [ ] 실기기 미실시.
