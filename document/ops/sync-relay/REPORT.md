# S4-1 REPORT — route 발행 in-flight 제거 (Firestore 쓰기 폭주)

같은 트레일을 달릴 때 Firestore에 진행률을 초당 네다섯 번 쏟아붓던 것이, 이제 약 초당 한 번(heartbeat 기대)으로 줄었다. 겹쳐 나가던 쓰기가 사라져 쓰기 왕복 시간도 수 초에서 수백 밀리초로 짧아졌다. 동행(peer) 위치 정확도와 멀리서 보이는 주행자 점(spectator)은 나빠지지 않았고, spectator는 오히려 더 가깝게 따라온다.

- **지시번호**: S4-1
- **일시**: 2026-08-12
- **브랜치**: `fix/multiplayer-position-sync` · 제품 HEAD `54810f4` (③ 계측 커밋 전)
- **e2e**: before **1.4·1.3·1.3 분** · after **1.3·1.4·1.3 분** (합계 **~8.0 분**)
- **보존**: `S41-before-run{1,2,3}-events.json` · `S41-after-run{1,2,3}-events.json` · `S41-summary.json`

---

## 반증 — §4

**해당 없음(겹침→RTT 예측은 성립).** before Firestore write RTT p50 **2380 ms** → after **159 ms**. 같은 런 RTDB RTT는 ~170→~179 ms로 거의 그대로다. 쓰기 건수와 RTT가 함께 줄었다.

---

## UAG — §3 가~사

**S4-1 PASS(route 쓰기 폭주 제거) · 정확도 유지**

| 항목 | 결과 |
|---|---|
| **가** FS route 쓰기 after/before ≤0.5 · cruise ≈1 Hz | **PASS** (전체 비 **0.24** · cruise **0.95**/s) |
| **나** route in-flight max ≤1 (after 3런) | **PASS** (1·1·1 · before **45·59·64**) |
| **다** pt9 ok=0 · pt3 ok=0 | **PASS** (전부 0) |
| **라** z15 정확도 3런 중앙값 | **PASS** (depart **300** · cruise **260**) |
| **마** 경로 B ≤57.0 / 87.0 | **PASS** (p50 **1.65** · max **13.9**) |
| **바** motion 가드 · publishQueue · d0/d1 | **PASS** |
| **사** RTDB 쓰기 after/before ≤1.3 | **PASS** (비 **0.98**) |

---

## 기술

### 구현 (커밋 3 분할)

| # | 해시 | 내용 |
|---:|---|---|
| ① | `bdcad6d` | pt11 touch 쓰기 계측 · pt9 route in-flight 계수 (동작 변경 없음) |
| ② | `54810f4` | `routePublishFlight.ts` single-flight + latest-wins · `markRouteProgressPublished`를 write start로 · 실패는 pt9 ok=0 + `onRouteError` |
| ③ | *(본 커밋)* | e2e 6런 · `s41-summarize.mjs` · 보고 |

motion 경로·heartbeat 상수·발행 스냅샷 산식 미변경. F-2(삼킴) 재발 없음 — route catch에서 pt9 ok=0 방출 후 `onRouteError`로 표면화.

### 쓰기량 · RTT (3런 중앙값)

| | before | after | 비 |
|---|---:|---:|---:|
| FS route 전체 /s | 4.24 | **1.03** | **0.24** |
| FS depart /s | 6.35 | 1.11 | 0.17 |
| FS cruise /s | 1.31 | **0.95** | 0.72 |
| RTDB /s | 5.14 | 5.03 | 0.98 |
| FS RTT p50/p95/max | 2380 / 6723 / 7724 | **159 / 413 / 785** | — |
| RTDB RTT p50 | 170 | 179 | 대조군 |

### route in-flight max

| phase | run1 | run2 | run3 | max |
|---|---:|---:|---:|---:|
| before | 45 | 59 | 64 | **64** |
| after | 1 | 1 | 1 | **1** |

### z15 (after 3런 · 중앙값 판정)

| 구간 | D_eff | RMSE | max | 스케일 |
|---|---:|---:|---:|---:|
| depart | **300** | 0.480 | 2.371 | 0.18 % |
| cruise | **260** | 0.309 | 1.160 | 0.97 % |

after run1 depart residual max **4.93** 은 단일 런 예산 초과이나, Chief 3런 중앙값 규칙으로 PASS (중앙 max 2.371).

### 경로 B (spectator · S3B-3 기준선 대비 악화 금지)

| | p50 | max |
|---|---:|---:|
| S3B-3 기준선 | 57.0 | 87.0 |
| S4-1 after 중앙 | **1.65** | **13.9** |

쓰기 RTT가 줄면서 Firestore 1 Hz 행이 덜 낡아져 개선됐다. 이번 목표(악화 금지)를 넘어서는 부수 효과다.

### pt11 (판정 미사용 · S4-3 이월)

touch 쓰기 /s: before **5.03** → after **1.04** (route 가드에 종속되어 함께 줄음 — touch 자체 수정 없음).

### 가드

after 3런 전부: motion inFlightMax ≤1 · A_firstOutOfOrder 0 · 전진 폐기 0 · publishQueue p50≤150 · d0/d1 PASS 유지.

### 이견 · 미완

없음. S4-2(읽기 증폭)·S4-3(touch·heartbeat)·F-1·F-2(motion)는 이번 범위 밖.
