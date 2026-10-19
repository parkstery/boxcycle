# 구현09 결과 — Admin 재생성 방지와 후보 누락 마감

- 날짜: 2026-10-19. 수행: OpenCode. 모델: `opencode/glm-5.3-flash-free`. 세션: Task09 전용.
- 02-task-09.md 계약에 따라 구현·검증했다. 기존 변경(Task01~07·Cursor web)은 되돌리지 않았다. `scripts/` Supervisor 시험 파일은 수정하지 않고 실행만 했다. 운영 Firebase·인증정보·UID·원본데이터·`.out/private-guest-lifecycle`·evidence는 접근하지 않았다. 배포·커밋·푸시·에뮬레이터 기동 없음.
- `index.ts`·`userTierCore.ts`·`routeTokenCore.ts`와 3개 rides trigger에 `guestLifecycle/{uid}` marker를 **쓰기 전 같은 transaction으로 읽는** 공용 guard를 넣었고, HTTP 진입 게이트와 후보 누락 발견을 마감했다. Guest marker 없는 정상 Google/Guest의 기존 동작은 단위시험으로 보존을 확인했다.

## 1. Admin 재생성 방지 (§1)

새 공용 guard `functions/src/guestLifecycleGuard.ts`:

- `assertGuestLifecycleWritableInTx(tx, db, uid)` — writer transaction 본문의 **첫 동작**으로 `tx.get(guestLifecycle/{uid})`. marker 읽기를 transaction read 집합에 넣어 sweep의 arm(삭제 예약)·deleted 마커 쓰기와 Firestore conflict 감지로 직렬화한다. 재시도한 transaction은 blocking marker를 읽고 도중에 던져 그 transaction의 쓰기(users·routeTokenLedger·conquest)를 전부 폐기시킨다.
- `assertGuestLifecycleWritable(db, uid)` — transaction 밖 1차 게이트(HTTP 입구 조기 종료용). race의 진짜 해소는 위 InTx 검문이다.
- blocking 상태는 `deletionScheduled·disabling·deleting·failed·deleted` 5값(`GUEST_WRITE_BLOCK_STATUSES`). `guestWriteBlockStatusOf`는 대소문자·모르는 값·active·linking·exempt를 통과시킨다.
- `GuestLifecycleBlockedError`(`guest-lifecycle/blocked`, message에 `tombstone(status)` 포함). guard는 marker를 **읽기만** 하고 쓰지 않는다.

guard를 채운 writer들:

- `userTierCore.ts` — `mergeUserAuthMeta`는 종래 비transaction `set(merge)`이라 입구 확인 뒤에도 재생성 여지가 있었으므로 transaction으로 변환하고 첫 동작에 InTx guard를 뒀다. deps(Admin Auth/Firestore 표면)를 `UserTierAdminDeps` 옵션으로 받게 해 시험에서 격리 DB로 교체한다(기본값은 종래 표면).
- `routeTokenCore.ts` — 온보딩 지급·route_generate 차감·refund·완주 적립의 4개 transaction이 모두 개인자료(users·routeTokenLedger)를 만들므로 전부 첫 동작에 InTx guard. `RouteTokenAdminDeps`·`loadRouteTokenEconomy(db)`로 deps 교체 가능. Ledger 멱등키는 종래와 같다(user readable id는 `onboarding:{uid}`·`ride_complete:{rideId}` — `/`만 `_`로 치환).
- `mileageOnRideCreated.ts`·`conquestOnRideCreated.ts`·`routeTokenOnRideCreated.ts` — 지연 rides trigger의 transaction 본문을 `applyMileageInTransaction`·`applyConquestInTransaction`(export)로 이동하고 첫 동작에 InTx guard. handler catch는 `GuestLifecycleBlockedError`면 warn 로그 1줄 + 정상 종료(재시도 대상 아님), 그 외는 종래 계약(throw 또는 error 로그)을 유지한다.

## 2. HTTP verifyIdToken(token, true)와 오류삼킴 수정 (§2)

`guestLifecycleHttp.ts`에 HTTP 수신부 공용 게이트를 모았다 — 4곳(index.ts 2종 HTTP, routeTokenEnsureOnboardingHttp, tierQuotaHttp)의 반복 본문이 같은 계약을 쓴다:

- `verifyUidForAdminHttp(res, token)` — `verifyIdToken(token, true)`로 서버가 끈(disabled) 계정의 남은 토큰도 거절. 영구 인증 오류는 종래 계약대로 401, 나머지(네트워크·Auth 장애 등)는 `HttpsError("unavailable")` → 503 JSON. 검증 뒤 marker를 읽어 blocking이면 403 `permission-denied`로 종료 → 이후 개인자료 생성 코드가 아예 실행되지 않는다. marker 조회가 일시 실패하면 "차단 여부를 모른다"를 정상으로 삼지 않고 503.
- `guestLifecycleBlockedHttpsError` / `transientStoreHttpsError` — 처리 중 던져진 guard 차단은 403, Firestore 일시 코드(`unavailable`·`aborted`·`deadline-exceeded`)는 503. 그 외는 기존 계약(internal 500 등)을 유지.

파일별 근거: index.ts는 경로 계산·토큰 소모가 users 원장을 만들고(§1 계약) routeTokenEnsureOnboarding는 온보딩 지급이 지급 ledger 자체를 만드므로 둘 모두 입구 게이트 필수. tierQuotaHttp는 mergeUserAuthMeta가 quota 판정 앞 users 원장을 건드리므로 같은 게이트가 필요하다 — 이 4개는 `guestLifecycleHttp.ts`에 공용화했다.

오류삼킴: routeTokenEnsureOnboarding과 index.ts·tierQuotaHttp의 `mergeUserAuthMeta` catch는 종래 "users 메타 실패해도 Guest(true)로 보수 진행" 계약을 keep하되, **tombstone 차단과 일시 장애만은 재throw**해 온보딩·차감이 계속되지 않게 했다. 지급 Transaction 자체도 InTx guard가 있어 여기가 뚫려도 재생성 없이 실패한다.

## 3. listProfileUids 후보 누락 마감 (§3)

`guestLifecycleAdmin.ts`:

- 신규 발견 경로: `routeTokenLedger.userId`(문서 id가 멱등키 해시라 uid가 아니므로 userId 필드로 귀속), `nicknames.ownerUid`, `publicRouteRequests.applicantUid`, `routePublications.applicantUid`.
- conquest 고아: `conquestOrphanSubcollectionUids` group 스캔 + `conquestOrphanUidFromDocPath` — `conquest/{uid}/chunks/…`·`conquest/{uid}/traces/…` 문서 경로만 귀속 인정(다른 루트 컬렉션·다른 하위명은 null). 이로 부모 `conquest/{uid}`가 없는 traces-only·chunks-only 계정을 users 부재와 무관하게 발견한다.
- membership 귀속 경로 검증: `membershipUidFromDocPath`는 `trails/{id}/members`·`publicationSessions/{id}/members`·`trails/{id}/livePublicationRides`만 인정한다(rooms(구 시대)·coursePresence·기타 하위명은 null).
- 공용 Trail `hostUid`는 종래 Task07 원칙 그대로 후보에서 제외(유지). RTDB motion-only 발견은 종래 경로 유지.
- 정책 대조: `accountDeletionCore.ts`의 자료취급표와 일치 — nicknames·publicRouteRequests·routeTokenLedger·conquest(chunks·traces 포함)는 delete, routePublications는 anonymize(`applicantUid ""` + `publisherDeleted`)여도 anonymize 전 uid가 개인귀속 근거이므로 발견에 넣는다.

## 4. 시험

새 단위시험 2파일(시험 전용 fake `guestAdminFakeFirestore.ts` 사용 — 충돌 재시도 흉내·`FieldValue.increment` 커밋 적용·marker seed):

- `guestLifecycleGuard.test.ts`(10 orange→10 PASS): blocking 5상태 InTx·tx밖 게이트 차단, marker 없음/active/linking/exempt 통과, merge guard가 marker를 안 씀, 정상 Google merge patch(승격 tier 보존)·정상 Guest anonymous merge, 삭제 예약 뒤 merge 재생성 금지, **예약 race**(marker read 직후 arm → conflict 재시도 → blocking marker로 거절, sweep marker는 되돌려지지 않음), deleted race, group 스캔 경로 검증.
- `guestLifecycleTriggersGuard.test.ts`(8 PASS): 지연 mileage/conquest trigger marker 없으면 수치·마킹 종래 그대로, 5상태 뒤 지연 도착은 users·conquest 하위 전체 미생성, 온보딩 지급 수치(guest 10)·5상태 재요청 users/ledger 미생성(marker 자체 무변동), 완주 적립 5상태 원장·잔액 미생성 + marker 없으면 거리×rate 계약 그대로.

## 5. 실행

| 명령(실제 폴더) | 종료 | 판정 |
|---|---|---|
| `cd C:\20.HDev\boxcycle\functions` 후 `npm run build` | 0 | PASS. tsc 오류 없음 |
| `cd C:\20.HDev\boxcycle\functions` 후 `npm run lint` | 0 | PASS. error 0 |
| `cd C:\20.HDev\boxcycle\functions` 후 `npm test` | 0 | PASS. tests 116 · pass 116 · fail 0 (기존 9파일 + 신규 2파일. 기존 시험 전부 통과 — 회귀 없음) |
| `cd C:\20.HDev\boxcycle\functions` 후 `node --test lib/guestLifecycleGuard.test.js` | 0 | PASS 10 |
| `cd C:\20.HDev\boxcycle\functions` 후 `node --test lib/guestLifecycleTriggersGuard.test.js` | 0 | PASS 8 |
| `cd C:\20.HDev\boxcycle` 후 `node --experimental-strip-types --test scripts/guest-lifecycle-supervisor.test.mjs` | 0 | PASS. tests 7 · pass 7 · fail 0 |
| 실제 emulator 룰 시험(`scripts/guest-rules-supervisor.test.mjs`) | 미실행 | **Supervisor 실행 몫.** 에뮬레이터 기동·운영 데이터 접근이 이 작업 범위 밖. lib 빌드는 위 `npm test`가 만들어 동일 워크스페이스에서 바로 돌릴 수 있다 |

## 6. 바꾼 파일 (전부 승인 범위 functions)

| 파일 | 성격 | 근거 |
|---|---|---|
| `functions/src/guestLifecycleGuard.ts` | **신규** | §1 공용 guard — 모든 Admin 개인자료 writer의 동일 계약 |
| `functions/src/guestAdminFakeFirestore.ts` | **신규(시험 전용)** | guard·trigger 계약을 격리 DB로 검증하는 fake. 런타임 코드 아님 |
| `functions/src/guestLifecycleGuard.test.ts` | **신규 시험** | §4 |
| `functions/src/guestLifecycleTriggersGuard.test.ts` | **신규 시험** | §4 |
| `functions/src/guestLifecycleHttp.ts` | 공용 계약 | §2 — 4개 Admin HTTP 수신부의 반복 본문을 하나로 고정 |
| `functions/src/index.ts` | 계약 채택 | 경로 계산·지출(§2 2종 HTTP) + mergeUserAuthMeta catch 재throw |
| `functions/src/routeTokenEnsureOnboarding.ts` | 계약 채택 | 온보딩 지급 개인자료 생성 엔트리(§2) |
| `functions/src/tierQuotaHttp.ts` | 계약 채택 | quota 선검사 앞 users 원장 merge(§2) |
| `functions/src/userTierCore.ts` | §1 | mergeUserAuthMeta transaction+guard 변환·deps 주입 |
| `functions/src/routeTokenCore.ts` | §1 | 4개 지출·지급 transaction guard + deps 주입 |
| `functions/src/mileageOnRideCreated.ts` | §1/§2 | 지연 trigger tx 본문 이동+guard, catch 분류 |
| `functions/src/conquestOnRideCreated.ts` | §1/§2 | 〃 |
| `functions/src/routeTokenOnRideCreated.ts` | §1/§2 | catch 분류(적립은 tx가 routeTokenCore 안에 있음) |
| `functions/src/guestLifecycleAdmin.ts` | §3 | listProfileUids 확장·경로 검증 |
| `functions/src/guestLifecycleCore.ts` | 참조 | blocking 5상태·marker 경로 SoT (변경 없음 확인) |
| `functions/package.json` | 등록 | `test`에 신규 2파일 추가 |

- 수정하지 않은 것: `scripts/*` 전부(실행만), apps/web 전부(Cursor 소유), rules/DB 데이터, 배포. Supervisor 소유 시험 파일의 기대자리와의 정합은 코드 주석과 계약명으로 맞췄다.

## 7. 남은 한계

- **실제 emulator 룰·integration 시험은 미실행**(Supervisor 몫). guard 직렬화 증거는 격리 fake의 conflict 재시도 흉내로 제공한다 — 실제 Firestore transaction 복귀 경합은 emulator 단계에서 재확인 대상이다.
- `transientStoreHttpsError`의 일시 코드 집합은 `unavailable`·`aborted`·`deadline-exceeded`. `internal`은 일시로 삼지 않는다(장애를 503으로 감추면 진짜 결함이 숨는다). 재시도 계열 코드 추가가 필요하면 Supervisor 검수 제안으로.
- 온보딩 HTTP의 "users 메타 실패 → isAnonymousHint=true 보수 진행" 종래 계약은 유지했다. guard 오류·일시 장애는 여기서 재throw되므로 온보딩이 tombstone 뒤로 계속되지 않는다.
- 정책 대조 중 남은 발견(수정하지 않고 보고만): `routeAutoRouteCache` 컬렉션은 `accountDeletionCore` 취급표에 없어 삭제 누수 자료로 남는다(개인귀속 라는 취급 행 필요 — 새 Task 후보).
- routes trigger catch에서 guard 차단은 warn+return(정상 종료)이다. 지연 event가 Firestore에서 최소 1회 전달되면 그때 이미 marker Absent 신규 Guest 로 온다 — 미성립한 공용 예약 경합에 대한 최후 방어는 Rules(Supervisor 몫)와 본 guard의 InTx read이다.

## 8. Chief 확인

```
cd C:\20.HDev\boxcycle\functions
npm run build
npm run lint
npm test
node --test lib/guestLifecycleGuard.test.js
node --test lib/guestLifecycleTriggersGuard.test.js
cd C:\20.HDev\boxcycle
node --experimental-strip-types --test scripts/guest-lifecycle-supervisor.test.mjs
```

에뮬레이터 룰 시험은 Supervisor가 `scripts/guest-rules-supervisor.test.mjs`를 에뮬레이터 기동 뒤 실행한다(`npm test`가 만든 `functions/lib`가 필요하므로 위 빌드를 먼저 돌려놨다).
