# 결과40 — 왼쪽·얇은 캐럿 행 (MapView.css 4선 수정)

- 대상: `apps/web/src/components/map/MapView.css` — `.map-view__pick .map-view__pick-caret` 규칙만
- 변경 4선:
  - `justify-content: center` → `flex-start`
  - `min-height: 44px` → `24px`
  - `height: 44px` → `24px`
  - `margin: 0.06rem 0 0` → `0`
- 유지: 전체폭 100%·padding 0·투명배경·border 0·radius 0·focus-visible·20px svg·색/phase/값/observer/delete/drag/상하접기
- 검증: `git diff --check` 통과 (whitespace 오류 없음, CRLF 경고만)
- 현재 파일 해당 규칙 확인 (344~352행): flex-start / 24px / 24px / margin 0
- 그 외 dirty/TS/폰트/버튼/작동 변경 없음 (본 지시에서 수정 금지, 기존 dirty 손대지 않음)
- 참고: 기존 44px 검증은 Chief 명시 예외로 24px 적용
