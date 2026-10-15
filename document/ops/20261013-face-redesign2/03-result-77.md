# 결과77 — 정상 로그인 중 연결 실패 오표시 제거

모델: Auto (Cursor agent router). branch `main2`. HEAD `dbab829691b3b251bdc8d92ad727b044ee4f3354`. 커밋·푸시·배포·브라우저·서버·서브에이전트 없음. 지시77 파일은 수정하지 않음. `useAppAuth`는 읽기만 했고 동작은 바꾸지 않음. 다른 dirty 파일은 되돌리지 않음.

## 변경

- `apps/web/src/components/auth/AuthSessionGate.tsx` 추가. `stage === "gate" && !needsGuestEntry` 블록의 표현만 이 컴포넌트가 맡는다. props는 `configured` / `authInitialized` / `authSigningIn` / `userSignedOut` / `busy` / `error` / `onStartGuest` / `onGoogleSignIn`. 껍데기는 기존 `AuthGateCard`, Google 마크·`auth-actions auth-actions--gate`·`btn auth-gate-google` / `secondary` / `primary`를 그대로 쓴다.
- 우선순위: 설정 없음 → `Firebase 설정 필요`. 그다음 `configured && (!authInitialized || authSigningIn || busy)` 는 `role="status"` 로 `로그인 중…`(busy 또는 authSigningIn) 또는 `연결 중…`(부트). 이 대기에는 실패 문구, 다시 시도, 선택 버튼, stale `error` 가 없다. 구글 창 여부는 별도 신호가 없어 게스트 대기에도 창 안내를 넣지 않았다. 그다음 명시 로그아웃 문구·Google/게스트 버튼·안내. 그다음 `error` 가 있으면 `서비스에 연결할 수 없습니다.` 와 error 상세, `다시 시도`(게스트 재시도)와 `Google로 로그인`. 그외 idle 은 `시작 방법을 선택해 주세요.` 와 같은 두 버튼. timeout 으로 실패를 만들지 않는다.
- `App.tsx` 는 같은 조건에서 위 props와 `beginAuthenticatedSession` / `handleGoogleSignIn` 만 연결한다. 닉네임 카드가 `AuthGateCard` 를 계속 쓰므로 그 import 는 남겼다. `AuthGoogleMark` 는 App 에서 더 쓰지 않아 import 를 뺐다.
- `entry-contract.mjs` 에 `auth-session-state` 한 단계를 추가했다. 기존 intro/Guest/ride-entry 단계는 바꾸지 않았다. 컴포넌트 파일의 대기 조건·연결 중/로그인 중·실패·선택 앵커와, App 연결 앵커를 함께 둔다. 한 단계가 파일 둘을 보려면 검사기가 필요해서 `verify-selectors.mjs` 가 선택 필드 `also` 를 같은 단계에서 추가로 읽게만 했다. `file` 만 있는 기존 단계의 판정은 그대로다.
- `rideEntryHelpers.ts` 의 정착 화면에 `시작 방법을 선택해 주세요.` 를 넣었다. `연결 중…`·`로그인 중…` 은 ready 로 넣지 않았다.

회귀는 실제 `AuthSessionGate` 를 React 로 그려 확인한다. `react-dom/server` 의 `renderToStaticMarkup` 으로 문구·status·버튼 유무를 보고, 같은 컴포넌트 element 의 `onClick` 으로 idle Google/게스트와 error 의 다시 시도/Google 을 누른다. 조건문 정규식을 테스트에 복제하지 않았다. TSX 를 Node 테스트에서 불러오려고 `scripts/identity/auth-session-gate-tsx-register.mjs` 와 hooks 를 뒀고, CSS import 는 빈 모듈로 넘긴다.

`git diff --numstat` (HEAD 대비, 추적 파일): `App.tsx` +12/−51, `entry-contract.mjs` +49/−0, `verify-selectors.mjs` +21/−10, `rideEntryHelpers.ts` +5/−3. 신규 비추적: `AuthSessionGate.tsx`, `scripts/identity/auth-session-gate-render.test.mjs`, `auth-session-gate-tsx-register.mjs`, `auth-session-gate-tsx-hooks.mjs`, 이 결과 파일.

## 검증

| 명령 | exit | 판정 |
|---|---|---|
| `apps/web`에서 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS. 18단계 전부 유효 |
| `apps/web`에서 `npx tsc --noEmit` | 0 | PASS. 출력 없음 |
| `apps/web`에서 `npx eslint src/App.tsx src/components/auth/AuthSessionGate.tsx e2e/rideEntryHelpers.ts` | 0 | error 0. warning 7은 `App.tsx` 기존 `react-hooks/exhaustive-deps`(715, 1178, 1215, 1231, 1273, 1354, 2841). 새 컴포넌트와 helper 는 지적 없음 |
| `apps/web`에서 `node --import ./scripts/identity/auth-session-gate-tsx-register.mjs --test scripts/identity/auth-session-gate-render.test.mjs` | 0 | PASS. 4 tests, pass 4, fail 0 |

렌더 테스트가 본 순서: 부트(`연결 중…`, stale error 숨김, 버튼 없음) → busy Google/게스트(`로그인 중…`, 실패·선택 없음, 콜백 0) → idle 취소 복귀에서 Google·게스트 콜백 각 1 → error 상세 1회와 다시 시도·Google 콜백 각 1 → busy 재진입에서 그 error 와 실패 문구를 다시 숨김. 별도 케이스로 `authSigningIn`, 명시 로그아웃(기존 세 문장·error 상세·실패 제목 없음·두 콜백), 설정 없음(초기화 전·busy·error 가 있어도 실패 제목과 연결/로그인 문구·버튼 없음).

## 미실행·잔여

- 성공 후 App 게이트가 사라지는 경로는 이 단위 테스트가 App 을 올리지 않는다. 렌더는 여전히 `stage === "gate" && !needsGuestEntry` 일 때만 `AuthSessionGate` 를 둔다. popup 대기·취소·오류·성공·부트는 지시대로 Supervisor 가 App import 와 `useAppAuth` fixture 로 확인한다.
- 스마트폰 800×360 / 667×300 캡처, 문구·버튼의 화면 확인, 전체 실주행 E2E 는 미실행. 이번 지시는 브라우저·서버를 금지한다. Firebase 전제가 있는 `playwright test ride-entry` 도 서버를 띄우므로 실행하지 않았다.
- 게스트 시작 callback 이 throw 되는 기존 문제와 전역 promise 는 범위 밖이라 그대로 두었다.
