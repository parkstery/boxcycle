# S3B-2 REPORT — D-1 적용속도 발행 + Firestore 쓰기량

- **지시번호**: S3B-2
- **일시**: 2026-08-12
- **브랜치**: `fix/multiplayer-position-sync`
- **e2e**: 기준선 **1.2 분** · 사후 **1.3 분** (산출물 `elapsedMin`)
- **보존**: `S3B2-base-events.json` · `S3B2-chain-events.json` · `S3B2-summary.json` (전량)
- D-2·F-1·F-2·S4·Orchestrator·`SPEED_PUBLISH_DELTA`·heartbeat·integrator·single-flight 미변경.
- S3B-1 z15 정확도는 **유지 대상**이었으며, 이번 사후 depart `D_eff` 가 예산을 넘겼다.

---

## 반증 — §4

**해당 (FS 증가 없음).** 새 기준선(pt9) 대비 Firestore 쓰기 **사후/기준선 = 0.812** (depart 0.782 · cruise 0.957).
램프에서도 증가하지 않음 → 「적용속도가 델타 우회로 Firestore를 증폭시킨다」는 예측은 **이 런에서 반증**.
RTDB 비 **0.976** ≤ 1.3. 원인 탐색하지 않음 — 수치만 보고.

---

## UAG

**FAIL — §3-2 z15-depart `D_eff` 360 > 350.** D-1·가드·쓰기량은 충족. 「S3B-2 PASS(D-1 교정) · z15 유지」에 해당하지 않음. S3B-3 미착수.

### §3-1 D-1

| 항목 | 결과 |
|---|---|
| known-fail `d1-target-vs-applied` | **뒤집음** ≥20% → **<20%** (rel **0.041**, actual 2.90 vs pub 3.02 m/s) |
| 출발 5 km/h 고착 | **해제** (depart pt3 p50 **8.33** m/s · near139 ratio 0.044 · `stuckAt5kmh=false`) |
| `d0-duplicate-distm` | **PASS 유지** (fixture gate) |

### §3-2 z15 회귀 (예산 ≤350 / RMSE≤1.0 / max≤2.5 · 스케일 ≤10%)

| case | D_eff | RMSE | max | 스케일 | 판정 |
|---|---:|---:|---:|---:|---|
| z15-depart | **360** ✖ | 0.455 ✔ | 1.353 ✔ | 0.54% ✔ | **FAIL** (S3B-1: 340) |
| z15-cruise | **300** ✔ | 0.372 ✔ | 0.938 ✔ | 0.31% ✔ | **PASS** (S3B-1: 300) |

전제: skew=0 · 앞 2 s 폐기 · maxDelay 3000 · 겹침 1.0 · Δ≥100 m · 창 ≥20 s.

### §3-3 가드 6

| 가드 | 결과 |
|---|---|
| inFlightMax ≤ 1 | **1** ✔ |
| A_firstOutOfOrder = 0 | **0** ✔ |
| 전진 packet 폐기 = 0 | **0** ✔ |
| pt3 ok=0 | **0** ✔ |
| pt9 ok=0 | **0** ✔ |
| publishQueueMs p50≤150 · p95≤400 · max≤800 · 1s초과 0% | **5 / 105 / 413** · over1s **0** ✔ |

### §3-4 쓰기량 (pt9 건수 · 새 기준선)

| | 기준선 /s | 사후 /s | 비 | 판정 |
|---|---:|---:|---:|---|
| RTDB (전체 판정창) | — | — | **0.976** | ✔ ≤1.3 |
| Firestore pt9 (전체) | 3.159 | 2.566 | **0.812** | ✔ ≤1.3 |
| FS depart | 5.052 | 3.950 | **0.782** | ✔ |
| FS cruise | 1.265 | 1.210 | **0.957** | ✔ |

pt9 n: base 309 · post 285. RTT(전체 판정창) base p50/p95 1708/3815 · post 2092/3237.

---

## 기술

### 구현

`buildLiveLocationSnapshot`: `peekSampleAppliedSpeedKmh()` 유한이면 사용, 아니면 `input.speedKmh`.
`paused` → `speedMps = 0` 유지. App.tsx / HUD `rideMetrics` 미수정.
pt9: `mergeTrailLivePublicationRideSnapshot` 전후 DEV `peerSyncChainLog(9, …)`.

### known-fail

`d1-target-vs-applied` 기대 뒤집음 (소스 `S3B2-chain-events.json` pt3). `d0` PASS 유지.

### 실패·미완 · 이견

- **FAIL 원인**: depart `D_eff` 360 (예산 350). 재시도·상수 조정 없음.
- 이견 없음(작업 전 검산 통과 후 진행).
- HANDOFF §3-7 Firestore ≈4.2/s 는 기준선으로 쓰지 않음.

### 커밋

1. `548d771` — pt9 계측 (D-1 미적용)
2. `6f16f2f` — D-1 적용 (+ fixture 기대 뒤집기)
3. (본 보고·산출물·gate 소스 정리 커밋)
