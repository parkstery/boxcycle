# 결과 C1 — 코너 드리프트 제거 + 속도 비례 흔들림

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-16 · Developer (Cursor) |
| 지시 | [02-task-c1.md](02-task-c1.md) |
| 브랜치 | `feat/rider-curve-sway` |
| Git | commit · push · 배포 없음. 브라우저·dev 서버 없음 |

## 한 줄

화면 위치는 경로 거리 ±3 m 두 점의 중점이고, 그 곡선의 진행 방위(±0.5 m)가 코너 스무더의 목표다. 꼭짓점 안쪽 거리는 2.121 m, 직선은 선 위다. **드리프트 최대 ≤ 1° 는 맞지 않았다.** 수정 전 44.36°, 곡선 방위 기준 26.55°, 스무더를 거친 몸 방향 기준 39.94°.

## 변경

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/geo/geo.ts` | `smoothedRoutePoint`, `smoothedCurveHeadingAtRouteDistanceMeters`, `SMOOTHED_CURVE_HEADING_EPSILON_M = 0.5`. 중점은 머캐이터 |
| `apps/web/src/lib/rider/riderTurn.ts` | `RIDER_TURN_HALF_SPAN_M`(5) 삭제. `RIDER_CURVE_HALF_SPAN_M = 3` 한 곳. 스무더·기울기 식·τ 그대로 |
| `apps/web/src/components/map/MapView.tsx` | 경로 거리가 있으면 본인 마커·네임태그·3D 위치·카메라 추종 인자를 곡선 점으로. 카메라 함수는 수정하지 않음. 페이서 위치·차선 오프셋도 곡선. spec 에 `speedMps` |
| `apps/web/src/lib/peerMotion/PeerMotionRegistry.ts` | span > 0 이면 위치·방위가 곡선. `displayDistM` 은 경로 거리 그대로. span 0 이면 종전 |
| `apps/web/src/lib/peerMotion/peerRidersDrive.ts` | 주석만. 호출부가 반경을 넘기는 구조는 유지 |
| `apps/web/src/lib/ride/pacer/pacerMotion.ts` | 주석만. `PACER_HEADING_HALF_SPAN_M` 는 그대로 두고 MapView 는 읽지 않음 |
| `apps/web/src/lib/riderPrototype/iso2dMarker.ts` | `RiderGlbModelSpec.speedMps?` |
| `apps/web/src/lib/riderPrototype/riderSway.ts` | `swaySpeedFactor`, `RiderSwaySpeedFollow`(τ 1 s) |
| `apps/web/src/lib/map/riderPreservedLayer.ts` | `computeRiderSway(…, envelope × factor)`. 속도 없으면 배율 1 |
| `apps/web/scripts/rider/rider-turn.test.ts` | 목표 방위를 곡선으로. 꼭짓점·직선·드리프트 단언 추가 |
| `apps/web/scripts/pacer/pacer-heading.test.ts` | 제품 방위로 교체. `0.05 m 당 3° 미만` 유지. 실측 2.86° |
| `apps/web/scripts/rider-preserve/rider-sway.test.ts` | 배율 표·τ·envelope 곱·속도 없음 |

`git diff --stat`: 12 files, 302 insertions, 44 deletions. 새 lib 파일은 없다. `dep-layers.json` 등록 추가 없음.

### 상수와 동행

`peerMotion` 은 `rider` 를 import 하지 못한다. 반경 정의는 `riderTurn.ts` 한 곳이고, MapView 가 `headingHalfSpanM: RIDER_CURVE_HALF_SPAN_M` 을 넘긴다. 레지스트리는 그 숫자로 `smoothedRoutePoint` 와 `smoothedCurveHeadingAtRouteDistanceMeters` 를 부른다.

HUD 거리·진행률·정복·세션 거리는 `sampleLiveDistM` 과 `displayDistM` 을 그대로 둔다. 경로 거리가 없으면(야외 GPS) 위치·방위는 종전 `sample` / `resolveRiderBearingDeg` 다.

페이서 차선은 곡선 방위(`hdg`)로 민다. 모델 `bearingDeg`·`leanDeg` 는 스무더 출력이다.

## 드리프트 게이트 — 미달

90° 합성 경로, 20 km/h, 60 fps. 같은 시험 로그:

`drift before=44.36° geometric=26.55° rendered=39.94° inset=2.121`

| 측정 | 값 | 뜻 |
|---|---|---|
| 수정 전 | **44.36°** | 꺾인 선 위 위치 + ±5 m 현 방위 vs 한 프레임 이동 |
| 곡선 방위 | **26.55°** | `smoothedCurveHeading`(ε 0.5 m) vs 곡선 점의 한 프레임 이동 |
| 화면 몸 방향 | **39.94°** | `RiderTurnSmoother` 출력 vs 그 이동 |
| 꼭짓점 거리 | **2.121 m** | `3·√2/2` ±0.2 안. 이 단언은 드리프트 단언보다 먼저 통과 |
| 직선 | 통과 | 코너 ±6 m 밖, 원래 선과 1 cm 이내. 같은 이유로 드리프트 단언 전에 통과 |

중점 곡선은 코너에서 현으로 잘린다. 진입·이탈(꼭짓점 ±3 m)에서 진행 방향이 한 프레임에 약 45° 꺾인다. ε 0.5 m 창은 그 꺾임 양쪽을 같이 보므로, 이미 한쪽으로 움직인 프레임과 최대 26.55° 벌어진다. 꺾임 ±0.8 m 밖에서는 같은 식으로 재면 기하 드리프트가 0.000006° 였다(별도 프로브, 단언은 아님).

몸 방향을 그 이동 방향에 1° 안으로 붙이면, 헤어핀(170°)에서 프레임당 회전이 기존 상한 15° 를 넘는다(ε 방위만으로도 프레임당 33.18°). 스무더(τ 0.15 s, 지시에서 변경 금지)가 그 점프를 받으면 프레임당 회전은 12°·15° 안에 남고, 대신 이동 방향과의 차가 39.94° 까지 벌어진다. 기존 코너 시험(프레임당 ≤12°, 1–3 s, 기울기 부호·상한, 헤어핀 ≤15°)은 스무더 출력으로 **통과**했다. ≤1° 단언만 실패한다. 단언은 완화하지 않았다.

## 흔들림

`swaySpeedFactor(speedKmh) = clamp(speedKmh / 20, 0.3, 1.8)`.

| km/h | 배율 |
|---|---|
| 5 | 0.3 |
| 12 | 0.6 |
| 20 | 1.0 |
| 35 | 1.75 |
| 50 | 1.8 |

라이더 id 별 τ 1.0 s. 처음 보는 id 는 목표 배율. 이후 지수 추종. `envelope × factor` 가 어깨 롤·자전거 롤·bob 에 같이 곱해진다. envelope 0 이면 세 값 모두 0. `speedMps` 가 없으면 배율 1.

## 검증

작업 디렉터리 `apps/web`. PowerShell. 의존 방향만 저장소 루트.

| 명령 | exit | 요약 |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | 진단 없음 |
| `npx eslint` (변경 ts/tsx 12파일) | 0 | error 0. warning 8은 MapView 기존 `react-hooks/exhaustive-deps`. 이번 줄 아님 |
| 루트 `node scripts/check-dep-direction.mjs --check` | **2** | M0 실패. `scripts/route-token/route-token-onboarding-grant.test.mjs` → `functions/lib/routeTokenCore.js` 없음. 미지정 lib 파일 0. `peerMotion → rider` 엣지 없음. 새 파일 없음 |
| `npm run test:quick` | **1** | 통과 1135 · 실패 4. 아래 |
| `npm run test:peer-spacing` | 0 | GATE PASS, transitions requiredFail 0, residual requiredFail 0 |
| `npm run test:pacer` | 0 | 14 pass. 곡선 방위 worst step 2.86°, 세그먼트 대조 90.00°. 허용 3° 유지 |
| `npm run test:rider-preserve` | 0 | 44 pass + 계약 6 pass |
| `npm run build` | 0 | vite 성공. `SADDLE`/`PELVIS` import 경고는 기존 `riderRig.ts` |

`test:quick` 묶음: ride 754 pass · **1 fail**(이번 드리프트 단언), map 68/0, peer 72/0, meters 58/0, tools 24/0. route 159 pass · **3 fail**.

route 3건은 지시가 예고한 `functions/lib` 부재다.

- `scripts/route-token/harness-active.test.mjs`
- `scripts/route-token/production-surface.test.mjs` — `functions/lib/index.js`, `functions/lib/index.harness.js` ENOENT

`route-token-onboarding-grant.test.mjs` 는 같은 이유로 건너뜀.

ride 의 1건은 `scripts/rider/rider-turn.test.ts` 「90° 코너에서 곡선 위치와 진행 방위가 어긋나지 않는다」. 꼭짓점·직선은 통과한 뒤 `drift 26.55° (before 44.36°)` 에서 실패. 같은 파일의 기존 4개(최단 각, 90° 프레임·시간·기울기, 좌우 부호, 170° 헤어핀)는 통과.

브라우저와 dev 서버는 켜지 않았다. 게이트가 합성 경로 수치이고, 그 수치가 이미 실패로 나와서다.
