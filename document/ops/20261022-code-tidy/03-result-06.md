# 결과06 — P3 반복 통합: 서비스·저장소 작은 쌍

2026-10-22 · 구현 Claude(impl) · 지시 [02-task-06.md](02-task-06.md) · 규칙 [02-task-p3-rules.md](02-task-p3-rules.md)

8쌍 전부 합쳤다. 합치지 못한 쌍은 없다. 바깥으로 내보내는 이름·인자·반환 타입과 로그·오류 문자열은 그대로다. 시험·eslint·knip·baseline 파일은 건드리지 않았다.

## 쌍별 결과 (줄 수는 git numstat 의 추가/삭제, 새 파일은 전체 줄 수)

| # | 공통부 위치 | 쓰는 쪽 증감 | 새 파일 |
|---|---|---|---|
| 1 | `src/services/routeFunctionsWire.ts` — `wireStatusToFunctionsCode`, `createRouteTokenSpendReporter` | distanceAutoRouteApi +3/−26, mapboxDirections +3/−27 | 31줄 |
| 2 | 기존 `geo/lineStringCoordsJson.ts` 의 `decodeLineStringCoordsJson` 을 그대로 사용 | firestoreSavedRoutes +2/−17 | 없음 |
| 3 | `src/lib/conquest/conquestPathGeometry.ts` — `parseConquestPathItem` (ride → conquest 허용) | rideConquestResult +3/−26, firestoreConquest +3/−22 | 30줄 |
| 4 | `src/lib/identity/functionsHttpJson.ts` — `readFunctionsHttpJson` (account → identity 허용) | accountDeletionApi +2/−7, guestResetApi +2/−7 | 16줄 |
| 5 | `src/lib/account/functionsErrorMessage.ts` — `parseErrorMessage` (account/repo → account 허용) | tierQuota +1/−8, subscription +1/−8 | 8줄 |
| 6 | `src/lib/ride/sanitizeLngLat.ts` — `sanitizeLngLat` | nextRideTarget +3/−12, firestoreRides +5/−14 | 11줄 |
| 7 | 같은 파일 안 `prepareNicknameWrite` (검증+참조 생성) | firestoreUser +12/−17 | 없음 |
| 8 | 같은 파일 안 `runLockedSlotOp`, `restoreExpiryUnlessCompleted`, `casWriteSlotResult` | rideResumeSlotLocal +48/−52 | 없음 |

## 쌍별 메모 (동작 불변 근거)

1. `services/` 는 `dep-layers.json` 의 appLayer 라 도메인 규칙 밖이다. 배정 목록 추가도 필요 없다. `lastSpendFeedbackRequestId` 상태는 두 파일이 각자 따로 갖던 것이라, 공유 모듈 전역 변수 대신 팩토리(`createRouteTokenSpendReporter()`)로 파일마다 자기 상태를 갖게 했다. 같은 requestId 중복 보고 방지 동작도 같다.
2. 기존 함수는 JSON 파싱 실패·형식 오류에 null 을 돌려준다. 이전 인라인 코드도 똑같이 null 이었고 legacy 폴백으로 넘어가지 않았다. 의미가 같다.
3. 두 구현의 차이는 반환 방식뿐이었다(건너뜀 vs 빈 배열). 공통 함수는 항목 하나를 LineString 또는 null 로 바꾸고, 각 호출부가 기존 모양(`undefined` / `[]` 반환 포함)으로 모은다.
4. 두 쪽의 `errorMessage` 계산은 서로 달라서 합치지 않았다(account 는 trim 한 문자열 또는 null, guest 는 서버 오류 번호 폴백). 합친 것은 본문 JSON 읽기와 `ok` 판정뿐이다. 새 파일은 `identity/` 에 두었고 `identity/repo/` 가 아니다. fetch 응답 해석만 하고 Firebase 를 알 필요가 없기 때문이다.
5. `tierQuota.ts` 는 이미 `account/repo/tierQuotaApi` 를 쓰는 구조다. 공통 함수는 account 본체에 두었고, `account/repo/subscription` 이 그것을 쓴다(repo → 자기 도메인).
6. `asLngLat` 과 `sanitizeAnchorLngLat` 은 본문이 같았다. `clamp01` 과 `sanitizeAnchorRatio` 도 겹치지만 지시 범위(42–51 ↔ 81–90) 밖이라 건드리지 않았다.
7. 호출 순서(형식 검사 → 키 검사 → `getFirebaseFirestore()` → 참조 생성)와 오류 문구는 같다. `changeNicknameTransaction` 의 게스트 거절은 helper 호출 앞에 그대로 있다.
8. 락 획득 실패 시 lock_busy 결과, TTL 쓰기 실패 시 ttl_write_failed 결과, CAS 실패 시 cas_conflict·slot_write_failed 결과의 이유 문자열과 `slot` 값이 이전과 같다. `Date.now()` 호출 시점도 같다(경로가 있고 미완주일 때만).

## dep-layers.json

배정 목록에 **추가만** 했다(엣지는 건드리지 않음): `identity/functionsHttpJson.ts`, `account/functionsErrorMessage.ts`, `conquest/conquestPathGeometry.ts`, `ride/sanitizeLngLat.ts`. 같은 파일 diff 의 `trail/keyedSubscriptionHub.ts` 는 동시에 작업하는 다른 구현자의 추가분이다.

## 스스로 검사 (apps/web)

- `npx tsc -b --noEmit` — 출력 없음, 통과.
- `npx eslint <고친 18개 파일>` — 처음에 `functionsHttpJson.ts` 의 no-useless-assignment 1건이 나왔다. 초기값을 없애는 식으로 고친 뒤 0건이다.
- `node ../../scripts/check-dep-direction.mjs --check` —
  ```
  === 방향 위반 0건 ===
  === lib 순환 0쌍 ===
  [check-dep-direction] baseline 이내 — 통과
  ```
- `npm run test:quick` —
  ```
  ✓ meters 트래픽 계측      통과   58  실패   0  (5개 파일, 1.3초)
  ✓ tools  시험 도구 자체    통과   41  실패   0  (7개 파일, 10.1초)
  [test:quick] 합계 통과 1341 · 실패 0 · 62.5초 · 제외 3개 파일(에뮬레이터·하네스, --list 로 확인)
  ```
  이 실행은 eslint 수정 직전에 돌렸다. 이후 수정은 `functionsHttpJson.ts` 의 `let` 초기값 제거 한 줄이라 동작은 같고, tsc 와 eslint 는 다시 통과를 확인했다.
