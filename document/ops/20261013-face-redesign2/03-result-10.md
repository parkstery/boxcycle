# 결과10 — 계정 grid 늘어남 마감

- 변경: `apps/web/src/components/UserInfoSheet.css` 3선언만
  1. `.user-info-sheet__scroll-body`에 `align-content: start` 추가 — 남는 세로 공간을 행에 분배하지 않고 위로 모음
  2. 같은 블록에 `grid-auto-rows: max-content` 추가 — 행 높이를 내용 자연높이로 고정
  3. `.user-info-sheet__confirm-input`에 `min-height: 44px` 추가 — 탈퇴 확인 입력 터치 높이 확보 (글씨/색/문구 불변)
- 유지: 기간 탭·Free행 `min-height: 44px` 그대로, `align-self: stretch`는 행이 max-content라 추가 늘어남 없음
- 검증: `git diff --check` 1회 — 출력 없음(통과). 브라우저/tsc 미실행(Supervisor 담당).
