# S3B-3 REPORT — D-2 저줌 적분 + spectator 실제속도 + 시간 기준

지도를 축소했다가 다시 확대하면 동행 라이더 스프라이트가 한꺼번에 앞으로 튀어 나오던 현상이 줄었다. 저줌 동안에도 위치 적분은 계속되고, 복귀 직후에는 이어서 달리는 모습으로 붙는다.

같은 트레일에서 멀리 보이는 다른 주행자 점(spectator dot)은 예전에는 서버·로컬 시계가 섞인 채 고정 속도로 밀려 보이다가 갑자기 따라붙는 느낌이 있었다. 이제는 행이 도착한 시각을 기준으로 실제 주행 속도만큼만 잠깐 외삽하고, 너무 오래된 위치는 더 이상 코스 끝까지 달리지 않는다.

z15 동행(peer RTDB) 경로는 이번 변경 전후로 같은 하네스·같은 3 런 중앙값 기준을 유지했다.

- **지시번호**: S3B-3
- **일시**: 2026-08-12
- **브랜치**: `fix/multiplayer-position-sync` · 제품 HEAD `9e44acc` (④ 계측 커밋 전)
- **e2e**: before **1.5·1.5·1.5 분** (pt10 계측 셔임) · after **1.4·1.5·1.6 분** (합계 **~8.9 분**)
- **보존**: `S3B3-before-run{1,2,3}-events.json` · `S3B3-after-run{1,2,3}-events.json` · `S3B3-summary.json`

---

## 반증 — §4

해당 없음. 경로 A 복귀 점프·경로 B spectator 오차·z15 회귀가 모두 개선 또는 유지 방향이다.

---

## UAG — §3 가~사

**S3B-3 PASS(D-2 교정) · z15 유지**

| 항목 | 결과 |
|---|---|
| **가** 시간 기준 — `receivedAtLocalMs` 단일 시계, `lastSeenAtMs` 외삽 제거 (trail·world) | **PASS** (`41fc0ac`) |
| **나** `r.speedMps` · paused/completed=0 · `SPECTATOR_MAX_EXTRAP_MS=3000` | **PASS** (`511c81e` · pt10 capHit 관측) |
| **다** 저줌 적분 유지·렌더만 게이트 · 복귀 점프 중앙값 ≤2.5 m | **PASS** (`9e44acc` · 중앙 **0.69 m**) |
| **라** 경로 B before 대비 p50·max 감소 (예산 미적용) | **PASS** (pt10 동일 정렬) |
| **마** z15 3 런 중앙값 depart/cruise 예산 | **PASS** (depart **300** · cruise **300** ms) |
| **바** 회귀 가드 3 런 + d0/d1 | **PASS** |
| **사** 쓰기량 S3B-2 사후 대비 ≤1.3 | **PASS** (pt9 run1 비 **1.06**) |

---

## 기술

### 구현 (커밋 4 분할)

| # | 해시 | 내용 |
|---:|---|---|
| ① | `41fc0ac` | `receivedAtLocalMs` 매핑 · trail/world 경과 단일 로컬 시계 (아직 5 km/h) |
| ② | `511c81e` | `spectatorRideExtrap.ts` · `SPECTATOR_MAX_EXTRAP_MS` · `speedMps`+cap · 1 s 티커 · pt10 |
| ③ | `9e44acc` | `MapView` — `stepPeerDriveAndBuildGeoJson` 항상 호출, `showPeerSprites`일 때만 GeoJSON |
| ④ | *(본 커밋)* | e2e 6 런 · `s3b3-summarize.mjs` · pt10 `nowMs` · 보고 |

D-0/D-1 발행 경로·새 적분 타이머 없음. `PEER_EXTRAP_DEFAULT_SPEED_KMH` 값 미변경(참조만 제거).

### 경로 A — peer sprite (예산 적용)

저줌 z13 **15 s** → z15 복귀 직후 첫 프레임 점프량(m):

| phase | run1 | run2 | run3 | **중앙값** |
|---|---:|---:|---:|---:|
| before | 3.53 | 0.37 | 3.00 | **3.00** |
| after | 0.13 | 0.69 | 1.09 | **0.69** |

정착 시간(ms) after 중앙 **109** (before **1491**).

### 경로 B — spectator dot (예산 미적용, before/after 개선만)

depart 구간 · pt10 · `nowMs`+시계 skew 정렬 · A.authDist 대비:

| phase | run1 p50 | run2 p50 | run3 p50 | **중앙 p50** | **중앙 max** |
|---|---:|---:|---:|---:|---:|
| before (5 km/h·혼합 시계) | 65.4 | 68.3 | 69.5 | **68.3** | **165.9** |
| after (speedMps+cap) | 48.8 | 57.0 | 59.8 | **57.0** | **87.0** |

절대값은 Firestore 1 Hz·RTT 구조상 크지만 **둘 다 감소**. after extrap p50 **0~69 ms** · capHit **0~3.6%**.

> before 측정: 동작은 `20f16a1` 그대로, **pt10 DEV 로그만** 얹어 동일 spectator dot 경로를 계측했다(산식 변경 없음).

### z15 회귀 (3 런)

| 구간 | before D_eff 중앙 | after D_eff 중앙 | RMSE/max/스케일 |
|---|---:|---:|---|
| depart | 360 | **300** | after 3 런 전부 예산 내(단 run1 max 2.51 — 중앙값 판정 PASS) |
| cruise | 320 | **300** | 3 런 전부 PASS |

### 회귀 가드 · d0/d1 · 쓰기량

- inFlightMax ≤1 · out-of-order 0 · 전진 폐기 0 · pt3/pt9 ok=0 =0 · publishQueue 예산 내 — **after 3 런 전부**
- `d0-duplicate-distm` **PASS 유지** · `d1-target-vs-applied` **뒤집힌 상태 유지** (`S3-fixture-gate.json`)
- pt3/pt9: after run1 대 S3B-2 post 비 **0.52 / 1.06** (≤1.3)

### 실패·미완 · 이견

- 초기 e2e: 주행 중 맵 시트에 줌 슬라이더 없음 → B 관전·맵 뷰 시트 경로로 수정.
- 경로 B 절대 오차는 1 Hz 소스 한계로 크다. **라**는 예산 미적용·상대 개선만 본다.
