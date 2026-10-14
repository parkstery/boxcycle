# 결과29 — 경로 생성 팝업의 그룹·여백 정리 (CSS만)

- 지시: `02-task-29.md` (Chief 입문28 통과·다음 계속. 이번 창 지도 지점 클릭의 경로 생성 팝업만, 다른 창 미착수).
- Supervisor Codex / Developer Muse Spark 1.3.
- 일자: 2026-10-14 / branch: `face-redesign2`, HEAD `8fdedae` (작업 전 확인).
- cwd: `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`.
- 사전 dirty(메뉴/계정/두 목록·`UserInfoSheet.tsx`·PROGRESS/README 및 `MapView.css` 주소 1행 `calc(0.82rem - 2pt)`) 무변경·보존. commit/push/merge/deploy·서버조작·하위agent·다른ops탐색 없음. TSX/TS 쓰기 없음.
- 기준 보존: `pick-before-29.css` 미수정 (읽기만, 지시 비교 대상).

## 1. 실제 변경 (허용 1파일, `.map-view__pick` 팝업 CSS만)

- `apps/web/src/components/map/MapView.css`만 수정. `mapPopupElements.ts`는 조사용 읽기만 (DOM 구조·문구·콜백 불변 확인).
- 여백 절제 (0으로 붙이지 않음, 흰/파랑 유지):
  1. `.map-view__pick-token` `margin-bottom 0.3rem → 0.2rem`, `padding-bottom 0.28rem → 0.22rem` (underline·닫기 ✕ 자리 `padding-right 1.95rem`·구분선 유지).
  2. `.map-view__pick-meta` `margin-top 0.22rem → 0.15rem` (font/family/size/line-height/좌표·고도 문구 불변).
  3. `.map-view__pick-actions` `margin-top 0.38rem → 0.22rem` (pin-row 전용 효과. `--profile`은 `margin-top: 0` override 그대로이므로 영향 없음. pin-row `sticky/nowrap/overflow-x:auto/gap` 유지).
  4. `.map-view__pick-profile-section` `margin-top 0.22rem → 0.14rem` (hidden 토글·`--awaiting-profile`·라벨 로직 불변).
  5. `.map-view__pick-auto-route` `margin-top/padding-top 0.16rem → 0.12rem` (구분선 유지).
  - 세로 절감 합계 약 0.49rem(≈7.8px). 토큰 잔여/부족/진행 상태 메시지·`status-slot reserve(min-height 0.92rem)` 삭제 없이 유지.
- 거리 preset 그룹 plain 선택:
  - `.map-view__pick-distance-chips`: `display/gap:4px/nowrap/grid-column` 그대로, `background:#F1F5F9` + `border-radius:999px` 추가. 컨테이너 padding 추가 없음 → chip rect·팝업 높이 증가 없음.
  - `.map-view__pick-distance-chip`: `border:1px solid transparent` (1px 자리 유지, 크기 불변). `padding/font-size/line-height` 불변. `is-active`는 `border:#2563EB` + `background:#EFF6FF` 유지, 숫자 명확화를 위해 `color:#1D4ED8`만 추가 (파랑 계열). `hover(:not disabled, :not active)` → `#E2E8F0`, `focus-visible` → `2px solid #2563EB`, `:disabled` 기존 그대로. `±`·slider(hidden)·direct input 구조·unit·값·disabled 그대로.
- profile 아이콘 그룹 잡음 절제:
  - `.map-view__pick-btn--profile` 미선택 `border-color:transparent` (중립배경 `#F1F5F9`·직경 `2.35rem`·icon `1.22rem` 유지). hover도 `border-color:transparent` (배경 `#EFF6FF` 유지). `is-active` 파랑 + `active:hover` 진파랑 그대로. `focus-visible: outline 2px solid #2563EB, offset 2px` 명시. `clear-route` 보조 버튼 무수정.
- 불변: TSX/TS/문구/폰트크기/주소/좌표/단위/버튼크기·padding/콜백/검색·라우팅·토큰·센서정책/창 anchor·drag·close·pin-row 가로 스크롤·다른 Map CSS. 겹침/가로 overflow/내용숨김 유발 선언 없음.

## 2. 검증 (Developer, 정적만)

- [x] `git diff --check` 1회: 통과 (whitespace 오류 없음).
- [x] 한 파일 diff 확인: `git diff --stat -- apps/web/src/components/map/MapView.css` → 1 file, 이번 작업분 30 insertions / 11 deletions (+ 사전 dirty 주소 1행 포함 표시). HEAD 대비 diff에 다른 파일 없음 (이번 호출 1회에 check+stat+diff 함께 수행).
- [x] `pick-before-29.css` 대비: 주소 `calc(0.82rem - 2pt)`는 기준·현행 동일 (사전 dirty 보존). 그 외 차이는 위 §1과 일치. `clear-route`·`status-slot`·`--awaiting-profile`·pin-row 스크롤·drag-handle 블록은 diff에 없음 (불변).
- [x] 높이 논증: 레이아웃 치수 변경은 margin/padding 감소분만 (−0.49rem). 추가된 background/radius/hover-bg/outline/color는 페인트·아웃라인 전용으로 박스 치수 불변. chip border 폭 1px 유지, 컨테이너 padding/gap 불변 → chip rect·text/font rect는 위치만 위로 이동, 팝업 높이 미증가(감소).
- [x] 상태 접근 정적 확인: `profileSection/rowProfile hidden` 토글, pin-only 초기 → 출발 후 expanded, 긴 주소(`break-word`), token 라인 4색, `searching/failed/found/idle` 클래스, `status-slot` 유지 모두 CSS·TS 소스상 기존 경로 그대로.

## 3. 미검증 (Supervisor 브라우저·tsc 검수 대기)

- [ ] 740/667/800/844/PC 전후 text/font/버튼 rect 동일(위치만 이동)·popup 높이 미증가·title/address 줄바꿈 실측.
- [ ] pin-only 초기 / 출발 후 expanded / 긴 주소 / 토큰 잔여·부족 / 검색중·실패 status / 많은 핀 row 가로 스크롤 접근 실측.
- [ ] 경로 행동·모드/preset값·active/focus/close·드래그 실측, tsc — Supervisor.
