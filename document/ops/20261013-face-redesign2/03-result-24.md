# 결과24 — 퍼블릭 헤더 검색 폭 마감 (재지시24)

- 변경 파일(허용 1개만): `apps/web/src/components/ride/OfficialCourseListModal.css` — 한 선언만
  - 실제 변경: `.oc-modal[aria-label="퍼블릭 경로"]:has(.oc-modal__sortbar) .oc-modal__search`의 `margin-right: 9rem` → `6.5rem`. 검색-정렬 간 빈공간(740에서 45px) 마감. 예상 간격 root 13.5 기준 약 11.28px, 16 기준 13px 전후.
  - 불변: 헤더 여백·sortbar height 등 다른 값 일체 미변경. TSX/폰트/색/버튼/타인 dirty 불변. 하위 agent 미사용, commit/push/merge/deploy·서버조작 미수행.
- 명령·종료코드:
  - `git diff --check` → 출력 없음, 종료코드 0 (1회)
  - 한 선언 diff 확인: `git diff -- apps/web/src/components/ride/OfficialCourseListModal.css` → 해당 선언 1줄만 변경 확인, 종료코드 0 (HEAD 대비 diff에는 지시23 block 포함 — 지시23 미커밋 상태라 HEAD 기준 전체가 표시되며, 이번 재지시분은 `margin-right` 1줄이 전부. `public-before-24.css` 대비 1선언 차이는 Supervisor 확인용으로 보존됨).
- 미검증 사항 (Supervisor 수행): 브라우저 검수(740 검색-정렬 간격·겹침 없음, 667 포함 기존 검수 항목), `tsc` (CSS 1선언 변경이라 영향 예상 없음).
