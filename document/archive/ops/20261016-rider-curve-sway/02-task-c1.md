# 지시 C1 — 코너 드리프트 제거(둥근 경로) + 속도 비례 흔들림

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — Cursor Agent CLI |
| 작업 위치 | `C:\20.HDev\boxcycle-curve` (브랜치 `feat/rider-curve-sway`, 기준 `main2` `c698abe`) |
| 결과 파일 | `C:\20.HDev\boxcycle-curve\document\ops\20261016-rider-curve-sway\03-result-c1.md` |
| 참고 | 코너 회전 묶음 `document/ops/20261016-rider-smooth-turn/`(01-plan, 03-result-t1), 흔들림 묶음 `document/ops/20261016-rider14-sway/01-plan.md` |

## A. 코너 드리프트 (Chief: "커브를 도는 과정에서 드리프트가 심하다")

**원인**: 방향은 경로 ±5 m chord(`smoothedHeadingAtRouteDistanceMeters`, `RIDER_TURN_HALF_SPAN_M`)로 코너 5 m 전부터 돌지만, 위치는 꺾인 경로 선 위(`getPointOnRouteByDistance`)를 그대로 간다 → 코너 앞뒤에서 몸 방향 ≠ 이동 방향 = 옆으로 미끄러짐.

**수정**: 위치도 둥근 곡선으로.
1. 새 순수 함수(예: `lib/geo/` 또는 `lib/rider/` — 기존 도메인 규칙에 맞게): `smoothedRoutePoint(route, d, halfSpanM)` = 경로 위 `d−h` 와 `d+h` 두 점의 **중점**(경로 끝 근처는 가능한 쪽으로 자름). 이 곡선은 직선에서는 원래 선과 같고, 코너에서 안쪽으로 둥글게 돈다.
2. **방향 = 그 곡선의 진행 방향**: `smoothedRoutePoint(d−ε)` → `smoothedRoutePoint(d+ε)` 방위(ε 0.5 m 정도). 기존 chord 방향 대신 이것을 `RiderTurnSmoother` 의 목표로 쓴다(스무더·기울기 식은 그대로 — 기울기는 이 곡선의 회전 속도로 자연히 계산됨).
3. 새 상수 `RIDER_CURVE_HALF_SPAN_M = 3`(위치·방향 공용). 기존 `RIDER_TURN_HALF_SPAN_M`(5)은 이 상수로 대체하거나 같은 값으로 정리 — 상수는 한 곳.
4. 적용 대상: **본인**(경로 거리 있을 때 — 라이더 렌더 위치·네임태그. 카메라가 따라가는 본인 위치도 같은 둥근 위치를 쓰는지 확인하고, 카메라 추종 대상만 바꾸고 카메라 코드 자체는 수정하지 않는다), **페이서**(`along` → 둥근 위치, 차선 오프셋은 둥근 방향 기준), **동행**(`PeerMotionRegistry` 위치를 둥근 위치로 — `peerMotion → rider` 의존 금지이므로 함수는 geo 쪽에 두거나 옵션으로 넘긴다).
5. HUD 거리·진행률·정복·세션 거리 등 **데이터 값은 바꾸지 않는다**(화면 위치만).
6. GPS 야외 주행(경로 거리 없음)은 지금 그대로.

**시험**: 90° 코너 합성 경로·20 km/h·60 fps 에서
- **드리프트 각 = |몸 방향 − 실제 화면 이동 방향| 최대 ≤ 1°**(수정 전 값도 같이 기록),
- 코너 꼭짓점에서 곡선 위치와 꼭짓점 거리 ≈ 3·√2/2 ≈ 2.1 m(±0.2),
- 직선 구간(코너 ±6 m 밖)에서 위치가 원래 선과 1 cm 이내,
- 기존 코너 시험(프레임당 회전 ≤ 12°, 기울기 부호·상한)과 헤어핀 시험 유지.

## B. 속도 비례 흔들림 (Chief: "속도에 따라 좌우 진폭이 변해야, 최고 속도 한계 필요")

1. `riderSway.ts` 에 `swaySpeedFactor(speedKmh)` = `clamp(speedKmh / 20, 0.3, 1.8)`(20 km/h 에서 1.0 = 현재 값). 상수 `RIDER_SWAY_REF_KMH = 20`, `RIDER_SWAY_MIN_FACTOR = 0.3`, `RIDER_SWAY_MAX_FACTOR = 1.8`.
2. 배율은 어깨 롤·자전거 롤·상하 bob 세 값에 곱한다. 라이더 id 별로 τ 1.0 s 지수 추종(속도 변화에 갑자기 튀지 않게). 기존 envelope(정지 시 0)와 곱한다.
3. 속도 전달: `RiderGlbModelSpec` 에 선택 필드 `speedMps?: number` 를 추가하고 MapView 가 본인·페이서·동행 spec 에 넣는다(코너 스무더용으로 이미 계산한 값 재사용). 레이어 render 루프에서 `computeRiderSway(…, envelope × factor)` 형태로 반영. 값이 없으면 배율 1.
4. 계약 시험 문자열(`preserved-layer-contract.test.mjs`) 유지.

**시험**: 배율 표(5→0.3, 12→0.6, 20→1.0, 35→1.75, 50→1.8), τ 추종, envelope 과의 곱, 속도 없음 → 1.

## 검증 (PowerShell, `apps/web`)

`npx tsc --noEmit -p tsconfig.app.json` · 변경 파일 eslint · **루트에서 `node scripts/check-dep-direction.mjs --check`(새 lib 파일은 `apps/web/dep-layers.json` 에 반드시 등록 — 지난 두 번 푸시 게이트에서 걸림)** · `npm run test:quick`(worktree route 3건은 `functions/lib` 부재 — 환경) · `npm run test:peer-spacing` · `npm run test:pacer` · `npm run test:rider-preserve` · `npm run build`. 브라우저는 꼭 필요할 때 하나만(dev 서버 5070, 끝나면 종료).

## 금지

카메라 코드·τ 변경, 동행 동기화 정책 변경, 데이터 거리 값 변경, 리그·LOD 변경, 기존 시험 완화, commit · push · 배포, 백그라운드 잔류.
