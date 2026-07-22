---
name: peer-sync
description: 동행 peer 위치 동기화(보간·병합·외삽) 알고리즘을 실주행 없이 패킷 로그로 재생·검증하는 워크플로. src/lib/peerMotion/* (integrator·mergePackets·rideSyncPolicy) 또는 보간·외삽·dedup·reconcile 로직을 만질 때 사용한다. "실주행으로 확인" 대신 replay 하네스로 회귀를 고정해 알고리즘 반복 교체를 막는다.
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
---

# peer-sync — 동행 보간 알고리즘 작업 규율 (WHY)

peer 위치 동기화(`src/lib/peerMotion/`)는 실주행 2인 이상이 있어야 눈으로 확인돼서,
"고치고 → 실주행 → 또 어긋남 → 또 고침"으로 **알고리즘을 3번 갈아엎은** 영역이다. 그 반복의
근본 원인은 실력이 아니라 **실주행 없이 검증할 하네스의 부재**였다(3번 규칙,
[Skill/Harness 아키텍처](../../../document/260722-Skill-Harness-아키텍처.md) §4).

- **이 문서 = 왜·언제·합격기준.** 도구를 **어떻게** 쓰는지는 [하네스 사용법](../../../apps/web/scripts/peer-sync/HARNESS.md)을 보라.
- **SoT 우선순위**: 보간·외삽·쓰기 정책의 수치 정본은 [`src/lib/rideSyncPolicy.ts`](../../../apps/web/src/lib/rideSyncPolicy.ts)와 [`integrator.ts`](../../../apps/web/src/lib/peerMotion/integrator.ts) 주석이다. **코드 주석과 이 스킬이 충돌하면 코드가 우선한다** — 이 스킬은 그 계약을 재생으로 강제할 뿐이다.

## 철칙 — 실주행으로 sync 를 확인하지 마라

peer 보간·외삽·dedup·병합처럼 **타이밍이 얽힌 로직**을 바꿀 때 이 순서를 지킨다:

1. **재현 시나리오 먼저** — 무엇이 깨졌는지(또는 무엇을 지켜야 하는지)를 패킷 시퀀스로 `scenarios.mjs` 에 적는다. 실주행 로그가 있으면 JSON 으로 넣는다.
2. **재생 검증** — `replay.mjs --check` 로 불변식(clamp·역행없음·순간이동없음·외삽상한)을 판정한다. 고치기 **전에** 먼저 돌려 결함이 재생되는지 확인한다.
3. **그래프 확인** — `--graph` 로 PNG 를 만들어 파란선(보간)이 회색점(수신 패킷)을 매끄럽게 따라가는지 눈으로 본다.
4. 코드를 고친 뒤 **다시 재생**해 위반이 사라졌는지 확인. 그다음에야 실주행으로 최종 확인.

> **같은 sync 증상을 실주행에서 2번 이상 쫓고 있다면 — 1번(재현 시나리오)이 빠진 것이다. 멈추고 패킷 시퀀스로 재현하라.**

## PASS / FAIL 기준 (재생에서 YES/NO 판정)

`replay.mjs --check` 가 기계적으로 판정한다. 하나라도 위반(`✗`)이면 재작업. `~`(known-fail)는 이미 문서화된 미해결 버그다.

| 항목 | PASS | FAIL |
|---|---|---|
| 범위 clamp | displayDistM 이 항상 [0, routeLenM] | 음수·경로초과 |
| live 역행 | 원본이 단조 전진이면 렌더도 단조(≤0.5m 흔들림 허용) | live 구간 displayDistM 이 0.5m 넘게 뒤로 감 |
| 순간이동 | 한 스텝 점프 ≤ 물리상한(+원본 불연속 따라잡기) | 이유 없는 대점프(보간이 외삽으로 샘) |
| 외삽 상한 | stall 후 전진이 `PEER_INTERP_MAX_EXTRAP_MS` 안에서 멈춤 | 끊긴 뒤 무한 전진 |
| known-fail 잔존 | `~` 유지(예상된 실패) | `!` = 고쳐졌는데 `expectFail` 방치 → 제거하라 |

## Anti-pattern (재발 금지)

- **sync 버그를 실주행으로만 쫓지 말 것.** 2인 실주행은 재현이 비싸고 비결정적이다. 먼저 패킷 시퀀스로 재현해 `--check` 에 고정한다(알고리즘 3회 교체의 근본 원인).
- **버그를 고치기 전에 회귀 시나리오부터 만들 것.** 고친 뒤엔 그 버그를 다시 못 만든다 — 재현을 먼저 `scenarios.mjs` 에 박아야 회귀로 남는다.
- **미해결 버그를 조용히 두지 말 것.** 지금 안 고칠 거면 `expectFail: true` 로 known-fail 고정한다. 그래야 CI 는 통과하되 언젠가 고쳐지면 `!` 로 알려주고, 잊혀지지 않는다.
- **`rideSyncPolicy.ts` 상수를 감으로 바꾸지 말 것.** DELAY·BUFFER_MAX·EXTRAP 상한을 바꾸면 먼저 replay 로 전 시나리오 그래프를 다시 보고, 매끄러움이 유지되는지 확인한다.
- **순수 함수에 Date.now·전역 상태를 새로 들이지 말 것.** `integrator.ts`·`mergePackets.ts` 가 순수해서 이 하네스가 성립한다. 시각은 파라미터(`nowMs`)로 받는 계약을 지켜라.
