# 코너에서 라이더가 부드럽게 돌고 안쪽으로 기울기 — 계획

| 항목 | 내용 |
|------|------|
| 문서 유형 | **작업 계획(ops)** |
| 최초 작성 | 2026-10-16 |
| 상태 | `진행` — Chief 지시 2026-10-16 |
| 역할 | Supervisor = Claude · Developer = Cursor Agent CLI · Chief = 육안 |
| 작업 위치 | worktree `C:\20.HDev\boxcycle-turn`, 브랜치 `feat/rider-smooth-turn`(기준 `main2` `a0dd4e3`) |

## 0. Chief 요청

> 경로가 90° 로 꺾이는 곳에서 라이더가 단숨에 휙 꺾는다. 부드럽게 회전하면 좋겠다. 몸도 안쪽으로 기우는 것이 자연스러운데 가능한가?

## 1. 원인 (Supervisor 조사)

| 라이더 | 방향 계산 | 위치 | 코너에서 |
|---|---|---|---|
| 본인 | `resolveRiderBearingDeg(route, pos, prev)` = 직전→현재 위치 방위 (`geo.ts` 295) | 경로 선 위 | 꼭짓점을 지나는 **한 프레임에 90°** |
| 동행 | `headingAtRouteDistanceMeters` = 현재 구간 방향 (`PeerMotionRegistry.ts` 311) | 경로 선 위 | **한 프레임에 꺾임** |
| 페이서 | `smoothedHeadingAtRouteDistanceMeters(±3 m)` (`MapView.tsx` 2452) | 경로 선 위 | 6 m 에 걸쳐 돎(짧음) |

기울기: 본인만 `leanTarget = clamp(±10°, Δbearing/dt × 0.22)`, τ 0.35 s (`MapView.tsx` 2610–2620). 방향이 한 프레임에 튀므로 기울기는 한 프레임 스파이크 후 감쇠 → 눈에 거의 안 보였다. 동행·페이서는 기울기 없음.

렌더러: 레이어가 `spec.bearingDeg`(yaw) 와 `spec.leanDeg`(진행축 x 롤, 지면 원점)를 받는다. 흔들림의 자전거 롤도 같은 축에 더해진다 → 기울기는 `leanDeg` 하나로 모든 라이더에 줄 수 있다.

## 2. 설계

### 2.1 방향 — 경로 앞뒤 두 점(chord)

- 경로 위 거리 `d` 를 아는 라이더(본인: `sampleLiveDistMRef`, 동행: `entity.displayDistM`, 페이서: `along`)는 모두 `smoothedHeadingAtRouteDistanceMeters(route, d, HALF_SPAN)` 로 방향을 정한다. 90° 코너에서 방향이 `2·HALF_SPAN` 미터에 걸쳐 돈다.
- `RIDER_TURN_HALF_SPAN_M = 5`(새 상수 한 곳). 페이서도 같은 상수로 통일(기존 3 m). 20 km/h 에서 90° 를 약 1.8 s 에 돈다.
- 경로 거리를 모르는 경우(GPS 야외 주행 등)는 지금 식(`resolveRiderBearingDeg`)을 유지.

### 2.2 방향 — 각속도 상한 (안전망)

라이더 id 별로 화면 방향을 목표 방향 쪽으로 각도 차이만큼 지수 추종(τ 0.15 s, 최단 각 경로, 360° 랩 처리). 경로 데이터가 튀거나 GPS 일 때도 한 프레임 꺾임을 막는다. 순수 함수/작은 클래스로 분리(`riderTurn.ts`).

### 2.3 기울기 — 물리식

- 각 라이더의 (스무딩된) 방향 변화율 ω(rad/s)와 속도 v(m/s)로 `lean = atan(v·ω / g)`, g = 9.81. 오른쪽으로 돌면 오른쪽으로 기운다(부호는 W2 육안으로 확정).
- 화면용 상한 **±20°**, 기울기 자체도 τ 0.25 s 로 추종(들어갈 때·나올 때 부드럽게).
- 속도: 본인은 `liveRiderMotionRef.speedKmh`, 동행은 `entity.speedMps`, 페이서는 페이서 월드 속도(없으면 프레임 간 경로 거리 변화 / dt).
- 본인·동행·페이서 **모두** `leanDeg` 를 넘긴다. 기존 본인 기울기 식은 이 식으로 교체.
- 참고값: 20 km/h, 반경 5 m 코너 → 물리 30° → 상한 20°. 직선에서는 0.

### 2.4 범위 밖

카메라 추종의 회전 스무딩(카메라는 별도 `cameraSmooth` 경로가 있음)은 건드리지 않는다. 결과에서 카메라가 코너에서 튀는지 관찰만 적는다. 경로 위치 자체(코너 안쪽으로 파고드는 궤적)는 바꾸지 않는다.

## 3. 단계와 게이트

| 단계 | 내용 | 게이트 |
|---|---|---|
| **T1 구현** | 2.1–2.3 + 시험 | tsc 0, 변경 파일 eslint 0, `npm run test:quick`·`test:pacer`·`test:rider-preserve`·`rider-detail-lod` 계약 통과. 신규 시험: 90° 코너 합성 경로에서 프레임당 방향 변화 최대 ≤ 12°(60 fps·20 km/h), 코너 통과 시간 1–3 s, 기울기 부호·크기·상한, 직선 0, 360° 랩 |
| **T2 육안** | 90° 코너가 있는 경로(입문 코스 또는 합성)에서 본인·페이서가 코너를 도는 연속 캡처(위·뒤 시점) 전후 비교 | Chief 육안 |
| **T3 배포** | 미리보기 → 병합·푸시·운영 | Chief 지시 |

## 4. 위험

| # | 위험 | 대응 |
|---|---|---|
| R1 | 동행 동기화 시험이 방향 값을 단언 | 시험이 깨지면 의미를 확인하고 새 규칙에 맞게 고친다(완화 금지) |
| R2 | 기울기 부호 반대 | T2 육안에서 확인, 부호 한 곳 |
| R3 | U턴 등 180° 에 가까운 꺾임에서 chord 방향이 불안정 | 시험에 170° 꺾임 케이스, 각속도 추종이 받아 줌 |
| R4 | 페이서 차선 오프셋(`offsetLngLatLateral(at, hdg, laneM)`)이 방향 변경으로 코너에서 다르게 보임 | 같은 함수로 계산하므로 오히려 부드러워짐. T2 관찰 |

## 5. 롤백

`RIDER_TURN_HALF_SPAN_M` 과 기울기 상한을 상수 한 곳에 둔다. 기능 전체는 커밋 revert.
