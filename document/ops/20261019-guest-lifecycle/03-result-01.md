# 조사01 결과 — Guest 수명·고아 데이터 정리 (코드 조사)

- 날짜: 2026-10-19. 담당: OpenCode GLM-5.3 (`opencode/glm-5.3-flash-free`). 스코프: **코드 조사만**.
- 금지 준수: 운영 Firebase 접속·인증 파일·운영 UID·원본 데이터·`.out/private-guest-lifecycle`·이 묶음 evidence는 읽지 않았다. 읽은 것은 저장소 코드·지시 문서뿐이다. Chief 외부 전송 승인 범위(코드·지시·이 익명화 결과)만 유지한다.
- 조사 방법: 하위 탐색 세션(`ses_eaede4911ffed8S7AIc7HDHz2a`)으로 1차 전수 탐색 → 그 결과 후반부에 비정상(의미 불명) 텍스트 섞임 확인 → 계약·빈도 높은 핵심 파일은 **직접 읽어 재검증**했고, 아래 모든 인용은 직접 읽은 파일 기준(하위 세션 보고 중 검증 못 한 조사 참고 항목은 별도 표기).

## 1. 실행 기록 (branch/HEAD/dirty·모델·세션)

명령(저장소 루트 PowerShell):

```
cd C:\20.HDev\boxcycle
git status            # 종료코드 0 (PASS)
git log --oneline -3  # 종료코드 0 (PASS)
git branch --show-current
```

- branch: `main2` / origin과 동일(up to date). HEAD: `b6c9917` (fix(web): 위치 선택 버튼 문구를 두 줄로 정리).
- dirty: 기존 변경 **보존(되돌리지 않음)**. modified 30파일(apps/web 인증·맵·주행 결과 계열 + AGENTS.md·문서 해싯 상태보드·결정 로그 등), untracked 2 ops 묶음(20261017-entry-location, 20261018-*) + `.out/` + `cdbox.bat` + `document/ops/20261019-guest-lifecycle/` 신규. 상세 목록은 `git status` 출력 그대로이며 호출 당시 상태를 지키기 위해 본 파일에는 앱 라이프사이클 관련 파일만 요약한다: `App.tsx`, `components/auth/*`(`AuthGateCard.tsx`·`GuestEntryCard.tsx`·`AppIntroScreen.tsx`), `hooks/useEntryLocation.ts`.
- 사용 모델·세션: OpenCode `opencode/glm-5.3-flash-free`. 본 결과는 본 세션에 작성되었고, 1차 탐색은 하위 세션 `ses_eaede4911ffed8S7AIc7HDHz2a` 사용(일부 텍스트 왜곡 → 주요 파일 직접 읽음).
- 부가 검증: `cd functions && npm run build` → PASS(Windows, Node v24.19.0, tsc 종료코드 0).

## 2. 인증·Guest 현재 코드 (사실 조사)

### 2-1. 인증 상태·자동 게스트 진입 (apps/web)

- `apps/web/src/hooks/useAppAuth.ts`
  - L82-92: `onAuthStateChanged` 유일 처리부. 세션 복원(기존 Guest 재접속)도 여기서 자동으로 이뤄진다(Auth 세션은 Firebase 기본 persistence=IndexedDB `firebaseLocalStorageDb`에 저장 — `lib/firebase/app.ts`는 `getAuth(app)` 기본 사용, 명시적 persistence 지정·clearIndexedDbPersistence 호출은 저장소에 없음).
  - L94-127: 자동 익명 재진입 조건 = 로그아웃 플래그 없음 + `readGuestEntryAccepted()` + 1회(`autoSignInStartedRef`). `beginAuthenticatedSession`(L194-210)이 「게스트로 시작」 시 `signInAnonymously`.
  - L212-265: `handleGoogleSignIn` — Guest면 `linkWithPopup`(L229)로 계정 유지 연결. `auth/credential-already-in-use`·`auth/account-exists-with-different-credential`이면 Google credential로 `signInWithCredential`(L239) — **이 경우 Guest uid를 버리고 Google 계정으로 로그인**. `authLinkRev`(L130-131, L230): 연결은 같은 User 객체를 제자리에서 바꿔 onAuthStateChanged가 울리지 않으므로 닉네임 동기 효과 재개용 rev 카운터.
  - L319-331 `completeFirebaseSignOut`: `setUserSignedOutSessionFlag()`(localStorage `boxcycle_user_signed_out_v1`, `lib/storage/appSessionKeys.ts` L10·L61-67) 후 `signOut` — **데이터 삭제 없음**.
- `apps/web/src/lib/storage/appSessionKeys.ts`: L34-38 주석 — 로그아웃 플래그를 브라우저 전체(localStorage)에 두는 이유: 다른 탭이 새 게스트를 자동 생성하지 못하게.
- `apps/web/src/lib/identity/firebaseAuthPopup.ts`: 팝업 취소 무시 판정(`auth/popup-closed-by-user` 등).

### 2-2. 현재 Guest 로그아웃 = 삭제 (철회 대상 지점)

- `apps/web/src/App.tsx` L1621-1663 `handleServiceExit`:
  - 절차: ride idle → `deleteTrailPresence(uid, trailId)` → `deleteGlobalLivePresence(uid)` → 기본 허브 `deletePublicationSessionMember` → **Guest면 `resetGuestAccount(user)`**(L1643-1654) → 성공 시에만 signed-out 플래그 + `location.reload()`. 서버 삭제 실패 시 로그아웃하지 않음.
  - L1644 주석: "게스트 로그아웃 = 데이터 삭제(2026-10-09 Chief)" ← **이번에 철회할 동작**.
- `apps/web/src/lib/identity/guestAccountReset.ts`:
  - L1-6 헤더: 서버(`resetGuestHttp`)가 Firestore·RTDB·Auth를 함께 지운 뒤 앱 localStorage/IndexedDB 정리. `user.delete()`는 데이터 고아를 남긴다(2026-10-07 운영 8건) — 금지.
  - L11-43: 앱 localStorage 키(접두어 `rtw.`·`boxcycle_` 등)만 지운다.
  - L45-72 `clearFirebaseAuthAuthIndexedDb`: 이름에 `firebase`가 드는 IndexedDB 전부 삭제.
  - L83-104 `resetGuestAccount`: `user.isAnonymous` 재확인 → 서버 성공 시에만 로컬 정리. 실패 시 아무것도 안 지움.
- 서버: `functions/src/accountDeletionHttp.ts` L150-202 `resetGuestHttp`(익명만, `deleteAccountData` → `getAuth().deleteUser(uid)`), L52-142 `deleteAccountHttp`(정식 계정 탈퇴. 익명 거부 L86-92, 최근 5분 로그인 요구 L93-101, 확인 문구 「탈퇴」, Stripe 해지, `accountDeletions/{uid}` 진행 기록).
- `apps/web/src/components/UserInfoSheet.tsx` L411-414·797 주석: Guest는 삭제 없는 로그아웃이 없다(삭제=로그아웃). UI 문구 철회 시 손봐야 할 곳.
- `apps/web/src/lib/account/accountDeletion.ts`(정식 탈퇴, 유지): L31 `REAUTH_SKIP_MAX_AGE_MS = 4분` < 서버 5분. L40-66 `deleteMyAccount`. Guest는 예외 throw(L41-43).

### 2-3. users 문서 생성·활동 신호

- `apps/web/src/lib/identity/repo/firestoreUser.ts`:
  - L148-167 `ensureAnonymousUserTier`: Guest tier merge — `displayName`·`isAnonymous:true`·`tier:"anonymous"`·`tierUpdatedAt`·`updatedAt: serverTimestamp()`. tier가 이미 있으면 **merge 생략**(로그인마다 updatedAt을 쓰지 않음) → users.updatedAt은 활동 주기 신호로 부족.
  - L133-146 `buildUserProfileWrite`(회원), L199-264 `claimNicknameTransaction`(닉네임 트랜잭션), L266-337 nickname 30일 쿨다운·7일 잠금.
- 활동 신호 후보 현황(현재 저장소에 통합 필드 없음):
  - `functions/src/userTierCore.ts` L7-28 `mergeUserAuthMeta`: 서버가 `users/{uid}`에 `isAnonymous`·`updatedAt: serverTimestamp()` merge. 호출처(하위 세션 보고, 파일 확인 대상): `functions/src/index.ts` L181·L457(경로 생성 HTTP 2종, 실패 무시), `tierQuotaHttp.ts` L62, `routeTokenEnsureOnboarding.ts` L47 — **경로 생성·토큰 발급 시점에만** 갱신.
  - presence `lastSeenAt: serverTimestamp()`: `apps/web/src/lib/trail/repo/firestoreTrail.ts` L54-67 `defaultPresenceUpsert`(trails/{id}/members/{uid})와 전역 livePresence·publicationSessions members·livePublicationRides 동일 패턴 — 주행 중이라는 강한 신호.
  - Auth Admin `UserRecord.metadata.lastSignInTime`·`lastRefreshTime`: purge 대상 판정에 쓸 수 있으나 현재 도구는 기록보고용(candidates의 createdAt·lastSignInAt만, `purgeGuestUsersCore.ts` L72-76).
- **30일 만료·스케줄 Guest 정리는 현재 없음.** `functions/src/index.ts`의 스케줄 export는 `routeActivityScheduledReconcile`(L502), `subscriptionExpireSweep`(`subscriptionScheduled.ts`, 구독만)(L520), trailInstanceLifecycle(Trail 인스턴스 수명), openTrailListingsSweep(10분). Auth 사용자 만료 함수는 0건 — grep으로 확인.

### 2-4. 삭제 코어 — 컬렉션 정책 단일 진실

- `functions/src/accountDeletionCore.ts`:
  - L36-60 `ACCOUNT_DELETION_POLICY`(새 컬렉션 누락 시 계약 테스트 `accountDeletionCore.test.ts`가 실패하는 게이트): `users·userPrivate·nicknames·livePresence·openTrailListings·rides·savedRoutes·publicRouteRequests·conquest·routeTokenLedger = delete`, `routePublications = anonymize`(applicantUid "" + `publisherDeleted`), `trails·rooms·publicationSessions·routeActivity·publicationPresence·worldActivity 등 = none`(공용 보존).
  - L63-69 하위컬렉션: `trails/{tid}/members/{uid}`, `trails/{tid}/livePublicationRides/{uid}`, `publicationSessions/{pid}/members/{uid}`, `conquest/{uid}/chunks|traces`.
  - L72 RTDB: `trails/{trailId}/motion/{uid}`.
  - L159-183 `deleteAccountData`: RTDB motion(`trailIdsForUid`) → 정책대로 익명화(`anonymizeOwnedPublications`) → 닉네임 해지(`releaseNickname`+`releaseHeldNicknames`) → `deleteGuestUidFirestoreData`. users 마지막 묶음 삭제(중간 실패 재실행 안전 명시).
- `functions/src/purgeGuestUsersCore.ts`:
  - L111-113 `isAnonymousUserRecord`: `providerData.length === 0 && !email && !phoneNumber` — **Auth 기반 판정(Google 승급 계정은 자동 제외)**.
  - L52-82 `listGuestCandidates`(`auth.listUsers`, admin claims 제외), L92-109 `listOrphanUserDocs`(Auth 없는 users·userPrivate 문서 — `auth.getUsers(...).notFound` 방식, 100건/회).
  - L301-332 `deleteGuestUidFirestoreData`: users·userPrivate·conquest(+chunks/traces)·livePresence·rides/savedRoutes/routeTokenLedger(userId==uid)·publicRouteRequests(applicantUid) + presence 인덱스 refs. `routePublications·trails 문서는 절대 건드리지 않는다`.
  - L334-336 `deleteGuestAuthUser`, L176-216 `buildPresenceIndex`(members collectionGroup은 부모 컬렉션으로 trails/publicationSessions 구분).

### 2-5. CLI 도구 (functions/package.json admin:*)

- `functions/src/cliPurgeGuestUsers.ts`: dry-run 기본/`--yes`/`--limit`. 안전장치 — **삭제 직전 uid별 `auth.getUser` 재판정, 익명 아니면 즉시 `process.exit(1)` abort**(L110-120). 고아 uid는 Auth 삭제 없이 데이터만 삭제(L160-162). RTDB motion은 삭제하지 않는다(§3-6 참고). 결과 JSON은 `document/ops/20260923-first_ride/.out/guest-purge`(무관 고정 경로 — 이번 모듈 재사용 시 경로 지정 인자 필요).
- 그 외: `cliStripPublicPii`(공개 문서 PII 제거), `cliPurgeDiscardableRides`·`cliPurgeConquestV1`·`cliPurgeRideLegacyFields`·`cliPhase7TerminologyPurge`. `initAdminForCli.ts`(기본 projectId 고정 — 결과 파일에는 익명화). 루트 `scripts/`는 인증·삭제 무관.

### 2-6. Rules — 삭제·재쓰기 표면

- `firestore.rules`: `users/{uid}` create=`userCreateIsProfile()`(L106-109: `isAnonymous == (sign_in_provider == 'anonymous')` — "지워진 계정의 열린 탭이 「주행 이어하기」 칸만 든 문서를 되살린 일이 있었다(운영 3건)" 주석 L101-105), update 제약 다수, **`allow delete: if false`(L226)**. `rides`·`routePublications`·`conquest`·`routeTokenLedger` 등 client delete=false — 삭제는 Admin SDK 전용. `users`·`userPrivate`·members·livePresence 등 쓰기는 전부 `request.auth.uid == userId`(isSelf) 뿐 — **계정 존재 여부·만료 여부를 Rules로 검사하지 않는다**(경합 방어의 핵심 공백).
- `database.rules.json`(15줄 전체): 유일 경로 `trails/$trailId/motion/$uid`, write = `auth.uid == $uid` + phase/measure 검증. 계정 삭제 후에도 유효 토큰이면 쓰기 가능.

## 3. 필수 분석 (지시 §2 — 재생성 경합·Google 연결 경합)

### 3-1. 문제1: 삭제 중/삭제 후 살아 있는 토큰으로 데이터 재생성

메커니즘(기존 운영 사례가 코드 주석에 고정되어 있다):
1. 서버가 `deleteUser(uid)` + Firestore 일괄 삭제 → Admin SDK는 Refresh Token을 무효화하지만 **이미 발급된 ID 토큰은 만료(1시간) 전까지 유효**. `onAuthStateChanged`는 즉시 울지 않는다 — 클라이언트는 다음 `getIdToken`(Functions 호출 직전 자동 갱신) 시점에야 실패한다.
2. 유효한 ID 토큰으로 Rules `isSelf(uid)`를 통과해 `users/{uid}`(create), `userPrivate`, `trails/{tid}/members/{uid}`, publicationSessions members, `livePresence/{uid}`, RTDB `motion/{uid}` 등을 **다시 만들 수 있다**. Rules는 계정 존재 검사가 없다(§2-6).
3. 특히 create는 `userCreateIsProfile`만 요구 — 열린 탭의 `ensureAnonymousUserTier`(merge니 create는 아님)를 제외해도, 다른 쓰기 경로·옛 클라이언트가 세미-비어 있는 users 문서를 되살린 실제 사례가 rules 주석(운영 3건)과 `purgeGuestUsersCore` L84-90에 기록돼 있다.
4. 결과: `listOrphanUserDocs`가 매번 뒤늦게 이런 문서를 건지고 있고(purge CLI의 고아 처리가 그 답), **서버 자동 정리 후 2차 재검기를 하지 않으면 고아 감소가 반복되지 않는다**.

구현02 제안(경합 차단 방식):
- (A) 서버 삭제 시퀀스에 **deleteUser 이후 표식** 추가: `accountDeletions/{uid}`(기존 탈퇴 기록 문서 재사용 — 정책 `none`)에 `status:"done"`·uid 기록. 상태보드·결정 로그에 의미 변경 없음(기존 deleteAccountHttp가 이미 같은 문서를 쓴다).
- (B) 일일 배치가 `listOrphanUserDocs`를 **삭제 실행 후 일정 지연(예: 다음 주기·또는 배치 내 2차 패스)**로 재실행해 재생성분을 회수. 기존 purge CLI 고아 경로(데이터만 삭제)를 그대로 재사용.
- (C)(옵션·Rules 변경은 아키텍처 판단 사항) `accountDeletions/{uid}`가 존재하면 해당 uid의 users/userPrivate/members/livePresence/motion 쓰기 차단하는 Rules 가드 — Rules 읽기 exists() 사용은 비용 증가가 있어 Chief 결정 필요. 최소안은 (A)+(B)만으로 기존 클라이언트 토큰 만료(≤1h)를 넘기는 것이고, (C)는 즉시 차단이 필요할 때의 2차 방어다.
- (D) 30일 만료 후보 선정을 서버가 **Auth + users 양쪽**에서 검증(아래 3-2와 동일 자리)한 뒤 삭제 — 배치는 dry-run 기본/manifest 기반으로 cli 선행(지시의 "Supervisor가 운영 삭제 실행"과 정합).

### 3-2. 문제2: Google 연결 중 삭제 (게스트가 탈퇴 만료·서버 정리와 경합)

지점: `useAppAuth.handleGoogleSignIn` L227-246 — 익명 Guest가 `linkWithPopup`으로 **동일 uid에서 Google로 승격**하거나, credential 충돌 시 `signInWithCredential`로 **새 Google 계정(다른 uid)으로 이동**한다. 경합 시나리오 3가지:

1. 연결 완료 후 배치가 uid를 익명으로 오판: `listGuestCandidates`는 스냅샷 시점 기준. 스냅샷 후에 `linkWithPopup`이 성공하면 Auth UserRecord에는 providerData가 들어오지만 **배치의 후보 목록에 그대로 있다면** `deleteUser(uid)`가 Google 연결 계정을 지워버린다. 차단: cliPurgeGuestUsers L110-120 방식 — **delete 직전 `auth.getUser` 재판정 + `isAnonymousUserRecord` 재확인, 아니면 skip+보고**. 새 스케줄 배치도 이 패턴을 복사해야 한다(스냅샷과 삭제 사이 승급을 놓치지 않는 유일한 안전장치).
2. 연결 처리 중(팝업 진행) 서버가 삭제: `users/{uid}`가 사라지면 닉네임 재확인/claim이 실패해 `fsSync` error·`awaiting_nickname`이 된다. Auth가 이미 없으므로 다음 `getIdToken`이 실패하고 UI에는 Auth 오류가 그대로 노출될 수 있다 — 클라이언트 변경의 "만료(dispatch) 확정에만 UID 캐시 정리·명시 진입 화면 복구, 네트워크 실패는 보존" 계획 항목과 정확히 연결된다. 구현02의 클라이언트 안내문구 계약에 `permission-denied`/`unauthenticated` 구분 테스트 필요.
3. Guest 로그아웃 삭제 철회(side effect 제거) 후에는 로그아웃 시점에 계정·데이터가 남으므로 **삭제된 Guest의 만료와 Google 연결 성공이 겹칠 수 있는 시간**은 유지된다: 만료 배치는 "30일 미활동 Guest"만 대상으로 좁혀지고, 로그아웃 철회로 활동 중 Guest는 보호된다. 다만 열린 탭이 활동 갱신(presence/lastActiveAt)을 계속 치면 만료 후보가 안 된다 — 배치 판정은 `lastActiveAt` 갱신 중단 시각 기준이어야 한다.

### 3-3. 서버 자동 정리 vs 기존 고아 스캔 누락 구분

- 서버 자동 정리(신규 구현): **멱등 활동 갱신(lastActiveAt) + 30일 판정 + daily 배치**. 판정은 `isAnonymousUserRecord`(Auth 원직접 판정)와 **users.isAnonymous를 신뢰하지 않는다**(기존 결론 2026-10-09: `purgeGuestUsersCore` L85-90 — "표시와 무관하게 Auth 유무로 판정").
- 기존 고아 스캔 누락 리스크 — 신규 배치에도 같은 근거로 유의:
  1. `listOrphanUserDocs`는 users·userPrivate만 스캔. **users 없이 rides/savedRoutes/members만 남은 고아**는 발견 못 한다(주석 명시). 배치 dry-run에서 "Auth 없는데 데이터가 있는 uid" 발견 경로를 users가 아닌 rides(userId)·members(collectionGroup) 방향에서도 비교 옵션으로 남겨야 놓치지 않는다 — 별도 스캔 도구 없음(§2-5).
  2. `cliPurgeGuestUsers`는 **RTDB motion을 지우지 않는다**(deleteGuestUidFirestoreData만 호출) — `purgeGuestUsersCore` L301-332와 `accountDeletionCore` deleteAccountData 차이. 신규 배치는 `deleteAccountData(db, rtdb, uid)` 재사용이 RTDB 정리까지 커버 — 이쪽으로 정합이 맞다.
  3. `routePublications`(savedRoutes 역참조)와 `trails(hostUid)`는 보고 전용 — 공용 자산 보존/익명화 정책 유지.
- 유예 기준(기존 계정에 lastActiveAt 없음): (a) users.updatedAt 존재 → 그 시각, (b) 없으면 Auth metadata.lastSignInTime, (c) 없으면 createdAt, (d) 전부 없으면 **skip+보고**(기존 운영 3건 누락 패턴 회피). (괄호 시각 필드가 없는 것이 기준으로 세운다.)

## 4. 구현02 제안 (파일·함수 단위)

### 서버 (functions/src)

- **`userLifecycleCore.ts` 신규**: `GUEST_INACTIVITY_DAYS = 30`, `isAnonymousUserRecord`·`buildPresenceIndex` 등은 `purgeGuestUsersCore`/`accountDeletionCore` 재사용. 커널: `recordGuestActivity(uid)`(`mergeUserAuthMeta` 확장 — `users/{uid}`에 `lastActiveAt: serverTimestamp()` merge, 경로 생성·토큰 HTTP·tierQuota HTTP에서 호출), `listExpiredGuestUids(db, nowMs)`(`users` where isAnonymous + lastActiveAt < cutoff — Auth `getUser`로 2차 재검증, admin claims 제외, lastActiveAt 없는 기존 계정은 §3-3 유예 기준), `purgeExpiredGuestCore` — 후보 확인 → `deleteAccountData(db, rtdb, uid)`(RTDB motion 포함) → `deleteUser(uid)` → `accountDeletions/{uid}` 표식 → 실패 재시도·삭제 기록.
- **`guestLifecycleScheduled.ts` 신규 + `index.ts` export**: 1회/일 `onSchedule` — `listExpiredGuestUids` → **dry-run 안전 통과(삭제 실행 전 `auth.getUser` 재판정·Google 연결 skip)** → 삭제(제한 몇 개 도입 — 비용 절제, limit 설정). 2차 패스: `listOrphanUserDocs` 재실행·재생성분 데이터 정리(고아 회수). `ACCOUNT_DELETION_POLICY` 게이트에 이 흐름을 넣어 새 콜렉션별 것 놓치지 않도록.
- `purgeGuestUsersCore.ts`: `listOrphanUserDocs`에 **rides·members 기반 스캔 보강 옵션**(users가 없는 고아 발견)는 비용 고려해서 옵션 플래그로.
- 테스트: 기존 `accountDeletionCore.test.ts` 계약 테스트 재사용 + `guestLifecycleCore.test.ts`(에뮬레이터).

### 클라이언트 (apps/web)

- **`useAppAuth.ts`**:`completeFirebaseSignOut` 만이 유지되고, `App.tsx` `handleServiceExit`에서 `resetGuestAccount` 분기(L1643-1654)를 **제거**해 당 로그아웃도 `completeFirebaseSignOut`으로.
  - `resetGuestAccount`(`guestAccountReset.ts`)는 「이 기기 데이터 지우기」 경로가 없으므로 **INFO 메뉴로만** 남긴다(제거 대상 아님 — 오히려 이전 감리에 있던 버튼 삭제 회복).
- Guest 만료가 화면에 도달하는 경로: `onAuthStateChanged`에서 동작 후 `getIdToken` 실패 시에만 Auth 삭제 협동 — **삭제된 게스트 캐시 정리·명시 진입 화면 복구** 플로우, 네트워크 실패는 재시도. `appSessionKeys.prepareStartScreen("account-deleted")`(L89-97) 재사용.
- **`authLinkRev`·Google 연결 충돌** 로직 유지 + 만료 Guest에서 `linkWithPopup`→auth/user-not-found 대응 문구(확정 만료에만).
- 기존 sessionStorage `readGuestEntryAccepted`·signed-out 플래그는 유지(자동 신규 Guest 생성 오염 방지 — README의 금지와 정합).

## 5. 시험 계획 (구현02에 반영)

- 서버: 시간 경계(29·30·31일), 활동 연장(갱신 중·만료 후), Google/admin/보호 UID 제외, Auth-only/Firestore-only/RTDB-only 조합, 중간 실패 재시도(2차 패스 회수), 기존 토큰 재쓰기(deleteUser 표식 후에 Rules 통과하는 create 시도), 네트워크 실패 보존, 로그아웃**(삭제 없음) 회귀, RTDB motion 실제 제거, `accountDeletionCore.test.ts` 계약 게이트 PASS.
- 클라이언트: 로그아웃 회귀(e2e `ride-verify` 단일 worker), 만료 Guest 유예(탭 종료 후 복원), 이탈 화면·재시도 UX, localStorage 초기화 금지(전체 clear 불허) 검증.
- 실행 환경: Firestore·RTDB·Auth 에뮬레이터(단일 worker), 5분 진전 없으면 로그/포트 확인 후 유지 대신 headless·단일 worker·정적/단위 시험 전환(AGENTS 자율 진행 정책 준수). functions build/test/lint + web type/build/lint.

## 6. 명령·종료 코드·PASS/FAIL/미실행

| 항목 | 명령 | 종료코드 | 판정 |
|---|---|---|---|
| git 상태 | `git status` · `git log --oneline -3` · `git branch --show-current` | 0 | PASS (dirty 보존 확인) |
| functions 컴파일 | `cd C:\20.HDev\boxcycle\functions && npm run build` | 0 | PASS (tsc) |
| 기존 테스트 실행 | — | 미실행 | 이유: 코드 조사 단계 지시("코드 조사만")로 기존 변영 영향 불필요하며, 시험 기초는 구현02의 §5 계획으로 승인 예정 |
| 운영 조사 | — | 미실행 | 지시 금지(§3). Supervisor가 로컬에서 전담 |

## 7. 다음 행동

1. Supervisor가 본 결과를 검수(특히 §3-1 (A)/(B)/(C) 경합 차단 방식·§4 `lastActiveAt` 기록 위치) → 구현 지시02 발행.
2. 구현02 시작 전: dirty 인벤토리 해시(App.tsx 등 기존 변경) 재확인·_COLLISION 점검 조사01에 있는 파일과 충돌 시 conflict 방지(기존 변경 수용).
3. 운영 고아 읽기 조사(Supervisor) 결과와 §3-3의 "users 없는 고아" 발견 격차를 합쳐 dry-run 목록 견본 확정 → 최초 정리 manifest.
