---
name: ride-verify
description: 실주행 진입 시퀀스(게스트 익명 인증→입문 코스 로드→주행 시작→running)를 검증하는 워크플로. 진입 흐름·게스트 인증 게이트·RouteDock/코스 모달/HUD 셀렉터·주행 시작 로직을 만지거나, 실주행이 "안 뜬다/안 시작된다"를 디버깅할 때 사용한다. 셀렉터 계약을 정적으로 고정해 UI 변경이 e2e 를 깨기 전에 잡는다.
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
---

# ride-verify — 실주행 진입 검증 규율 (WHY)

실주행 진입(게스트→코스→주행 시작)은 Firebase 익명 인증·Firestore·여러 컴포넌트의
셀렉터가 얽혀 있어, 하나만 바뀌어도 "앱은 뜨는데 주행이 안 시작됨"이 난다. 이걸 매번
**Playwright MCP 로 수동 클릭해 재확인**하던 반복을 하네스로 대체한다.

- **이 문서 = 왜·언제·합격기준.** 도구를 **어떻게** 쓰는지는 [하네스 사용법](../../../apps/web/scripts/ride-verify/HARNESS.md)을 보라.
- **이름 주의**: Claude Code 빌트인 `/verify`(범용 검증)와 다르다. 이 스킬은 **RTW 실주행 진입 전용**이다.
- **SoT 우선순위**: 진입 조건·게이트 로직의 정본은 코드(`src/App.tsx` 의 `needsGuestEntry`·`handleStartRide`, `src/hooks/useAppAuth.ts`)다. 이 스킬은 그 진입 흐름의 셀렉터 계약을 고정할 뿐이다.

## 철칙 — 진입을 수동 클릭으로 반복 확인하지 마라

진입 시퀀스 UI(게스트 카드·메뉴·코스 모달·RouteDock·HUD)를 바꿀 때 이 순서를 지킨다:

1. **셀렉터 계약 먼저** — 바꾸는 버튼/그룹의 앵커를 `scripts/ride-verify/entry-contract.mjs` 에 반영한다.
2. **계약 검증** — `node scripts/ride-verify/verify-selectors.mjs` (Firebase 불필요, exit 0/1). 커밋 전 게이트.
3. **e2e 진입** — Firebase 가 준비됐으면 `RIDE_VERIFY_LIVE=1 npm run test:e2e -- ride-entry` 로 실제 클릭 시퀀스를 돌린다. 아니면 2번까지가 방어선.
4. 필요 시 실제 dev 서버·Playwright MCP 로 눈 확인 — 단, **2·3을 건너뛰고 곧장 수동 확인으로 가지 마라.**

> **진입 문제를 수동 클릭으로 2번 이상 쫓고 있다면 — 계약(1번)이 빠졌거나 낡은 것이다. 멈추고 계약부터 맞춰라.**

## PASS / FAIL 기준

**셀렉터 계약**(`verify-selectors.mjs`, 항상):

| 항목 | PASS | FAIL |
|---|---|---|
| 6단계 앵커 | 각 단계의 aria/텍스트 앵커가 소스에 실재(exit 0) | 하나라도 실종(exit 1) → UI 변경에 계약·spec 미갱신 |

**진입 e2e**(`ride-entry.spec.ts`, `RIDE_VERIFY_LIVE=1` 일 때):

| 항목 | PASS | FAIL |
|---|---|---|
| 게스트 진입 | '시작' 클릭 후 진입 카드가 사라짐 | 카드 그대로 / 익명 인증 실패 |
| 코스 로드 | 입문 모달에서 코스 클릭 후 모달 닫힘 | 모달 안 열림 / 코스 항목 없음 |
| 주행 시작 | '주행 시작'(Go) 클릭 가능 | 버튼 미표시(stage ≠ ready-to-start) |
| running 확정 | '주행 지표' 그룹 + '주행 종료' 버튼 보임 | 둘 중 하나라도 안 뜸 |

## Anti-pattern (재발 금지)

- **진입을 매번 수동 클릭으로 확인하지 말 것.** 그게 이 하네스를 만든 이유다. 계약 검증(Firebase 불필요)이 먼저다.
- **셀렉터를 한쪽만 고치지 말 것.** `entry-contract.mjs` 와 `e2e/ride-entry.spec.ts` 는 같은 셀렉터를 쓴다. 하나만 고치면 계약이 통과해도 e2e 가 깨진다(또는 반대).
- **`RIDE_VERIFY_LIVE=1` 을 CI 기본으로 켜지 말 것.** 에뮬레이터 미배선 상태에서 켜면 실 Firebase 에 붙어 비결정적으로 실패한다. Firebase 전제(HARNESS.md)를 먼저 갖춰라.
- **`VITE_ALLOW_UNAUTH_MAP` 으로 주행 시작을 우회하려 하지 말 것.** 그 플래그는 인증 카드만 완화하고, `handleStartRide` 는 `!user` 면 return 한다 — 주행 시작엔 실제 익명 로그인이 필수다.
