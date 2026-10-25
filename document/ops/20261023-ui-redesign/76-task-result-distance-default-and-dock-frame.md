# 지시76·결과 — 거리·방향 기본 자동차 · RouteDock 깜빡임 · 미실행 시험(Claude Code 직접)

2026-10-25 KST · Supervisor Claude Code 가 지시·구현·감리·시험을 모두 맡음. 외부 실행자 없음. **미커밋.**

## Chief 지시(10-25)

> 1. 자동차를 기본 수단으로 고정하고 유저가 변경할 수 있게 해 2. 실행하지 않은 시험 진행해. 3. RouteDock 프레임 문제 정리해

## 바꾼 것

| 파일 | 내용 |
|---|---|
| `src/components/map/mapPopupElements.ts` | `DISTANCE_DEFAULT_PROFILE = "driving"`. 거리·방향 화면에 들어오면(첫 화면·탭 전환) 수단을 자동차로. 이 팝업에서 사용자가 거리·방향 수단을 고르면 탭을 오가도 유지. 이미 걸린 거리 세션(팝업 다시 열기·이어 달리기)은 그 수단 유지 — 이어 달리기의 직전 Ride 수단 승계(`resolveRideContinuationSetup`)는 그대로 |
| `src/components/route-dock/RouteDock.tsx` | 주행 시작 접힘·종료 펼침을 `useEffect` 대신 렌더 중 이전 stage 비교로 — 펼친 카드가 한 번 commit 되던 깜빡임 제거(감리40 LOW) |
| `e2e/route-dock-ride-start-frame.spec.ts`(새) | React Profiler 로 commit 수를 잰다. 고치기 전 `commits:2, openSeen:[true,false]` FAIL → 후 1번·접힘만 PASS |
| `e2e/distance-direction-attention.spec.ts` | 첫 방향 탐색 `driving`, 자전거로 재탐색 `cycling`, 고른 보행은 탭을 오가도 `walking` |
| `e2e/ride-summary-compact.spec.ts` | 1px 접근성 트리거를 키보드로 연다(가장자리 탭이 덮음). 센서 시트 시험을 묶음4 시안12 기준으로(제목 「체험 속도」·hero 상태, 09-18 폭·높이 값은 `ui-redesign-batch4` 잠금이 대체) |
| `e2e/guest-lifecycle.spec.ts` | 옛 「종료」가 하던 membership·livePresence 정리를 재현한 뒤 「종료 상태가 다시 만들지 않는다」 확인 |
| `e2e/account-deletion-ui-shots.spec.ts` | `ACCOUNT_DELETION_SHOTS_DIR` — 재검증이 보관 사진을 덮지 않게 |

## 시험

| 검사 | 결과 |
|---|---|
| 팝업 7파일(프리뷰) | 50 PASS · 2 skip |
| route-dock 관련(새 시험·riding-content·ui-edge-live·ui-800x360) | 22 PASS · 2 skip |
| 에뮬레이터 ride-continuation | **7/7 PASS** — 묶음5 위 첫 통과 |
| 에뮬레이터 ride-entry·route-dock-riding-content·ui-edge-live | 7 PASS |
| 에뮬레이터 calorie-profile-sync·route-pick-popup-title | 4/4 PASS |
| account-deletion-ui-shots | 2/2 PASS |
| guest-lifecycle(demo 에뮬레이터) | 3 PASS · **1 FAIL** — offline 시작: 옛 종료 표시로 돌아온 기기가 offline 에서 같은 Guest 로 바로 재진입(실측 새 계정 0·같은 uid, 복구 뒤도 동일). 시험은 시작 메뉴에 머문다고 기대 |
| ride-summary-compact | 센서 시트 등 2 PASS · **3 FAIL** — 옛 위치 컨트롤(`Set start`·캐럿)·09-18 독 배치(캐럿·Go 줄)·짧은 탭 팝업. 10-23~24 배포 디자인(탭·고정11·12·길게 눌러 팝업)으로 이미 낡은 시험, 다시 쓰기 필요 |
| tsc · eslint 변경 파일 | 0 · 0 |

## 사고

20:28 `ui-800x360` 을 증거 폴더 env 없이 돌려 커밋된 `evidence/riding-address-dock-collapse/*.png` 5장을 덮었다. `git show HEAD:<path>` 로 되써 원본과 같다(덮인 사본은 scratchpad `overwritten-2028/`).

## 판정

① ③ PASS. ② 실행 완료 — 남은 FAIL 4건은 원인 확인, 제품 회귀 아님. 커밋·배포는 Chief 승인 대기.
