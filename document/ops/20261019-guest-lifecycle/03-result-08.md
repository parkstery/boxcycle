# 구현08 결과 — Guest 인증 훅 재작업

- 날짜: 2026-10-19. 수행: Cursor. 모델: Auto. 세션: Task06을 이은 같은 Cursor 대화.
- 스코프: `apps/web` 인증 훅·안내·정책 문구, 08:21 산출물 삭제, 이 결과. `03-result-06.md`는 고치지 않았다.
- 서버·Rules·Supervisor 시험 파일은 수정하지 않았다. 운영 Firebase·인증 파일·`.out/private-guest-lifecycle`·evidence는 읽지 않았다. 커밋·푸시·배포 없음. 에뮬레이터는 새로 띄우지 않았다.

## 1. 정정 (03-result-06)

06의 lint 설명은 틀렸다. `npx tsc -b --pretty false --noEmit false`가 2026-10-19 08:21에 `apps/web` 소스 옆에 JS를 만들었다. 그 파일은 저장소에 원래 있던 것이 아니다. Vite는 같은 이름의 `.js`가 있으면 TS보다 그 파일을 먼저 쓰므로, 그 다음 `npm run build` PASS는 최종 증거가 아니다. 해당 산출물 371개를 지운 뒤의 build·lint만 유효하다.

06이 적은 「복원 후 사용자가 없으면 자동 Guest」도 철회한다. `signInAnonymously`는 `beginAuthenticatedSession`에서만 호출한다.

## 2. 동작

- 검증 중인 uid에 대해 SDK가 `null`을 먼저 보내도 generation을 올리지 않고 그 검증을 끝낸다. `reload`가 `auth/user-not-found`를 던지면 `authExpiryKind`는 `guest-expired`로 남는다.
- 다른 uid가 오면 generation을 올려 이전 검증을 버린다. 명시적 `signOut`의 `null`은 보류하지 않는다.
- 캐시 삭제는 익명 계정의 `auth/user-not-found`만 한다. 비활성 Google과 다른 uid 키는 남긴다.
- 부트 effect의 `signInAnonymously`는 제거했다. 예전 게스트 진입 표시가 있어도 새 계정을 만들지 않는다. 저장된 인증 복원(`ensureAuthPersistence`, `authStateReady`)은 유지한다.
- 오프라인 「재시도」와 게스트 카드 「시작」은 `min-height: 44px`이다.

## 3. 삭제한 산출물

371개. 조건: `C:\20.HDev\boxcycle\apps\web` 안, git 미추적, CreationTime `2026-10-19 08:21`, 같은 폴더에 같은 이름의 `.ts` 또는 `.tsx`, 확장자는 `.js`·`.map`·`.d.ts`. 실제 일치한 것은 `.js` 371개였다. `.map`·`.d.ts`는 0개. 추적 파일로 건너뛴 것은 0개. `node_modules`·`dist`는 제외했다.

예: `apps\web\src\App.js`, `apps\web\src\hooks\useAppAuth.js`, `apps\web\src\main.js`, `apps\web\vite.config.js`, `apps\web\devPort.js`. 삭제 후 이 경로는 없고, `npm run build`도 다시 만들지 않았다.

## 4. 실행

| 명령 | 종료 | 판정 |
|---|---|---|
| `cd C:\20.HDev\boxcycle` 후 `node --test scripts/guest-auth-hook-supervisor.test.mjs` | 0 | PASS 5 (부모 1 + 보류·삭제 null·오프라인 재시도·비활성 Google). 시험 파일은 수정하지 않음 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/guest-lifecycle-client.test.ts scripts/identity/start-screen-after-deletion.test.ts` | 0 | PASS 20 |
| `cd C:\20.HDev\boxcycle` 후 `node --test scripts/guest-logout-supervisor.test.mjs` | 0 | PASS 2 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS 19 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --test scripts/identity/guest-auth-notice-viewport.test.mjs` | 0 | PASS. 667×300·844×390에서 만료 문구·「시작」, 오프라인 문구·「재시도」. 버튼 높이 44px 이상이고 화면 안에 있음. 첫 실행은 `시작`이 `Google로 시작`까지 집어 종료 1, exact 지정 후 재실행 통과 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run build` | 0 | PASS. 경고 경로는 `riderRig.ts`라 삭제된 JS가 아니다. `SADDLE`/`PELVIS` 경고는 기존 TS |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run lint` | 0 | error 0, warning 40. 이번 훅 파일의 새 경고는 없다. warning은 기존 `App.tsx`·지도·주행 훅의 dependency다. 06에서 error로 보였던 `src/**/*.js` 규칙 없음은 삭제한 산출물이었다 |

에뮬레이터 기동은 하지 않았다.

## 5. 문서

`document/reference/product/260519-사용자-tier-및-진입-정책.md`에서 부트 자동 생성 주장을 뺐다. §1.2·§3.2·§3.4·§5·개정 이력. 2026-10-09 결정 로그 행은 지우지 않았다.

## 6. 바꾼 파일

- `apps/web/src/hooks/useAppAuth.ts`
- `apps/web/src/components/auth/AuthGateCard.css`
- `apps/web/src/components/auth/GuestEntryCard.css`
- `apps/web/scripts/identity/guest-auth-notice-viewport.test.mjs`
- `document/reference/product/260519-사용자-tier-및-진입-정책.md`
- 이 결과 파일
- 위 371개 JS 삭제

## 7. 한계

- 검증 중 `null` 보류는 그 uid의 in-flight가 있고 명시적 로그아웃이 아닐 때로 한정한다. Auth·Firestore·RTDB는 여전히 한 트랜잭션이 아니다.
- `completeGuestLink`의 틀린 토큰 수락은 서버 몫이다.
- 44px 실측은 안내 카드 fixture다. 전체 지도 화면을 667×300으로 다시 찍지는 않았다.
- Node의 `firebase/auth`는 브라우저 지속성을 메모리로 바꾸므로, 로컬 지속성 이름 계약은 06과 같다.

## 8. Chief 확인

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

`apps\web\src\App.js`와 `apps\web\src\hooks\useAppAuth.js`가 없어야 한다. 있으면 Vite가 낡은 번들을 만든다.
