# PLAN 공통 시간축 표시 — Chief 승인용 (최종)

담당: Cursor CLI · 지시: [10-task-unify-ingest-axis.md](10-task-unify-ingest-axis.md) · 시각: 2026-10-05  
상태: **계획만** (제품 표시·네트워크·상수 미변경)  
원본 [06](06-plan-two-view-consistency.md)·[09](09-plan-common-timeline.md) **보존**. 본 문서가 Supervisor 검수 정정 반영 후 **승인용 단일 권고안**이다.

근거: [08](08-result-rework.md) · [11](11-result-unified-axis.md) · [two-view-order-metrics.json](two-view-order-metrics.json)

## 0. 사용자 요구

**같은 시각에 양쪽 창의 위치와 주행 순서가 일치**해야 한다.  
창 안 self/peer 지연 맞춤만으로 「후속」에 창 간 일치를 미루면 요구 미충족이다.

## 1. 권고안 (하나)

**공통 과거 시점 + 고정 공통 지연 D=600ms + 추정 서버 상대 시계(commonNow).**

| 층 | 규칙 |
|----|------|
| 표시 | self · peer · 카메라가 **같은** `renderTime = commonNow − D` 로 경로 거리→좌표 |
| 진실(비표시) | raw ride distance · speed · HUD 수치 · Claim 판정은 **즉시 실제값** (표시 시계와 분리) |
| D | **고정 600ms** (1차). 창마다 EMA로 고르지 **않는다**. 적응형 창별 D는 이번 승인에서 **제외** |
| commonNow | `.info/serverTimeOffset` 기반 **추정** 서버시각. 로컬 `Date.now`만으로 창 간 일치를 주장하지 않는다 |

옵션 Q(peer 외삽 to now)·옵션 R(현상 유지)은 **채택하지 않는다**.

### 09 §4 정정 (필수)

09는 local gap EMA로 D≈440~500을 양쪽이 독립 선택하도록 권고했다.  
그건 **서로 다른 renderTime**을 만든다 → Supervisor **비승인**.  
1차는 **모든 창이 동일 상수 D=600ms**.

600ms는 현재 200ms 송신의 오프라인 예산 **후보**다.  
`gap×2.2≈440`보다 여유를 둔 값이며, **실제 jitter·시계 오차 행렬로 검증할 목표**이지 무조건 안전한 값이 아니다.  
승인 전 제품 상수·표시 코드 변경 금지.

## 2. 06/09 오류·한계 (승인 전 공유)

06 「`D_A≠D_B`일 때만 역순」은 **틀림**.  
`D_A=D_B=D`여도 진실 간격 `|g| < v·D` 이면 양쪽 모두 「내가 앞」(oppositeSign).  
B 측정: 대칭 440ms·간격 1m → mismatch 1800/1800.

따라서 창 간 순서 일치는 **(1) 공통 renderTime**과 **(2) 동일 고정 D**가 동시에 필요하다.

## 3. 공통 시계 · `tSrv` 의미

### 3.1 현재 필드 (변경 시 명시 승인)

| 필드 | 지금 의미 | snapshot capture time? |
|------|-----------|------------------------|
| RTDB motion `t` / `serverAtMs` | 송신 기기 `Date.now()` (encode/write 직전일 수 있음) | **아님** |
| FS `lastSeenAt` | Firestore commit/serverTimestamp 계열 | **아님** |

수신 stamp(TASK-02/03)는 네이티브를 **수신축**으로 옮길 뿐 지구 공통 캡처 시각을 만들지 않는다.

### 3.2 `.info/serverTimeOffset` — 공식·SDK 근거

| 항목 | 내용 |
|------|------|
| 공식 문서 | [Enabling Offline Capabilities — Clock Skew](https://firebase.google.com/docs/database/web/offline-capabilities#clock-skew) |
| 경로 | `/.info/serverTimeOffset` (읽기 전용 `.info`) |
| 웹 modular | `onValue(ref(db, ".info/serverTimeOffset"), snap => …)` — 문서 스니펫과 동일 |
| 설치 SDK | `firebase@12.13.0` → `@firebase/database@1.1.3`. 번들(`index.cjs.js`)에 `serverTimeOffset` 갱신·`Path('.info/serverTimeOffset')` 존재 확인 |
| 공식 정의 | 클라이언트가 **로컬 시각에 더해 서버 시각을 추정**하는 ms offset |
| 공식 한계 | **networking latency에 의해 정확도가 영향받음**. 주된 용도는 **큰(>1초) 시계 불일치 발견**. 「수~수십 ms 보장」은 **문서에 없음 → 삭제** |

SDK 시계 보정은 **추정**이다. 불확실성/오차는 측정 게이트로 다룬다(§6).  
이상화 모델(offset 오차 0)과 실제 기기 offset 오차 주입 모델은 **표를 분리**한다(§5).

### 3.3 `tSrv` — 캡처 스냅샷 시각 (encode 시각 아님)

**정의:** `tSrv`는 **좌표·속도를 샘플링한 순간의 추정 서버 시각**이다.  
큐 대기·in-flight가 생겨도 `(tSrv, dist, speed)`는 **한 스냅샷**이어야 한다.

| 금지 | 이유 |
|------|------|
| encode/write 직전 `Date.now()+offset`을 capture time이라 부르기 | 샘플과 송신 사이에 지연이 있으면 시각·자세가 어긋남 |
| 기존 `t` 의미를 바꿔 server-relative로 재정의 | Rules·구클라·TASK-30 시계독립 가정과 충돌 → **별도 Chief 승인(B안)** |

**A안(권고):**

1. 샘플 순간: `pose = {dist, speed, …}`, `tSrv = Date.now() + serverTimeOffset` (그때의 offset 캐시).
2. 이후 encode/write는 같은 `pose`+`tSrv`를 실어 보냄 (재샘플하지 않음).
3. 기존 `t`(기기 시각)는 **유지** — 선택적 병행 필드. 구클라는 `tSrv` 무시.
4. `tSrv` 없으면 현행 수신 stamp 경로(하위 호환).

표시:

```text
commonNow = Date.now() + serverTimeOffset   // 연결·offset 수신 후 추정
renderTime = commonNow - D                  // D = 600 (1차 고정)
```

### 3.4 Rules / interface 승인 범위

| 항목 | 1차 | 승인 |
|------|-----|------|
| 기존 `t` 의미 | 불변 | 확인만 |
| 신규 `tSrv` (number, ms, optional) | RTDB motion payload | **필요** — wire 소폭 |
| Rules | `tSrv`가 number·합리적 범위인지 정도 | **소폭** 허용 검토. 의미 있는 완화 없음 |
| TS interface (`RtdbTrailMotionRow` 등) | optional `tSrv?` | **필요** |
| FS schema / 송신 주기 | 불변 | 표시용 FS 증가·주기 축소 금지 |
| 제품 상수 `PEER_*` DELAY | 승인 전 변경 금지 | D=600은 표시층 상수로 도입(승인 후) |

### 3.5 접속/복구

| 상태 | 동작 |
|------|------|
| offset 미수신 | 표시는 현행. 「공통 시계 준비 전」— 창 간 절대 일치 비주장 |
| 재연결 offset 점프 | 버퍼 유지. renderClock은 기존 catchup(±10%/s). ≥5s면 현 resync와 동일 즉시 맞춤 |
| FS only | `lastSeenAt`≠캡처. 불확실 UI(§6). 정상 신뢰 상태로 보지 않음 |

## 4. 왜 D=600ms인가 (200ms 송신 예산)

| 후보 | 값 | 채택 |
|------|-----|------|
| 현 peer 적응 | gapEma×2.2 ≈ 440ms @200ms | 창별 EMA → **비채택**(renderTime 분열) |
| 09 floor/max | 440 / 500 | 창별 적응 잔존 → **비채택** |
| 06 고정 300 | 300 | 버퍼 최신보다 앞서 외삽↑ → **비채택** |
| **1차 고정** | **600** | 440 대비 ~160ms 지터/처리 여유. **검증 목표** |

혼자 주행(peer 없음): D=0, commonNow 불필요.

## 5. 두 창 모델 (모델만 — wire 미검증으로 보고하지 않음)

오프라인 이상화. **실제 `tSrv` 구현을 검증한 것처럼 쓰지 않는다.**

기준: v=20km/h ≈ 5.556 m/s, D=600ms → L = v·D ≈ **3.33m**.

### 5.1 이상화 (clock estimate error = 0)

| 시나리오 | 기대(모델) |
|----------|------------|
| 대칭 지연 · \|g\|≫L | mismatch ≈ 0 |
| 대칭 지연 · \|g\|≪L (예: 1m) | 공통 D면 부호 일치(둘 다 같은 상대 순서) |
| 비대칭 one-way | 공통 renderTime이면 순서 유지(도착 지연은 버퍼로 흡수되는 범위에서) |
| 속도 변경 20→30→10 | 공통 시점 샘플이면 mismatch ≈ 0 |
| near-tie \|g\|≈0 | tie 대역(§6) — 동률, 순서 단정 금지 |
| stall / 미도착 | **정상 신뢰 상태 아님**. mismatch 잔존 허용, UI 순서 단정 금지 |
| 가속 + 미도착 | 외삽으로 「진실」주장 금지 |
| FS-only stale | 캡처≠커밋. 신뢰 배지 off |

08 B의 common D=300/500 셀은 이상화 0 mismatch 쪽 증거(측정 하네스). D=600도 같은 부류의 **모델**로 취급.

### 5.2 clock estimate error 주입 (모델)

각 창의 추정 서버시각에 독립 오차 ε ∈ {0, ±50ms, ±100ms}를 넣는 사고실험.

위치 오차 대략 `δx ≈ v·|ε|`:

| \|ε\| | δx @20km/h | 비고 |
|-------|------------|------|
| 50ms | ≈ 0.28m | tie 대역과 겹침 |
| 100ms | ≈ 0.56m | near-tie에서 부호 흔들림 가능 |

**순서 tie 범위(권고 계산):**

```text
tieM = max(0.5m, v · (ε_budget + 0.05s))
```

- ε_budget=100ms → @20km/h tieM ≈ max(0.5, 5.556×0.15) ≈ **0.83m**
- 「정확한 동시·무오차 위치」를 보장하지 않는다. tie면 동률 UI.

측정 시 이상화 표와 ε 주입 표를 **분리 기록**. ε 주입 PASS를 wire 구현 PASS로 보고하지 않음.

## 6. stall · 미도착 · 불확실

| 상황 | 표시 | 순서 |
|------|------|------|
| peer stall > `PEER_INTERP_MAX_EXTRAP_MS`(1200) | hold. self도 같은 renderTime | 순서로 단정하는 UI 금지 |
| 한쪽만 stall | 공통 D로도 mismatch 가능 | 「신호 약함」·배지 숨김 |
| offset 미수신·점프 직후 | 공통 시계 배지 off | 창 간 절대 일치 비주장 |
| FS-only stale | 불확실 | 정상 신뢰 상태 아님 |
| near-tie | \|Δdist\| < tieM | 동률 |

## 7. 송신 주기: 200ms 유지 vs 1초 지원 비용

이번 수정에서 **송신 주기는 유지(200ms)**.  
「1초/3초는 지원 범위 밖」한 문장으로 트래픽 우려를 끝내지 않는다 — 비용 표를 남긴다.

| 항목 | 현재 200ms + D=600 | 1초 송신 지원 시 |
|------|---------------------|------------------|
| 권고 공통 D | **600ms** (고정) | gap×2.2 ≈ **2200ms 이상** (적응이든 고정이든 버퍼 최신보다 앞서지 않으려면) |
| self 표시 반응 지연 | ≈ 0.6s | ≈ **2.2s+** |
| L = v·D @20km/h | ≈ 3.3m | ≈ **12m+** |
| 나란히 느낌 | 수 m 이내 상대는 tie/불확실 커짐 | 거의 항상 L 스케일 뒤처짐 — 창 안 「따라가기」체감 악화 |
| stale / 외삽 | 현 INTERP_MAX 1200·RTDB stale 2500과 정합 검토 | **정책 재설계 필요**(D>stale 가능, 외삽 hold 구간 확대) |
| 수렴(08 A3) | 200ms: converge ≈ 2.6s | 1000ms: converge ≈ **15s**, delay pp 잔존 |
| motion 트래픽 | 기준(5Hz) | ≈ **1/5** (절감) |
| FS | 불변(표시용 추가 금지) | 불변 |
| 이번 작업 | **주기 유지** | 제품에 넣으려면 **별도 Chief 승인** + D·stale·외삽 재설계 |

Chief는 **표시 정책/지연(D=600·tSrv)** 과 **향후 빈도 변경(1초)** 을 구분해 승인할 수 있어야 한다.

3초 송신은 RTDB stale(2500)과 이미 policyConflict — 표시 일치 제품 대상 아님(비용표 확장 시 동일 논리로 D≈6.6s급).

## 8. 변경 범위 · 트래픽 · 단계 (승인 후)

### 8.1 터치 예상

| 영역 | 예 | 변경 |
|------|-----|------|
| offset 모듈 | `peerMotion/serverClockOffset.ts` | `.info/serverTimeOffset` 구독·캐시·불확실 플래그 |
| 송신 | liveLocation / motion encode | 샘플 순간 `tSrv` (A안). **기존 t 유지** |
| self 표시 버퍼 | 신규 | `(tSrv, distM)` 링버퍼 |
| 표시 시계 | App liveForMap · camera | peer 있을 때 renderTime 공유, D=600 |
| peer | integrator/Registry | 가능하면 tSrv 축 정렬 |
| 시험 | two-view + ε 모델 셀 · peer-spacing | 창 간 mismatch 게이트(stall 제외) |
| **제외 1차** | 송신 주기, FS 주기, 경쟁 서버화, Rules 대변경 | 별도 승인 |

### 8.2 트래픽

| 항목 | 증분 |
|------|------|
| `.info/serverTimeOffset` | SDK 메타. motion과 별도 대량 송신 없음 |
| `tSrv` | 패킷당 수 바이트 @5Hz — 미미 |
| motion 빈도 | **0** |
| FS r/w | **0** |

### 8.3 단계

1. 수신축 통일·게이트 — **완료**(08/11).  
2. **승인**: 본 권고(고정 D=600 + tSrv 캡처 스냅샷 + offset 추정 + ε 게이트).  
3. 구현: offset → tSrv(샘플 순간) → self 버퍼 → 표시 결합.  
4. 회귀: peer-spacing · two-view(이상화+ε) · fallback 54 · smoothness/liveness · 혼자 D=0.

## 9. 검증 완료 조건 (승인·구현 후)

1. two-view 이상화: 등속·대칭·비대칭·속도변경에서 stall 제외 mismatch ≈ 0 (공통 D=600).  
2. ε=±50/±100 모델: tie 대역·불확실 처리가 문서와 일치. wire PASS로 과장하지 않음.  
3. stall/미도착/FS-stale: UI가 순서를 단정하지 않음.  
4. `test:peer-spacing` · fallback · smoothness 회귀 PASS.  
5. 혼자 D=0.  
6. 송신 주기 불변(200ms).  
7. Chief 육안: uid·이름표·경로 거리 기준 앞뒤 일치(색 무시).

## 10. Chief에 물을 것

1. 본 권고(**고정 D=600ms** + 캡처 순간 `tSrv` + offset 추정 + ε 측정 게이트) **승인 여부**.  
2. 기존 `t` 의미 변경(B안)은 **하지 않음** 확인.  
3. Rules에 `tSrv` optional number 소폭 — 승인 범위에 포함하는지.  
4. 경쟁·보상 판정을 화면과 분리할지 — 필요 시 별도 묶음.  
5. **1초 송신 지원**을 제품에 넣을지(넣으면 D≈2.2s+·stale/외삽 재설계; 트래픽 절감과 자기 반응 지연을 교환). 이번 승인과 **분리**.

## 11. 비범위

- 승인 전 카메라/HUD/self 지연/wire/`PEER_*` 상수 변경 금지.  
- 송신 주기 축소로 일치 「해결」금지.  
- TASK-02/03 stamp·게이트와 표시 정책을 한 커밋에 섞지 말 것.  
- 09의 창별 EMA D·「수~수십ms」보장 문구는 본 문서에서 **폐기**.
