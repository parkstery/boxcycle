# 결과06 — App·MapView 연결과 소비자 시험

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — 구현 결과 |
| 최초 작성 | 2026-10-17 |
| 상태 | DONE — 이 단계만. 제품 전체 완료 아님 |
| 독자 | AI |
| 연결 문서 | [지시06](02-task-06.md) |
| 브랜치 | `main2` @ `1f226f1` |
| 담당 | Cursor |

지시04 버튼과 지시05 위치 API를 App·MapView에 연결했다. 기존 dirty는 보존했다. commit/push/deploy/server/browser/subagent는 하지 않았다. 좌표 로그·저장·전송·`watchPosition`은 넣지 않았다.

## 연결

- 인트로의 「게스트로 시작」「로그인」은 클릭 동기 구간에서 소개를 닫고 `entryRequested`를 세운 뒤 `beginAuthenticatedSession` / `handleGoogleSignIn`을 바로 호출한다. 거절된 promise는 catch한다. 인증 함수가 기존 오류 상태를 넣는다. 복원된 사용자는 새 인증을 호출하지 않는다.
- `APP_INTRO_DURATION_MS`와 2초 effect, 인트로 중 카메라 점프는 제거했다. 첫 지도 중심·줌은 `MAP_FALLBACK_CENTER` / `MAP_FALLBACK_ZOOM`, 초기 스타일은 satellite. `resolveMapBootCenter` 계약은 바꾸지 않았다.
- `useEntryLocation`은 항상 같은 순서로 호출한다. 설정·인증 초기화 이후, 버튼 진입 또는 복원 사용자, 로그아웃이 아닐 때 켠다. 인증 busy만으로 막지 않는다. 한 번 idle에서 켜지면 같은 인증 세션에서는 주행이 시작돼도 위치 세션을 끄지 않는다. 로그아웃·미설정이면 끈다.
- 위치 phase가 `checking` / `choice` / `locating`이면 `AuthSessionGate`·`GuestEntryCard`·닉네임 카드를 덮지 않는다. `ready` 뒤에 인증 대기·오류·로그아웃·설정 없음 회복을 다시 보여 준다. 정상 첫 진입은 게스트 카드를 다시 띄우지 않는다. 탈퇴 안내는 버튼을 누르기 전 게스트 카드에 남긴다.
- `MapView`에 `bootFlyTarget`을 추가했다. 이동 전 prop만 목적지에 반영한다. 일반 모션은 줌 0.6 지구본, hold 해제 후 600ms, 3500ms fly. 동작 줄이기는 위치 결정 후 `jumpTo`한다. 사용자 제스처와 명시 `externalCameraJump`는 부트 이동을 취소한다. 대기 중인 부트 목적지가 있으면 `mapZoom` 반영(바깥·콜백·rAF)을 건너뛴다.
- 저장돼 있던 localFirst `at`는 자동 카메라에서 이미 처리한 것으로 둔다. 이후 검색·지역 선택의 새 `at`와 실주행 재개 점프는 그대로다.
- 위치 `notice`는 지도 중앙을 가리지 않는 상단 `role="status"`로 한 번 보여 준다.

## 손댄 파일

- `apps/web/src/App.tsx`
- `apps/web/src/App.css`
- `apps/web/src/components/map/MapView.tsx`
- `apps/web/scripts/ride-verify/entry-contract.mjs`
- `apps/web/e2e/rideEntryHelpers.ts`
- `apps/web/e2e/ride-entry.spec.ts`
- `apps/web/scripts/perf/run-real-gpu.mjs`

`MapView`의 `onExternalCameraSettled`가 작업 트리에 같은 선언으로 세 번 들어가 있어 `tsc`가 막혔다. HEAD에는 없던 중복이다. 선언 하나만 남겼다.

## 시험

작업 폴더: `C:\20.HDev\boxcycle\apps\web`

| 명령 | exit | 결과 |
|---|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` | 0 | 18단계 유효. 직전 1회는 부트 목적지 앵커가 JSX 문법이라 실패했고, 객체 필드에 맞춘 뒤 통과 |
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts` | 0 | pass 18, fail 0 |
| `node --test scripts/identity/auth-session-gate-render.test.mjs` | 0 | pass 4, fail 0 |
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/map/map-boot-center.test.ts` | 0 | pass 6, fail 0 |
| `npx.cmd eslint src/App.tsx src/components/map/MapView.tsx src/App.css e2e/rideEntryHelpers.ts e2e/ride-entry.spec.ts scripts/ride-verify/entry-contract.mjs scripts/perf/run-real-gpu.mjs` | 0 | error 0. warning 16은 기존 hook 의존성·ref cleanup. `App.css`는 eslint 설정 밖이라 ignore warning |
| `npm.cmd run build` | 0 | 재실행. `tsc -b` 통과, vite build 통과. 첫 실행은 위 중복 선언으로 exit 2. 청크 크기·`SADDLE`/`PELVIS` import warning은 기존 |
| `npx.cmd playwright test ride-entry --list` | 0 | 7 tests listed. 실행하지 않음 |
| `git diff --check` (이번 연결 파일) | 0 | 공백 오류 없음 |

## 하지 않은 것

- 실 Firebase E2E, 개발 서버, 브라우저, 실제 Mapbox, 폰 667×300. 지시대로 Supervisor 검수 범위.
- (아래 「추가」에서 처리) 로컬에서 「시작」 카드를 다시 기다리는 e2e 복제본.
- 커밋·푸시·배포.

## 추가 — e2e 소비자 정리 (Chief 「계속해」)

위 「하지 않은 것」의 복제 스펙을 정리했다. 인트로 버튼이 인증을 바로 시작하므로 「시작」 카드를 반드시 기다리는 스펙은 시간 초과로 깨진다.

- 로컬 `guestStart` 복제 17개: 본문을 공용 `guestStart`(별칭 `sharedGuestStart`) 호출로 바꿨다. 함수 이름·호출부는 그대로다. 대상 파일은 `u5-shots`, `u5-render-phase`, `u3-camera-trace`, `u2-map-render-tick`, `touch-targets-44`, `sensor-chip-route-dock-6a`, `s42-read`, `route-pick-popup-title`, `route-dock-riding-content`, `ride-summary-compact`, `ride-story-shots`, `minimap-milestone-shots`, `minimap-map-shots`, `menu-declutter-a`, `hud-distance-elevation-shots`, `account-panel-tidy`, `h1-hud-companion`.
- 카드를 반드시 기다리던 7개(`ride-hierarchy-narrow`, `ride-continue-phase-c`, `ride-continuation`, `autoroute-overlap-5a-measure`, `autoroute-fitbounds-5a`, `account-deletion-ui-shots`, `local-first-card-shots` 2곳)도 공용 `guestStart`로 바꿨다.
- `route-token-ui-smoke`: 익명 가입 응답 대기를 `page.goto` 앞으로 옮기고 공용 `guestStart`를 쓴다. 버튼 클릭 순간 가입 요청이 나가기 때문이다.
- 그대로 둔 것: 카메라 계열 8개(`camera-*`)는 카드를 try로 8초 기다리고 없으면 넘어간다. 깨지지는 않지만 8초를 쓴다. `calorie-profile-sync`, `public-trail-functional-1-2`는 카드가 있을 때만 누른다.

| 명령 (`C:\20.HDev\boxcycle\apps\web`) | exit | 결과 |
|---|---|---|
| `npx.cmd playwright test --list` | 0 | 105 tests in 58 files. 실행하지 않음 |
| `npx.cmd eslint e2e` | 0 | error 0, 기존 warning 1(`firebase-traffic-compare` 미사용 disable) |

## 남은 한계

- 인증이 끝난 뒤 주행 재개가 위치 안내보다 늦게 뜨면, 안내가 이미 떠 있는 동안 재개 카메라와 겹칠 수 있다. 재개 점프 자체는 부트 fly를 취소한다.
- 저장 지역 자동 프레이밍은 이번 진입에서 하지 않는다. 사용자가 다시 고르면 이동한다.
- 로그아웃 화면에서는 부트 목적지가 남아 지구본 줌을 `mapZoom` 15로 덮지 않는다. 위치를 고르기 전에는 HUD 줌 반영도 보류된다.
