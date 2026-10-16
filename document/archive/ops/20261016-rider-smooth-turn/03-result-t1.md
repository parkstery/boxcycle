# 결과 T1 — 코너 부드러운 회전 + 안쪽 기울기

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-16 · Developer (Cursor) |
| 지시 | [02-task-t1.md](02-task-t1.md) |
| 계획 | [01-plan.md](01-plan.md) |
| 브랜치 | `feat/rider-smooth-turn` |
| Git | commit · push · 배포 없음 |

## 한 줄

경로 거리로 현 방위(앞뒤 5 m)를 잡고, 라이더 id 마다 방향은 τ 0.15 s, 기울기는 `atan(v·ω/g)` 를 τ 0.25 s·상한 ±20° 로 추종한다. 본인·동행·페이서 spec 에 `bearingDeg`·`leanDeg` 가 들어간다. 위치·카메라·리그·흔들림·LOD 는 그대로다.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/rider/riderTurn.ts` | 신규 92줄. 상수 4개, `shortestAngleDeltaDeg`, `approachHeadingDeg`, `physicalLeanDeg`, `RiderTurnSmoother` |
| `apps/web/scripts/rider/rider-turn.test.ts` | 신규 132줄. `test:quick` 의 ride 묶음 (`scripts/test-quick.mjs` 에 `rider` 폴더 추가) |
| `apps/web/src/components/map/MapView.tsx` | diffstat 기준 +/− 합 86. 본인 현 방위, 페이서 현 반경 교체, 세 종류 모두 smoother, 틱 끝 `prune`. 기존 `glbLeanDegRef` 식(×0.22, ±10°, τ 0.35 s) 제거 |
| `apps/web/src/lib/peerMotion/PeerMotionRegistry.ts` | `headingHalfSpanM` 이 있으면 `smoothedHeadingAtRouteDistanceMeters`. feature 에 `speedMps`·`displayDistM` |
| `apps/web/src/lib/peerMotion/peerRidersDrive.ts` | 위 반경과 두 필드를 GeoJSON properties 로 전달 |
| `apps/web/src/components/map/riderDomMarkers.ts` | properties 에 선택 필드 `speedMps`·`displayDistM` |
| `apps/web/scripts/pacer/pacer-heading.test.ts` | 현 반경 입력을 `RIDER_TURN_HALF_SPAN_M` 로 교체. 단언 `0.05 m 당 3° 미만` 은 유지 |
| `apps/web/src/lib/ride/pacer/pacerMotion.ts` | `PACER_HEADING_HALF_SPAN_M = 3` 은 남김. MapView 는 더 이상 읽지 않음 |
| `apps/web/dep-layers.json` | `rider/riderTurn.ts` 를 rider 도메인에 배정 |

`git diff --stat` (추적 파일): 8 files, 118 insertions, 38 deletions. 신규 두 파일은 아직 untracked.

### 동행이 상수를 직접 import 하지 않는 이유

`peerMotion` 은 `rider` 를 import 할 수 없다 (`dep-layers.json`). 상수 정의는 `riderTurn.ts` 한 곳이고, MapView 가 `headingHalfSpanM: RIDER_TURN_HALF_SPAN_M` 을 `stepPeerDriveAndBuildGeoJson` 에 넘긴다. 레지스트리 호출은 `smoothedHeadingAtRouteDistanceMeters(routeGeometry, distM, span, routeLenM)`. span 이 0 이면 종전 구간 방위다.

페이서 차선 오프셋은 그 현 방위(`hdg`)를 그대로 쓴다. spec 의 `bearingDeg`·`leanDeg` 는 smoother 출력이다.

동행 속도는 feature 의 `speedMps`(엔티티 속도)를 쓴다. 그 값이 유한 수가 아니면 `displayDistM` 의 프레임 차이를 dt 로 나눈다.

계약 문자열이 남아 있다. `phaseRev: liveCrankPhaseRevRef.current`, `id: "live-self"` … `kind: "self"`, `id: f.properties.id` … `kind: "peer"`. `preserved-layer-contract` 가 통과했다.

## 검증

작업 디렉터리 `apps/web`. PowerShell.

| 명령 | exit | 요약 |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | 진단 없음 |
| `npx eslint` (위 변경 ts/tsx 8파일) | 0 | error 0. warning 8은 MapView 기존 `react-hooks/exhaustive-deps` (1767, 1784, 1802, 2939–2942, 2976). 이번 수정 줄이 아님 |
| `npm run test:quick` | **1** | 통과 1107 · 실패 3. 아래 |
| `npm run test:pacer` | 0 | 14 pass / 0 fail |
| `npm run test:rider-preserve` | 0 | 보존 모델 37 + 계약 6, 전부 pass |
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-hierarchy/rider-detail-lod-contract.test.ts` | 0 | 7 pass |
| `npm run build` | 0 | vite build 성공. `SADDLE`/`PELVIS` import 경고는 기존 `riderRig.ts` |

`test:quick` 묶음: ride 739/0 (71파일, `scripts/rider/rider-turn.test.ts` 포함), map 68/0, peer 72/0, meters 58/0, tools 11/0. route 만 159 pass · **3 fail**.

실패 3건은 이번 diff 밖이다. `functions/lib` 가 없다.

- `scripts/route-token/harness-active.test.mjs` — `Cannot find module '../../../../functions/lib/harnessActive.js'`
- `scripts/route-token/production-surface.test.mjs` — `functions/lib/index.js`, `functions/lib/index.harness.js` ENOENT

`route-token-onboarding-grant.test.mjs` 는 같은 이유로 건너뜀(기존 `test:quick` 규칙). functions 빌드는 이 지시 범위 밖이라 하지 않았다.

신규 `rider turn` 4개(별도 실행도 exit 0): 각도 최단 경로, 90° 좌회전(프레임당 ≤12°, 전환 1–3 s, 코너 \|lean\|≥8°, 상한 20°, 직선 \|lean\|<0.5°), 좌·우 부호 반대, 170° 헤어핀(NaN 없음, 프레임당 ≤15°).

페이서 방향 시험: 종전은 `PACER_HEADING_HALF_SPAN_M`(3 m)을 넣었다. 제품 현 반경이 5 m 로 바뀌어 시험 입력만 `RIDER_TURN_HALF_SPAN_M` 로 바꿨다. 허용 각 `worst < 3°`(0.05 m 마다)는 그대로다. 실측 smoothed worst step = 0.57°, 세그먼트 대조 = 90.00°. 완화가 아니다.

`node scripts/check-dep-direction.mjs --check` 는 지시 목록 밖이다. 돌려 보니 M0 실패: `scripts/route-token/route-token-onboarding-grant.test.mjs` → `functions/lib/routeTokenCore.js` 해석 실패. 이번 파일과 무관하고, 미배정 lib 파일은 0건이다. `peerMotion → rider` 엣지는 만들지 않았다.

## 육안 준비

dev 서버 `npx vite --port 5070 --strictPort --host 127.0.0.1`. 캡처 후 리스너(pid 33908)와 셸을 종료했고, 5070 LISTEN 은 없다.

입문 코스 꼭짓점 방위 차(구간 방위, 한 꼭짓점):

| 코스 | 길이 | 최대 꺾임 | 위치 |
|---|---|---|---|
| 서울 남산 | 413 m | −45° | 39 m |
| 파리 퐁뇌프 | 448 m | **+80°** | 140 m |
| 뉴욕 센트럴파크 | 453 m | +6° | 63 m |
| 암스테르담 폰델파크 | 2016 m | +98° | 749 m |

뚜렷한 꺾임이 있어 **Basic 2 · 파리 퐁뇌프**를 찍었다. 게스트 → 센서 없음 → 속도 20 km/h(기본 5) → 입문 → 파리. 뷰포트 1280×720. HUD 거리 0.13 km 부터 0.2 s 간격 12장. 카메라 2(뒤) 한 번, 카메라 1은 `20m 상공`까지 누른 뒤 한 번.

| 산출 | 경로 |
|---|---|
| 위 | `apps/web/scripts/rider-preserve/.out/turn/capture/strip-cam1.png` (원본 `cam1-00.png` … `cam1-11.png`, 거리 0.13→0.20 km) |
| 뒤 | `apps/web/scripts/rider-preserve/.out/turn/capture/strip-cam2.png` (원본 `cam2-00.png` … `cam2-11.png`, 거리 0.13→0.19 km) |
| 기록 | `apps/web/scripts/rider-preserve/.out/turn/capture/capture-report.json`, 절차 같은 폴더 `capture-turn.mjs` (git 제외 폴더로 이동 — Supervisor) |

같은 파리 기하를 20 km/h·60 fps 로 `RiderTurnSmoother` 에 넣으면(캡처와 별개인 순수 재생) 프레임당 방향 변화 최대 0.94°, 기울기 피크 **+19.97°** 가 145.5 m. 140 m 에서 +18°, 152 m 에서 +2.6°, 158 m 에서 0.2°. 부호는 시계 방향(이 코스는 방위 51°→132°, 우회전)에서 양수다.

정지 화면에서 본 것:

- 위(20 m): 0.13 km 프레임의 라이더는 강변 도로를 비스듬히 보고, 0.18 km 프레임에서는 북쪽 도로와 나란하다. 0.2 s 간격 12장 안에서 한 장에 휙 꺾이는 컷은 보이지 않았다.
- 뒤: 같은 구간에서 시점이 옆모습에서 등 뒤로 돌아온다. 이것은 라이더 yaw 와 별도로 따라가는 카메라다. 카메라 코드는 수정하지 않았다. 코너에서 카메라가 한 프레임에 튀는지는 이 0.2 s 표본만으로 단정하지 않는다. 옆에서 뒤로 이어지는 회전은 보였다.
- 기울기: 0.14 km 부근 등 뒤 프레임에서 본인(주황)이 오른쪽으로 약간 기울어 보인다. 방향은 우회전의 안쪽과 같다. 20° 까지 기운 것으로 읽히지는 않는다. 피크가 약 140–146 m(HUD 0.14–0.15 km)에 몰려 있고, 12장이 0.13–0.19 km 를 덮어 대부분의 장이 피크 밖이다. 카메라 2 피치 83.5°·방위 오프셋 7.5° 라 롤이 정면 뒤로 보이지도 않는다.

## 남은 문제

- 기울기 부호(시계 방향 = 양수)와, 20° 가 화면에서 안쪽 기울기로 충분한지는 T2 육안이 확정할 일이다. 축을 뒤집지 않았다.
- `PACER_HEADING_HALF_SPAN_M`(3)은 죽은 수출로 남아 있다. ride 가 rider 를 import 할 수 없어 5 m 상수에 묶지 않았다.
- `test:quick` 의 route 토큰 3실패와 `check-dep` M0 은 `functions/lib` 부재. 이번 변경이 아니다.
- 폰델파크 +98°(749 m)는 찍지 않았다. 90° 에 더 가깝지만 20 km/h 로 약 2분이 더 걸린다.
