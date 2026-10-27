# 지시93 — 주행 중 경로 삭제 금지(먼저 주행 종료)·경로가 없으면 음악 정지

2026-10-26 · Chief 직접 지시 · Supervisor Claude Code(Opus 5.5) 조사·지시·감리 / 실행 Cursor CLI

## Chief 지시(원문 요지)

- 달리는 도중 「경로 삭제」가 된다. 경로가 지워지면 정상 주행이 안 되는데 주행 음악은 계속 나온다 → **경로가 삭제되면 음악도 멈춘다.**
- 근본적으로 주행 중 경로 삭제는 문제를 일으킨다 → **주행 중 지우려 하면 먼저 주행을 멈춘(종료한) 뒤에만 지울 수 있게** 흐름을 정비한다.

## Supervisor 조사(원인)

1. 주행 중 경로 잠금 `lockRouteWorkspaceDuringRide`(`apps/web/src/lib/route/routeWorkspaceLock.ts`)는 `import.meta.env.PROD && sessionNotIdle` — **개발 서버에서는 잠금이 없다.** Chief 시험(localhost:5017 개발 서버)에서는 주행 중 삭제가 그대로 실행된다. 운영 빌드에서는 같은 버튼이 아무 안내 없이 무시된다(눌러도 반응 없음).
2. 삭제 경로: `App.tsx` `handleClearPins` → `useRoutePlanning.clearRoutePins(routeMenuLockedForProd)`. 진입점 셋:
   - 지도 경로 창(`mapPopupElements.ts` 「경로 삭제」 버튼 → `MapView` `onClearRoute` → App `onClearRoute: handleClearPins`),
   - `MapHud.tsx` 747행 `onClick={onClearPins}` (App 의 `onClearPins: handleClearPins` 두 곳),
   - RouteDock 지점 ✕ `handleRemoveRouteDockStop`(출발·도착 제거 = 경로 무효화, 같은 `routeMenuLockedForProd` 가드).
3. 음악: `features/ride-feedback/useRideCoachingMedia.ts` 의 `useRideBgm({ sessionActive: opts.sessionStatus !== "idle", ... })` — 세션만 보고 경로 유무를 보지 않는다.

## 할 일

1. **음악 정지(방어선)**: `useRideCoachingMedia` 에서 `sessionActive` 를 `opts.sessionStatus !== "idle" && opts.routeGeometry != null` 로. 어떤 이유로든 주행 중 경로가 없어지면 음악이 멈춘다(기존 페이드아웃 경로 그대로).
2. **주행 중 삭제 차단 + 안내(빌드 모드 무관)**: `rideStatus !== "idle"`(주행·일시정지)일 때 위 세 진입점은 경로를 지우지 않는다. 대신 확인 창을 띄운다.
   - 문구: 제목 「주행 중에는 경로를 지울 수 없습니다」, 본문 「주행을 종료한 뒤 경로를 지울 수 있어요.」
   - 버튼: 「주행 종료」(기존 종료 흐름 `handleEndRideWithTrailCleanup` 그대로 → 주행 결과 화면. **경로를 자동으로 지우지 않는다**), 「계속 주행」(창만 닫음).
   - 판단은 App 한 곳에서: `handleClearPins`·`handleRemoveRouteDockStop` 앞에 같은 가드 함수. `clearRoutePins` 의 기존 `rideLocked` 인자·`routeWorkspaceLock` 의 PROD 조건은 **바꾸지 않는다**(메뉴·코스 전환 등 다른 잠금은 이번 범위 밖).
   - 경로 창의 「경로 삭제」 버튼 클릭 뒤 처리(`mapPopupElements.ts` onclick 의 핀·거리 선택 초기화)도 주행 중에는 실행되지 않게 한다 — 버튼 상태가 지워진 것처럼 바뀌면 안 된다. 가장 단순한 방법: `MapView`·팝업에 「지금 지울 수 있나」를 묻는 콜백(예: `canClearRouteNow(): boolean`)을 넘기고, false 면 App 안내만 띄우고 return.
   - 확인 창 모양은 기존 설정 창(`components/ui/SettingsSurface.css` 흰 판·회색 원형 닫기)과 같은 계열, 작게(폭 ≤ 320px, 글자 ≥ 10px). Esc·바깥 클릭 = 「계속 주행」.
3. **시험**
   - 정적/단위 계약(빠른 시험 묶음에 들어가는 위치, 예 `apps/web/scripts/ride-verify/` 또는 기존 계약 옆): `useRideBgm` 의 sessionActive 가 경로 없음에서 false 인지, App 가드가 세 진입점 앞에 있는지.
   - 하네스 또는 실앱 e2e 1건: 주행 중 「경로 삭제」 → 확인 창 표시·경로 그대로·주행 계속, 「주행 종료」 → 주행 결과 화면. 가능하면 기존 `apps/web/e2e/route-media-controls.spec.ts` 또는 `ui-redesign-batch*.spec.ts` 미리보기(`scripts/ui-800x360/preview.html`)로. 실앱이 필요하면 에뮬레이터 모드.
   - 증거 캡처는 리포 밖(임시 폴더)으로. 잠금 e2e 의 기본 출력이 `document/` 증거를 덮지 않게 env 를 지정한다.

## 금지

- Chief 지정 디자인 고정 목록(`document/reference/product/261024-RTW-Chief-지정-디자인-고정.md`) 1~25 변경 금지 — 특히 15(팝업 두 탭 맨 아래 줄: 수단 3개·주행·경로 삭제), 23(두 주행 버튼 5회 펄스), 24·25.
- 「경로 삭제」 버튼을 숨기거나 위치·모양을 바꾸지 않는다(눌렀을 때 동작만 바뀜).
- `git worktree`·`git restore`·`git clean`·`git stash`·커밋·푸시 금지. 이 지시와 무관한 dirty 파일(증거 PNG 8장, `15-entry-flight-metrics.json`, `.out/`, `cdbox.bat`, `claude-headless.err`) 건드리지 않음.
- 포트 3000·5017·5040 의 기존 서버를 끄지 않는다. 시험용으로 띄운 서버만 끝나면 끈다.
- 기대값·게이트 완화 금지.

## 완료 조건

- `apps/web` 에서 `npx tsc -b --noEmit` exit 0, 변경 파일 eslint 오류 0, `node scripts/test-quick.mjs` 실패 0, `node scripts/ride-verify/verify-selectors.mjs` 19/19.
- 위 e2e 통과.
- 결과를 `document/ops/20261023-ui-redesign/93-result-no-route-delete-while-riding.md` 에 작성: 바꾼 파일, 실행 명령과 통과·실패·미실행 구분, 남은 위험.
