# RESULT — 낮은 트래픽 · 제한된 검증 (지시 16)

담당: Cursor CLI · 지시: [16-task-low-traffic-bounded-verification.md](16-task-low-traffic-bounded-verification.md) · 시각: 2026-10-05  
제품 코드·송신 설정·Rules **미변경**. 브라우저 실주행 **미실시**. commit/push/배포 **없음**.

## 판정

| 항목 | 결과 |
|------|------|
| 배포 절감 기준 ↔ 현재 코드 대조 | **PASS** — RTDB motion **200ms**, FS heartbeat **4s** 일치 |
| 공통축 모델 빈도 비교 (200 vs 1s) | **PASS** (유한값·프레임 불변식 OK) |
| 제품 wire / adaptive 1s 재게이트 | **미실행** (지시: 모델 비교·바뀐 비교만) |
| 권고안 | **RTDB 200ms 유지 + 공통 D=600 + optional `tSrv`** (1s 송신 이번 비권고) |

증거: [two-view-order-traffic-freq-compare.json](two-view-order-traffic-freq-compare.json) · `.out/two-view-order-traffic-freq-compare.json`

## 1. 트래픽 기준 대조 (항목 1)

| 층 | 배포 baseline (최종 보고 / followup) | 현재 코드 | 비고 |
|----|--------------------------------------|-----------|------|
| RTDB motion | **5Hz = 200ms** 유지 | `PEER_MOTION_PUBLISH_INTERVAL_MS = 200` (`rideSyncPolicy.ts`) | 분리 기록 |
| FS live-ride heartbeat | **1s→4s** 절감 | `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS = 4_000` | 분리 기록 |
| publish gate | liveLocationSnapshot이 위 상수 사용 | `:145` FS · `:164` RTDB | 일치 |
| 사진 당시 선택 채널 | **미계측** | — | **유지** |

FS 1s→4s 되돌리기·FS 구독/r/w 추가안은 **제외**(지시).

## 2. 실행 명령 · 경과

```bash
cd apps/web
node --check scripts/peer-sync/two-view-order-harness.mjs
node scripts/peer-sync/two-view-order-harness.mjs --policy traffic-freq-compare
```

| 명령 | wall-clock | exit | 판정 |
|------|------------|------|------|
| `--check` + `traffic-freq-compare` | **1191 ms** (상한 120s) | 0 | **PASS** |
| Vite current / peer-spacing 전체 | — | — | **미실행** (재조사 금지·바뀐 비교만) |
| 브라우저 실주행 | — | — | **미실행** |

하네스만 수정: `--policy traffic-freq-compare`, `--interval`, gap/외삽 지표. 제품 TS 미수정.

## 3. 후보 정의 (공통 과거 시점 모델)

미래 패킷 미사용. self=캡처 버퍼 · peer=도착 버퍼만. ε∈{0,±50,±100} 전체 행렬 실행, 표는 ε0/0·+100/−100 중심.

| id | interval | D | 의미 |
|----|----------|---|------|
| `keep-200-D600` | 200ms | 600ms | 현행 빈도 + 권고 공통 D |
| `low-1000-D2200` | 1000ms | 2200ms | 1s + gap×2.2 상당 공통 D |
| `low-1000-D600` | 1000ms | 600ms | 1s인데 D=600 고정 시 한계 |

1s를 **adaptive peer-only** 실패만으로 제외하지 않음. 기존 기록(HARNESS A3 / 15): peer-only·1s면 self 즉시에 상대 ≈v·D 뒤처짐·지연 수렴 중 pp 변동 — 본 스위트는 **공통축**으로 재평가.

## 4. 비교표

### 4.1 메시지 · bytes · FS

| 후보 | RTDB msgs / rider / 40s | 2 riders | FS heartbeats (4s) | FS Δ | payload UTF-8 / msg | MB/h/rider (shape) |
|------|-------------------------|----------|--------------------|------|---------------------|--------------------|
| keep-200 | 199 | 398 | 10 | 0 | **70** (측정) | **1.202** |
| low-1000 (둘 다) | 39 | 78 | 10 | **0** | 70 | **0.240** |

- bytes는 `encodePayload` 키 형태(`p,d,v,ph,t`) JSON UTF-8 **측정**. 프레이밍·압축·fanout **미포함**.
- optional `tSrv` 추가 시 **+21 UTF-8 bytes/msg** (측정). 송신 횟수 Δ=0 · FS r/w Δ=0.
- 1s는 RTDB 메시지 **약 1/5**. FS 절감 **0**(4s 유지).

### 4.2 순서 · 간격 오차 · 자기 지연 (ε0/0 · tieDoc 100+100)

| 시나리오 | keep-200-D600 opp | selfLag m | low-1000-D2200 opp | selfLag | low-1000-D600 opp | 비고 |
|----------|-------------------|-----------|--------------------|---------|-------------------|------|
| 1a gap15 | 0 | 3.333 | 0 | **12.222** | 0 | 공통 D면 창 간 opp 0 |
| 1b gap1 | 0 | 3.333 | 0 | 12.222 | 0 | 동일 |
| 2 추월 | 0 | 3.622 | 0 | 13.364 | 0 | D600·1s: abDiffMax **0.583m** |
| 3 가감속 | 0 | 3.133 | 0 | 11.654 | 0 | D600·1s: abDiffMax **4.583m**, truthErrMax **1.574m** |
| 4 비대칭 | 0 | 3.333 | 0 | 12.222 | 0 | D600·1s: abDiffMax **1.667m**, peerExtrap **~83%**, hold **15%** |
| 6 stall | **0.081** | 3.333 | **0.055** | 12.222 | **0.108** | 신호 공백 → 현재 순서 **보장 불가** |

ε+100/−100 (keep / D2200): 등속 truthGapErrMax ≈ **1.111m**; 창 간 opposite(excl) 정상 시나리오 **0**. stall opposite는 ε와 무관하게 잔존.

### 4.3 예측·외삽 한계

| 조건 | 관찰 |
|------|------|
| keep-200-D600 | 정상: peerExtrap≈0. 비대칭만 ~7% 짧은 외삽 |
| low-1000-D2200 | 정상 등속: 외삽 0 · **자기 표시 ≈v·2.2s ≈12.2m 지연** |
| low-1000-D600 | 등속도 selfExtrap≈40% · peerExtrap≈70% — D&lt;interval 이라 **예측에 의존** |
| stall (전 후보) | `MAX_EXTRAP_MS=1200` 이후 hold → 창 간 opposite **5~11%**. 임의 tolerance로 PASS 처리하지 않음 |
| 신호 공백 | **정확한 현재 순서 보장 불가** → 공통 시각 표시 + near-tie/불확실(순서 단정 금지) 필요(14·15와 동일) |

기존 `t` 재사용: **불가** as capture time(`encode` 직전 기기 `Date.now`). optional `tSrv`(캡처 순간 추정 서버시각) 필요 — 비용 +21 B/msg · 횟수/FS 0.

## 5. 수신 수정 한계 vs 모델 증거 (분리)

| 층 | 상태 |
|----|------|
| 수신 stamp 정규화 (TASK-02/03) | **APPROVED(로컬)** — 도착 지터→속도 지터 제거(15) |
| 현행 self즉시/peer과거 | 구조적으로 창 간 「내가 앞」 잔존(two-view current) — **이번 미재실행**, 14/15 인용 |
| 본 결과 | **공통축 모델**만. 제품 표시·`tSrv` wire **미구현** |

## 6. 권고안 하나 (비용 최소화)

**유지: RTDB 200ms + FS 4s. 표시만 공통 고정 D=600ms + 캡처 `tSrv` + `.info/serverTimeOffset` 추정 commonNow.**

| 이유 | |
|------|--|
| 창 간 순서 | 정상 조건에서 모델 opposite **0** (1s·D2200과 동등) |
| 자기 반응 | selfLag **3.3m** vs 1s·D2200 **12.2m** |
| 1s·D600 | 트래픽↓이나 외삽 의존·비대칭/가감속 창차·stall 악화 → **비권고** |
| 1s·D2200 | 순서 모델은 가능하나 자기 지연·속도 반영 늦음. 트래픽↓는 RTDB만; FS 이미 4s |
| `tSrv` | 기존 `t` 유지(A안). +21 B/msg 측정. Rules optional number 소폭 |

### 구현 대상 파일 (승인 후 · 이번 미구현)

| 영역 | 파일(후보) |
|------|------------|
| 표시 공통 시각 | peer 렌더/카메라 경로(Registry·integrator 소비부 · HUD 좌표 쪽 — 승인 후 Supervisor가 확정) |
| wire | `rtdbTrailMotion.ts` encode/decode · Rules `tSrv?` |
| 시계 | `.info/serverTimeOffset` 구독·캐시 |
| 검증 | `two-view-order-harness` 제품 경로 게이트 · `test:peer-spacing` 보존 |

### Chief 결정 필요

1. 공통 고정 D=600 표시 승인 여부 (송신 주기 **올림 없음**).
2. optional `tSrv` + Rules 소폭 포함 여부.
3. **1s RTDB 송신은 이번과 분리**(별도 승인). 이번 모델상 비용 대비 자기 지연이 큼.
4. stall/offset 미수신/FS-only: 순서 단정 금지·불확실 표시 정책 확인.

### 제품 경로 합격 조건 (승인 후)

- 같은 source·capture timestamp로 self/peer/카메라 렌더; 창별 EMA D 금지.
- 정상·비대칭·가감속·stall·ε 행렬에서 창 간 opposite(정상)≈0; stall은 불확실 처리(FAIL을 PASS로 숨기지 않음).
- solo 지연 0; 송신 횟수 불변; `tSrv` 실측 bytes 기록.
- 기존 `test:peer-spacing` / core replay 게이트 보존.

### 후속 브라우저 관측 (필수일 때만 · 짧게)

- 정상 주행 **30~60s**, 명령 **180s hard timeout**, headless·단일 worker·기존 서버 재사용.
- 계측: 선택 source · 도착 간격 · 표시 시각 · uid별 경로 거리(창 2).
- 수분 대기 주행안 **제안하지 않음**.

## 7. Git · 범위

- 변경: `two-view-order-harness.mjs`, `HARNESS.md` 단락, 본 17, 증거 JSON, README/PROGRESS.
- focus-read 등 다른 untracked **미포함**. 제품 TS **미수정**.
- commit/push/merge/배포: **하지 않음**.

다음: Supervisor가 17·증거 JSON·하네스 diff 검수 후 Chief 표시 정책(및 1s 분리) 승인 요청.
