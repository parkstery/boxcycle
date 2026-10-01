---
name: ops-relay-auto
description: 기존 ops 릴레이를 명시적으로 재개할 때만 사용하는 호환 스킬. 새 Codex Supervisor → Cursor CLI 작업에는 document/ops/README.md 프로토콜을 따른다.
---

# 기존 릴레이 호환

이 스킬은 종료된 릴레이의 기록과 도구를 해석할 때 사용한다. [ops 색인](../../../document/ops/README.md)에서 해당 묶음의 현재 상태를 먼저 확인한다. 종료된 묶음은 명시적 재개 지시가 없으면 실행하지 않는다.

- 새 작업은 해당 묶음 README와 최신 Supervisor 지시를 읽고, 한 지시를 수행한 뒤 별도 결과 파일을 쓰고 종료한다.
- 기존 묶음이 재개되면 그 묶음의 파일명·검증·Git 제한을 따른다.
- `await-next.mjs`는 지시에서 명시적으로 요구할 때만 실행한다. 무한 대기·자동 재시작을 기본 동작으로 삼지 않는다.
- 테스트 실패와 미완료는 결과에 그대로 기록한다. Chief에게 파일 중계를 요구하지 않는다.
