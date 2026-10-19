# 결과07 — GLM 서버·Rules 마감 (Task07)

- 수행자: OpenCode GLM-5.3 (`opencode/glm-5.3-flash-free`), 2026-10-19
- 근거 지시: [02-task-07.md](02-task-07.md) · 기존 참고: [03-result-04.md](03-result-04.md), [06-supervisor-findings-02.md](06-supervisor-findings-02.md), [07-supervisor-integration-findings.md](07-supervisor-integration-findings.md)
- Task04에서 내가 보고한 제품 결함(#1 complete lease fencing, #2 verifyToken 401 오판, #3 core 빌드 게이트)을 이번 수행의 소유 파일(guestLifecycle*.ts, Rules, accountDeletionCore.ts, package.json)에서 수정하고 재검증했다.
- 금지 준수: 운영 Firebase·인증·`.out/private-guest-lifecycle/evidence` 접근 없음. 배포·커밋·푸시·운영 변경 없음. 내 소유 이외(web/, 루트 scripts/, 운영도구, 다른 작업자의 변경) 수정·되돌림 없음. 에뮬레이터 시작 안 함(아래 대기 항목).

## 수정 파일 (이번 수행 쓰기 소유분)

| 파일 | 내용 |
|---|---|
| `database.rules.json` | 최상위 닫힘 뒤에 붙은 옛 `.validate` 중복 tail 제거 → 유효 JSON. `trails/{trailId}/motion` 패킷 `.validate` 계약 원문 그대로 보존 |
| `functions/src/guestLifecycleCore.ts` | ① settleOne 의 631 중복 비교 TS2367 제거(deleted 는 앞선 return 으로 이미 제외되므로 `inPipeline = BLOCKING.has(doc.status)` 단일 판정으로 정리) ② `armDeletion` 결과 유형을 단일 리터럴 discriminant `GuestArmResult` 로 분리해 TS2339 해제 ③ `completeGuestLink` lease fencing: 문서에 살아 있는 linkLeaseToken 이 있고 보낸 토큰이 다르면 `lease-mismatch` 거절(pre-read 사전 차단 + tx 안 CAS 재확인). marker 차단분은 412 고정 ④ purgeGuest catch 의 `rtdb.setBlocked` 재실패해도 배치가 죽지 않게 catch |
| `functions/src/guestLifecycleHttp.ts` | ① 영구 토큰 오류 코드 분류(만료·폐기·무효·사용중지·user-not-found), 모르는 코드는 일시 방향(안전 쪽) ② `verifyToken`: 영구만 null(→401), 일시는 throw 유지 ③ `runGuestLifecycleRequest` 래퍼: handler·getUser·setBlocked 등의 throw 를 401 로 줄이지 않고 503 JSON(`reason: "transient-failure"`) 로 응답 ④ `getRtdbOrNull` |
| `functions/src/guestLifecycleAdmin.ts` | ① `guestRtdbPort`: rtdb null 이면 차단 쓰기를 거부(조용한 통과 금지) → 삭제는 실패·재시도로 남음 ② `listProfileUids` 확장: users·userPrivate·livePresence 외에 rides·savedRoutes(userId 필드 projection), conquest(문서 id), `members`·`livePublicationRides` collectionGroup(문서 id), RTDB motion 합침. 공용 Trail 문서 자체·openTrailListings hostUid 는 후보에서 제외 ③ `recentRideOrPresence`: rides endedAt, livePresence updatedAt, Trail members/session members/livePublicationRides lastSeenAt, RTDB motion t 까지 30일 창 판정 ④ `recordRun`: 90일 보존, run당 최대 50건까지 과거 run 정리 ⑤ 위 인덱스는 lazy 1회 구성 + 비용 한계 주석 |
| `functions/src/accountDeletionCore.ts` | `deleteAccountData` 가 presence 인덱스로 못 보는 RTDB-only motion 을 `rtdbTrailIdsWithMotion` 으로 직접 발견해 합침. 공용 Trail 문서 자체 보존, 다른 라이더 motion 노드 불변 |
| `functions/package.json` | `test` 스크립트에 guestLifecycleHandlers.test.js·guestLifecycleDelete.test.js 연결 |
| `functions/src/guestLifecycleHandlers.test.ts` | 결과04 [감리 FAIL] complete lease 검증 항목을 PASS 계약 시험으로 전환(412·lease-mismatch·문서 linking 마커 유지). lifecycle-disabled 등록 계정의 임의 토큰 complete 차단 시험 추가. HTTP 영구·일시 분류와 503 래퍼 계약 시험 추가 |
| `functions/src/guestLifecycleDelete.test.ts` (신규) | RTDB-only motion 수거, 다른 라이더 motion 불변, 공용 Trail 문서 보존, RTDB null 시 motion 건드리지 않음, guestRtdbPort null 거부·실제 blocked 기록 |

## 실행 증거

실행 폴더 전체 절대 경로: `C:\20.HDev\boxcycle\functions` (루트 시험은 `C:\20.HDev\boxcycle`)

```
cd C:\20.HDev\boxcycle\functions
npm run build
npm run lint
npm test
node --test lib/guestLifecycleCore.test.js
node --test lib/guestLifecycleHandlers.test.js
node --test lib/guestLifecycleDelete.test.js

cd C:\20.HDev\boxcycle
node --experimental-strip-types --test scripts/guest-lifecycle-supervisor.test.mjs
```

| 명령 | exit | 결과 |
|---|---|---|
| `npm run build` (tsc) | 0 | 오류 0 — 결과04 빌드 게이트(core.ts TS2367·TS2339) 해제 |
| `npm run lint` (eslint src) | 0 | clean |
| `npm test` (functions 전 시험, build 포함) | 0 | tests 98 / pass 98 / fail 0 |
| `node --test lib/guestLifecycleCore.test.js` | 0 | 17 / 17 PASS(시간 경계·경합 소유권·관리자 disabled 무변경·Auth 부재 유예 구분 등) |
| `node --test lib/guestLifecycleHandlers.test.js` | 0 | 25 / 25 PASS — Task04의 HTTP 19건 회귀 전원 PASS 포함, 감리 FAIL 항목 412 PASS로 전환 |
| `node --test lib/guestLifecycleDelete.test.js` | 0 | 5 / 5 PASS |
| `node --experimental-strip-types --test scripts/guest-lifecycle-supervisor.test.mjs` | 0 | 7 / 7 PASS 유지 |
| `JSON.parse(database.rules.json)` | 0 | 유효 JSON |

## 지시 1~7 대응

1. database.rules.json 을 유효 JSON 으로 교정, motion `.validate` 원문 보존.
2. core 빌드 오류 2건 해제 + complete lease fencing: 토큰 불일치 시 412·`lease-mismatch`, lifecycle-disabled 등록 계정도 임의 토큰으로는 재활성화·면책되지 않음(다음 sweep 이 문서 소유 표식만 보고 복구). HTTP 19건 전원 PASS.
3. verifyToken 은 영구 인증 오류만 401로, 네트워크·internal 등 일시 장애는 예외 그대로 두고 수신부가 503 JSON으로 응답(클라이언트 상태 보존·재시도). RTDB 초기화 null 은 `guestRtdbPort` 가 차단 쓰기를 거부해 삭제가 진행되지 않고 실패·재시도 상태로 남음. Auth 삭제 후 기존 토큰은 `auth/user-not-found` 영구 401 분류. 이 구분을 시험으로 고정.
4. listProfileUids 확장 + deleteAccountData RTDB-only motion 실제 수거(공용 Trail 문서 보존, hostUid 만을 발견 근거로 사용하지 않음).
5. 활동 판정에 Trail/Publication 실활동(members·livePublicationRides lastSeenAt)과 RTDB motion t 포함. 개별 uid 오류는 retryable로 건너뛰고 배치를 죽이지 않음(기존 시험 재확인). 삭제 cap 20·관찰 cap 100, Google/admin/보호UID·관리자 disabled 무변경. config/guestLifecycle 접근: firestore.rules 의 `/config/{configId}` get 은 routeReviewers uid 만, 나머지 거부 — protectedUids 문서를 클라이언트가 읽을 수 없음. guestLifecycle/·guestLifecycleRuns/ 는 read,write false.
6. 단일 원자성은 주장하지 않음. activity·link lease·삭제 예약은 모두 guestLifecycle/{uid} 트랜잭션으로 직렬화, setPipeline CAS(owner+generation), worker lease, CAS 실패 시 삭제 중단. 예약 전 조회 실패 같은 일시 장애는 계정을 건드리지 않고 retryable. Auth 이미 없는 Guest 는 신규 30일 유예 없이 즉시 정리(supervisor test 5 확인).
7. scheduled KST 03:15 등록 유지(index.ts), ACCOUNT_DELETION_POLICY 에 guestLifecycle·guestLifecycleRuns 분류 등록 유지, functions npm test 에 신규 시험 2건 연결, guestLifecycleRuns 90일 보존·run당 50건 정리로 무한 누적 방지.

## 비용 한계 (명시)

- 후보 수집: 컬렉션별 id-only projection 또는 userId 단 필드 projection 스캔 1회 + Auth 전체 pagination + 후보 uid당 users profile get 1회. 현재 소규모(수백 게스트·문서) 에서 안전. rides·savedRoutes가 10만+ 건이 되면 projection 스캔의 범위 조정(커서 분산 등)이 필요.
- membership·RTDB motion 인덱스는 pipeline 진입 후보가 있는 회차에만 lazy 1회 구성.
- RTDB `trails` 전체 스캔(listRtdbMotionUids·motion 인덱스·RTDB-only 수거)은 RTDB 데이터 커지면 heavy — 소규모 초기 단계 기준.
- 배치 cap: 삭제 20건 / 관찰 100건 / 실행. 실패는 다음 실행이 이어받음.
- guestLifecycleRuns: 회차당 1문서 write + 과거 90일분 최대 50건 delete.

## Supervisor에게 전달 / 대기

1. `scripts/guest-rules-supervisor.test.mjs` 실행 준비 완료. 이 시험은 demo 프로젝트(`demo-boxcycle-guest`) 에뮬레이터 + 환경변수 `FIREBASE_AUTH_EMULATOR_HOST` / `FIRESTORE_EMULATOR_HOST` / `FIREBASE_DATABASE_EMULATOR_HOST` 세팅 후 루트에서 실행하면 된다. 시험은 `functions/lib/guestLifecycleAdmin.js`·`lib/guestLifecycleCore.js`를 import하므로 실행 전 `cd C:\20.HDev\boxcycle\functions; npm run build` 필요. GLM은 에뮬레이터를 시작하지 않았다(지시 준수).
2. 에뮬레이터에서 재확인 권장: RTDB blocked 마커 규칙(client 재쓰기 거부), Auth 삭제 후 기존 토큰 401 실증, verifyIdToken 실제 오류 코드가 분류 집합(TOKEN_PERMANENT_ERROR_CODES)과 일치하는지. 모르는 코드는 일시(안전) 방향.
3. 운영 적용 배포 범위·순서는 Supervisor 검증 후 결정. 내 수정 범위는 02-task-07 지시의 내 소유 파일 전부다.

## 미실행·한계

- Rules·에뮬레이터 통합 시험: GLM 미실행 — Supervisor 전용(demo 에뮬레이터). 준비 상태만 기록.
- Memory 포트로 증명하는 수준이며, 실제 Firestore transaction CAS·Rules 승인/거부 동작은 에뮬레이터 감리 필요.
- firestore.rules: 이번 수행에서 파일 내용 수정 없음(기존 작업의 변경 유지) — 접근 권한(config/guestLifecycle) 검수 결과만 기록.
- guestLifecycleCore.test.ts: 소유 범위 내이나 기존 17개를 일절 보존했고 신규 검증은 handlers/delete 시험에 배치.

## 결론

Task07 우선 수정 1~7 구현·검증 완료. 모든 게이트(build 0 / lint 0 / functions npm test 98 PASS / HTTP 25 PASS(19 회귀 포함) / 루트 supervisor 7 PASS / database.rules.json 유효 JSON) 통과. 배포·운영 변경 없음.
