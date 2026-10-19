# 구현10 결과 — retry 경합

- 날짜: 2026-10-19. 수행: Cursor. 모델: Auto. 세션: Task08을 이은 같은 Cursor 대화.
- 결과08은 보존했다. 서버·Rules·Supervisor 시험 파일은 수정하지 않았다. 운영 Firebase·인증·`.out/private-guest-lifecycle`·evidence는 읽지 않았다. 커밋·푸시·배포 없음. JS를 다시 만들지 않았다. `apps\web\src\hooks\useAppAuth.js`는 빌드 뒤에도 없다.

## 1. 수정

`retryAuthRestore`가 검증 전에 `inflightUid`를 잡지 않아, 재시도 `reload`가 내는 SDK `null`이 generation을 올리고 만료 결과를 버렸다. 재시도는 처음 복원과 같은 `applyVerifiedUser`를 쓴다. 호출 전에 그 uid를 in-flight로 표시한다.

다른 uid가 오거나 명시적 로그아웃이 되면 generation이 올라가 늦은 결과는 무시한다. 캐시 삭제는 익명 계정의 `auth/user-not-found`만 한다. Google이 재시도에서 삭제 확인돼도 그 캐시는 남고 안내는 `account-unavailable`이다. Guest는 `guest-expired`이고 그 uid 캐시만 지운다.

훅 주석의 「자동 익명」「로비」는 명시적 Guest 시작과 Trail로 바꿨다.

## 2. 실행

| 명령 | 종료 | 판정 |
|---|---|---|
| `cd C:\20.HDev\boxcycle` 후 `node --test scripts/guest-auth-hook-supervisor.test.mjs` | 0 | PASS 9 (부모 1 + 동작 8). 시험 파일은 수정하지 않음. 두 번 실행했고 둘 다 종료 0 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/guest-lifecycle-client.test.ts scripts/identity/start-screen-after-deletion.test.ts` | 0 | PASS 20 |
| `cd C:\20.HDev\boxcycle` 후 `node --test scripts/guest-logout-supervisor.test.mjs` | 0 | PASS 2 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS 19 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --test scripts/identity/guest-auth-notice-viewport.test.mjs` | 0 | PASS. 첫 실행은 667×300 「재시도」 높이가 43.999996이라 `>= 44`에서 종료 1. `Math.round`로 다시 재면 44라 그 비교만 고친 뒤 종료 0 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run build` | 0 | PASS. 경고 경로는 `riderRig.ts`. `SADDLE`/`PELVIS`는 기존 TS |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run lint` | 0 | error 0, warning 40. 이번 훅의 새 경고는 없다. warning은 기존 dependency |

지시가 말한 6동작에, 파일이 이미 갖고 있던 2동작(이전 검증이 새 uid를 덮지 않음, 명시적 로그아웃이 대기 검증을 취소)이 더 있다. 8동작 모두 통과했다.

통과한 retry 2건:

- offline → retry → SDK `null` → `user-not-found` Guest: `authExpiryKind=guest-expired`, 그 uid 캐시 삭제, 새 Guest 0.
- 같은 순서의 Google: `authExpiryKind=account-unavailable`, `boxcycle_calorie_profile_v1_retry-google` 유지, 새 Guest 0.

## 3. 바꾼 파일

- `apps/web/src/hooks/useAppAuth.ts`
- `apps/web/scripts/identity/guest-auth-notice-viewport.test.mjs` (서브픽셀 반올림만)
- 이 결과 파일

## 4. 한계

- in-flight `null` 보류는 그 uid 검증 중이고 명시적 로그아웃이 아닐 때만이다.
- 667×300에서 「재시도」의 레이아웃 높이는 44px이고, Edge가 43.999996으로 재었다.
- 에뮬레이터는 띄우지 않았다. `completeGuestLink` 토큰 검사는 서버 몫이다.

## 5. Chief 확인

```
cd C:\20.HDev\boxcycle
node --test scripts/guest-auth-hook-supervisor.test.mjs
node --test scripts/guest-logout-supervisor.test.mjs
cd C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/guest-lifecycle-client.test.ts scripts/identity/start-screen-after-deletion.test.ts
node --test scripts/identity/guest-auth-notice-viewport.test.mjs
node scripts/ride-verify/verify-selectors.mjs
npm run build
npm run lint
```
