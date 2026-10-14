# 결과25 — 내 경로·퍼블릭 목록 행 압축 (CSS 2파일)

- 지시: `document/ops/20261013-face-redesign2/02-task-25.md` (지시25)
- 일자: 2026-10-14 / Developer: Muse Spark 1.3
- branch: `face-redesign2` (HEAD `8fdedae`), cwd `face-redesign2/boxcycle`
- 베이스라인 보존: `document/ops/20261013-face-redesign2/saved-before-25.css`,
  `document/ops/20261013-face-redesign2/public-before-25.css` (작업 전 현행 복사)

## 1. 변경 범위 (허용 2CSS만)

- `apps/web/src/components/ride/SavedRoutesPanel.css`
- `apps/web/src/components/ride/OfficialCourseListModal.css`
- TSX·문구·폰트크기·데이터·콜백·폭/높이상한·검색/정렬/필터·확인/로딩/긴오류·버튼높이: 무변경.
  TSX는 row 부분만 읽기(`SavedRoutesPanel.tsx` 515–648행, `OfficialCourseListModal.tsx` 40–68행),
  쓰기 없음. 사전 dirty(메뉴/계정/기타 CSS·`UserInfoSheet.tsx`·PROGRESS/README) 보존.
- `git diff --check` 1회: 통과(출력 없음).
- `font-size` 값 변경 0건(베이스라인 대비 diff에 `font-size` +/- 없음).
- `min-height: 44px` 양쪽 유지. `display: contents` 미사용.

## 2. 내 경로 (`SavedRoutesPanel.css`)

- `.saved-routes__row`: `display:block` → `grid`,
  `grid-template-columns: minmax(0,3fr) minmax(0,2fr)`,
  `column-gap:0.5rem` / `row-gap:2px` / `align-items:center`,
  `padding: 0.4rem 0.55rem` → `3px 0.55rem` (inline 유지).
- `.saved-routes__head`: `grid-column: 1 / -1` (1행 전체폭) + `min-width:0`.
- `.saved-routes__meta`: `grid-column:1`, `margin:0.2rem 0 0` → `margin:0`,
  `line-height:1.2`, `flex-wrap:wrap` + `column-gap:0.35rem/row-gap:1px`,
  `overflow-wrap:anywhere` (좁을 때 숫자/날짜 겹침 방지용 wrap).
- `.saved-routes__meta-left`: `nowrap/ellipsis` → `white-space:normal` +
  `overflow-wrap:anywhere/word-break:break-word` (meta 줄바꿈 허용).
  긴 **경로명**(`.saved-routes__name`)은 기존 `ellipsis` + `title` 그대로 유지.
- `.saved-routes__row:not(:has(.saved-routes__progress)) .saved-routes__meta`:
  `grid-column: 1 / -1` (progress 없는 경로는 meta 전체폭).
- `.saved-routes__meta + .saved-routes__progress`: `margin-top:0.4rem` → `0`.
- `.saved-routes__progress`: `grid-column:2` (2행 오른쪽),
  `line-height:1.2`, `min-width:0`, `flex-wrap:wrap` + `column/row-gap` 분리
  (좁을 때 트랙 축소·내부 wrap으로 가로 overflow/겹침 방지, 배지 자체는 그대로).
- `.saved-routes__progress-track`: `height:6px` → `4px` (허용치), `min-width:0`.
- `.saved-routes__progress-label`: `line-height:1.2` 추가.
- 선택/hover/focus/rename/툴바/긴안내 예외·배지 크기·프로필 아이콘: 무변경.

## 3. 퍼블릭 (`OfficialCourseListModal.css`, aria-label="퍼블릭 경로" 범위만)

- 공용 base(`.oc-modal__item` / `__item-name` / `__item-sub`) 무변경 — 입문 불변.
- 범위 한정 추가만:
  - `.oc-modal__item`: `+ padding: 3px 0.55rem` (기존 `0.45rem` 상하 → 3px).
  - `.oc-modal__item-name`: `+ line-height:1.2` (base 1.35 유지, wrap 규칙 유지).
  - `.oc-modal__item-sub`: `+ margin-top:1px` (base 0.15rem 대비), `+ line-height:1.2`
    (`flex-wrap:wrap`, 등록자 wrap 규칙 유지).
- `min-height:44px`, 행구분선/`gap:0`, 선택/hover/focus/disabled, 활동메타·수단·거리·등록자: 유지.

## 4. 행 높이 전후 (16px root 기준 계산 추정치, 실측은 Supervisor)

| 목록 | 행 유형 | 전 | 후 | 절감 |
|---|---|---|---|---|
| 내 경로 | progress행(3줄→2줄) | 약 73.7px | 44px (하한) | 약 −29.7px (−40%) |
| 내 경로 | 일반행(2줄 유지, 여백 절제) | 약 52.3px | 44px (하한) | 약 −8.3px |
| 퍼블릭 | 짧은 행 | 약 50.1px | 44px (하한) | 약 −6.1px |
| 퍼블릭 | 긴 행(이름/등록자 wrap) | 가변 | 가변, 약 −13.5px | padding 8.4 + 행간 약 5 |

- 목록 150px 기준 완전표시 행수(짧은 행): 내 경로 일반행 2.9 → 3.4,
  progress행 2.0 → 3.4. 퍼블릭 짧은 행 3.0 → 3.4.
- 정직 보고: 양 목록 모두 짧은 행이 **44px 하한에 걸리므로 추가 감소 불가**.
  폰트·히트박스를 줄이지 않는다는 조건 하에서 밀도 상한에 도달.
  더 보려면 행 높이가 아닌 목록 영역(모달 상한·툴바 조건부)을 건드려야 하며, 이는 지시25 범위 밖.

## 5. 검수 상태 (Developer: 정적 검증까지, 브라우저/tsc는 Supervisor)

- [x] `git diff --check` 통과.
- [x] 허용 2파일 외 쓰기 없음 (`git status` 확인, TSX 무변경).
- [x] DOM 텍스트·폰트 동일 (TSX 무변경, CSS 텍스트 속성 없음).
- [x] 행 ≥ 44px (`min-height:44px` 양쪽 유지).
- [x] 가로 overflow/정보 겹침 방지: grid `minmax(0,…)` + `min-width:0` + wrap 허용
  (meta-left normal wrap, progress 내부 wrap, 퍼블릭 기존 wrap 유지).
- [x] 핵심 행동 유지: 선택/hover/focus/rename/툴바 조건부/긴안내 예외 규칙 무변경.
- [ ] 740×300 / 667×300 / 800×360 / 844×390 / 1024×450 / PC 실측 rect·완전표시행수,
  복합 SavedRow(만료D86/Public/40%/이어달리기중 동시, 완주/대기, 긴 metric, 선택/rename),
  public 장/단 제목·등록자·선택·disabled — **Supervisor 실측 대기**.
  행이 44px 하한에 묶이므로 폰 가로(300px대)에서는 행수 증가가 0~1행에 그칠 수 있음.

## 6. 종료

- 결과 기록 후 종료. commit/push/merge/deploy·서버 조작·하위 agent·타 ops 탐색 없음.
