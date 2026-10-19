# 구현11 결과 — Firebase SDK 재접속 spec

- 날짜: 2026-10-19. 수행: Cursor. 모델: Auto. 세션: Task10을 이은 같은 Cursor 대화.
- 결과06·08·10은 보존했다. 서버·Rules·Supervisor 시험 파일은 수정하지 않았다. 운영 Firebase·인증·`.out/private-guest-lifecycle`·evidence는 읽지 않았다. 커밋·푸시·배포 없음. 에뮬레이터는 기동하지 않았다. JS를 다시 만들지 않았다. `apps\web\src\hooks\useAppAuth.js`는 빌드 뒤에도 없다.

## 1. spec

`apps/web/e2e/guest-lifecycle.spec.ts`

기존 `guestStart`·`readGuestUid`와 Playwright 배선을 재사용한다. `scripts/guest-integration-supervisor.mjs`는 수정하지 않았다. Supervisor가 `--ride-only`가 아닐 때 이 spec을 `apps/web`에서 실행한다.

게이트:

- `FIREBASE_AUTH_EMULATOR_HOST`·`FIRESTORE_EMULATOR_HOST`·`FIREBASE_DATABASE_EMULATOR_HOST`·`VITE_FIREBASE_PROJECT_ID`가 모두 없으면 skip. 사유는 `demo localhost emulator is not configured`.
- 호스트가 `127.0.0.1` 또는 `localhost`가 아니거나, 프로젝트 환경값이 `demo-boxcycle-guest`가 아니면 `beforeAll`이 실패한다. 그 경우에는 skip하지 않는다.
- 에뮬레이터 전제가 있을 때 실패를 피하려고 skip하거나 `test.fixme`를 두지 않았다.

demo 전용 REST:

- Auth 목록·삭제: `http://{AUTH}/emulator/v1/projects/demo-boxcycle-guest/accounts`
- Firestore fixture·삭제·`guestLifecycle` status `deleted`: `Authorization: Bearer owner`
- RTDB `guestLifecycle/{uid}/blocked=true`: `auth=owner`. Rules는 이 경로의 클라이언트 쓰기를 막으므로, 에뮬레이터가 admin으로 다루는 owner 토큰만 쓴다. 인증 파일은 열지 않는다.

SDK를 모킹하지 않는다. 최초 Guest는 UI의 「게스트로 시작」·「시작」이다. 그 다음 새로고침과 같은 브라우저 컨텍스트의 새 탭은 IndexedDB를 그대로 쓴다. `console`로 UID·토큰을 찍지 않는다. 비교가 실패해도 메시지에 UID를 넣지 않는다.

spec 안의 세 시험:

1. 소개 화면이 보이는 동안 Auth 증가 0. 명시 시작 후 Auth 1. 새로고침 뒤 같은 IndexedDB uid, Auth 1.
2. 로그아웃 UI 후 Auth 1, `userPrivate` fixture 유지. 대기와 새로고침 뒤에도 Auth 1. 만료 문구는 없다.
3. Auth 삭제, `users`·`userPrivate` 삭제, Firestore `deleted`, RTDB `blocked`. 새로고침과 새 탭에서 만료 안내가 보이고 「연결 중…」「로그인 중…」은 없다. 자동 Auth 0. 옛 uid 문서는 다시 생기지 않는다. Google 다른 uid 캐시 키는 남는다. 「시작」을 다시 누르면 새 Auth 1이며 옛 uid와 다르다.

4번(SDK가 `USER_NOT_FOUND`를 `auth/user-token-expired`로 바꾸거나, 복원 사용자가 없이 `null`인 경우)은 모킹으로 재현하지 않는다. 위 3번이 그 두 결과를 모두 만료 안내·캐시 유지로 받게 되어 있고, 실제 분기는 Supervisor의 에뮬레이터 실행에서 확인된다.

## 2. 제한 수정

확인된 Guest만 `boxcycle_last_verified_guest_uid_v1`에 기록한다. Google 확인이 되면 그 기록은 지운다. 기록은 삭제 확정이 아니다.

- 부트 중 persistence가 비어 있고, 로그아웃이 아니며, 마지막 확인 Guest가 있으면 `guest-expired`를 보여주고 시작 화면으로 돌린다. `clearUidLocalCache`는 호출하지 않는다.
- `authStateReady`가 실패하면 offline이다. 만료로 보지 않고 캐시를 지우지 않는다.
- 캐시 삭제는 익명 계정의 `auth/user-not-found`만이다. `auth/user-token-expired`와 네트워크 오류는 캐시를 남긴다.
- 검증 중인 계정에는 뒤늦은 빈 세션 신호가 만료를 덮지 않는다.

## 3. 실행

| 명령 | 종료 | 판정 |
|---|---|---|
| `cd C:\20.HDev\boxcycle` 후 `node --test scripts/guest-auth-hook-supervisor.test.mjs` | 0 | PASS 9 (부모 1 + 동작 8). 시험 파일은 수정하지 않음 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/guest-lifecycle-client.test.ts scripts/identity/start-screen-after-deletion.test.ts` | 0 | PASS 20 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --experimental-strip-types --test scripts/identity/guest-lifecycle-e2e-static.test.ts` | 0 | PASS 4. spec 게이트·모킹 금지·캐시 정책 |
| `cd C:\20.HDev\boxcycle` 후 `node --test scripts/guest-logout-supervisor.test.mjs` | 0 | PASS 2 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS 19 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --test scripts/identity/guest-auth-notice-viewport.test.mjs` | 0 | PASS |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run build` | 0 | PASS. 경고 경로는 `riderRig.ts`. `SADDLE`/`PELVIS`는 기존 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run lint` | 0 | error 0, warning 40. 이번 파일의 새 경고는 없다 |
| Playwright `guest-lifecycle.spec.ts` | 미실행 | 에뮬레이터 기동은 Supervisor 몫 |

`JS_REGENERATED=no`.

## 4. 바꾼 파일

- `apps/web/e2e/guest-lifecycle.spec.ts`
- `apps/web/scripts/identity/guest-lifecycle-e2e-static.test.ts`
- `apps/web/src/hooks/useAppAuth.ts`
- `apps/web/src/lib/identity/authRestore.ts`
- `apps/web/src/lib/identity/lastVerifiedGuest.ts`
- 이 결과 파일

## 5. 한계

- 브라우저 재접속 4동작은 에뮬레이터에서 실행하지 않았다. 정적 계약과 단위 정책만 통과했다.
- Auth 목록 API와 RTDB `auth=owner`는 에뮬레이터에서 아직 호출하지 않았다. 응답이 기대와 다르면 Supervisor 실행에서 실패가 보인다.
- 마지막 확인 Guest 기록은 익명 확인이 성공한 뒤에만 생긴다. 그 기록이 없는 첫 방문의 `null`은 빈 세션이다.
- in-flight `null` 보류는 그 uid 검증 중이고 명시적 로그아웃이 아닐 때만이다.

## 6. Chief 확인

에뮬레이터 실행은 Supervisor 통합 러너가 한다. 아래는 이번 정적 확인과 같다.

```
cd C:\20.HDev\boxcycle
node --test scripts/guest-auth-hook-supervisor.test.mjs
node --test scripts/guest-logout-supervisor.test.mjs
cd C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/guest-lifecycle-client.test.ts scripts/identity/start-screen-after-deletion.test.ts
node --experimental-strip-types --test scripts/identity/guest-lifecycle-e2e-static.test.ts
node --test scripts/identity/guest-auth-notice-viewport.test.mjs
node scripts/ride-verify/verify-selectors.mjs
npm run build
npm run lint
```
