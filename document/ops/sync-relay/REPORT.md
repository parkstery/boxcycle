# S3A-VR REPORT — 정확도 재검산 (저장 증거)

- **지시번호**: S3A-VR
- **일시**: 2026-08-12
- **브랜치**: `fix/multiplayer-position-sync`
- **새 e2e**: 없음 (`S3AV-chain-events.json` · 창은 `S3AV-summary.json`)
- **보존**: `document/ops/sync-relay/S3AVR-summary.json`
- `apps/web/src/**` 미변경. 예산·해결책 없음.

---

## UAG

**§4-2 수용 게이트: PASS** · **§4-3 교차검산 게이트: PASS**

한 줄: **z15 스케일 PASS · 정확도 미종결**

| case | D_eff | RMSE | max | 겹침 | 천장 | 판정 |
|---|---:|---:|---:|---:|---|---|
| z15-depart | **560** ✘ | 0.639 ✔ | 2.117 ✔ | 1.000 | 아니오 | 미종결 |
| z15-cruise | **540** ✘ | 0.751 ✔ | **2.746** ✘ | 1.000 | 아니오 | 미종결 |

감리 재검산치 대비 전부 ±5% 안 (D_eff 일치, RMSE/max 오차 < 0.1%).
사슬 합계 − D_eff: depart **7 ms** · cruise **9 ms** (게이트 ≤ 50 ms).

예산(`D_eff`≤350 · RMSE≤1.0 · max≤2.5)은 그대로 적용. 바꾸지 않음.
「멀티라이더 위치 동기화 결함 종결」이 아니다.

---

## 기술

### skew = 0

Playwright 한 프로세스의 두 컨텍스트는 **같은 OS 시계**를 읽는다. 판정 경로에서 skew 보정 없음.

폐기한 핸드셰이크 원본(판정 미사용): `clockSkewBefore=6` · `clockSkewAfter=320`. 호출 간 실행 지연.

### §3 지연 사슬 (p50 / p95 / n · m 환산 @ 구간 실제 applied 속도)

속도: depart 8.17 m/s · cruise 8.33 m/s. 발행 `speedMps` 미사용.

| case | ① 샘플링 낡음 | ② publishQueue | ③ 전송 ws→recv | ④ 보간 | 합계 | D_eff |
|---|---:|---:|---:|---:|---:|---:|
| depart | 231 / 392 / 92 · 1.88 m | 7 / 136 / 92 · 0.06 m | 155 / 241 / 92 · 1.27 m | 160 · 1.31 m | **553** | 560 |
| cruise | 217 / 400 / 107 · 1.81 m | 3 / 110 / 107 · 0.03 m | 151 / 235 / 107 · 1.26 m | 160 · 1.33 m | **531** | 540 |

네 단계는 인접하고 겹치지 않는다.

### 별도 관측 (사슬 합산 제외)

`writeRtt` 는 ③과 겹친다. `receiveVsAckMs` p50 이 음수 — 수신이 write ACK 보다 먼저다.

| | writeRtt p50/p95 | receiveVsAck p50/p95 |
|---|---:|---:|
| depart | 207 / 277 | **−55** / 68 |
| cruise | 189 / 252 | **−35** / 62 |

### §2-1 전송 비대칭 (참고 · skew 아님)

전 세션 firstSeen−writeStart: A→B p50 **166** ms (n=348) · B→A p50 **155** ms (n=311) · 차이 **11 ms**.

### 실패·미완 · 이견

없음. 게이트 2/2 PASS. 새 e2e 없음.

### 커밋

보고와 같은 브랜치에 푸시.
