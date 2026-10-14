# 결과26 — 두 목록 선택행 44px → 32px 하한 축소 (CSS 2파일)

- 지시: Chief 추가 첨부 피드백(간격 더 축소). 44px 예외 승인을 두 목록 선택행에 한해 적용, 전체앱/다른 컨트롤 확대 없음.
- 일자: 2026-10-14 / Developer: Muse Spark 1.3
- branch: `face-redesign2`, cwd `face-redesign2/boxcycle`
- 베이스라인 보존: `document/ops/20261013-face-redesign2/saved-before-26.css`,
  `document/ops/20261013-face-redesign2/public-before-26.css` (작업 전 현행 복사)
- 사전 dirty(메뉴/계정/목록25 외 CSS·`UserInfoSheet.tsx`·PROGRESS/README) 무변경·보존. TSX 쓰기 없음.

## 1. 변경 범위 (허용 2CSS의 목록행 밀도값만)

- `apps/web/src/components/ride/SavedRoutesPanel.css`
- `apps/web/src/components/ride/OfficialCourseListModal.css` (aria-label="퍼블릭 경로" 범위만, 입문 불변)
- TSX·데이터·문구·폰트크기·색·패널폭/상한·헤더·필터·정렬·toolbar·rename·오류예외·콜백: 무변경.
- `display: contents` 미사용. 투명 44px hitbox 덧씌우기 없음.

## 2. 내 경로 (`SavedRoutesPanel.css`, before-26 대비 diff)

- `.saved-routes__row`: `min-height: 44px` → `32px` + `height: auto`(내용 증가 시 행이 늘어남),
  `padding: 3px 0.55rem` → `1px 0.55rem`, `row-gap: 2px` → `1px`.
  grid `3fr/2fr`·`column-gap`·`align-items`·선택/hover/focus 그대로.
- `line-height: 1.2` → `1.15`: `.saved-routes__name` / `__meta` / `__progress` / `__progress-label`
  (font-size·문구·배지 크기 그대로).
- `gap: 0`·행구분선(`border-bottom`) 유지. meta/progress 둘째줄 구조·wrap/overflow 규칙 유지.
  긴 경로명은 기존 ellipsis+title 그대로, meta-left wrap 그대로.

## 3. 퍼블릭 (`OfficialCourseListModal.css`, aria-label="퍼블릭 경로" 범위만)

- `.oc-modal__item`: `min-height: 44px` → `32px` + `height: auto`,
  `padding: 3px 0.55rem` → `1px 0.55rem`. 선택/hover/focus/disabled 그대로.
- `.oc-modal__item-name`: `line-height: 1.2` → `1.15` (wrap/전체표시 유지, clamp 없음).
- `.oc-modal__item-sub`: `line-height: 1.2` → `1.15`, `margin-top: 1px` → `0`
  (flex-wrap·등록자 wrap 유지, 긴 제목/등록자는 줄바꿈으로 행이 늘어남).
- `.oc-modal__item-meta` 확인: 별도 padding/margin 없음 → 추가 손질 불필요, 무변경.
- 공용 base(`.oc-modal__item`/`__item-name`/`__item-sub`) 무변경 → 입문 영향 없음.

## 4. 행 높이 전후 (16px root 기준 계산 추정치, 실측은 Supervisor)

| 목록 | 짧은 행 내용 합 | 전(하한 지배) | 후(내용≈하한) | 절감 |
|---|---|---|---|---|
| 내 경로 일반/progress행 | pad 2 + 제목 16.19 + gap 1 + 2행 13.62 ≈ 32.8px | 44px | 약 32.8px | 약 −11.2px (−25%) |
| 퍼블릭 짧은 행 | pad 2 + 이름 15.09 + sub 13.25 ≈ 30.3 → 하한 지배 | 44px | 32px | −12px (−27%) |
| 긴 행(이름/등록자/meta wrap) | 가변 | 가변(44 하한) | 가변, pad −4 + 행간 −0.5~1 | 내용별 −4~5px |

- 목록 150px 기준 완전표시 행수(짧은 행): 전 3.4행 → 내 경로 약 4.6행 / 퍼블릭 약 4.7행.
- 실제 최소 32px보다 작아지지 않음(양쪽 `min-height: 32px` + 내용 시 `height: auto` 증가).

## 5. 검수 상태 (Developer: 정적 검증까지, 브라우저/tsc는 Supervisor)

- [x] `git diff --check` 1회: 통과(출력 없음).
- [x] before-26 대비 diff: 상기 밀도값만. `font-size` +/- 0건. 허용 2파일 외 쓰기 없음.
- [x] 행 ≥ 32px(`min-height: 32px` 양쪽) + `height: auto`로 긴 내용 증가 보장(잘라 숨김 없음).
- [x] 가로 overflow/겹침 방지 구조 유지(grid `minmax(0,…)`+`min-width:0`+wrap, 퍼블릭 wrap 유지).
- [x] 선택·hover·focus·rename·툴바 조건부·긴안내 예외·배지/프로필 크기·문구 무변경.
- [ ] 740/667/800/844/1024/1366 정상상태 실제행높이·표시개수(짧은/긴 내용 조건별),
  배지/메타/진행률 겹침 0·가로넘침 0, 선택·키보드·로드/재개·이름 기능 — **Supervisor 실측 대기**.
- 정직 보고: 이번 작업은 선택행 touch 범위를 32px 이상으로 축소하는 명시 예외이며,
  실기기 체감은 미검증.
