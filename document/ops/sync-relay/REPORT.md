# S3A-V REPORT — 증상 종결 검증 (측정 전용)

- **지시번호**: S3A-V
- **일시**: 2026-08-12
- **브랜치**: `fix/multiplayer-position-sync`
- **e2e 실행 시간**: **1.7 분** (`S3AV-summary.json` `elapsedMin`)
- **보존**: `document/ops/sync-relay/S3AV-chain-events.json` (pt1~pt7 **전량 9369건**) · `S3AV-summary.json`
- 제품 코드(`apps/web/src/**`) 미변경. F-1·F-2 미수정.

---

## 반증 — §6

**해당하지 않음.** z15-cruise 스케일 이탈 **0.94%** ≤ 10% (PASS).
S3A 로 스케일 증상은 닫혔다. 종단 정확도 예산은 미달 — 그건 반증 조건이 아니다. 원인 탐색 안 함.

---

## UAG

**미종결.**

두 케이스 모두 유효성 가드 5건·스케일 게이트는 통과했으나, 정확도 예산(§3-2)을 각각 한 항목씩 넘겼다.
「부분 성공」이 아니다. 「멀티라이더 위치 동기화 결함 종결」도 아니다 (D-1·D-2 / S3B 잔여).

| case | Δ(A_auth) | 창(s) | 스케일 이탈% | D_eff | RMSE | max | 가드 5건 | 판정 |
|---|---:|---:|---:|---:|---:|---:|---|---|
| **z15-depart** | 126.2 m | 20.1 | **1.15% PASS** | **400** | 0.666 | 1.945 | ①~⑤ PASS | **미종결** (`D_eff` 400 > 350) |
| **z15-cruise** | 181.7 m | 21.8 | **0.94% PASS** | 320 | 0.757 | **3.023** | ①~⑤ PASS | **미종결** (max 3.023 > 2.5) |

S1 당시 z15-cruise 스케일 이탈 48% → 이번 0.94%. 스케일 게이트는 닫혔다.

---

## 기술

### 유효성 가드

| # | 내용 | 근거 |
|---|---|---|
| ① | 앞 2 s 폐기 | 각 케이스 `start+2000ms` 이후만 집계. F-1(`visibilityNowMs` 초기 0) 회피 |
| ② | Δ≥100 m · 창≥20 s | depart 126.2 m / 20.1 s · cruise 181.7 m / 21.8 s |
| ③ | 겹침 ≥ 0.7 | depart 0.975 · cruise 0.977 (`s1-metrics` `minOverlapRatio`) |
| ④ | `maxDelayMs=3000` 천장 미접촉 | depart 400 · cruise 320. 천장 아님 |
| ⑤ | 시계 보정 | before **6 ms** · after **320 ms**. \|Δ\| = 314 > 100 → **선형 보간** (`clockRangeB` 구간). 보정 없이 쓴 수치 없음 |

`A_auth` = pt1 `authDist` @ `capturedAt`. `B_disp` = pt6 `displayDistM` @ `renderTime+160`.
`B_newest` = 수용 pt5 `d` @ pt4 `recvAt`. D-8 clamp 구간 미진입 (`maxAuth` depart 146 · cruise 348 ≪ geo 1029).

### §4 관측 (원인 단정 없음)

**가. accepted 간격** (연속 recvAt, n=276) — p50 **249** · p95 **554** · max **1136** ms.
히스토그램: 0–100: 9 · 100–200: 75 · 200–400: **146** · 400–800: 45 · 800–1600: 1.

**나. 모드 점유**

| | interpolate | extrapolate |
|---|---:|---:|
| depart | 65.0% | 35.0% |
| cruise | 61.6% | 38.4% |

oldest · paused = 0. cap 히트 **0**.

**다. 외삽 오차 vs A 실제 이동** — depart p50 0.077 / max 0.98 m · cruise p50 0.033 / max 0.32 m. ahead p50 68–96 ms.

**라. RTDB 쓰기** — pt3 `ok=0` **0건** (실패율 0). pt2−pt3 = **9** (미완료·누락 후보, 실패로 세지 않음). F-2 미수정.

**마. ①−②** — depart p50 1.53 / max 3.61 m · cruise p50 1.81 / max 3.89 m. clamp 발화 없음.

**바. 내부 지표 (판정 아님)** — `publishQueueMs` p50 **19** / max 510 · `inFlightMax` **1** · `A_firstOutOfOrder` **0**. S3A 유지.

### z13 (판정 제외)

기록만. Δ(A_auth) 193 m · 창 23.3 s · 스케일 1.72% · D_eff 340 · RMSE 1.14 · max 3.22.
pt6 n=34 (줌아웃 후 표본 감소). D-2 미수정 — 판정표에 올리지 않음.

### F-1 · F-2 (기록만)

- **F-1** `visibilityNowMs` 초기 0 — 앞 2 s 폐기로 회피. 고치지 않음.
- **F-2** `motionPublishFlight` fire-and-forget — `ok=0` 0건으로만 관측. 고치지 않음.

### 실패·미완 · 이견

- 수용 종결 조건 미달 (위 UAG). 재측정·완화 없음.
- 이견 없음. `src` 미변경.

### 커밋

보고와 같은 브랜치에 푸시. 해시 커밋 로그.
