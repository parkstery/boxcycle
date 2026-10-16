# 결과 C1-R1 — 둥근 경로를 구간 평균으로

| 항목 | 내용 |
|---|---|
| 작성 | 2026-10-16 · Developer (Cursor) |
| 지시 | [02-task-c1-r1.md](02-task-c1-r1.md) · 원 지시 [02-task-c1.md](02-task-c1.md) |
| 브랜치 | `feat/rider-curve-sway` |
| Git | commit · push · 배포 없음. 브라우저·dev 서버 없음 |

## 한 줄

화면 위치는 경로 거리 ±4 m 구간의 연속 평균이고, 진행 방향은 그 구간 끝점의 현이다. 경로가 있는 방향의 스무더 τ 는 0.03 s 다. 꼭짓점 안쪽 거리는 1.414 m, 화면 드리프트는 2.44° 다. **기하 드리프트 최대 ≤ 0.5° 는 맞지 않았다.** 한 프레임(20 km/h · 60 fps) 전진 차분이 0.66° 다. 단언은 완화하지 않았다.

## 이어받은 작업트리

직전 실행이 메모리 부족으로 끊긴 뒤 남은 미커밋 diff 가 이미 아래 구현이었다. 이번 실행은 그 코드를 지시와 대조하고 검증만 돌렸다. 소스는 더 고치지 않았다. B(속도 비례 흔들림)는 C1 구현 그대로다.

`git diff --stat` (HEAD 대비, C1+R1 미커밋): 12 files, 511 insertions, 51 deletions. 새 lib 파일은 없다. `dep-layers.json` 등록 추가 없음.

## 변경

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/geo/geo.ts` | `smoothedRoutePoint` = 겹친 선분마다 `길이 × 중점` 을 합쳐 창 길이로 나눔. 끝이 잘리면 잘린 길이로 나눔. 좌표는 머캐이터. `smoothedCurveHeadingAtRouteDistanceMeters` 는 같은 h 의 `smoothedHeadingAtRouteDistanceMeters` 를 그대로 반환 |
| `apps/web/src/lib/rider/riderTurn.ts` | `RIDER_CURVE_HALF_SPAN_M = 4`. `RIDER_TURN_HEADING_TAU_ROUTE_S = 0.03`. `RIDER_TURN_HEADING_TAU_S = 0.15` 유지. `update` 의 다섯 번째 인자가 방향 τ. 기울기 τ 0.25 s · 상한 20° · `atan(v·ω/g)` 그대로 |
| `apps/web/src/components/map/MapView.tsx` | 경로 거리가 있으면 본인 마커·네임태그·3D 위치·카메라 추종 인자가 구간 평균. 카메라 함수는 수정하지 않음. 페이서 위치·차선도 같은 곡선. 경로 방위가 있으면 τ 0.03 s, 없으면 0.15 s. 페이서·동행 모델은 0.03 s |
| `apps/web/src/lib/peerMotion/PeerMotionRegistry.ts` | span > 0 이면 위치는 구간 평균, 방위는 끝점 현. `displayDistM` 은 경로 거리 그대로 |
| `apps/web/src/lib/peerMotion/peerRidersDrive.ts` | 주석. 호출부가 반경을 넘기는 구조는 유지 |
| `apps/web/src/lib/ride/pacer/pacerMotion.ts` | 주석. `PACER_HEADING_HALF_SPAN_M` 는 그대로 두고 MapView 는 읽지 않음 |
| `apps/web/scripts/rider/rider-turn.test.ts` | 구간 평균·끝점 현·τ·드리프트·지그재그. C1 중점(h=3, ε 0.5 m, τ 0.15 s)을 옆에 재현 |
| `apps/web/scripts/pacer/pacer-heading.test.ts` | 제품 반경 4 m 의 끝점 현. `0.05 m 당 3° 미만` 유지 |

C1 에서 이미 들어간 흔들림 파일(`riderSway.ts`, `iso2dMarker.ts`, `riderPreservedLayer.ts`, `rider-sway.test.ts`)은 이번 재지시에서 식을 바꾸지 않았다.

`peerMotion` 은 `rider` 를 import 하지 않는다. 반경 정의는 `riderTurn.ts` 한 곳이고, MapView 가 `headingHalfSpanM: RIDER_CURVE_HALF_SPAN_M` 을 넘긴다.

HUD 거리·진행률·정복·세션 거리는 `sampleLiveDistM` 과 `displayDistM` 을 그대로 둔다. 경로 거리가 없으면 위치·방위·τ 는 종전 GPS 경로다.

## 수치 (90° · 20 km/h · 60 fps)

같은 시험 로그:

```
corner90 step=1.32° elapsed=1.367s midLean=-18.78°
lean left=-19.93° right=19.93°
hairpin170 step=13.39°
metric | c1-midpoint | interval-mean
geometric-deg | 26.55 | 0.66
geometric-1mm-deg | | 0.0076
rendered-deg | 39.94 | 2.44
inset-m | 2.121 | 1.414
straight-off-m | | 0.0000
expect-inset-m | | 1.4142
continuity len=31.96 pos=0.0354 m turn=0.71°
continuity len=3.00 pos=0.0000 m turn=0.00°
```

| 측정 | C1 중점 (h=3, ε, τ 0.15 s) | 구간 평균 (h=4, 끝점 현, τ 0.03 s) | 한도 |
|---|---|---|---|
| 기하 드리프트 | 26.55° | **0.66°** | ≤ 0.5° — 미달 |
| 1 mm 이동의 기하 드리프트 | — | 0.0076° | 단언 아님. 도함수와 현이 맞는 증거 |
| 화면 드리프트 | 39.94° | **2.44°** | ≤ 3° — 통과 |
| 꼭짓점 안쪽 | 2.121 m | **1.414 m** | `h/(2√2)` = 1.4142 m ±0.05 — 통과 |
| 직선 이탈 | — | 0.0000 m | 코너 ±(h+1) m 밖, 1 cm — 통과 |
| 프레임당 회전 (90°) | — | 1.32° | ≤ 12° — 통과 |
| 코너 회전 시간 | — | 1.367 s | 0.5–3 s — 통과 |
| 기울기 | — | 좌 −19.93° · 우 +19.93° · 상한 20° | 부호 반대 · 상한 — 통과 |
| 헤어핀 170° | — | 13.39° / 프레임, NaN 없음 | ≤ 15° — 통과 |
| 2 m 지그재그 · 경로 끝 | — | NaN 없음. 0.05 m 당 위치 ≤ 0.0354 m, 방위 ≤ 0.71° | 튐 없음 — 통과 |

꼭짓점 기대값: 들어오는 구간 중점 `−h/2`, 나가는 구간 중점 `+h/2` 를 평균하면 `(−h/4, h/4)`. 꼭짓점까지 거리는 `(h/4)·√2` = `h/(2√2)`. h=4 이면 √2 m.

0.66° 는 구현이 현과 어긋나서가 아니다. 1 mm 전진 차분은 0.0076° 이고, 프레임 길이(약 9.26 cm)에 거의 비례한다. 90° 꼭짓점에서 순간 방향과 그 다음 한 프레임 위치의 차는 `Δ/(2h)` rad 이다. Δ = 20/3.6/60 m, h = 4 이면 약 0.66°. 반경 4 m · 20 km/h · 60 fps 를 유지하면 이 전진 차분은 0.5° 아래로 내려가지 않는다. `geometric <= 0.5` 단언은 실패로 남겨 두었다. 나머지 단언은 통과했다.

페이서 방위 시험: 0.05 m 당 최악 0.72° (허용 3° 유지). 세그먼트 대조 90.00°.

## 검증

작업 디렉터리 `apps/web`. PowerShell. 의존 방향만 저장소 루트. 명령은 포그라운드, 한 번에 하나씩.

| 명령 | exit | 요약 |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | 진단 없음 |
| `npx eslint` (변경 ts/tsx 12파일) | 0 | error 0. warning 8은 MapView 기존 `react-hooks/exhaustive-deps` |
| 루트 `node scripts/check-dep-direction.mjs --check` | **2** | M0 실패. `scripts/route-token/route-token-onboarding-grant.test.mjs` → `functions/lib/routeTokenCore.js` 없음. 미지정 lib 파일 0. `peerMotion` → `rider` import 없음. 새 파일 없음 |
| `npm run test:quick` | **1** | 통과 1137 · 실패 4. 22.3초. 아래 |
| `npm run test:peer-spacing` | 0 | GATE PASS. transitions requiredFail 0. residual requiredFail 0 |
| `npm run test:pacer` | 0 | 14 pass. 곡선 방위 worst step 0.72° |
| `npm run test:rider-preserve` | 0 | 44 pass + 계약 6 pass |
| `npm run build` | 0 | vite 성공. `SADDLE`/`PELVIS` import 경고는 기존 `riderRig.ts` |

`test:quick` 묶음: ride 756 pass · **1 fail**, route 159 pass · **3 fail**, map 68/0, peer 72/0, meters 58/0, tools 24/0.

route 3건은 지시가 예고한 `functions/lib` 부재다.

- `scripts/route-token/harness-active.test.mjs`
- `scripts/route-token/production-surface.test.mjs` — `functions/lib/index.js`, `functions/lib/index.harness.js` ENOENT

`route-token-onboarding-grant.test.mjs` 는 같은 이유로 건너뜀.

ride 의 1건은 `scripts/rider/rider-turn.test.ts` 「90° 코너에서 구간 평균 위치와 끝점 현이 어긋나지 않는다」. 꼭짓점·직선·화면 드리프트 단언은 통과한 뒤 `geometric 0.66°` 에서 실패. 같은 파일의 나머지(최단 각, 90° 프레임·시간·기울기, 좌우 부호, 170° 헤어핀, 지그재그·경로 끝, τ 0.03/0.15)는 통과.

그래서 `test:quick` 는 route 3건 외에 실패가 1건 더 있다.

브라우저와 dev 서버는 켜지 않았다.
