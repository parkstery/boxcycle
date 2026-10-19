# 구현06 결과 — Guest 수명 웹 클라이언트

- 날짜: 2026-10-19. 담당: Cursor. 스코프: `apps/web` 인증·identity·안내, 그 시험, 제품 정책·결정 로그·문서 색인.
- 서버·Rules는 쓰지 않았다. `functions/`·`firestore.rules`·`database.rules.json`·`functions/src/guestLifecycleCore.test.ts`·Supervisor 시험·orphan 스크립트·묶음 README·`document/ops/PROGRESS.md`는 수정하지 않았다.
- 금지 준수: 운영 Firebase·인증 파일·운영 UID·`.out/private-guest-lifecycle`·이 묶음 evidence는 읽지 않았다. 커밋·푸시·배포·운영 삭제 없음. 에뮬레이터는 Supervisor가 보유 중이므로 새로 띄우지 않았다.

## 1. 한 줄

Guest 로그아웃은 계정을 지우지 않고 `signOut`만 한다. 인증은 `reload`와 강제 토큰 갱신이 성공하기 전에는 앱에 넘기지 않으며, SDK가 먼저 `null`을 줘도 그 사이 새 Guest를 만들지 않는다. Google 팝업은 lease 응답을 기다리지 않고 클릭 턴에서 연다.

## 2. 실행

작업 폴더와 종료 코드.

| 명령 | 종료 | 판정 |
|---|---|---|
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/guest-lifecycle-client.test.ts scripts/identity/start-screen-after-deletion.test.ts` | 0 | PASS 20 / FAIL 0 |
| `cd C:\20.HDev\boxcycle` 후 `node --test scripts/guest-logout-supervisor.test.mjs` | 0 | PASS 2 / FAIL 0. 파일은 수정하지 않음 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS 19단계 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run build` (`tsc -b && vite build`) | 0 | PASS. 기존 rider rig `SADDLE`/`PELVIS` import 경고는 그대로 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run lint` | 1 | FAIL. 아래 |
| 에뮬레이터 Rules·RTDB·브라우저 667×300 / 844×390 | — | 미실행. 에뮬레이터를 새로 띄우지 말라는 지시. 화면 실측 없음 |

로더 없이 `guest-lifecycle-client`만 돌리면 지속성 시험 1건이 실패했다. Node의 `firebase/auth`가 `browserLocalPersistence`와 `browserSessionPersistence`를 같은 `InMemoryPersistence(type NONE)`로 바꾸기 때문이다. 이름 계약(`browserLocal`)과 `app.ts`의 `setPersistence(getFirebaseAuth(), AUTH_BROWSER_PERSISTENCE)`로 고친 뒤 로더 포함 20건은 통과했다. `start-screen-after-deletion`의 게스트 초기화 키 시험은 확장자 없는 import 때문에 로더가 필요하다. 로더를 붙이면 통과한다.

`npm run lint`의 error 15건은 기존 `src/**/*.js`가 `react-hooks/*`·`@typescript-eslint/no-explicit-any` 규칙을 찾지 못하는 것이다. 이번 클라이언트 파일의 error는 없다. `useAppAuth.ts`·`guestLifecycleApi.ts`는 해당 파일만 린트했을 때 종료 0. `App.tsx`·`UserInfoSheet.tsx`의 hook dependency warning은 기존 줄이다.

## 3. 클라이언트 동작

- 복원: `ensureAuthPersistence()` 뒤에 리스너를 붙이고 `authStateReady()` 전에는 `null`을 빈 세션으로 보지 않는다(`early-null`, `blockAutoAnonymous` 유지). 복원이 확정되고 사용자가 없을 때만 자동 Guest가 가능하다. 후보 uid는 `reload` + `getIdToken(true)` 성공 뒤에만 노출한다.
- 만료: `auth/user-not-found`만 그 uid의 `boxcycle_ride_resume_slot_v1_`·`boxcycle_calorie_profile_v1_`를 지운다. `user-disabled`·토큰 무효는 안내 후 `signOut`만 하고 캐시를 남긴다. `auth/network-request-failed` 등은 오프라인이다. 사용자를 숨기고 자동 Guest를 막은 채 「재시도」만 보여 준다.
- 로그아웃: `handleServiceExit`는 Guest·Google 모두 presence를 지운 뒤 `completeFirebaseSignOut`만 호출한다. `resetGuestAccount`·`location.reload` 없음. 확인 문구는 Google 연결 전 로그아웃이 같은 Guest 복귀를 보장하지 않는다는 것과 30일 미사용 정리이다. 버튼은 「로그아웃」.
- 활동: 익명 사용자가 보이는 동안 연결 직후, 이후 5분마다 `guestActivityHttp`. 본문에 시각을 넣지 않는다. 409·`deletion-pending`이면 그 워치를 멈춘다. 캐시는 지우지 않는다.
- Google 연결: `runGuestGoogleLink`가 `begin`과 `linkWithPopup`을 같은 동기 턴에서 시작한다. 팝업을 lease 응답 뒤로 미루지 않는다. 완료 시 `guestLinkHttp` body는 `{ action, leaseToken }`이다. 서버 핸들러가 읽는 필드명과 같다. 이미 있는 Google 계정이면 lease를 취소하고 그 계정으로 들어가며, 어느 쪽 로컬 캐시도 지우지 않는다. `deletion-pending`이면 `complete`를 호출하지 않는다. 팝업이 이미 연결됐으면 데이터는 지우지 않고 안내만 한다.
- 지속성: `setPersistence(..., browserLocalPersistence)`. `browserSessionPersistence`는 쓰지 않는다.
- 안내: 시작 화면 알림에 `guest-expired`·`account-unavailable`를 더했다. `account-deleted` 탈퇴 경로는 그대로다. 만료 문구는 기존 게스트 카드의 한 줄이다.

## 4. 문서

- `document/reference/product/260519-사용자-tier-및-진입-정책.md` §3.4와 개정 이력 한 줄을 추가했다. 기존 문장은 지우지 않았다.
- `document/260707-RTW-결정-로그.md` 맨 위에 2026-10-19 행을 추가했다. 2026-10-09 로그아웃=삭제 행은 그대로다.
- `document/README.md` tier 색인에 Guest 30일 수명을 적었다.

## 5. 바꾼 파일

- `apps/web/src/hooks/useAppAuth.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/lib/firebase/app.ts`
- `apps/web/src/lib/storage/appSessionKeys.ts`
- `apps/web/src/lib/identity/authRestore.ts`
- `apps/web/src/lib/identity/authPersistence.ts`
- `apps/web/src/lib/identity/uidLocalCache.ts`
- `apps/web/src/lib/identity/guestActivity.ts`
- `apps/web/src/lib/identity/guestGoogleLink.ts`
- `apps/web/src/lib/identity/repo/guestLifecycleApi.ts`
- `apps/web/src/lib/account/accountDeletion.ts`
- `apps/web/src/components/auth/AuthExpiryNotice.tsx`
- `apps/web/src/components/auth/AuthSessionGate.tsx`
- `apps/web/src/components/auth/GuestEntryCard.tsx`
- `apps/web/src/components/UserInfoSheet.tsx`
- `apps/web/scripts/identity/guest-lifecycle-client.test.ts`
- `apps/web/scripts/identity/start-screen-after-deletion.test.ts`
- `apps/web/scripts/ride-verify/entry-contract.mjs`
- `apps/web/e2e/account-deletion-ui-shots.spec.ts` (기대 문구만)
- 정책·결정 로그·문서 색인, 이 결과 파일

새 디버그 화면·주소 스위치는 없다. `dev-tools.json` 변경 없음.

## 6. UX

폰 가로에서 줄을 늘리지 않았다. 게스트 확인은 기존 문단 한 칸을 갈아 끼웠고, 위험 버튼은 「로그아웃」이다. 만료는 게스트 카드의 기존 안내 줄이다. 오프라인은 주 버튼 「재시도」 하나다. 로그아웃된 상태의 「게스트로 새로 시작」은 그 분기 뒤에 있어, 확인되지 않은 세션을 새 Guest로 바꾸지 않는다. 667×300·844×390 실측은 하지 못했다.

## 7. 제약

- Auth 연결과 lease는 한 트랜잭션이 아니다. 삭제 예약 응답보다 팝업 연결이 먼저 끝나면 클라이언트는 `complete`를 호출하지 않지만, Auth 사용자는 이미 Google에 붙었을 수 있다. 로컬 데이터는 지우지 않는다. 서버가 제공자를 다시 보고 지우지 않아야 한다.
- `completeGuestLink`가 틀린 leaseToken에도 성공한다는 GLM 발견은 서버 수정이다. 클라이언트는 발급된 `leaseToken`만 보낸다.
- `resetGuestHttp`는 옛 번들용으로 남아 있다. 새 로그아웃은 호출하지 않는다. 배포하지 않았다.
- Node 시험은 IndexedDB 로컬 지속성을 재현하지 못한다. 브라우저 번들이 `browserLocalPersistence`를 `setPersistence`에 넘기는지만 고정했다.
- Rules의 옛 토큰 쓰기 거부와 RTDB `blocked`는 이 결과에서 증명하지 않았다. GLM·에뮬레이터 몫이다.
- 보호 UID 목록은 코드에 넣지 않았다.

## 8. 다음

GLM Task07이 서버 수명·Rules·`completeGuestLink` 토큰 검사를 끝내면, Supervisor가 에뮬레이터로 옛 토큰 쓰기 거부와 로그아웃 실기를 보면 된다. 이 클라이언트는 그 전에 배포하지 않는다.

## 9. Chief 확인

실행 위치 `C:\20.HDev\boxcycle`.

```
cd C:\20.HDev\boxcycle
node --test scripts/guest-logout-supervisor.test.mjs
cd C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/guest-lifecycle-client.test.ts scripts/identity/start-screen-after-deletion.test.ts
node scripts/ride-verify/verify-selectors.mjs
npm run build
```

화면은 에뮬레이터를 새로 띄우지 않고, Supervisor가 이미 띄운 웹이 있을 때만 `http://127.0.0.1`의 그 주소에서 본다. Guest로 들어간 뒤 사용자 시트에서 로그아웃하면 계정이 지워지지 않고 「로그아웃되었습니다.」가 나와야 한다. 확인 문구에 30일과 같은 Guest 복귀 보장이 없다가 보여야 한다. 브라우저를 닫았다 열면 같은 인증이 남는지, 비행기 모드에서 사용자가 바로 노출되지 않는지는 에뮬레이터 인증이 떠 있을 때 확인한다.
