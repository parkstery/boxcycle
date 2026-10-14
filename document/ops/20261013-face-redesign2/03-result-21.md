# 결과21 — 내 경로 목록 밀도·비교 공간

- 변경 파일(허용 1개만): `apps/web/src/components/ride/SavedRoutesPanel.css` (+62/-15)
  - 조사 읽기만: `SavedRoutesPanel.tsx`, `SavedRoutesModal.tsx`, `RouteListModalShell.tsx`, `OfficialCourseListModal.css`, `RouteSortSelect.css` (변경 없음).
  - 실제 변경 (`git diff` 확인):
    1. 모달 범위(내 경로 한정): `.oc-modal-overlay:has(.saved-routes)` padding 8px, `.oc-modal:has(.saved-routes)` 창폭 `min(560px, calc(100vw - 16px))`, 상한 `calc(100vh - 16px)` + `calc(100dvh - 16px)` 폴백. 높이는 auto 원칙이라 0/1/2개는 내용높이 종료, 개수 증가 시 상한까지 자라 목록 스크롤. 입문/퍼블릭·모달 기본(`420px·min(85dvh,560px)`) 불변 — 전부 `:has(.saved-routes)` 스코프라 다른 창에 닿지 않음. 조건부 상한 분기(nth-child) 없이 단일 상한으로 동일 관측 동작(내용높이 vs 상한)을 만족, PC tall에서도 3개 행이 빈 공간으로 늘어나지 않음.
    2. 조건부 툴바: `.saved-routes:not(:has(.saved-routes__item.is-selected)) .saved-routes__toolbar { display: none }`. 선택 시 기존 툴바 그대로. TSX disabled·문구·동작·키보드 불변. flex 흐름 안이라 선택/해제 시 목록 스크롤 영역에 자동 반영. rename 중에도 해당 행이 `is-selected`라 툴바 유지.
    3. 상단 여백 절제(내 경로 한정): 껍데기 head `0.6rem→0.5rem`·body `0.6/0.75→0.5/0.6rem`, notice/error 하단 `0.5→0.4rem`, quota 하단 `0.55→0.45rem`, controls gap `0.4→0.35rem`·하단 `0.55→0.5rem`, control-row gap `0.35rem`. 폰트·버튼 높이/패딩·Guest Google 안내·필터4·정렬3·검색·오류/쿼터 문구와 확인 버튼 전부 유지. filter/정렬은 560px폭에서 한 행, 좁은 폭은 기존 wrap 폴백 유지.
    4. 행구분 전환: list `gap 0.4rem→0`·`padding 2px→0` + 상단 1px 구분선, item 카드(`1px border`·`radius 10px`·흰바탕) → `border-bottom 1px soft`·`radius 0`·투명 행. 선택 파랑은 `#EFF6FF` 바탕 + 좌측 `inset 3px #2563EB` 바로 명확 유지. row 세로패딩 `0.45→0.4rem` + `min-height: 44px`(border-box) — 짧은 행도 44px, 진행률·배지 행은 내용대로 커짐. hover·`:focus-visible` 파랑 유지. title 기존 ellipsis 그대로(축약/line-clamp 추가 없음). rename 입력·저장/취소·글자/숫자/진행률/미완주·완주·이동방식·퍼블릭·재개 배지 전부 TSX·CSS 불변.
    5. 스크롤: 평소 목록(`.saved-routes__list`)만 스크롤, header/notice/필터·정렬/툴바 고정 구조 유지. 긴 오류·쿼터 예외: `.saved-routes > .saved-routes__error/.saved-routes__quota-notice`에 `flex-shrink: 1; min-height: 0; overflow-y: auto; max-height: 9rem→30vh→30dvh` — 평소 짧을 땐 무효과, 길어지면 스스로 내부 스크롤(확인 버튼 포함 접근 가능), 부모가 잘라 숨기지 않음.
  - 보존: 타인 dirty(`MenuPanel.css`, `UserInfoSheet.*`, `MapView.css`, `MapHud.css`, `LocalFirstEntryCard.css`, `PROGRESS.md`, `README.md`)·계정20/메뉴18/추가15·16 손대지 않음. 기존 CSS는 `saved-before-21.css` 보존됨(작업 전 해시·내용 동일 확인).
- 정적 추정치(루트 16px 가정, Guest 안내 없음·단순행 기준 — 브라우저 실측 아님):
  - 행 피치: 변경 전 약 64px(카드+gap) → 변경 후 약 55px(행+구분선). 진행률 행은 약 80px → 약 71px.
  - 목록 clientHeight(추정): 667×300/740×300: 115px → 선택시 153px/미선택 188px. 800×360: 166px → 213px/248px. 844×390: 192px → 243px/278px. PC 1280×800: 420px(560px 상한) → 653px/688px.
  - 한화면 완전표시 단순행수(추정): 667×300: 1.8행 → 선택 2.8/미선택 3.5행. 800×360: 2.6행 → 3.9/4.6행. 844×390: 3.0행 → 4.4/5.1행. PC: 6.6행 → 12행 전후. 목표(폰 가로 기본 4행 전후)는 800×360 미선택 약 4.6행·선택 약 3.9행으로 전후 달성, 667×300은 약 3~3.5행. 진행률 행이 섞이면 행당 약 71px로 행수 감소 — 사실대로 보고.
- 명령·종료코드:
  - `git diff --check` → 출력 없음, 종료코드 0 (1회)
  - `git diff -- apps/web/src/components/ride/SavedRoutesPanel.css` → 위 변경만 확인, 종료코드 0 (stat: 1 file, +62/-15)
  - `git status --porcelain` → 허용 1파일 외 기존 dirty만, 추가 변경 없음 확인, 종료코드 0
  - commit/push/merge/deploy·서버5013조작·하위agent 미수행. 다른 ops 전체탐색 미수행.
- 미검증 사항 (Supervisor 수행): 브라우저 검수(740×300/667×300/800×360/844×390/PC, 목록 0/1/2/20개·선택/해제·Guest안내·필터4·정렬3·검색0건·rename·미완주·쿼터·긴오류, 한화면 실제 완전표시 행수·목록 clientHeight 전후 실측, 44px 선택행 유지, 입문/퍼블릭 창 영향 없음), `tsc` (CSS만 변경이라 영향 예상 없음).
