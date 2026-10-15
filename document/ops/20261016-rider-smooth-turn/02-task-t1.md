# 지시 T1 — 코너 부드러운 회전 + 안쪽 기울기 구현

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — Cursor Agent CLI |
| 계획 | [01-plan.md](01-plan.md) — **먼저 전부 읽을 것** (원인 표·설계 §2) |
| 작업 위치 | `C:\20.HDev\boxcycle-turn` (브랜치 `feat/rider-smooth-turn`). 본 작업트리 `C:\20.HDev\boxcycle` 읽기만 |
| 결과 파일 | `C:\20.HDev\boxcycle-turn\document\ops\20261016-rider-smooth-turn\03-result-t1.md` |

## 만들 것

1. `apps/web/src/lib/rider/riderTurn.ts`(신규, 순수):
   - 상수 `RIDER_TURN_HALF_SPAN_M = 5`, `RIDER_TURN_HEADING_TAU_S = 0.15`, `RIDER_LEAN_MAX_DEG = 20`, `RIDER_LEAN_TAU_S = 0.25`.
   - `shortestAngleDeltaDeg(from, to)`(−180…180), `approachHeadingDeg(cur, target, dt, tau)`.
   - `physicalLeanDeg(speedMps, yawRateRadPerS)` = `atan(v·ω/9.81)` 를 도로, 상한 적용.
   - `class RiderTurnSmoother { update(id, targetHeadingDeg, speedMps, dtSec): { headingDeg, leanDeg }; prune(liveIds) }` — 처음 보는 id 는 목표 방향·기울기 0 에서 시작. 방향은 `approachHeadingDeg`, ω 는 스무딩된 방향의 프레임 변화율, 기울기는 `physicalLeanDeg` 를 τ 로 추종.
2. `MapView.tsx` 주행 틱(2580–2650 부근, `specs` 를 만드는 곳):
   - 본인: `sampleLiveDistMRef` 로 경로 거리가 있으면 `smoothedHeadingAtRouteDistanceMeters(route, d, RIDER_TURN_HALF_SPAN_M)`, 없으면 기존 `resolveRiderBearingDeg`. 그 값을 `RiderTurnSmoother` 에 넣어 `bearingDeg`·`leanDeg` 결정. **기존 `glbLeanDegRef` 식(×0.22, ±10°)은 이것으로 교체.**
   - 페이서: `PACER_HEADING_HALF_SPAN_M` 대신 `RIDER_TURN_HALF_SPAN_M`(페이서 차선 오프셋 계산에도 같은 방향 사용) → smoother 통과 → spec 에 `leanDeg`.
   - 동행: `PeerMotionRegistry` 의 `hdg` 계산을 `smoothedHeadingAtRouteDistanceMeters(routeGeometry, distM, RIDER_TURN_HALF_SPAN_M)` 로. MapView 에서 동행 spec 에도 smoother 를 통과시켜 `leanDeg` 를 넣는다(속도는 레지스트리 feature 에 없으면 프레임 간 `displayDistM` 차이/dt 로 — 필요한 최소 필드만 feature properties 에 추가).
   - smoother 는 MapView 에 1개(ref), 매 틱 끝에 `prune`.
   - `glb` 모드(`syncRiderGlbModels`)도 같은 spec 을 받으므로 함께 혜택 — 별도 처리 불필요, 동작 확인만.
3. 계약 시험이 MapView 에서 찾는 문자열(`preserved-layer-contract.test.mjs`: `phaseRev: liveCrankPhaseRevRef.current`, `id: "live-self"[\s\S]*?kind: "self"`, `id: f.properties.id[\s\S]*?kind: "peer"` 등)을 유지.

## 시험 (`apps/web/scripts/rider/rider-turn.test.ts` 신규 — 기존 시험 묶음 규칙에 맞는 위치·명령으로, `test:quick` 에 포함되게)

1. `shortestAngleDeltaDeg`: 350→10 = +20, 10→350 = −20, 180 경계.
2. 합성 경로: 동쪽 50 m → 북쪽 50 m(90° 좌회전). 20 km/h·60 fps 로 경로 거리를 진행시키며 `smoothedHeadingAtRouteDistanceMeters(±5 m)` → `RiderTurnSmoother`:
   - 프레임당 방향 변화 최대 ≤ 12°,
   - 방향이 90°→0° 로(북 기준 방위로 동=90, 북=0) 바뀌는 데 걸린 시간 1–3 s,
   - 코너 중간에서 |lean| ≥ 8°, 상한 20° 초과 없음, 직선 구간(코너 ±15 m 밖) |lean| < 0.5°,
   - 좌회전 lean 부호와 우회전 lean 부호가 반대.
3. 170° 꺾임(헤어핀) 경로에서 NaN 없음·방향 변화 최대 ≤ 15°/프레임.
4. 기존 `test:pacer`(페이서 방향 시험이 3 m 를 단언하면 새 상수에 맞게 갱신 — 완화 아님, 이유를 결과에 적기)·동행 시험이 통과.

## 검증 (PowerShell, `apps/web`)

`npx tsc --noEmit -p tsconfig.app.json` · 변경 파일 eslint · `npm run test:quick` · `npm run test:pacer` · `npm run test:rider-preserve` · `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-hierarchy/rider-detail-lod-contract.test.ts` · `npm run build`.

## 육안 준비 (T2 용, 이번에 캡처까지 해 둔다)

dev 서버 포트 **5070**(5060 은 Chrome 차단 포트). 실제 앱에서 게스트 → 입문 코스 주행(흐름은 `C:\20.HDev\boxcycle\apps\web\scripts\rider-preserve\.out\rider14\p6\sv-capture-app.mjs` 참고, 그 파일은 읽기만). 입문 코스에 뚜렷한 꺾임이 있으면 그 지점 통과 전후 0.2 s 간격 12장을 카메라 1(위)·2(뒤)로 찍어 `strip-*.png` 로 이어 붙인다. 주행 속도를 키우거나 코스 위치로 빨리 가는 방법이 앱·e2e 에 있으면 활용(앱 코드 수정 금지). 꺾임 지점까지 가기 어려우면 그 사실과 대안(예: 합성 경로 벤치 페이지)을 결과에 적는다. 끝나면 5070 서버 종료.

## 결과 파일

변경 파일·줄 수, 명령 exit code·요약, 시험 개수, 캡처 경로·관찰(기울기 방향이 코너 안쪽인지), 카메라 관찰, 남은 문제.

## 금지

경로 위치(궤적) 변경, 카메라 코드 변경, 리그·흔들림·LOD 변경, 기존 시험 완화, commit · push · 배포 · `npm install`, 백그라운드 잔류.
