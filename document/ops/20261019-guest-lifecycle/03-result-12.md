# 구현12 결과 — HTTP 오류경로·후보 누락 감리잔여 마감

- 날짜: 2026-10-19. 수행: OpenCode. 모델: `opencode/glm-5.3-flash-free`. 세션: Task09를 이은 같은 세션.
- `02-task-12.md` 계약에 따라 `08-supervisor-admin-review.md` 완성본 대조 잔여만 수정했다. Task09 결과는 보존했고, `scripts/` Supervisor 시험 파일·`apps/web`·운영 데이터·`.out/private-guest-lifecycle`·evidence는 건드리지 않았다. 배포·커밋·푸시·에뮬레이터 기동 없음. 감리core7 등 관련 게이트는 Task09 자체보고를 재사용하지 않고 **수정 후 재실행**했다.
- 다른 릴레이가 남긴 dirty 변경(accountDeletionCore·purgeGuestUsersCore·routeAutoRouteCacheDeletion.test 등)은 되돌리지 않았고, `functions/package.json`의 `test` script에 이미 있던 `routeAutoRouteCacheDeletion.test.js`도 그대로 뒀다.

## 1. 잔여 수정

### §1 metadata 오류삼킴 제거(핵심) — 4개 HTTP 수신부

mergeUserAuthMeta를 감싸던 inner catch를 전부 제거해 metadata 실패가 그 응답 계약으로 끝나게 했다:

- `index.ts`(getMapboxDirections·getDistanceAutoRoute): "users 메타 실패해도 계속" warn+계속 계약 삭제 → `await mergeUserAuthMeta(uid)` 를 온보딩·토큰 소모·Directions 호출 앞에서 직접 await. 실패하면 **외부 Mapbox 비용·토큰 원장·users 재생성이 아예 시작되지 않고** outer catch로 간다.
- `routeTokenEnsureOnboarding.ts`: "users 메타 실패 → isAnonymousHint=true Guest 보수 진행" fallback 삭제. merge 성공 결과의 isAnonymous를 그대로 지급에 쓴다.
- `tierQuotaHttp.ts`: "실패해도 quota 계속" 계약 삭제. 실패하면 assertTierQuota 앞에서 outer catch가 끊는다.

outer catch 응답 분류(4곳 공통): `HttpsError` 그대로 → guard blocked 403 → Firestore 일시(unavailable·aborted·deadline-exceeded·gRPC 숫자) 503 → **신규 `permanentAuthHttpsError` 401(unauthenticated, `auth/user-not-found`·`auth/user-disabled` 등 영구 Auth 집합)** → 알수없는 실패는 500 정직 종료. 무조건 200/Guest hint fallback은 없다. verifyIdToken(true) 성공 뒤 manual Auth 삭제 경합(mergeUserAuthMeta getUser user-not-found)은 온보딩을 중단하고 401로 응답한다.

### §2 numeric gRPC 503

`transientStoreHttpsError`가 Admin Firestore gRPC 숫자 코드 **4(DEADLINE_EXCEEDED)·10(ABORTED)·14(UNAVAILABLE)** 도 문자열 3계열과 같은 503으로 분류한다. 그 외 숫자·모르는 문자열은 null(500 등 호출 측 기존 처리)이어서 장애를 줄여 은폐하지 않는다. 문자열 중복 조립을 `transientStoreHttpsResult()` 헬퍼로 묶었다. Supervisor emulator suite의 숫자시험은 이미 추가되어 있다(감리 문서 기재).

### §3 후보 누락 — openTrailListings.hostUid

`guestLifecycleAdmin.ts`:

- `isOpenTrailListingOwnershipPath(docPath)`: **`openTrailListings/{docId}`(parts.length===2)만** 개인귀속 근거로 인정. `ACCOUNT_DELETION_POLICY`의 이 컬렉션 delete와 실제 정리(purgeGuestUsersCore presence 스캔) 모두 최상위 컬렉션만 다루므로, 같은 이름이라도 `X/{id}/openTrailListings/…`(length===4) 형태 subcollection 문자는 귀속 근거로 거절한다 — 허용 root/sub 조합이 현재 정책상 존재하지 않는다(결과 문서에 기록, 과잉수락 방지가 정확성 우선).
- group 스캔: `db.collectionGroup("openTrailListings").select("hostUid")` + 위 경로 검증 → hostUid(uid) 후보를 `listProfileUids` 유니언에 추가(`listingHostUids`).
- `trails/{trailId}.hostUid` 공용역사(정책 none)는 여전히 후보 제외. membership·conquest 고아 검증 경로는 그대로다. header 주석의 종래 "openTrailListings hostUid 제외" 문장을 새 계약으로 갱신했다.

### §4 단위시험

- 신규 `functions/src/guestLifecycleHttpGate.test.ts`(7 PASS): 문자열 3계열 503 / gRPC 숫자 4·10·14 503 / 그 외 숫자 null, 영구 Auth user-not-found·user-disabled 401 + 알수없는 실패 null(500), **metadata 실패 뒤 users 원장 쓰기 없음**(transaction 미개시, users undefined + mapper 401/503), metadata 통과 뒤 정상 merge 계약 회귀, openTrailListings 경로 검증(subcollection 문자 거절·top-level 인정), guard blocked는 영구 Auth mapper로 바꿔치기 되지 않음.
- 기존 시험mock은 구현변경으로 인한 계약변화가 없어 그대로 통과한다 — 단, 호칭 계약(guestLifecycleGuard.test의 정상 Google 보존 등)·의미있는 경합·tombstone 재생성 방지 검증을 유지했다.
- `functions/package.json` `test`에 `lib/guestLifecycleHttpGate.test.js` 연결.

## 2. 실행

| 명령(실제 폴더) | 종료 | 판정 |
|---|---|---|
| `cd C:\20.HDev\boxcycle\functions` 후 `npm run build` | 0 | PASS. tsc 오류 없음 |
| `cd C:\20.HDev\boxcycle\functions` 후 `npm run lint` | 0 | PASS. error 0 |
| `cd C:\20.HDev\boxcycle\functions` 후 `node --test lib/guestLifecycleHttpGate.test.js` | 0 | PASS 7/7 |
| `cd C:\20.HDev\boxcycle\functions` 후 `npm test` | 0 | PASS. **tests 127 · pass 127 · fail 0** (기존 11파일 + routeAutoRouteCacheDeletion + 신규 httpGate. 회귀 없음) |
| `cd C:\20.HDev\boxcycle` 후 `node --experimental-strip-types --test scripts/guest-lifecycle-supervisor.test.mjs` | 0 | PASS. **tests 7 · pass 7 · fail 0** (감리core7 — 수정 후 재실행) |
| Supervisor 실제 HTTP+Auth emulator 시험(metadata user-not-found 실패주입·정상200·users 재생성 금지) | 미실행 | **Supervisor 실행 몫**(에뮬레이터 기동 금지 범위). 빌드된 `functions/lib` 열려 있어 재실행 준비 완료 |

## 3. 바꾼 파일

- `functions/src/guestLifecycleHttp.ts` — `permanentAuthHttpsError` 신설, `transientStoreHttpsError` numeric gRPC 4/10/14, 헬퍼 정리.
- `functions/src/index.ts` — 2개 route HTTP의 inner mergeUserAuthMeta catch 제거 + outer catch에 영구 Auth 401 단계 추가.
- `functions/src/routeTokenEnsureOnboarding.ts` — inner catch·isAnonymousHint fallback 제거, header 주석 갱신, outer catch 401 단계.
- `functions/src/tierQuotaHttp.ts` — inner catch 제거, outer catch 401 단계.
- `functions/src/guestLifecycleAdmin.ts` — `isOpenTrailListingOwnershipPath`+`openTrailListingsHostUids` group 스캔, header 주석 갱신.
- `functions/src/guestLifecycleHttpGate.test.ts` — **신규 시험**.
- `functions/package.json` — 게이트 연결.
- 수정하지 않은 것: `scripts/*` 전부(Supervisor 소유·실행만), apps/web 전부, rules, 배포.

## 4. 남은 한계

- 실제 emulator HTTP 실패주입 시험은 미실행(상단 표). "verifyIdToken(true) 성공 후 getUser user-not-found → 401·users 미재생성"의 최종 확정은 Supervisor 재실행 몫이다 — 단위시험은 mergeUserAuthMeta 거절·users 미재생성·mapper 401까지 고정했다.
- 영구 Auth 집합은 토큰 검증 영구 코드(`TOKEN_PERMANENT_ERROR_CODES`)와 공유한다. getUser가 현실적으로 던지는 것은 user-not-found·user-disabled 계열이고, 토큰 전용 코드(id-token-expired 등)가 getUser에서 나올 수는 없어도 나오는 경우 401(unauthenticated)로 매핑된다 — 인증 채널 장애를 500으로 오염시키는 것보다 나은 쪽이다. 집합 응집 분리가 필요하면 검수 제안으로.
- numeric gRPC 집합은 감리 지정 4·10·14만 포괄한다(과잉포괄 금지). 새 코드가 나타나면 supervisor suite 재확정과 함께 넓힌다.
- openTrailListings 후보는 length===2(최상위)만 인정한다. 감리 문구의 "가능하면 length===4·허용root/sub조합"은 subcollection 동명 문자가 존재할 때의 제한 방법이지만, 현재 정책·실제 정리 경로에 그런 조합이 없어 빈 조합으로 두면 과잉수락 위험이 생긴다 — 따라서 허용집합을 비우고 최상위로 고정했고, 조합이 생기면 정책 표와 함께 확정하는 것을 근거로 문서화했다.
- group 스캔 비용: collectionGroup 1회(`openTrailListings`, hostUid projection) 추가 — 수만 Guest 규모에서 이미 header에 기재된 cursor·batch 재조정 필요성 항목과 함께 조정 대상이다.

## 5. Chief 확인

```
cd C:\20.HDev\boxcycle\functions
npm run build
npm run lint
npm test
node --test lib/guestLifecycleHttpGate.test.js
cd C:\20.HDev\boxcycle
node --experimental-strip-types --test scripts/guest-lifecycle-supervisor.test.mjs
```

에뮬레이터 기동·`scripts/guest-rules-supervisor.test.mjs`·실패주입 HTTP 시험은 Supervisor 실행이다(이 작업은 에뮬레이터 기동 금지).
