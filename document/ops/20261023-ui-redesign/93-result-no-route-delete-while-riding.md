# 지시93 결과 — 주행 중 경로 삭제 금지·경로가 없으면 음악 정지

2026-10-26 · 구현·시험: Claude Code 서브에이전트(impl-standard, Sonnet 5.5) · 지시서: `93-task-no-route-delete-while-riding.md`

## 바꾼 것

1. **음악 방어선** — `apps/web/src/features/ride-feedback/useRideCoachingMedia.ts`: `useRideBgm` 의 `sessionActive` 를 `opts.sessionStatus !== "idle" && opts.routeGeometry != null` 로. 경로가 없어지면 기존 페이드아웃 경로로 멈춘다.
2. **주행 중 삭제 차단 + 확인 창**(빌드 모드 PROD/DEV 무관)
   - 새 `apps/web/src/lib/route/routeClearGuard.ts`: `isRouteClearBlockedByRide(rideStatus)` = `rideStatus !== "idle"`.
   - 새 `apps/web/src/components/ride/RouteClearBlockedDialog.tsx` + `.css`: `SettingsSurface.css` 계열 흰 판(`settings-surface` 클래스 재사용, 회색 원형 닫기), 폭 ≤ 320px, 글자 14/12/13px(≥ 10px). 제목 「주행 중에는 경로를 지울 수 없습니다」, 본문 「주행을 종료한 뒤 경로를 지울 수 있어요.」, 버튼 「계속 주행」·「주행 종료」. Esc·바깥 클릭·X = 계속 주행.
   - `apps/web/src/App.tsx`: 확인 창 열림 상태 + 가드. `handleClearPins`·`handleRemoveRouteDockStop` 맨 앞에서 주행 중이면 창만 띄우고 return(경로·핀 상태 변경 없음). 「주행 종료」는 `handleEndRideWithTrailCleanup()` 만 호출(경로 자동 삭제 없음). 주행이 끝나면 창은 자동으로 닫힌다. MapView 에 `canClearRouteNow: () => !routeClearBlockedByRide` 전달. MapHud `onClearPins` 두 곳은 기존대로 `handleClearPins` 를 쓰므로 같은 가드를 지난다.
   - `apps/web/src/components/map/MapView.tsx`: `canClearRouteNow` prop/ref 추가. 팝업 `onClearRoute` 래퍼가 막힌 때는 검색 순서·디버그 마커 정리 전에 App 안내(`onClearRoute`)만 부르고 return. 팝업에는 `canClearRouteNow` 콜백 전달.
   - `apps/web/src/components/map/mapPopupElements.ts`: 「경로 삭제」 onclick 맨 앞에서 `canClearRouteNow()` 가 false 면 `onClearRoute()`(안내)만 부르고 return — 핀·거리 선택 초기화·팝업 닫기 모두 실행되지 않는다. 버튼 숨김·위치·모양은 그대로.
   - 바꾸지 않은 것: `routeWorkspaceLock` 의 PROD 조건, `clearRoutePins(routeMenuLockedForProd)` 인자, Chief 지정 디자인 고정 항목.
3. **시험**
   - 새 `apps/web/scripts/ride-hierarchy/route-clear-block-while-riding-contract.test.ts` (빠른 시험 묶음 `ride` 에 자동 편입, 9건): 판정 함수 값, BGM `sessionActive` 식, App 가드가 `clearRoutePins`·상태 변경보다 앞인지(두 콜백), MapHud/팝업 배선이 모두 `handleClearPins`, 확인 창 버튼 배선(종료가 경로를 지우지 않음), PROD 잠금 유지, 팝업 onclick·MapView 래퍼에서 가드가 상태 초기화보다 앞인지.
   - 하네스 `apps/web/scripts/ui-800x360/map-route-runtime.tsx`: `?riding=1` 이면 주행 중 상태(실제 `MapView`·실제 팝업·실제 확인 창 사용, App 과 같은 판정 함수). `#runtime-state` 에 `rideStatus`·`endRideCalls`·`clearBlockedOpen` 추가.
   - 새 e2e `apps/web/e2e/route-clear-blocked-while-riding.spec.ts` (2건).

## 실행한 검증 (모두 `C:\20.HDev\boxcycle\apps\web` 에서)

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | exit 0 |
| `npx eslint <변경·신규 9개 파일>` | 오류 0, 경고 17(App.tsx 7·MapView.tsx 10, 모두 기존 `react-hooks/exhaustive-deps`) |
| `node scripts/test-quick.mjs` | 통과 1381 · 실패 0 (ride 876, route 176, map 156, peer 72, meters 58, tools 43) |
| `node scripts/ride-verify/verify-selectors.mjs` | 19/19 유효 |
| `npx playwright test e2e/route-clear-blocked-while-riding.spec.ts e2e/map-route-runtime.spec.ts --workers=1 --reporter=line` | 5 통과 · 0 실패 |
| `npx playwright test e2e/route-pick-popup-title.spec.ts e2e/distance-direction-attention.spec.ts --workers=1 --reporter=line` | 3 통과 · 2 skipped(기존 skip) · 0 실패 |
| 정적 계약 사보타주(임시로 4곳을 깨뜨림) | BGM 식 제거·RouteDock 가드 제거·팝업 가드 제거·MapView 가드 제거 각각 9건 중 1건 실패(8/1) 확인 후 원복, 원복 뒤 9/0 |

새 e2e 가 확인하는 것(800x360): 주행 중 팝업 「경로 삭제」 → 확인 창 표시·문구, 경로 시작/도착점·팝업·`rideStatus: running` 유지, 창 폭 ≤ 320px·글자 ≥ 10px, Esc / 바깥 클릭 / 「계속 주행」은 창만 닫음, 「주행 종료」는 종료 흐름 1회 호출·경로는 그대로, 종료 뒤 「경로 삭제」는 즉시 지워짐. 주행 중이 아니면 확인 창 없이 바로 삭제. 증거 캡처는 리포 밖 `C:\Users\kdrea\AppData\Local\Temp\claude\C--20-HDev-boxcycle\acd6ab3e-ed3f-43c6-9de1-cd7f26ff6040\scratchpad\shots\route-clear-blocked-800x360.png`(env `RTW_ROUTE_CLEAR_SHOT_DIR`; 없으면 캡처하지 않음).

## 미실행·한계

- **실앱(에뮬레이터) e2e 는 돌리지 않았다.** App 배선(handleClearPins·RouteDock ✕·MapHud)은 정적 계약으로만 고정했고, e2e 는 실제 MapView·팝업·확인 창까지만 실물이다. 「주행 종료」 → 실제 주행 결과 화면은 하네스가 App 이 아니라 확인하지 못했다(`endRideCalls` 호출만 확인).
- RouteDock 지점 ✕ 와 MapHud 「핀 초기화」 클릭은 브라우저에서 눌러 본 시험이 없다(정적 가드 순서 검증만).
- 음악 정지 동작 자체(실제 페이드아웃)는 시험하지 않았고, `sessionActive` 식만 고정했다.

## 남은 위험

- 주행 중 경로가 비는 다른 경로(예: 거리 자동 경로의 `onClearRouteArtifacts`, 코스 전환)는 이번 범위 밖이라 그대로다. 그때는 음악 방어선만 작동한다.
- PROD 에서는 기존 `routeMenuLockedForProd` 때문에 RouteDock 쪽 다른 편집이 여전히 조용히 무시되는 부분이 남아 있다(범위 밖).
- 확인 창 z-index 57(설정 시트 56 바로 위). 주행 결과 시트 등과 겹치는 조합은 확인하지 않았다.

## 작업 환경 메모

- 시험용 vite 서버는 Playwright 가 기동·종료했고 남은 프로세스 없음. 포트 3000·5017·5040 은 건드리지 않았다.
- git worktree/restore/clean/stash/commit/push 사용 안 함. 무관한 dirty 파일은 수정하지 않았다(`document/ops/HANDOFF.md` 변경은 이 작업이 아님).

## Supervisor 감리 (Claude Code Opus 5.5, 2026-10-26 21:30 KST)

- 실행자: Cursor CLI(`agent -p --force`)는 Claude Code 자동 권한 검사가 거부 → 하위 에이전트 impl-standard 가 구현·시험. Supervisor 는 지시·diff 검수·실앱 감리.
- diff 검수 PASS: 세 진입점 모두 App `handleClearPins`·`handleRemoveRouteDockStop` 앞 같은 가드(`isRouteClearBlockedByRide`), 팝업·MapView 는 막힌 때 상태를 건드리지 않고 안내만, BGM `sessionActive` 에 경로 조건. `routeWorkspaceLock` PROD 조건·`clearRoutePins` 인자 불변. 고정 목록 15(팝업 맨 아래 줄)·23 불변.
- **실제 App(에뮬레이터) 감리 임시 시험(삭제함)**: 출발·도착 찍기 → 자전거 경로 → 주행 시작 → 경로 창 「경로 삭제」 → 확인 창·주행 계속(「주행 종료」 버튼 활성) → 「계속 주행」 창만 닫힘 → 다시 「경로 삭제」 → 「주행 종료」 → 주행 끝·경로 그대로 → 「경로 삭제」 → 경로 지워짐. 1/1 PASS. 시험 문구 맞춤으로 6회 재실행(제품 수정 없음).
- 참고: 거의 움직이지 않은 짧은 주행은 기존대로 결과 화면 없이 준비 화면으로 돌아간다. 음악 `<audio>` 는 문서에 붙지 않아 브라우저에서 재생 상태를 읽지 못했다 — 음악 정지는 정적 계약(사보타주 확인)으로만 고정.
- 판정: **PASS / LOCAL_VERIFIED**, 미커밋.

- 추가(지시94 중 발견): 새 파일 `lib/route/routeClearGuard.ts` 가 `apps/web/dep-layers.json` 에 없어 의존 방향 검사기 M0 가 실패했다(실행자 누락·감리 미실행). route 도메인에 등록해 통과.
