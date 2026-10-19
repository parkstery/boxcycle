# Task05 통합 감리 중간 발견

담당 Codex / 제품 수정 Cursor / HTTP 시험 GLM. 운영 변경·배포 없음.

- core 독립시험7 PASS.
- 08:07 functions build exit1: core.ts631 중복 deleted 비교 TS2367,650 discriminated union generation TS2339. GLM 시험의 unused TokenMap은 GLM 소유로 수정해야 함.
- 08:08 `JSON.parse(database.rules.json)` exit1: JSON 최상위 닫힘 뒤 옛 `.validate` 이하 중복 tail이 붙어 있다. 배포 전 반드시 파일을 유효 JSON으로 정리해야 한다. `.validate` 내용 자체는 기존 계약 그대로 보존.
- adapter listProfileUids 및 RTDB-only 삭제 누락은 findings06과 실제 emulator 시험에 고정함.
- HTTP verifyToken 임시 장애401 오판·RTDB null 삭제계속 방어도 findings06에 남아 있다.
- 이 파일은 병렬 작업 중간 스냅샷이다. 최종 검수에서 최신 소스와 실제 결과로 재판정한다.

## 08:23 adapter 초안 주의

conquest root `.select().get()`는 부모문서가 없고 traces/chunks만 있는 경우를 못 찾는다. 정확히 이번 최초조사에도 missing parent가 있었다. Supervisor emulator fixture에 **missing-parent traces-only** 및 **routeTokenLedger-only** 고아를 추가했다. 개인귀속 삭제정책 전부를 발견해야 하므로 request applicantUid/nickname ownerUid/openTrailListings hostUid 등도 검토. 공용 Trail hostUid는 후보로 삼지 않는 기준 유지.

## Admin 쓰기 우회 — 최종 승인 전 필수

Rules는 Admin SDK를 막지 못한다. index.ts 경로계산2종, routeTokenEnsureOnboarding.ts, tierQuotaHttp.ts가 verifyIdToken(token)만 하고 폐기여부를 검사하지 않는다. 특히 onboarding은 mergeUserAuthMeta의 Auth부재 오류를 삼킨 뒤 ensureRouteTokenOnboarding이 users/원장을 재생성할 수 있다. 최소 재현은 기존 ID token으로 **삭제 후 onboarding HTTP 요청**. 개인자료 Admin writer와 지연 CloudEvent(conquest/mileage/routeToken)가 tombstone을 transaction에서 확인해야 삭제 이후 재생성이 차단된다. 단순 entrypoint true 재검사만으로 진행중 transaction/지연 trigger 경합을 해결했다고 주장하지 않는다. 기존 Google4 기록에는 영향 없는 상태에서 검증할 것. 필요한 관련 파일 허용은 Supervisor 후속 task에서 구체화한다.
