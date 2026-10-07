# 20261007-lint-baseline-react-hooks

| 항목 | 내용 |
|---|---|
| 목적 | pre-commit 을 막는 기존 lint 오류(react-hooks v7 등) 15파일 36건을 의미 보존으로 제거 |
| 상태 | **DEVELOPMENT_DONE** · 검수 대기 |
| 배경 | `0bae764` 가 `useRoutePlanning.ts` 기존 오류 때문에 `--no-verify`(Chief 승인)로 커밋됨. 그 파일은 `8cc228f` 에서 정리. 나머지를 한 번에 정리하라는 Chief 지시(2026-10-07) |
| Supervisor | Claude · Developer: Cursor CLI |
| 지시 | [01](02-task-01.md) |
| 결과 | [01](03-result-01.md) |
| 다음 | Supervisor 가 diff·검증 검수 → APPROVED 또는 재지시 |
