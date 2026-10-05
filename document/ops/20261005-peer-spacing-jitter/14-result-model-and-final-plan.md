# RESULT-05 모델 실행 근거 + 승인용 정정안

담당: Cursor CLI · 지시: [13-task-final-model-evidence.md](13-task-final-model-evidence.md) · 시각: 2026-10-05  
원본 [12](12-plan-common-timeline-final.md) **보존**. 본 문서는 12를 대체하지 않고 **모델 실측·정정·승인 권고**만 담는다.  
제품 코드/수신 코드 **미변경**. 전체 회귀 **미반복**. commit/push/배포 없음.

## 판정

| 항목 | 결과 |
|------|------|
| D=600 + ε 행렬 **모델** 실행 | **PASS** (유한값·프레임 수 불변식 OK) |
| 제품 `tSrv` wire 검증 | **해당 없음** — 본 결과는 MODEL |
| 12 §5.2 tie≈0.83m | **정정** — 두 기기 오차 합 누락 |
| 12 §7 「상대가 D×v 뒤처짐」읽힘 | **정정** — 공통 D는 상대 간격을 D×v만큼 벌리지 않음 |
| 12 §8.2 `tSrv` 「수 바이트/미미」 | **정정** — 20~25 raw bytes/update 정량 |
| Chief 승인 요청 | Supervisor 검수 후 — 아래 §5 권고 |

원시 JSON: `.out/two-view-order-model-d600-metrics.json` · ops [two-view-order-model-d600-metrics.json](two-view-order-model-d600-metrics.json)

## 1. 모델 정의 (wire와 구분)

```text
kind: MODEL_NOT_PRODUCT_TSRV_WIRE
송신 stamp = real capture + sender ε
창 renderTime = real now + viewer ε − D   (D=600)
self·peer 모두 동일 규칙; self=INTERVAL 캡처 버퍼, peer=도착 버퍼만
미래 캡처·미도착 표본 사용 금지
```

실행: `node scripts/peer-sync/two-view-order-harness.mjs --policy model-d600`  
ε ∈ {0, ±50, ±100}ms × 시나리오 6종(1m/15m·추월·20→30→10·비대칭·stall).  
`node --check` 하네스 **PASS**.

## 2. 실측 요지 (문서 tie 예산 100+100ms 기준)

| 시나리오 | ε 0/0 opposite(excl) | ε +100/−100 opposite(excl) | 비고 |
|----------|----------------------|----------------------------|------|
| 1a gap15 | 0 | 0 | selfLag=peerLag=**3.333m**=v·D; dispGap=truth=−15 |
| 1b gap1 | 0 | 0 | 창 간 일치 유지; truth 대비 간격 오차 max **1.111m**=v·200ms |
| 2 추월 | 0 | 0 (incl05 0.004) | near-cross에서만 미세 |
| 3 속도변경 | 0 | 0 (incl05 0.005) | 동 |
| 4 비대칭 | 0 | 0 | 도착 비대칭은 버퍼가 흡수하는 범위에서 창 간 0 |
| 6 stall | **0.081** | **0.081** | 정상 신뢰 상태 아님(12§6과 동일) |

자기 검산(ε0/0·등속): `relativeGapNotWidenedByD`·`eachRiderLagApprox_vD` **OK**.  
공통 D에서 **상대 간격은 D×v만큼 벌어지지 않음** — 각 rider만 진실보다 ≈v·D 지연.

창 간 순서 mismatch의 주원인은 대칭 ε가 아니라 **stall/미도착**. ε는 주로 **진실 대비 계통 오차**와 tie 대역을 키운다.

## 3. tie 정정 (항목 2)

12 §5.2 오류: `tieM = max(0.5, v·(ε_budget+0.05s))`에 ε_budget=**한 기기** 100ms → 0.83m.  
`+100/−100`의 **차분 200ms**를 빠뜨림.

```text
tieM = max(0.5m, v · ((|ε_budget_A| + |ε_budget_B| + 50ms) / 1000))
@20km/h, budget 100+100 → tieM ≈ 1.389m
(잘못된 단일기기식 → 0.833m)
```

SDK `.info/serverTimeOffset`가 100ms 이내라고 **보장하지 않음**(공식: networking latency 영향·큰 불일치 발견용).  
ε_budget은 측정 게이트 가정값일 뿐.

## 4. 계획 정정 (항목 3) — 12 본문 대체 문구

### 4.1 공통 D와 상대 간격 (12 §7 표현 정정)

| 구분 | 올바른 의미 |
|------|-------------|
| L = v·D | **각** rider 표시가 현재 진실보다 지연된 거리(자기 반응 지연 체감) |
| 상대 간격 | 공통 D면 self·peer **함께** 늦춤 → 상대 간격 ≈ 지연 시점 진실(±ε 차분). **D×v만큼 벌어지지 않음** |
| 1초 송신 시 D≈2.2s | self 반응 ≈2.2s, 각 rider 진실 대비 ≈12m 지연. 「상대가 12m 뒤처짐」으로 읽히면 **오해** |

### 4.2 `tSrv` 트래픽 (12 §8.2 정정)

| 항목 | 값 |
|------|-----|
| 송신 횟수 증분 | **0** |
| FS r/w 증분 | **0** |
| `tSrv` raw size | JSON key+13자리 ≈ **20~25 bytes/update** |
| @5Hz | ≈ **0.36~0.45 MB/hour/rider** (프레이밍·압축·fanout 제외) |
| 실제 | encode 계측 필요 — 「수 바이트/미미」만으로 끝내지 않음 |

## 5. 승인용 권고안 (Supervisor → Chief)

12 권고 골격 **유지** + 본 문서 정정 반영:

1. **고정 공통 D=600ms** + 캡처 순간 `tSrv` + `.info/serverTimeOffset` 추정 commonNow.  
2. 창별 EMA D·옵션 Q/R **비채택**.  
3. tie: **두 기기 오차 합** 공식(§3). near-tie·stall·offset 미수신은 순서 단정 금지.  
4. 기존 `t` 유지(A안). Rules/`tSrv?` 소폭은 승인 범위에 포함 여부 확인.  
5. 송신 주기 **200ms 유지**. 1초 지원은 별도 승인(자기 반응·stale/외삽 재설계; 상대 간격= D×v 오해 금지).  
6. 본 ε 행렬은 **모델** — wire 구현 PASS로 보고하지 않음. 구현 후 동일 게이트 재측정.

### Chief에 물을 것

1. 위 권고(정정 포함) 승인 여부.  
2. B안(`t` 의미 변경) 하지 않음 확인.  
3. Rules `tSrv` optional number 소폭 포함 여부.  
4. 1초 송신은 이번과 **분리**.

## 6. Git·범위

- 변경: `two-view-order-harness.mjs`(+`HARNESS.md` 한 단락), 본 14, 모델 JSON, README/PROGRESS.  
- focus-read 등 다른 untracked **미포함**. 제품 TS **미수정**.  
- commit/push/merge/배포: **하지 않음**.

다음: Supervisor가 14·하네스 diff·원시 수치 검수 후 Chief 표시 정책 승인 요청.
