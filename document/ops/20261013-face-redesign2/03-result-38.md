# 결과38 — 이중 캐럿과 위/아래 보조 패널

- 일시: 2026-10-14
- Developer: MuseSpark1.3
- cwd: C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle
- 허용 범위: `apps/web/src/components/map/mapPopupElements.ts`, `apps/web/src/components/map/MapView.css` pick 관련만
- 금지 준수: commit/push/merge/deploy/server/하위agent 없음. 기존 타담당자 dirty(14파일 중 본건 외 12파일) 미접촉. 37 삭제 pointerstop·32 observer·33 viewport 높이·공통 token/delete/close/drag 유지. 다른 테스트를 옛UI에 맞추려고 변경하지 않음.

## 구현

`apps/web/src/components/map/mapPopupElements.ts`:
- `routePickView`는 중심 화면으로 유지, `routePickAuxExpanded` boolean 추가. 초기 location이면 위치만, distance/재개이면 거리만.
- DOM 순서: dragHandle(공통 header/주소/meta) → `routeLocationView(pinRow+profile)` → 단일 `routePickCaret` → `autoRouteSection(summary+distanceRow+status)`. `routeLocationView` id `map-view-pick-location-view`, `autoRouteSection` id `map-view-pick-distance-view`.
- profile행 끝 `거리 ›` 버튼 DOM 생성 제거. 거리 head `‹ 위치 선택` 버튼/`목표 거리로 경로 만들기` 타이틀행 DOM 생성 제거. `routeDistanceSummary(출발 설정됨 · 수단)`만 유지.
- 캐럿: `button.map-view__pick-caret`, 보이는 텍스트 0, inline SVG 이중 chevron(루시드 chevrons-up/down 동일 path), `stroke="#2563EB" fill="none"`, 20px, `aria-hidden`. 전체폭 44px 투명 영역, 테두리/알약 배경/카드 없음, `focus-visible` 제공. `aria-expanded`/`aria-controls(보조영역 DOM id)` 갱신. location 중심 collapsed `↓↓`/expanded `↑↑`, distance 중심 collapsed `↑↑`/expanded `↓↓`. `aria-label`은 `거리 선택 컨트롤 펼치기/접기` 또는 `위치 선택 컨트롤 펼치기/접기`. Enter/Space 네이티브 button. Start 전제 없으면 캐럿 hidden(위치 필수).
- `applyDistanceDirectionMode`에서 `routePickView` 대입 제거(모드 변경과 중심/펼침 분리). `setRoutePickAuxExpanded`: location 맥락 펼침 `apply(true)`(중심 위치 유지, 방향대기 준비, 실제 원격탐색은 지도 방향 클릭 때만), 접기 `apply(false)`(대기/원 정리). distance 맥락 펼침/접기는 UI만(방향대기/status 유지).
- `ensureDistanceDirectionForInput()`: Start/기능 전제 없으면 거부, `mode=false`라도 보이는 거리 컨트롤에서 입력 시 bridge `setDistanceDirectionMode(true)` 승격 후 기존 validation/sync/arm/preview 경로 사용. chip/step/number가 이 경로 사용. `syncDistanceModeUi`/`syncDistanceInputs` disabled 판정은 Start/기능 전제·min/max만, `mode=false` 단독으로 먹통 금지. 숨긴 checkbox DOM/계약 상수 유지.
- `syncRoutePickView`: `locationVisible = !inDistance || expanded`, `distanceVisible = inDistance || expanded`. 주소/meta는 위치 표시 때만. 토큰/phase/mode 갱신은 펼침 리셋 없음. `prerequisite(Start 없음)`만 위치 복귀+펼침 정리+`setDistanceDirectionMode(false)`+idle/원 정리.
- pin Start/WP/End는 기존 `apply(false)` 경로로 대기 정리 후 위치 콜백, 펼침 강제 접기 없음. `onRouteProfile` manualReady/토큰 게이트 유지. 하단 bridge microtask는 초기 거리재개 중심 동기화만, `expanded=false` 고정.
- 캐럿은 두 패널 사이 비drag 영역. 공통 header 삭제 pointerstop 유지.

`apps/web/src/components/map/MapView.css`:
- `.map-view__pick-caret` 전체폭 44px 투명 얇은 영역, hover도 투명, `:focus-visible` 파랑 outline, `.map-view__pick-caret-ico` 20px 중앙. 기존 폰트/버튼/프리셋 크기·흰/파랑 스타일 변경 없음. 장식 테두리/큰 여백 추가 없음. 기존 enter/back/head/title CSS는 미사용 잔재로 둠(DOM 미생성 확인).

## 검증(Developer)

- `npx tsc --noEmit -p apps/web/tsconfig.json` 통과(출력 없음).
- DOM 텍스트 버튼 제거 확인: `mapPopupElements.ts`에 `거리 ›`/`‹ 위치 선택`/`목표 거리로 경로 만들기` DOM 생성 없음(주석 언급만). `route-enter`/`route-back`/`route-distance-head` TS 참조 0건.
- `npx vitest run apps/web/scripts/distance-auto-route/distance-auto-route-contract.test.ts`: 50 pass / 1 fail. 실패 1건은 `3D-2 — 거리 조작만으로 provider 호출 없음`의 `assert.match(stepBlock, /if \(!distanceDirectionChecked\) return/)`이며, 지시38 §6(보이는 거리 컨트롤 재선택+`apply(true)` 승격)과 정면 충돌하는 구계약 문자열 검사다. 지시상 Developer는 테스트를 옛UI에 맞추려고 변경 금지이므로 수정하지 않고 남긴다. Supervisor 계약 갱신 필요: `stepTargetKm` 가드를 `ensureDistanceDirectionForInput()` 기반으로 갱신할 것.
- 화면내 배치/667·740x300·844x390·1366·키보드·토큰부족·phase/값보존 실측은 Supervisor 검증으로 인계(Developer 범위: tsc/diff).

## diff

- `git diff --stat` 기준 본건 2파일 외 기존 타담당자 dirty는 손대지 않음(전체 14파일 dirty 중 `MapView.css`·`mapPopupElements.ts`만 본건).
