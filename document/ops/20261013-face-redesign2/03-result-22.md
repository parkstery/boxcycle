# 결과22 — 긴 오류·쿼터 안내 공간 보장 (재지시22)

- 변경 파일(허용 1개만): `apps/web/src/components/ride/SavedRoutesPanel.css` — 긴 error/quota 예외 CSS만 보정
  - 보정 전 문제(Supervisor 감리21): 긴 quota/error가 `flex-shrink: 1`로 한 줄 띠에 압축되어 읽기 불편.
  - 실제 변경 (`saved-before-22.css` 대비 added-lines 확인):
    - `.saved-routes > .saved-routes__error/.saved-routes__quota-notice`: `flex-shrink: 1` → `0`. 안내가 최대높이(`9rem` → `30vh` → `30dvh`) 안에서 읽힐 공간 보장. 내용 초과 시 해당 안내 내부 스크롤(확인 버튼 포함) 유지. 한 줄 띠 강제 축소·잘라 숨기기 없음.
    - 예외 본문 스크롤: `.oc-modal__body:has(.saved-routes > .saved-routes__error)` 또는 quota일 때만 `overflow-x: hidden; overflow-y: auto` 허용. 일반 상태(안내 없음·짧음)는 본문 고정·목록만 스크롤 그대로. 창 헤더(`.oc-modal__head`, 본문 밖)는 고정 유지. 가로 overflow 0.
    - 예외 saved-routes: `flex: 0 0 auto` (자연 높이, overflow 잘림 없음).
    - 예외 list: `flex: 0 0 auto; max-height: 40vh→40dvh; min-height: 88px` — 내부 스크롤 유지 + rename 입력+저장/취소 1묶음 최소 공간 확보.
  - 불변: 일반상태·폭 560·행 44·글자/버튼·동작·다른 dirty·다른 창(셀렉터가 `.saved-routes` 자손 조건이라 입문/퍼블릭에 닿지 않음). TSX·다른 CSS 손대지 않음. 예외에서 선택 툴바가 본문 스크롤에 따라 움직이는 것은 허용(일반 상태 고정 유지).
  - 보존: `saved-before-22.css`가 작업 전 21 CSS와 동일함을 편집 전 확인(IDENTICAL).
- 명령·종료코드:
  - `git diff --check` → 출력 없음, 종료코드 0 (1회)
  - 단일파일 diff 확인: `git diff --stat -- apps/web/src/components/ride/SavedRoutesPanel.css` → 1 file (HEAD 대비 stat에는 지시21분 포함, 지시22분은 `saved-before-22.css` 대비 added-lines로 별도 확인), 종료코드 0
  - `git status --porcelain` → 허용 1파일 외 기존 dirty만, 추가 변경 없음 확인, 종료코드 0
  - commit/push/merge/deploy·서버조작·하위agent·TSX 변경 미수행.
- 미검증 사항 (Supervisor 수행): 브라우저 검수(긴 quota/error 740 캡처 재확인 — 안내 읽기 공간·확인 버튼 접근·예외 본문 스크롤·헤더 고정·가로 overflow 0·일반 상태 목록만 스크롤·rename 88px 최소 공간), `tsc` (CSS만 변경이라 영향 예상 없음).
