# 결과73 — 인트로 추가로 영향받는 기존 E2E 진입 보정

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `main2`. HEAD `c818ed46c6c7c64a05a3430e464fc0bfa47861ed`. 커밋·푸시·배포·브라우저·서버·서브에이전트 없음. 지시73 파일은 수정하지 않음. 앱 코드(`App.tsx`, `AppIntroScreen`, `entry-contract.mjs`)와 `ride-entry.spec.ts`는 지시72 변경 그대로 두었다. 다른 dirty 문서·증거도 유지.

## 변경

- `apps/web/e2e/rideEntryHelpers.ts`에 `dismissAppIntroIfShown` 추가. `guestStart`가 시작 다이얼로그를 기다리기 전에 호출한다. 공용 `guestStart`를 쓰는 스펙(peer-sync, calorie 첫 진입, public-trail 생성 등)은 이 한 곳으로 따라간다.
- 로컬 `guestStart`/`enterAsGuest`와, 헬퍼 없이 시작 다이얼로그를 직접 기다리는 진입(account-deletion, local-first 두 곳)도 같은 함수를 게이트 대기 앞에 둔다. 카메라·autoroute·ride-continuation·ride-continue-phase-c 포함. 기존 게이트 클릭·optional `try/catch`·타임아웃은 그대로다.
- 재진입 분기만 앞에 한 줄 추가했다. `calorie-profile-sync` 새로고침 뒤의 기존 `gate.isVisible` 앞, `public-trail-functional-1-2` F5 재참여·F7 Trailhead의 기존 DOM 일회 확인 앞. 그 뒤의 게이트 처리·하드캡은 유지.
- `ride-entry.spec.ts`의 `enterAsGuest`는 소개 `시작하기`를 이미 검증하므로 호출을 넣지 않았다.

동작: `expect.poll`로 소개, 시작 카드, `로그아웃되었습니다.`, `Firebase 설정 필요`, 닉네임 제목, `사용자 정보`, `서비스에 연결할 수 없습니다.` 중 하나가 보일 때까지 기다린다. `연결 중…`은 신호로 쓰지 않는다. 정착 결과가 소개일 때만 `시작하기`를 누르고, 소개가 사라진 뒤 시작 카드·로그아웃·계정 등 다음 화면이 나올 때까지 기다린다. 이미 로그인·명시 로그아웃·탈퇴 안내(시작 카드)·게스트 재진입(계정 버튼)이면 클릭하지 않고 반환해, 뒤의 기존 게이트 처리가 그대로 돈다. 소개만 무조건 기다리지 않는다. 숨은 전역 클릭, storage 우회, intro bypass env는 없다.

`git diff --numstat`에서 이번 파일은 `rideEntryHelpers.ts` +56/−0, 로컬 헬퍼 스펙은 대개 +2/−0, `calorie-profile-sync.spec.ts` +2/−1, `local-first-card-shots.spec.ts` +3/−0, `public-trail-functional-1-2.spec.ts` +3/−1. 그대로 둔 지시72 추적 변경은 `ride-entry.spec.ts` +5/−1, `App.tsx` +14/−1이다.

## 검증

| 명령 | exit | 판정 |
|---|---|---|
| `apps/web`에서 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS. 17단계 전부 유효 |
| `apps/web`에서 `npx tsc --noEmit` | 0 | PASS |
| `apps/web`에서 수정한 e2e 36파일 `npx eslint` | 0 | PASS. 출력 없음(error 0, warning 0) |
| `apps/web`에서 `npx playwright test --list` | 0 | PASS. `Total: 105 tests in 58 files`. 출력은 `Listing tests:`로 시작. webServer 기동 없음 |

## 미실행·잔여

- 테스트 실행(`npx playwright test` 본실행), `RIDE_VERIFY_LIVE`, 브라우저, 실앱 최초 진입/소개 닫힘/로그아웃/탈퇴 안내는 미실행. 지시가 서버·브라우저를 금지하고, 그 확인은 Supervisor 독립 검수로 두었다.
- 앱 소개가 실제로 게이트를 가리는지는 이번 턴에서 재현하지 않았다. 헬퍼는 소스의 `showAppIntro` 조건(인증 정착 후, 로그인·명시 로그아웃·`account-deleted`·게스트 재진입에는 없음)에 맞춰 분기만 넣었다.
