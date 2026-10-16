# 감리 T3 — 등록부·게이트·측정 스크립트

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-17 · Supervisor (Claude) |
| 대상 | [03-result-t3](03-result-t3.md) — Cursor Agent |
| 판정 | **APPROVED** |

## 확인

- 등록부 `apps/web/dev-tools.json` 59항목(module 24 · query 17 · script 18, temporary 8 = 만료 2026-11-17).
- 게이트 `scripts/check-dev-tools.mjs --check`: 현재 PASS. Supervisor 가 직접 **미등록 쿼리 키(`*_QUERY_KEY = "zzq"`)와 아무도 안 부르는 스크립트**를 만들어 FAIL 2·종료 1 확인 후 삭제. Developer 는 debug 미등록 FAIL 확인. 자기 시험 7개가 `test:quick` 에 포함.
- `githooks/pre-push` 에 게이트 추가(9종).
- `followCameraJump.ts` 분리: 함수 3개·카운터 그대로 이동, 호출처 import 만 변경 — 동작 무변경. `mapTickProbe` 에는 DEV 계측만 남음.
- 측정 스크립트 `apps/web/scripts/perf/run-real-gpu.mjs`(git 추적), 출력은 `scripts/perf/.out/<시각>/`.

## 이 묶음 종료 조건

T1~T3 APPROVED. temporary 8건은 만료일(2026-11-17)에 게이트 경고로 다시 올라온다.
