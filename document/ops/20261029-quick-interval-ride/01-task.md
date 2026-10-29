# 간편 인터벌 주행 1단계 — 구현 지시

2026-10-29 Chief 「권장안대로 1단계 지시서 작성해」. Supervisor Claude Code 작성. 실행자 기본은 Cursor CLI이고, 막히면 impl-standard로 대체한다([실행 한계](../../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md)). 확정값은 [README](README.md)를 따른다. 구현과 관련 검증을 마친 뒤 `02-result-<실행자>.md`에 바뀐 파일, 실행 명령, 통과·실패·미실행과 그 이유를 기록한다.

## 끊김 대비 (고정)

시작하자마자 결과 파일 `document/ops/20261029-quick-interval-ride/02-result-<실행자>.md`를 만든다. 첫 줄에 `STARTED <시각> <모델·도구>`를 쓰고, 파일 하나를 고칠 때마다 `DONE <파일> / NEXT <다음 파일·명령>` 한 줄을 추가한다. 한도나 오류로 멈추면 마지막 줄이 재개 지점이 된다.

## 착수 전제

1. [왼쪽 메뉴 정비](../20261029-left-menu/README.md): **충족**(2026-10-29 감리 PASS, 커밋 f2b1b882). Chief 지시로 거리 부족 안내보다 먼저 착수한다.
2. 아래 「확인된 부품」의 줄 번호는 작성 시점 기준이다. 왼쪽 메뉴 작업 뒤 바뀌었을 수 있으니 이름으로 다시 찾는다.

## 확인된 부품 (새로 만들지 말고 재사용)

| 용도 | 위치 |
|---|---|
| 인터벌 총 시간 | `getRideIntervalTotalSec(config)` — `apps/web/src/lib/ride/rideInterval.ts` |
| 인터벌 설정·켜기 | `useRideInterval`의 `config`, `onEnabled` — `apps/web/src/hooks/useRideInterval.ts` |
| 기준 속도 | `resolveIntervalBasisKmh()`(25 km/h) — **이 작업에서 새로 만든다**: `apps/web/src/lib/route/intervalRouteDistance.ts`에 `INTERVAL_ROUTE_BASIS_KMH = 25`와 `resolveIntervalBasisKmh()`만 둔다. 나중에 [거리 부족 안내](../20261029-interval-route-hint/01-task.md)가 같은 파일에 함수를 더한다. 내 평균 속도는 쓰지 않는다(2026-10-29 Chief, [계획](00-plan.md)) |
| 거리 범위 | `DISTANCE_AUTO_ROUTE_KM_MIN/MAX`(0.5~120) — `apps/web/src/lib/route/distanceAutoRouteErrors.ts`. 서버도 500 m~120 km만 허용한다 |
| 마지막 주행 종료점 | App의 `lastRideEntryTarget`과 같은 계산 — `resolveNextRideView({ rides: recentSessions, savedRoutes: [], activeRouteId: null })?.target.anchorLngLat`(실제 종료 좌표 우선, `lib/ride/nextRideTarget.ts`). `recentSessionsLoading` 중에는 「기록 없음」으로 판정하지 말고 로딩이 끝날 때까지 기다린다 |
| 이어 달리기 진입 | `handleStartRouteFromAnchor` → `resolveRideContinuationSetup` → `armDirectionPick` — `App.tsx` |
| 출발지 클릭 단계 | `useDistanceAutoRoute`의 `pick_start` 단계 |
| 방향 탐색·적용 | `useDistanceAutoRoute.handleMapPick`이 클릭 지점을 `targetRoadPoint`로 `fetchDistanceAutoRoute`에 보내고, 성공하면 `onApplyRoute` |
| 방향 지점 만들기 | `offsetLngLatByBearingMeters` — `apps/web/src/lib/geo/geo.ts` |
| 토큰 환불 | 서버 `functions/src/distanceAutoRouteHttp.ts`가 탐색 실패 시 `refundRouteGenerateToken`으로 환불한다. 서버는 고치지 않는다 |

## 동작

1. **메뉴 항목:** 왼쪽 메뉴의 「인터벌」 행 바로 아래에 「간편 인터벌 주행」 행을 둔다. 다른 행과 같은 모양·크기·터치 영역을 쓰고, 한국어 title과 aria-label을 단다. 주행 중(`rideLocked`)이거나 Route Token이 부족하면 비활성으로 하고, 이유를 title에 적는다.
2. **목표 거리:** `km = clamp(intervalTotalSec / 3600 × resolveIntervalBasisKmh() × 1.3, 0.5, 120)`. 25를 직접 적지 않는다. 소수 첫째 자리로 반올림한다. 상수 `QUICK_INTERVAL_DISTANCE_MARGIN = 1.3`과 `QUICK_INTERVAL_MAX_ATTEMPTS = 3`은 순수 함수 모듈에 이름을 붙여 둔다.
3. **출발 지점:**
   - 마지막 유효 주행 종료점이 있으면 그 지점을 출발지로 하고, 사용자 클릭 없이 바로 4번으로 간다. 지도는 그 지점으로 이동한다.
   - 없으면 「출발 위치를 맵에서 클릭하세요」 안내를 띄우고 `pick_start`로 들어간다. 클릭하면 바로 4번으로 간다(방향 클릭 단계는 건너뛴다).
4. **무작위 방향 탐색:** 0~360° 중 무작위 방위를 고른다. 출발지에서 그 방위로 안내 원 반지름(`resolveDistanceAutoRouteGuideRadiusKm(km)`)만큼 떨어진 지점을 `targetRoadPoint`로 만들어 기존 탐색 경로로 요청한다. 실패하면 실패한 방위들과 90° 이상 떨어진 방위로 다시 시도하며, 최대 3회까지 한다. 3회 모두 실패하면 「이 근처에서 경로를 찾지 못했어요. 출발지를 바꿔 다시 시도하세요」를 보여 주고 끝낸다. 진행 중에는 「목표 X km 경로를 찾는 중입니다…」 안내를 기존 상태 문구 자리에 띄운다.
   - `handleMapPick`은 팝업 바인딩·모드 상태를 요구한다. 그 상태를 흉내 내지 말고, 같은 요청·적용 코드를 쓰는 진입 함수(예: `searchTowardPoint(start, point, km)`)를 훅에 추가해 `handleMapPick`과 함께 쓰게 한다. 요청 코드를 복사해 두 벌로 만들지 않는다.
   - 이동수단(profile)은 이어 달리기와 같은 승계 규칙(`resolveRideContinuationSetup`)을 따른다.
5. **완료 상태:** 경로가 적용되면 인터벌을 켠다(`onEnabled(true)`, 저장된 설정 그대로 사용). RouteDock은 기존처럼 주행 버튼이 보이는 상태로 둔다. **주행을 자동으로 시작하지 않는다.**
6. **기존 경고와의 관계:** 여유분 1.3배 덕분에 보통은 「운동시간이 더 길어요」 경고가 뜨지 않는다. 이 경고 로직은 바꾸지 않는다.
7. **취소:** 탐색 중 메뉴를 닫거나 다른 경로 진입을 누르면 기존 `disarm`·요청 취소(`activeRequestIdRef`)로 정리한다. 늦게 도착한 응답이 새 상태를 덮으면 안 된다.

## 소유권·금지

- 수정 가능: MenuPanel/RideRoutePanel 등 왼쪽 메뉴 컴포넌트와 CSS, `App.tsx`, `useDistanceAutoRoute.ts`, 새 순수 함수 모듈(`apps/web/src/lib/ride/quickIntervalRoute.ts` 권장), 관련 e2e·preview·`scripts/ride-verify/entry-contract.mjs`, 새 단위 시험.
- 금지: `functions/`·Rules·토큰 경제·비용·동기화 변경, Firestore 저장 형식 변경, 주행 자동 종료나 경로 자르기(2단계 범위), 게이트·래칫 완화, 기존 시험 삭제·완화, 기존 증거 덮어쓰기. git worktree/restore/clean/stash/브랜치 전환/커밋/푸시/배포 금지. 다른 작업의 미커밋 변경을 되돌리거나 덮어쓰지 않는다. HANDOFF·고정 목록·ops 최종 문서는 Supervisor 소유라 수정하지 않는다(02 결과만 작성).
- 서버: 3000(imgman)·기존 5031·5041 서버는 끄지 않는다. 시험은 별도 포트를 쓴다. `npm run dev`는 운영 Firebase에 쓰므로 실제 탐색 시험은 에뮬레이터나 함수 응답 스텁으로 한다.

## 디자인 고정 (건드리면 FAIL)

[고정 목록](../../reference/product/261024-RTW-Chief-지정-디자인-고정.md) 기준:
- 14: 반달 20.4×43.2, 터치 44×76, 탭 전용, 가장자리 위치·캐럿·색 유지
- 16: SpinatlasMark 브랜드 정본
- 5/6: 목록 흰색 불투명, 어두운 글자, 경로 한 줄
- 18/42: 왼쪽 메뉴의 경로 선택 한 줄과 인터벌 독립 행 위치 유지. 새 행은 그 아래에 추가만 한다
- 31/32/48: 인터벌 안내 위치·배경, 인터벌 설정 창, 경로시간 경고·INT 진입 유지
- 앱은 폰 가로 전용이다. 가로 800×360 기준으로 맞춘다

새 행 추가는 이번 Chief 지시에 따른 것이다. 고정 목록 한 줄 추가는 Supervisor가 감리 후 한다.

## 검증

실행 폴더: `C:\20.HDev\boxcycle\apps\web`

1. 단위 시험 `scripts/quick-interval/quick-interval-route.test.ts`를 새로 만든다. 확인할 것:
   - 15분 → 8.1 km(15/60 × 25 × 1.3 = 8.125, 반올림). 거리 부족 안내의 최소 거리(6.3 km)보다 항상 길다. 하한 0.5, 상한 120 적용
   - 기준 속도 함수 값을 바꾸면 목표 거리도 따라 바뀐다(25를 직접 적지 않았는지 확인)
   - 방위 재시도: 실패 방위와 90° 이상 떨어짐, 최대 3회, 난수를 주입해 결정적으로 시험
   - 일부러 틀린 구현(여유분 1.0, 재시도 무제한)을 넣었을 때 시험이 실패하는지 확인하고 결과에 적는다

   실행: `node --experimental-strip-types --test scripts/quick-interval/quick-interval-route.test.ts`
2. `ride-verify` 스킬과 `scripts/ride-verify/HARNESS.md`를 읽고, 새 행의 셀렉터를 entry-contract에 추가한다. 실행: `node scripts/ride-verify/verify-selectors.mjs`
3. e2e `e2e/quick-interval-ride.spec.ts`(1 worker, 0 retry, 함수 응답 스텁, 800×360). 시나리오 세 가지:
   - (a) 마지막 주행이 있음 → 클릭 없이 경로 적용·인터벌 켜짐·주행 미시작
   - (b) 기록 없음 → 안내 → 지도 클릭 → 경로 적용
   - (c) 3회 연속 실패 → 실패 안내, 요청 3회
   각 시나리오의 화면을 새 evidence 폴더(scratchpad 또는 이 묶음의 `evidence/`)에 캡처한다. 기존 `document/` 증거를 덮지 않도록 env를 확인하고, 시험 뒤 `git status`로 확인한다.
4. 관련 회귀 시험: `distance-route-continuation`, `interval-dock-confirm`, `ride-interval-settings`, 왼쪽 메뉴 관련 spec.
5. `npx tsc -b --noEmit`(`-p .`는 빈 검사라 쓰지 않는다), 바뀐 파일 eslint, `npm run build`.
6. 같은 증상에 5분 동안 진전이 없으면 서버·포트·로그를 확인하고 다른 경로로 바꾼다. 전체 e2e는 돌리지 않는다.

## 완료 조건

위 1~5가 PASS이고, (a)(b)(c) 캡처가 결과 파일에 경로와 함께 있어야 한다. 실폰·운영 Firebase 시험은 미실행으로 표시한다. Supervisor가 독립 검증한 뒤 Chief에게 캡처와 함께 보고한다.
