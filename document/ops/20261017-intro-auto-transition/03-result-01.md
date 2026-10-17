# 결과01 — 인트로 2초 후 인증 화면 자동 전환

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — 구현 결과 |
| 최초 작성 | 2026-10-17 |
| 상태 | DEVELOPMENT_DONE |
| 독자 | Supervisor · chief |
| 수행 | Developer — Cursor AI·CLI |
| 모델 | Composer (Auto, Cursor 에이전트 라우터) |
| 세션 | `CURSOR_CONVERSATION_ID=da50da8a-8282-4930-a400-fb096b91e597` |
| 연결 문서 | [지시01](02-task-01.md) · [묶음](README.md) |

## 저장소

| 항목 | 값 |
|---|---|
| 브랜치 | `main2` |
| HEAD | `1f226f19ac465aef390998bd9ccc99b3e138abe3` |
| 작업 폴더 | `C:\20.HDev\boxcycle` |
| 웹 실행 폴더 | `C:\20.HDev\boxcycle\apps\web` |

작업 시작 시 이미 있던 다른 담당 변경은 그대로 두었다. 수정: `AGENTS.md`, `apps/web/index.html`, `document/260707-RTW-결정-로그.md`, `document/archive/README.md`, `document/ops/PROGRESS.md`, `document/ops/README.md`, `document/reference/operations/261009-RTW-개발에이전트-협업-감리.md`. 미추적: `document/archive/reports/261017-RTW-프로세스&메모리-정리.md`, `document/ops/20261017-intro-auto-transition/`, `document/ops/20261017-intro-preload/`. `index.html`의 사진 preload와 위 문서는 이번 편집에 넣지 않았다. commit, push, deploy, browser, server, subagent는 실행하지 않았다.

## 변경

계약을 먼저 고친 뒤 그 앵커에 맞춰 구현했다.

- `apps/web/scripts/ride-verify/entry-contract.mjs`: 소개 단계는 region `앱 소개`, 제목 `달린 길이,`, 인자 없는 `AppIntroScreen()`을 고정한다. 게이트는 기존 `showAppIntro` 조건, `APP_INTRO_DURATION_MS = 2_000`, `showAppIntro`가 참일 때만 `setIntroDismissed(true)` 하는 타이머, `window.clearTimeout` cleanup, `[showAppIntro]` 의존, `<AppIntroScreen />`, 게스트 카드 상호 배제를 고정한다.
- `apps/web/src/App.tsx`: `showAppIntro` 바로 뒤에 `useEffect([showAppIntro])`를 두었다. 거짓이면 타이머 없이 반환한다. 참이면 `window.setTimeout` 2_000ms 뒤 `setIntroDismissed(true)`만 호출하고, cleanup은 `window.clearTimeout`이다. 화면이 다시 참이 되면 효과가 다시 돌아 새 타이머가 시작된다. 인증·경로·지도 함수는 호출하지 않는다. JSX는 `<AppIntroScreen />`이다. 명시 로그아웃·로그인 상태·탈퇴 안내·busy·error 예외는 기존 `showAppIntro` 조건 그대로다.
- `apps/web/src/components/auth/AppIntroScreen.tsx`: `onStart`, CTA, 화살표, 포커스 스크롤을 제거한 인자 없는 표현 컴포넌트다. 브랜드·제목·설명·사진·출처·고정 차단 레이어는 유지한다. 사진 `onLoad`를 기다리지 않는다.
- `apps/web/src/components/auth/AppIntroScreen.css`: CTA 규칙과 그 규칙에만 해당하는 설명을 제거했다. 본문·사진·그라데이션·출처·스크롤·글자 크기·남은 색은 유지한다.
- `apps/web/e2e/rideEntryHelpers.ts`: `dismissAppIntroIfShown` 이름과, 소개가 아닌 화면이면 클릭 없이 반환하는 분기를 유지한다. 소개가 보이면 「시작하기」를 누르지 않고 자동으로 닫힌 뒤 다음 인증 화면을 기다린다.
- `apps/web/e2e/ride-entry.spec.ts`: `enterAsGuest`가 소개를 본 뒤 자동으로 닫히길 기다리고, 그다음 게스트 「시작」을 누른다.

새 파일·props·훅·디버그 스위치는 없다. `dev-tools.json`은 바꾸지 않았다.

## 검증

명령은 `C:\20.HDev\boxcycle\apps\web`에서 실행했다. `git diff --check`만 `C:\20.HDev\boxcycle`에서 실행했다.

| 명령 | 종료 코드 | 구분 |
|---|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` | 0 | 통과. 18단계 전부 유효 |
| `node --test scripts/identity/auth-session-gate-render.test.mjs` | 0 | 통과. 4 pass, 0 fail |
| `npx.cmd eslint src/App.tsx src/components/auth/AppIntroScreen.tsx e2e/rideEntryHelpers.ts e2e/ride-entry.spec.ts scripts/ride-verify/entry-contract.mjs` | 0 | 오류 0. `App.tsx` 기존 hook 경고 7건. 이번 인트로 effect 줄은 경고에 없다 |
| `npm.cmd run build` | 0 | `tsc -b && vite build` 통과. `✓ built in 2.56s` |
| `npx.cmd playwright test ride-entry --list` | 0 | 수집만. 7 tests in 1 file. 실행하지 않음 |
| `git diff --check -- apps/web/src/App.tsx apps/web/src/components/auth/AppIntroScreen.tsx apps/web/src/components/auth/AppIntroScreen.css apps/web/e2e/rideEntryHelpers.ts apps/web/e2e/ride-entry.spec.ts apps/web/scripts/ride-verify/entry-contract.mjs` | 0 | 공백 오류 없음 |

`entry-contract.mjs`는 무시 메시지가 없었다. 지정 명령이 파일을 읽어 파싱했고 지적도 없었다. `eslint.config.js`의 TypeScript·React 규칙 `files`는 `**/*.{ts,tsx}`라 그 규칙 묶음은 `.mjs`에 붙지 않는다. `e2e`의 두 `.ts` 파일은 그 규칙 대상이며 지적이 없었다.

빌드 로그의 청크 500 kB 안내와 `riderRig.ts`의 `SADDLE`·`PELVIS` import 경고는 이번 파일 밖의 기존 출력이다. 종료 코드는 0이다.

## 미실행

Firebase 에뮬레이터와 실인증을 켜지 않았다. `RIDE_VERIFY_LIVE=1` 실주행 e2e는 미실행이며 성공으로 보지 않는다. 시간 제어 브라우저 검증(1999ms/2000ms, 사용자 동작 없이 다음 카드, 자동 인증 없음, 다음 「시작」에서만 콜백, StrictMode·게이트 cleanup, 사진 실패·지연, 폰 가로·PC)은 Supervisor 범위라 여기서 실행하지 않았다. browser와 server는 시작하지 않았다.

## 한계

`apps/web/scripts/perf/run-real-gpu.mjs`는 아직 소개 「시작하기」 클릭이 남아 있다. 허용 파일이 아니라 고치지 않았다. 아카이브와 옛 ops QA 스크립트도 일괄 수정하지 않았다. 사진이 실패하거나 늦어도 2초 뒤 화면은 넘어간다. 자동 인증과 자동 주행은 넣지 않았다.
