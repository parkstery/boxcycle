# 결과28 — 입문 행 퍼블릭 밀도 5선언 (CSS 1파일, 입문 aria 범위만)

- 지시: `02-task-28.md` (2026-10-14 Chief 명시요청: 입문도 퍼블릭 같은 형태, 목록간격 축소. 기존 두목록 32px 예외를 입문 선택행에도 적용. 전체앱 다른 컨트롤 불변).
- Supervisor Codex / Developer Muse Spark 1.3.
- 일자: 2026-10-14 / branch: `face-redesign2`, HEAD `8fdedae` (작업 전 확인).
- cwd: `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`.
- 직전 보존: `document/ops/20261013-face-redesign2/intro-before-28.css` (작업 전 현행, 지시 comparar 대상).
- 사전 dirty(메뉴/계정/두목록26 외 CSS·`UserInfoSheet.tsx`·PROGRESS/README) 무변경·보존. commit/push/merge/deploy·서버조작·하위agent·다른ops탐색 없음. TSX 쓰기 없음.

## 1. 실제 변경 (허용 1파일, 입문 aria 범위 5선언만)

- `apps/web/src/components/ride/OfficialCourseListModal.css` — `.oc-modal[aria-label="입문 경로"]` 범위만 5값 수정:
  1. `.oc-modal__item` `min-height: 44px` → `32px`
  2. `.oc-modal__item` `padding: 2px 0.55rem` → `1px 0.55rem`
  3. `.oc-modal__item-name` `line-height: 1.2` → `1.15`
  4. `.oc-modal__item-sub` `line-height: 1.2` → `1.15`
  5. `.oc-modal__item-sub` `margin-top: 1px` → `0`
- 불변: `height: auto` 유지(긴 내용은 높이 증가로 읽힘), 라인구분(`border-bottom`+`gap:0`), 선택(`inset 3px`)/focus/hover, 폰트크기, 배지, 전체텍스트(wrap), 폭460, 헤더/검색/정렬/나가기/오류 예외, 다른 창 rule(공용 base·퍼블릭 블록 동일 확인), TSX/콜백/데이터. 44px 가짜 hitbox 추가 없음.

## 2. 검증 (Developer, 정적만)

- [x] `git diff --check` 1회: 통과 (출력 없음, exit 0).
- [x] `intro-before-28.css` 대비 5값 확인 (스크립트 추출 비교):
  - BEF item: `min-height: 44px | height: auto | padding: 2px 0.55rem` → CUR: `min-height: 32px | height: auto | padding: 1px 0.55rem`
  - BEF name: `line-height: 1.2` → CUR: `line-height: 1.15` (wrap 선언 유지)
  - BEF sub: `margin-top: 1px | line-height: 1.2` → CUR: `margin-top: 0 | line-height: 1.15` (flex-wrap/row-gap 유지)
  - 퍼블릭 item/name/sub 블록 BEF=CUR 동일 (불변 확인).
- 참고: HEAD 대비 `git diff`는 dirty 누적분(지시23 퍼블릭+지시27 입문 append) 포함 표시되므로, 이번 작업분은 위 BEF 대비 5선언 diff로 판정.

## 3. 미검증 (Supervisor 브라우저 검수 대기)

- [ ] 입문 3행 목록 간격·선택행 포커스·긴이름 wrap·0/1/2/빈·검색/정렬/나가기 실측.
- [ ] 퍼블릭/내경로/전체앱 다른 컨트롤 rect 불변 실측.
- [ ] tsc·브라우저 검증 — Supervisor.
