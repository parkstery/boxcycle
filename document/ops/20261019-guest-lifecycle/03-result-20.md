# 구현20 결과 — 종료 후 Google 로그인

- 날짜: 2026-10-19. 수행: Cursor. 모델: Auto.
- GLM 소유 `apps/web/e2e/guest-lifecycle.spec.ts`와 `apps/web/scripts/identity/guest-lifecycle-e2e-static.test.ts`는 수정하지 않았다. Supervisor scripts는 실행만 했다. 서버·Rules·운영 Firebase·인증·`.out/private-guest-lifecycle`·evidence는 건드리지 않았다. 커밋·푸시·배포 없음. 에뮬레이터는 기동하지 않았다.

## 1. 수정

Google 인증이 서버 확인까지 성공한 뒤에만 이용 종료 표시를 지우고 그 `currentUser`를 연다. 대상은 세 갈래다. 종료한 Guest의 Google 연결, 이미 있는 Google 자격으로의 전환, 세션이 없을 때의 Google 팝업. 연결은 같은 User를 제자리에서 바꾸므로 인증 콜백이 없어도 연다. 연결이 확인되면 닉네임 동기 신호도 다시 올린다.

팝업은 클릭 턴에서 연다. 이미 있는 Google 세션은 확인 뒤에 바로 돌아오고, 그 확인 뒤에 팝업을 열지 않는다. 취소·차단·실패·네트워크에서는 종료 표시를 유지하고 사용자를 열지 않는다.

오류 화면의 버튼은 「로그인」과 「게스트로 시작」이다. 짧은 오류 설명은 그 위에 따로 둔다. 복원 전 오프라인만 「재시도」다.

`handleServiceExit` 주석은 이용 종료로 이미 맞춰져 있다. 훅 주석도 종료가 세션을 끊지 않는다는 뜻으로 맞췄다.

## 2. 실행

| 명령 | 종료 | 판정 |
|---|---|---|
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/guest-lifecycle-client.test.ts scripts/identity/start-screen-after-deletion.test.ts scripts/identity/auth-session-gate-render.test.mjs` | 0 | PASS 27 |
| `cd C:\20.HDev\boxcycle` 후 `node --test scripts/guest-auth-hook-supervisor.test.mjs` | 0 | PASS 15. 시험 파일은 수정하지 않음. 종료 Guest의 Google 연결, 팝업 취소, 빈 세션 팝업이 포함된다 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS 19 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run build` | 0 | PASS. 경고 경로는 `riderRig.ts` |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run lint` | 1 | error 2, warning 40. 오류 둘은 GLM 소유 `apps/web/e2e/guest-lifecycle.spec.ts`의 미사용 함수. 그 파일은 수정하지 않았다. 이번 수정 파일의 새 경고는 없다 |
| 에뮬레이터와 Playwright `guest-lifecycle.spec.ts` 본문 | 미실행 | Supervisor |

훅 시험은 처음 연결 항목이 10초 초과로 실패했다. fixture의 `linkWithPopup`이 첫 인자의 `currentUser`를 익명이 아닌 상태로 바꾸는데, SDK 호출은 `linkWithPopup(user, provider)`다. 호출 동안 그 user의 `currentUser`가 자기 자신을 가리키게 한 뒤 끝나면 지운다. 다시 실행해 15개가 통과했다.

## 3. 바꾼 파일

- `apps/web/src/hooks/useAppAuth.ts`
- `apps/web/src/components/auth/AuthSessionGate.tsx`
- `apps/web/scripts/identity/auth-session-gate-render.test.mjs`
- `apps/web/scripts/identity/start-screen-after-deletion.test.ts`
- `apps/web/scripts/ride-verify/entry-contract.mjs`
- 이 결과 파일

## 4. 한계

- `npm run lint`는 GLM spec의 미사용 함수 2개 때문에 종료 코드가 1이다. 그 두 줄은 고치지 않았다.
- 에뮬레이터에서 종료 뒤 Google 팝업을 돌리지는 않았다. 훅 fixture가 연결 성공·취소·빈 세션 팝업을 통과했다.

## 5. Chief 확인

```
cd C:\20.HDev\boxcycle
node --test scripts/guest-auth-hook-supervisor.test.mjs
cd C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/guest-lifecycle-client.test.ts scripts/identity/start-screen-after-deletion.test.ts scripts/identity/auth-session-gate-render.test.mjs
node scripts/ride-verify/verify-selectors.mjs
npm run build
npm run lint
```
