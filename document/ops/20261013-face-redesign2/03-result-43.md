# 결과43 — substats 가로넘침 보정 (flex-wrap 한 줄)

- 작업: `apps/web/src/components/ride/RideSummarySheet.css` `.ride-summary__substats` `flex-wrap: nowrap` → `wrap` 1줄만 변경
- 변경 행: 322행 (`flex-wrap: wrap;`)
- 보존: `.ride-summary__substat` / `.ride-summary__substat-metric` / `.ride-summary__substat--calorie` / `.ride-summary__calorie-setup`의 `white-space: nowrap` 유지 (숫자/단위 분리 없음). font/버튼/폼/내용/수치/조건/폭/높이 상한 미변경. `@media (max-width: 380px)`의 기존 `flex-wrap: wrap` 정책과 동일 — 이제 모든 시트 폭에 적용.
- 정적 diff 확인:
  - `git diff -- apps/web/src/components/ride/RideSummarySheet.css`에서 본건 변경은 `@@ -319,7 +319,7 @@` hunk의 `-  flex-wrap: nowrap;` / `+  flex-wrap: wrap;` 1줄뿐
  - 동일 파일의 나머지 7줄 변경(padding/gap/border 투명화/색상)은 42 dirty 등 기존 작업트리 변경으로 보존, 손대지 않음
  - `git status --short` 기준 본건 외 수정 파일 없음 (타 파일 15건 수정 + `document/ops/20261013-face-redesign2/` untracked는 기존 상태 그대로)
- 금지 준수: 조사 외 추가 실행 없음 (tsc/browser/전체 suite/서버/하위 agent/commit/push/deploy 미실행)
- Supervisor 확인 요청:
  - 단일 browser/page·지도 없는 fixture 8상태 전후 스크롤 비교
  - before42 기준 대비 가로 overflow 0 여부 (기존 740폭 6px / PC 3px 해소 확인)
  - 모든 단위/버튼 rect/文字/콜백 동일 여부
  - 내용 높이는 셀 줄바꿈 시 증가 가능 (정보 가독 목적이면 허용 — 치수 보고 요망). 기존 하한/글자 축소로 숨기지 않음
- 비고: 지시 절대경로 `C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/03-result-43.md` 직접 쓰기는 샌드박스 차단으로 워크트리 상대경로에 동일 내용 작성. Supervisor 복사 요망.
