# 문서 체계 정리

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — 문서 운영 정비 |
| 최초 작성 | 2026-10-05 |
| 독자 | chief · AI |
| 상태 | APPROVED — Supervisor 검수 PASS, Chief 최종 종료 승인 전 |
| 최신 지시 | [01 지시](01-task-document-system.md) |
| 최신 결과·검수 | [02 결과](02-result-document-system.md) · [03 검수 PASS](03-review-document-system.md) |
| 최종 보고 | [문서 체계 정리 결과](../../archive/reports/261005-RTW-문서체계-정리-완료보고.md) |

## 지금 할 일

문서 정리·참조 갱신·검증을 완료했다. Cursor CLI가 구현 전 ENOMEM으로 종료해 Codex가 직접 수행·검수했다. 현재 문서 검사 PASS, 과거 기록 기존 오류 23건·이동 회귀 0건. 새 구현 지시는 없다. Chief 최종 종료 승인·커밋 여부는 별도이며 자동 커밋·push하지 않는다.

Chief 요청: 기존 정리 방안을 실행하고, 가장 자주 보는 상태보드를 목표·진도 점검의 핵심 입구로 계속 유지한다. 문서 이동은 이번 요청으로 승인된 범위다. 제품 의미·코드 동작 변경은 제외한다.

## 재현과 증거

[이동 목록](moves.json) · [이동 전 누락 링크](link-baseline.json) · [참조 수정 목록](migration-changed-files.json)

현재 검사: `node scripts/check-document-system.mjs`.
과거 비교: `node scripts/check-document-system.mjs --all --baseline document/ops/20261005-document-system/link-baseline.json --moves document/ops/20261005-document-system/moves.json`.
보존 확인: `python document/ops/20261005-document-system/verify-migration.py`.
누락 검출 확인: `node document/ops/20261005-document-system/checker-failcheck.mjs`.

`migrate-documents.py`·`update-indices.py`·`repair-routing.py`는 당시 수행 기록이다. 현재 상태에서 재실행하지 않는다. 새 정리는 새 범위·이동 목록으로 수행한다.
