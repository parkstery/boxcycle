# 구현13 결과 — Auth REST 주소와 test import

- 날짜: 2026-10-19. 수행: Cursor. 모델: Auto. 세션: Task11을 이은 같은 Cursor 대화.
- 결과11은 보존했다. 서버·Rules·Supervisor 시험 파일은 수정하지 않았다. 운영 Firebase·인증·`.out/private-guest-lifecycle`·evidence는 읽지 않았다. 커밋·푸시·배포 없음. 에뮬레이터는 기동하지 않았다. Playwright 시험 본문은 실행하지 않았다.

## 1. 수정

`apps/web/e2e/guest-lifecycle.spec.ts`

firebase-tools `lib/emulator/auth/apiSpec.js`의 공식 경로로 바꿨다.

- 목록은 GET `http://{AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-boxcycle-guest/accounts:batchGet?maxResults=1000`. `Authorization: Bearer owner`. 응답 `users[].localId`를 모은다. `nextPageToken`이 있으면 같은 이름의 쿼리로 다음 페이지를 읽는다. 같은 토큰이 반복되면 멈춘다.
- 삭제는 POST `http://{AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-boxcycle-guest/accounts:delete`. 헤더는 `ownerHeaders`, 본문은 `{ localId }`. 계정 전체 삭제 경로는 쓰지 않는다.
- `{AUTH}`는 기존 게이트의 `FIREBASE_AUTH_EMULATOR_HOST`다. localhost·`demo-boxcycle-guest`가 아니면 그대로 skip 또는 실패다.
- `test`는 `./open-meteo-stub`에서 `expect`와 함께 가져온다.

높이 비교만 `apps/web/scripts/identity/guest-auth-notice-viewport.test.mjs`에서 `height + 0.001 >= 44`로 바꿨다. `GuestEntryCard.css`·`AuthGateCard.css`의 `min-height: 44px`은 그대로다.

정적 계약도 새 REST와 import를 확인하게 맞췄다.

## 2. 실행

| 명령 | 종료 | 판정 |
|---|---|---|
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npx playwright test guest-lifecycle.spec.ts --list` | 0 | PASS. Total 3 tests in 1 file. 제목은 최초 진입, 로그아웃, 삭제 후 만료. 본문 미실행 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --experimental-strip-types --test scripts/identity/guest-lifecycle-e2e-static.test.ts` | 0 | PASS 4 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --test scripts/identity/guest-auth-notice-viewport.test.mjs` | 0 | PASS 1 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run lint` | 0 | error 0, warning 40. 이번 파일의 새 경고는 없다 |
| Playwright `guest-lifecycle.spec.ts` 본문 | 미실행 | 에뮬레이터 기동은 Supervisor 몫 |

등록된 3시험:

- `최초 진입은 명시 Guest 한 명이고 새로고침해도 같은 계정이다`
- `로그아웃은 계정과 개인자료를 남기고 새로고침해도 계정을 만들지 않는다`
- `삭제된 Guest 는 만료 안내로 돌아오고 명시 시작만 새 계정을 만든다`

## 3. 바꾼 파일

- `apps/web/e2e/guest-lifecycle.spec.ts`
- `apps/web/scripts/identity/guest-lifecycle-e2e-static.test.ts`
- `apps/web/scripts/identity/guest-auth-notice-viewport.test.mjs`
- 이 결과 파일

## 4. 한계

- `accounts:batchGet`와 `accounts:delete`는 에뮬레이터에 호출하지 않았다. `--list`는 등록만 확인한다.
- 목록 응답 본문은 읽지만 로그에 남기지 않는다.

## 5. Chief 확인

```
cd C:\20.HDev\boxcycle\apps\web
npx playwright test guest-lifecycle.spec.ts --list
node --experimental-strip-types --test scripts/identity/guest-lifecycle-e2e-static.test.ts
node --test scripts/identity/guest-auth-notice-viewport.test.mjs
npm run lint
```
