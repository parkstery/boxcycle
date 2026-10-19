# 구현17 결과 — 이용 종료와 같은 Guest 복귀

- 날짜: 2026-10-19. 수행: Cursor. 모델: Auto.
- GLM 소유 `apps/web/e2e/guest-lifecycle.spec.ts`와 `apps/web/scripts/identity/guest-lifecycle-e2e-static.test.ts`는 수정하지 않았다. Supervisor scripts는 실행만 했다. 서버·Rules·운영 Firebase·인증·`.out/private-guest-lifecycle`·evidence는 건드리지 않았다. 커밋·푸시·배포 없음. 에뮬레이터는 기동하지 않았다.

## 1. 수정

시작 메뉴는 「로그인」과 「게스트로 시작」이다. 이용 종료는 `endAppUse`다. Firebase `signOut`을 호출하지 않고 `boxcycle_app_use_ended_v1`만 남긴다. 노출 user는 null이라 활동 핑·개인 쓰기·동행 presence가 멈춘다. `auth.currentUser`와 브라우저 로컬 지속성은 유지된다. 새로고침·새 탭도 그 표시를 본다.

「게스트로 시작」은 복원된 익명 세션을 `reload`·`getIdToken(true)`와 활동 확인 뒤에 같은 uid로 연다. localStorage uid만으로 로그인하지 않는다. 같은 판정을 다섯 번 반복해도 `reuse`다. `auth/user-not-found`만 그 클릭에서 새 Guest 하나다. 삭제 진행·비활성·토큰 무효는 새 계정을 만들지 않고 안내한다. 네트워크 오류는 세션을 남기고 생성하지 않는다. 더블클릭은 한 flight다.

「로그인」은 확인되는 Google 세션이 있으면 팝업 없이 다시 연다. Guest이면 기존 연결 흐름이다. Google 캐시는 지우지 않는다. 명시적 Guest 선택이 Google 세션을 익명으로 바꿀 때만 `signOut` 후 하나를 만든다.

사용자 정보 메뉴는 「종료」다. 주행 중일 때만 「진행 중인 주행이 여기서 끝납니다」 확인이 있다. 「로그아웃되었습니다」「게스트로 새로 시작」「새 게스트는 기록을 이어받지 않습니다」는 시작 메뉴에서 뺐다. 복원 실패 안내와 재시도는 남겼다.

정책 §3.4와 결정 로그 2026-10-19 한 줄을 추가했다.

## 2. 실행

| 명령 | 종료 | 판정 |
|---|---|---|
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/guest-lifecycle-client.test.ts scripts/identity/start-screen-after-deletion.test.ts scripts/identity/auth-session-gate-render.test.mjs` | 0 | PASS 25. 클라이언트·시작 화면 21(복귀 판정 1 추가)과 게이트 4 |
| `cd C:\20.HDev\boxcycle` 후 `node --test scripts/guest-auth-hook-supervisor.test.mjs` | 0 | PASS 9. 시험 파일은 수정하지 않음 |
| `cd C:\20.HDev\boxcycle` 후 `node --test scripts/guest-logout-supervisor.test.mjs` | 0 | PASS 2. 현재 시험은 `endAppUse` 1회·`signOut` 0을 본다. 파일은 수정하지 않음 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS 19 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `node --test scripts/identity/guest-auth-notice-viewport.test.mjs` | 0 | PASS. 667×300, 844×390 |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run build` | 0 | PASS. 경고 경로는 `riderRig.ts` |
| `cd C:\20.HDev\boxcycle\apps\web` 후 `npm run lint` | 0 | error 0, warning 40. 이번 파일의 새 경고는 없다 |
| Playwright `guest-lifecycle.spec.ts` | 미실행 | GLM 소유. 에뮬레이터는 Supervisor |

## 3. 바꾼 파일

- `apps/web/src/hooks/useAppAuth.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/lib/storage/appSessionKeys.ts`
- `apps/web/src/lib/identity/guestResume.ts`
- `apps/web/src/components/auth/AuthSessionGate.tsx`
- `apps/web/src/components/UserInfoSheet.tsx`
- `apps/web/scripts/identity/guest-lifecycle-client.test.ts`
- `apps/web/scripts/identity/start-screen-after-deletion.test.ts`
- `apps/web/scripts/identity/auth-session-gate-render.test.mjs`
- `apps/web/scripts/ride-verify/entry-contract.mjs`
- `apps/web/e2e/account-deletion-ui-shots.spec.ts`
- `document/reference/product/260519-사용자-tier-및-진입-정책.md`
- `document/260707-RTW-결정-로그.md`
- 이 결과 파일

## 4. 한계

- GLM 소유 spec는 아직 「로그아웃되었습니다」를 본다. 이번 UI와 다르므로 그 E2E는 GLM이 고치기 전에는 종료 화면에서 실패한다. 그 두 파일은 수정하지 않았다.
- 종료와 복귀를 에뮬레이터 브라우저에서 3~5회 돌리지는 않았다. 같은 판정은 단위 시험이 다섯 번 `reuse`로 고정한다.
- `completeFirebaseSignOut`은 계정 전환·탈퇴용으로 훅에 남아 있다. 기본 메뉴는 호출하지 않는다.

## 5. Chief 확인

```
cd C:\20.HDev\boxcycle
node --test scripts/guest-auth-hook-supervisor.test.mjs
node --test scripts/guest-logout-supervisor.test.mjs
cd C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/guest-lifecycle-client.test.ts scripts/identity/start-screen-after-deletion.test.ts scripts/identity/auth-session-gate-render.test.mjs
node scripts/ride-verify/verify-selectors.mjs
node --test scripts/identity/guest-auth-notice-viewport.test.mjs
npm run build
npm run lint
```
