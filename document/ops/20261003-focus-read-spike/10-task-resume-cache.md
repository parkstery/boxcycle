# TASK-03 — foreground 복귀 one-shot read 저감

Owner: Cursor CLI Developer. Supervisor: Codex. [09 검수](09-review-visibility-meter-rework.md)를 읽고 구현하라.

## 목표

hidden→visible 반복에서 최신 데이터가 이미 있으면 published catalog와 Activity World full sync를 다시 읽지 않는다. 초기 로드·명시적 새로고침·stale 후 갱신은 유지한다.

## 요구사항

### A. Published catalog

- 성공한 catalog 결과에 **5분 TTL**을 둔다. TTL 안의 자동 visibility 복귀 호출은 Firestore를 다시 읽지 않는다.
- 동시에 들어온 자동 refresh는 in-flight 하나로 합친다.
- 사용자가 누르는 명시적 catalog 새로고침은 `force`로 TTL을 우회한다.
- 실패는 성공 freshness로 기록하지 않는다. 초기 데이터가 없으면 즉시 읽는다.

### B. Activity World

- page hidden 동안 poll/network는 현재처럼 중지한다.
- 직전 성공 sync 결과는 visibility suspension 동안 지우지 않는다.
- visible 복귀 시 마지막 성공 sync가 현재 adaptive interval(active 60초 / idle 10분) 안이면 즉시 full sync를 생략하고 남은 시간 뒤에 poll한다.
- 초기 enable, freshness 만료, 명시적 `refreshNonce`, post-ride force refresh는 기존처럼 즉시 실행한다.
- logout/config off/debug isolation처럼 실제 eligibility가 사라질 때는 stale 결과를 지운다. 단순 page hidden과 구분한다.

## 비목표

- world `trailLiveRides` listener N개와 Trail members visibility 정책 변경.
- Rules/schema/Functions/RTDB/Firestore 경로 변경.
- poll 기본 상수 변경, production deploy.

## 검증과 수치

- 정책을 순수 테스트로 고정: initial immediate, fresh resume skip/schedule, stale resume immediate, force bypass, failed refresh not fresh, in-flight dedup.
- 기존 visibility E2E 동일 ×10 시나리오에서 다음 actual network proxy 목표:
  - `catalogPublications`: 10 → **0** (settle 직후 10회 기준)
  - `activityWorldSummary`: 10 → **0**
  - `activityWorldGlobal`: 10 → **0**
  - routeActivity getDoc는 증가 금지.
- control과 N=3 listener 수명주기 회귀 없음. 이번 단계에서는 `trailLiveRides` 30/30이 유지돼도 정상이다.
- focused tests, s42 meters, dep check, tsc, changed-file lint, focused Emulator E2E 실행.
- 제품 e2e가 5분 무진전이면 중단하고 정적/단위 검증으로 전환한다.

결과는 `11-result-resume-cache.md`에 작성한다. commit/push/deploy하지 말라.
