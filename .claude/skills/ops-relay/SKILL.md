---
name: ops-relay
description: 명시적으로 재개된 기존 Claude ops 릴레이의 지시와 결과를 처리한다. 새 Supervisor/Developer 작업은 document/ops/README.md를 따른다.
user-invocable: true
---

# 기존 Claude 릴레이 호환

`document/ops/`의 기존 릴레이 기록은 보존한다. [ops 색인](../../../document/ops/README.md)에서 대상 묶음이 열려 있는지 먼저 확인한다. 종료된 묶음은 명시적 재개 지시 없이 수행하지 않는다.

1. 현재 묶음 README와 최신 지시를 읽고 범위·검증·Git 제한을 확인한다.
2. 지시된 범위만 수행하고, 실패·미완·범위 밖 발견을 숨기지 않고 별도 결과 파일에 기록한다.
3. 기존 번호 체계와 도메인별 검증 규율은 해당 묶음 README를 따른다. 기존 지시·결과를 덮어쓰지 않는다.
4. `await-next.mjs`는 현재 지시에서 명시적으로 요구할 때만 사용하며, 무한 대기와 자동 재시작을 기본 동작으로 삼지 않는다.

새 Codex Supervisor ↔ Cursor CLI 작업의 공식 규칙과 상태는 [ops 프로토콜](../../../document/ops/README.md)과 [전체 상태판](../../../document/ops/PROGRESS.md)을 따른다. Chief에게 파일 복사·붙여넣기 중계를 요구하지 않는다.
