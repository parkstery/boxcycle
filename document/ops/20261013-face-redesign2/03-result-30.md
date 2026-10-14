# 결과30 — 경로 탐색 모드별 패널 접기

- 지시: `02-task-30.md` (2026-10-14 Chief 직접 구현 지시. Supervisor Codex / Developer OpenCode Muse Spark 1.3).
- cwd: `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`, branch `face-redesign2`, HEAD `8fdedae` (작업 전 확인).
- 사전 dirty(메뉴/계정/두 목록·`UserInfoSheet.tsx`·PROGRESS/README·`MapView.css` 주소 1행·29 여백/그룹) 무변경·보존. commit/push/merge/deploy·새 서버·하위 agent 없음. 앱 쓰기 Developer 1명.
- 시작 branch/HEAD/dirty 기록: branch `face-redesign2`, HEAD `8fdedae`, dirty = `MenuPanel.css`, `UserInfoSheet.css`, `UserInfoSheet.tsx`, `MapView.css`, `MapHud.css`, `LocalFirstEntryCard.css`, `OfficialCourseListModal.css`, `SavedRoutesPanel.css`, `document/ops/PROGRESS.md`, `document/ops/README.md` (+`document/ops/20261013-face-redesign2/` untracked). 다른 담당자 변경 되돌림 없음.

## 1. 실제 변경 (허용 2파일만)

- `apps/web/src/components/map/mapPopupElements.ts` (이번 지시로 새로 dirty 편입. 그 외 TS/TSX 쓰기 없음):
  1. 패널 상태 2플래그 추가 (`routeLocationExpanded`/`routeDistanceExpanded`). 초기값: 출발 전(`!pins.start`)이면 위치 펼침/거리 접힘(거리 강제 금지); 출발 후면 bridge `distanceDirectionMode`·`autoRouteSessionActive`가 켜져 있을 때만 거리 펼침/위치 접힘, 아니면 위치 펼침/거리 접힘. 핀·거리 값 변경 없음.
  2. 위치 패널: 기존 `pinRow`(Start/WP1/WP2/WP3/End 그대로)를 내용으로 이동. 토글 `button type=button` + 제목 `위치 선택` + 펼침/접힘 표시(`▾`/`▸`, `aria-hidden`) + `aria-expanded`/`aria-controls`(`map-view-pick-route-location-content`). 클릭은 UI만 변경(둘 다 펼침 가능), 모드 전환 없음. 네이티브 button이라 Enter/Space·포커스 지원.
  3. 거리 패널: 기존 `distanceRow`(checkbox/±/입력/프리셋/ETA 그대로)를 내용으로 이동. 토글 제목 `거리 선택` + 동일 aria 구조(`map-view-pick-route-distance-content`). 상태 슬롯(`autoRouteStatusSlot`)은 내용 밖 형제로 분리해 접어도 오류·검색중·발견 안내가 보임. 펼침 시 기존 reserve 유지, 접힘 시 `idle`이면 슬롯 숨김(`hidden`)·메시지가 있을 때만 표시.
  4. `applyDistanceDirectionMode` 경로 하나로 유지 + 패널 동기화(켬→거리 펼침/위치 접힘, 끔→위치 펼침/거리 접힘) + `syncProfileUi()` 추가 갱신(수동 경로 준비/토큰 disabled 낡음 방지). checkbox `change`는 기존대로 이 경로만 호출.
  5. 거리 모드 중 위치 패널 안 Start/WP/End를 누르면 `applyDistanceDirectionMode(false)`로 방향 대기·원 정리 후 기존 위치 콜백 실행. 펼치기 자체는 모드 전환 없음. WP는 슬롯 활성화 확인 후에만 전환·콜백. Start의 기존 `queueMicrotask` 조건부 정리를 동기 단일 경로로 교체(동일 의미, 타이밍만 명확화). 핀·거리 값 임의 초기화 없음(위치 설정 의미 기존 유지).
  6. `setInlinePhase` 전 분기에 상태 슬롯 가시성 동기화 추가. `syncAutoRouteUi`는 출발지 prerequisite(`autoRouteSection.hidden`)와 슬롯만 다루고 사용자 펼침 상태 리셋 없음. token subscription 콜백(`syncProfileUi`·`syncAutoRouteUi`·`syncTokenUi`)도 펼침 상태 불변. 하단 bridge 재동기 microtask에 패널 동기화 추가(거리 재개→거리 펼침/위치 접힘, 단 출발 전이면 위치 펼침 유지).
  7. 이동수단/경로 삭제(`profileSection`)·토큰 피드백·주소·close/drag는 공통·기존 위치 그대로. 기존 aria/버튼 크기·글자·주소 문구·콜백(핀·거리·수단·토큰·탐색) 불변. 새 식별자는 route 계열만.
- `apps/web/src/components/map/MapView.css` (pick 관련 규칙만 추가, 29 그룹/여백 보존):
  1. scoped 규칙 `.map-view__pick [hidden] { display: none !important; }` — 내용 `hidden`이 flex/grid(`pinRow`·`distanceRow`·`profile`) display에 덮이지 않게 함.
  2. `.map-view__pick-route-toggle` — 전체 폭·`box-sizing:border-box`·`padding 0.14rem 0.2rem`·`font-size 0.7rem`(기존 핀 버튼과 동급)·`hover #F1F5F9`·`focus-visible outline 2px #2563EB`. 라벨 ellipsis·caret 축소로 667/740x300 가로 overflow 없음.
  3. 위치 패널 `margin-top 0.14rem`, 내용 안 pin-row `margin-top 0.14rem`(기존 0.22 이중화 방지). 거리 패널 `margin-top 0`(autoRoute 구분선·여백 유지). 컨테이너 padding·버튼 크기·font 불변이라 토글 2행 외 높이 증가 없음.

## 2. 검증 (Developer, 지정 2건)

- [x] `git diff --check` (작업 cwd): 출력 없음, exit 0 → PASS (whitespace 오류 없음).
- [x] `npx tsc -b --pretty false` (apps/web): 출력 없음, `$? = True` → PASS.
- [x] 변경 파일 확인: `git diff --stat -- apps/web/src/components/map/mapPopupElements.ts apps/web/src/components/map/MapView.css` → 2 files, 232 insertions / 19 deletions (29 사전 dirty분 포함). 허용 외 파일 쓰기 없음(신규 dirty는 `mapPopupElements.ts` 1개뿐, 허용 파일).
- [x] 정적 자체 점검: 토글 2개 `type=button`·`aria-expanded`·`aria-controls`·제목 문구, 내용 `hidden` 토글, 상태 슬롯 분리, `applyDistanceDirectionMode` 단일 경로+`syncProfileUi`, Start/WP/End 모드 종료 후 콜백, token 구독 펼침 보존 — 소스상 확인.

## 3. 미검증 (Supervisor 독립 DOM harness·실제 앱 검수 대기)

- [ ] 초기(위치 모드)/거리 재개 모드별 펼침 상태, 모드 전환(checkbox on/off), 양쪽 펼침 가능, 핀·거리·수단 값 보존.
- [ ] 토큰 구독이 펼침 리셋 없음, 오류·검색중·발견 안내 접힘 시 가시성, 펼침 시 reserve 유지.
- [ ] 폰 가로 667/740x300 가로 overflow 없음·기존 font/컨트롤 크기, 실제 앱 동작.
