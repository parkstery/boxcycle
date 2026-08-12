# S3B-1 REPORT — D-0 샘플링 낡음 제거

- **지시번호**: S3B-1
- **일시**: 2026-08-12
- **브랜치**: `fix/multiplayer-position-sync`
- **e2e 실행 시간**: **1.3 분** (`S3B1-summary.json` `elapsedMin`)
- **보존**: `S3B1-chain-events.json` (pt1~pt7 **전량 7803건**) · `S3B1-summary.json`
- D-1·D-2·F-1·F-2·보간 상수·single-flight 미변경.

---

## 반증 — §4

**해당하지 않음.** ① p50 = **0 ms** (depart·cruise). `D_eff` 340 / 300 ≤ 450.

---

## UAG

**S3B-1 PASS — z15 정확도 종결 (D-0).** §3-1~3-4 전부 충족. 「멀티라이더 위치 동기화 결함 종결」이 아니다 (D-1·D-2 / S3B-2·3 잔여).

### §3-1 정확도

| case | D_eff | RMSE | max | 겹침 | 창 | 스케일 | 판정 |
|---|---:|---:|---:|---:|---:|---|---|
| z15-depart | **340** ✔ | 0.394 ✔ | 1.245 ✔ | 1.000 | 23.7 s · Δ163 m | 0.57% | **PASS** |
| z15-cruise | **300** ✔ | 0.322 ✔ | 1.303 ✔ | 1.000 | 21.9 s · Δ182 m | 0.12% | **PASS** |

천장 미접촉. skew=0.

### §3-2 사슬

| case | ① | ② | ③ | ④ | 합계 | D_eff | \|Δ\| |
|---|---:|---:|---:|---:|---:|---:|---:|
| depart | **0** | 2 | 164 | 160 | 326 | 340 | 14 |
| cruise | **0** | 1 | 132 | 160 | 293 | 300 | 7 |

① p50 ≤ 20 ✔. 교차 ≤ 50 ms ✔.

### §3-3 회귀

inFlightMax **1** · A_firstOutOfOrder **0** · 전진 폐기 **0** · pt3 ok=0 **0** ·
publishQueue 3 / 110 / 446 · 1 s 초과 0.

### §3-4 쓰기량

RTDB 4.96 /s vs S3AV 4.67 /s · 비 **1.06** ≤ 1.3 ✔.
accepted 274 · sameDist 1044 · 전진 0.
Firestore `LiveLocationPublish` 텍스트 파싱은 불안정(세션 4.2 /s로 읽힘). `speedKmh`·heartbeat 미변경 — 1 Hz 경로 상수 유지. 게이트는 RTDB.

### before / after (S3AVR → S3B-1)

| | depart D_eff | cruise D_eff | ① p50 | cruise max |
|---|---:|---:|---:|---:|
| S3AVR | 560 | 540 | 231 / 217 | 2.746 |
| S3B-1 | **340** | **300** | **0 / 0** | **1.303** |

---

## 기술

### 구현

`buildLiveLocationSnapshot`: `peekSampleVirtualDistanceM()` 가 유한이면 그 값, 아니면 `input.virtualDistanceMeters`.
`distMetersAlongRoute` 와 `progressRatio` 를 **같은** `virtualDistanceMeters` 에서 유도.
`speedKmh` 미변경. App `rideMetrics` 소비처 미변경. 등록부(`useVirtualRideSession.ts:197`)에 DEV 게이트 없음 — 운영에서도 동작.

§3-6 사실 3건 코드 확인:
1. `:125` 는 diag 전용, `:97` `:112` 가 React 200 ms — 배선 이 한 곳.
2. `SPEED_PUBLISH_DELTA_MPS=0.28` 가 `shouldPublishRouteProgress` 에도 연결 — **미수정** (S3B-2).
3. spectator `lastSeenAtMs`−`Date.now()` — **미수정** (S3B-3).

### known-fail

`d0-duplicate-distm` 기대값 뒤집음: ≥40% → **<40%** (S3B1 pt3 n=294 · dup **0**). fixture PASS.
`d1-target-vs-applied` 그대로 PASS.

### 실패·미완 · 이견

없음. 1차 측정 depart 창 19.85 s 는 전제 미달이라 spec 창만 늘려 재측정(제품 코드 불변).

### 커밋

보고와 같은 브랜치에 푸시.
