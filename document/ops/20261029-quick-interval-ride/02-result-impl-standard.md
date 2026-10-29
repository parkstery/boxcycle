STARTED 20:35 impl-standard (Claude)
DONE src/lib/route/intervalRouteDistance.ts, src/lib/ride/quickIntervalRoute.ts / NEXT scripts/quick-interval/quick-interval-route.test.ts
DONE src/hooks/useDistanceAutoRoute.ts, src/components/map/mapRoutePickGesture.ts, MapView.tsx (start-mode short tap) / NEXT src/hooks/useQuickIntervalRide.ts
DONE src/hooks/useQuickIntervalRide.ts, src/components/ride/QuickIntervalStatus.tsx/.css / NEXT RideRoutePanel row + CSS + App wiring
DONE RideRoutePanel.tsx/.css, App.tsx (tsc -b OK) / NEXT entry-contract.mjs, preview harness, e2e
DONE entry-contract.mjs, scripts/quick-interval/quick-interval-runtime.*, e2e/quick-interval-ride.spec.ts / NEXT run e2e
DONE e2e quick-interval-ride 3 passed; screenshots in evidence/ / NEXT regression specs, unit tests, tsc, eslint, build
DONE 회귀 e2e 29 passed, tsc/eslint/build/verify-selectors PASS / NEXT (완료 — 결과 정리)

# 결과 요약 (impl-standard, Claude)

## 바뀐 파일 (apps/web 기준)
- 신규 src/lib/route/intervalRouteDistance.ts — INTERVAL_ROUTE_BASIS_KMH=25, resolveIntervalBasisKmh() 만
- 신규 src/lib/ride/quickIntervalRoute.ts — 여유분 1.3, 최대 3회, 목표 km(0.5~120, 0.1 반올림), 방위 재시도(90° 이상, 난수 주입), 시도 루프 runQuickIntervalAttempts
- 신규 src/hooks/useQuickIntervalRide.ts — 순서 담당(출발점 결정, 탐색 루프, 성공/실패 상태). 요청·적용은 useDistanceAutoRoute 것을 그대로 호출
- 수정 src/hooks/useDistanceAutoRoute.ts — handleMapPick 의 요청·적용 본문을 searchTowardPoint 로 추출(handleMapPick 도 그것을 호출, 복사 없음), armStartPick 추가(pick_start 대기, 클릭 시 onPicked 로 바로 탐색), disarm 이 대기 콜백도 정리
- 수정 src/components/map/mapRoutePickGesture.ts, MapView.tsx — pick_start(mapPickMode "start") 짧은 탭을 onAutoRouteMapPick 으로 전달하는 onStartShortTap 추가(이전엔 start 모드 탭 처리가 없었음. 기존 direction 경로·소스 정규식 단언 문자열은 그대로)
- 수정 src/components/ride/RideRoutePanel.tsx/.css — 「인터벌」 아래 「간편 인터벌 주행」 행(같은 행 클래스·34px), 비활성 사유는 title, :disabled 스타일 추가
- 신규 src/components/ride/QuickIntervalStatus.tsx/.css — 지도 위 한 줄 안내(role=status)
- 수정 src/App.tsx — prepareQuickIntervalStart(이어 달리기와 같은 정리·resolveRideContinuationSetup 승계·armDirectionPick), useQuickIntervalRide 연결, 행 props, 안내 배너, 성공 시 handleRideIntervalEnabled(true)(주행 자동 시작 없음)
- 수정 scripts/ride-verify/entry-contract.mjs — quick-interval-menu-row 단계 추가(셀렉터 getByRole('button',{name:'간편 인터벌 주행',exact:true}))
- 신규 scripts/quick-interval/quick-interval-route.test.ts, quick-interval-runtime.html/.tsx(e2e 하네스: 실제 hook+MapView+메뉴 행), e2e/quick-interval-ride.spec.ts

## 실행 명령과 결과
(apps/web, PATH 에 /c/Program Files/nodejs 앞세움, RTW_DEV_PORT=5045)
- node --experimental-strip-types --test scripts/quick-interval/quick-interval-route.test.ts — PASS 13/13
  - 사보타주: 여유분 1.3→1.0 이면 4 fail, 시도 상한 3→10 이면 1 fail, 원복 후 13/13 pass
- 기존 단위(관련 파일 변경 보호): distance-auto-route-click-intent·contract, map-route-pick-gesture, ride-continuation-setup-contract — 105/105 PASS
- npx playwright test e2e/quick-interval-ride.spec.ts --workers=1 --retries=0 — 3 passed
- 회귀: distance-route-continuation, interval-dock-confirm, ride-interval-settings, left-menu-supervisor — 29 passed
- npx tsc -b --noEmit — exit 0
- npx eslint(바뀐 파일) — 0 errors, 17 warnings(App.tsx 7=기존 그대로, MapView.tsx 10=기존)
- node scripts/ride-verify/verify-selectors.mjs — 21단계 전부 유효
- npm run build — 성공(청크 크기 경고만)

## 캡처 (C:\20.HDev\boxcycle\document\ops\20261029-quick-interval-ride\evidence\)
a-menu-800x360.png, a-route-applied-800x360.png, b-pick-start-800x360.png, b-route-applied-800x360.png, c-failed-800x360.png

## 계획과 다른 점 / 확인 필요
1. recentSessionsLoading 대기: 「기다린다」 대신 로딩 동안 행을 비활성화(title 에 「최근 주행 기록을 불러오는 중이에요」). 효과 안에서 setState 를 피하려는 선택. 필요하면 대기 후 자동 진행으로 바꿀 수 있음.
2. 진행·실패 문구 자리: 기존 상태 문구(경로창 inline)는 지도 클릭 콜백 때만 갱신되고 팝업이 없으면 보이지 않아, 지도 위 별도 한 줄 배너(QuickIntervalStatus)에 「목표 X km 경로를 찾는 중입니다…」·「출발 위치를 맵에서 클릭하세요」·실패 문구를 띄움. 실패 배너는 닫기 버튼 + 8초 뒤 자동 소멸. 위치·스타일은 새로 정한 것이라 Chief 디자인 확인 필요.
3. 성공·실패 후 useDistanceAutoRoute.disarm() 호출(성공 시 방향 클릭 모드가 남아 지도 탭이 재탐색되는 것을 막음). 일반 방향 클릭 흐름은 그대로.
4. 새 순수 모듈은 node strip-types 단독 실행을 위해 내부 import 에 .ts 확장자를 붙임(tsconfig allowImportingTsExtensions 허용, tsc·build 통과). 기존 src 는 확장자 없음 — 스타일 차이.
5. e2e 는 App 전체가 아닌 하네스(실제 hook·MapView·RideRoutePanel 사용, prepareStart 만 하네스용 단순 구현)로 검증. App.tsx 의 prepareQuickIntervalStart 실경로는 tsc·eslint·셀렉터 계약으로만 확인, 실제 App+에뮬레이터 시험은 NOT RUN. 실폰·운영 Firebase 시험도 NOT RUN.
6. 회귀 spec(left-menu-supervisor) 실행 중 기존 증거 document/ops/20261029-left-menu/evidence/interval-custom-699x273.png 가 덮여서, git show HEAD:<경로> 내용으로 되돌림(git restore 아님). git status 상 그 파일은 다시 변경 없음.
7. Route Token 부족 시 searchTowardPoint 가 요청 없이 failed 를 3번 돌려줄 수 있으나, 행이 이미 비활성이라 도달하기 어려움.

## 재작업 1
STARTED 20:52 impl-standard (Claude)
DONE App.tsx(3790줄, beginRouteFromAnchor 공통화), useQuickIntervalRide(목표km·비활성사유 이동), QuickIntervalStatus(폭·failed prop), 하네스 / code-tidy PASS(exports 186) / NEXT live spec
DONE e2e/quick-interval-live.spec.ts (written) / NEXT run live
DONE live spec 2/2 PASS(캡처 evidence/live/ 6장), 배너 top 44px·한 줄 / NEXT 최종 재검증 일괄
DONE 재검증 일괄 / NEXT (완료)

### 재작업 1 결과
- App.tsx 3790줄(기준 3807 이내, HEAD 3736 대비 +54). 이어 달리기·간편 인터벌이 공통 beginRouteFromAnchor(App.tsx) 하나를 씀. 목표 km 계산·비활성 사유·메뉴 닫기 콜백 인자는 useQuickIntervalRide 로 이동.
- knip exports 186(미사용 export 3개를 비공개로). code-tidy 통과, check:dep 통과.
- live spec e2e/quick-interval-live.spec.ts(실제 App+Mapbox+에뮬레이터, getDistanceAutoRoute 만 스텁): 2/2 PASS. 게스트 Route Token 때문에 행이 비활성인 일은 없었음(행 enabled 확인).
  - (b) 기록 없음 → 안내 → 지도 클릭 → 요청 1회 → 경로선·S/E, INT 켜짐, 주행 종료 버튼 없음(미시작)
  - (a) 50km/h 15초 주행(100m 초과라야 기록됨) 후 메뉴 → 클릭 없이 요청 1회, 출발지가 첫 출발지와 다름
  - 실패 배너 한 줄(텍스트 높이<20), 800×360·667×300 에서 .map-hud__tr 와 겹침 없음(top 44px, 폭 419)
  - 캡처: evidence/live/ b1-menu, b2-pick-start, b3-route-applied, a1-route-from-last-ride, c1-failed-banner-800x360/667x300
- 스텁 주의: prewarm 요청(targetRoadPoint 없음)은 세지 않고 빈 응답. 스텁 경로 길이=목표 거리(1.4km 로 하면 「운동시간이 더 길어요」 경고창이 떠 주행이 안 시작됨).
- 결과 시트 닫기: 일반 click 이 detached 재시도만 해서 DOM click 폴링으로 닫음(정정: 「저장 안 함」은 내 경로 저장만 건너뛰고 Ride 기록·다음 출발점은 남는다 — RideSummarySheet 주석 기준. 아래 재작업 2 참고).
- 검증: tsc -b 0, eslint 0 errors/17 warnings(기존), verify-selectors 21단계(contract 앵커를 새 App 연결에 맞춤), test:quick 1467/0, build OK, e2e quick-interval-ride 3 + 회귀 4종 = 32 passed. left-menu 증거 덮어쓰기 없음(git status 깨끗).

## 재작업 2
STARTED 22:17 impl-standard (Claude)
DONE e2e/quick-interval-live.spec.ts 결과 시트 닫기 수정 / NEXT 완료

### 재작업 2 결과
- 수정(시험 코드만): adhoc 결과 시트의 `getByRole('region',{name:'주행 결과'})` 안 「저장 안 함」 버튼이 보일 때까지 기다린 뒤 일반 click(force·DOM click 없음), region 이 사라질 때까지 대기. 이어서 메뉴 → 간편 인터벌 주행 → 클릭 없이 요청 1회, 출발지가 첫 출발지와 다름을 확인.
- 정정: 「저장 안 함」은 내 경로 저장만 건너뛰고 Ride 기록과 다음 출발점은 남는다. (a)가 그 상태에서 통과하므로 제품 문제 없음. 앞 절의 「저장 안 함 → 기록 안 남음」 문장은 틀렸다.
- 검증(apps/web, RTW_DEV_PORT=5046, --reporter=line): live spec 연속 2회 모두 2 passed (1.2m, 1.3m). eslint 바뀐 파일 0 error/0 warning.
