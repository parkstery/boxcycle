# PLAN 공통 시간축 표시 — Chief 승인용 (TASK-03)

담당: Cursor CLI · 지시: [07-review-and-rework.md](07-review-and-rework.md) · 시각: 2026-10-05  
상태: **계획만** (제품 표시/네트워크 구조 미변경)  
원본 [06-plan-two-view-consistency.md](06-plan-two-view-consistency.md) **보존**. 본 문서가 승인용 단일 권고안이다.

측정 근거: [08-result-rework.md](08-result-rework.md) · [two-view-order-metrics.json](two-view-order-metrics.json)

## 0. 사용자 요구 (충족 조건)

**같은 시각에 양쪽 창의 위치와 주행 순서가 일치**해야 한다.  
창 안 self/peer 지연 맞춤만으로 「후속」에 창 간 일치를 미루면 요구 미충족이다.

## 1. 권고안 (하나)

**공통 과거 시점 + 공통 지연 D + 서버 상대 시계(commonNow).**

| 층 | 규칙 |
|----|------|
| 표시 | self · peer · 카메라가 **같은** `renderTime = commonNow − D` 로 경로 거리→좌표 변환 |
| 진실(비표시) | raw ride distance · speed · HUD 수치 · Claim 판정은 **즉시 실제값** 유지(표시 시계와 분리) |
| D | 창마다 EMA로 고르지 않는다. **동일 정책 함수**로 산출(아래 §4) |
| commonNow | `.info/serverTimeOffset` 기반 추정 서버시각(아래 §3). 로컬 `Date.now`만으로 창 간 일치를 주장하지 않는다 |

옵션 Q(peer 외삽 to now)·옵션 R(현상 유지)은 **채택하지 않는다**.  
근거: B 측정에서 현행은 간격 < D·v 일 때 양쪽 「내가 앞」이 100%이고, stall/가속에서 외삽은 TASK-02 smoothness와 충돌 위험이 크다.

## 2. 06 오류 정정 (승인 전 공유)

06은 「`D_A≠D_B`일 때만 역순」이라고 했다. **틀림.**

진실 간격 g, 각 창 peer 뒤처짐 L≈v·D 일 때:

- 창 A: selfA − peerB ≈ g + L_A  
- 창 B: selfB − peerA ≈ −g + L_B  

`D_A=D_B=D`여도 `|g| < v·D` 이면 **양쪽 부호가 반대**(둘 다 내가 앞).  
실행: 대칭 440ms·L≈3.1m에서 간격 1m → mismatch 1800/1800. 간격 15m → 0.

따라서 창 간 순서 일치는 **(1) 공통 renderTime**과 **(2) 같은 D 정책**이 동시에 필요하다. self만 local peer delay만큼 늦추는 것으로 창 간 일치를 주장하지 않는다.

## 3. 공통 시계 — 송신 좌표 시각 매핑

### 3.1 현재 필드 의미 (변경 시 명시 승인)

| 필드 | 지금 의미 | snapshot capture time? |
|------|-----------|------------------------|
| RTDB motion `t` / `serverAtMs` | **송신 기기 `Date.now()`** | **아님** (기기 시계·송신 직전) |
| FS `lastSeenAt` | **Firestore commit/serverTimestamp 계열** | **아님** (커밋 시각; 캡처와 어긋날 수 있음) |

수신 stamp(TASK-02/03)는 이 네이티브를 **수신축**으로 옮길 뿐, 「지구 공통 캡처 시각」을 만들지 않는다.

### 3.2 `.info/serverTimeOffset` (SDK/공식 계약)

Firebase Realtime Database 클라이언트는 `.info/serverTimeOffset`을 제공한다(웹 SDK: `onValue(ref(db, '.info/serverTimeOffset'), …)`).

| 항목 | 내용 |
|------|------|
| 값 | 대략 `serverNow − clientDateNow` (ms). 추정 서버시각 ≈ `Date.now() + offset` |
| 갱신 | 연결 수립·재연결 시 SDK가 갱신. 앱은 리스너로 캐시하고, 끊김 중에는 마지막 offset 유지 + 「시계 불확실」플래그 |
| 오차 | RTT 비대칭·중계 지연으로 **수~수십 ms** 수준 추정. **정확한 공통 시각을 보장하지 않는다** |
| 한계 | 1회 `RTT/2`로 「정확한 공통 시각」이라고 **주장하지 않는다**. offset도 동일하게 「추정」으로만 쓴다 |

### 3.3 권고 매핑 (wire 최소)

**A안(권고, t 의미 유지):**  
송신 시 `captureApproxServerMs = Date.now() + serverTimeOffset`을 **신규 필드**(예: `tSrv`)로 실어 보낸다. 기존 `t`는 그대로(기기 시각).  
수신·표시는 `tSrv`가 있으면 그것을 캡처 시각 근사로 쓰고, 없으면 현행 stamp 경로(하위 호환).

**B안(비권고):** 기존 `t`의 의미를 server-relative로 바꾼다 → **명시적 Chief 승인 항목**, Rules·구버전 클라·TASK-30 시계독립 가정과 충돌 검토 필수.

표시용 commonNow:

```text
commonNow = Date.now() + serverTimeOffset   // 연결 중
renderTime = commonNow - D
```

캡처 샘플 `(tSrv, distM)` 버퍼를 renderTime에서 보간. peer는 현 integrator와 같은 계약으로 `tSrv` 축에 맞춘다.

### 3.4 접속/복구

| 상태 | 동작 |
|------|------|
| offset 미수신(첫 연결 전) | 표시는 현행(self now / peer 수신축) 유지. 「공통 시계 준비 전」 |
| 재연결 후 offset 점프 | D·버퍼는 유지. renderClock은 기존 catchup(±10%/s)로 흡수. 5s 이상 점프면 현 `PEER_RENDER_CLOCK_RESYNC_MS`와 동일 즉시 맞춤 |
| FS only | `lastSeenAt`을 서버축으로 보되, 캡처≠커밋임을 UI 불확실성에 반영(§6) |

## 4. 공통 지연 D — 300 vs 440 충돌 해소

현행 peer 적응 지연: `max(160, min(3000, gapEma × 2.2))`.  
생산 송신 200ms → gap≈200 → **D_peer ≈ 440ms**.

06이 쓰던 **고정 300ms는 gap×2.2≈440보다 짧다** → 재생 시점이 버퍼 최신보다 앞서 **외삽 비율이 다시 오른다**(peerSyncPolicy 주석·2026-09-27 계측과 동일 원인).

### 권고 D 정책

```text
D = clamp(
  max(PEER_COVIEW_FLOOR_MS, peerArrivalGapEma × 2.2),
  PEER_INTERP_DELAY_MS,          // 160
  PEER_COVIEW_DELAY_MAX_MS       // 권고 500 — 아래
)
```

| 상수 | 값 | 이유 |
|------|-----|------|
| `PEER_COVIEW_FLOOR_MS` | **440** (생산 200ms×2.2) | 300 폐기. 지원 송신 간격의 한 칸+여유 |
| `PEER_COVIEW_DELAY_MAX_MS` | **500** | 나란히 느낌 상한. 기존 INTERP_MAX 3000과 **분리** |
| 지원 송신 간격 | **200ms (5Hz)만** | `PEER_MOTION_PUBLISH_INTERVAL_MS=200` |

**1초 송신에서 300/500ms로 항상 보간된다고 주장하지 않는다.**  
1s×2.2=2200ms > 500ms 상한 → 상한에 걸리면 외삽·hold가 늘고, A3처럼 수렴도 길다. **제품 지원 범위 밖**으로 명시하고, 1s/3s는 표시 일치 게이트 대상이 아니다(3000ms는 이미 RTDB stale 2500과 policyConflict).

혼자 주행(peer 없음): D=0, commonNow 불필요(맵 반응성).

창 A·B가 각자의 gap EMA를 쓰면 D가 갈라진다 → **Trail 단위로 공유하는 D 후보**:

1. **로컬 동일 함수 + 동일 송신 간격 가정**(wire 0): 양쪽 200ms면 정상 시 D≈440으로 수렴. 지터로 ±수십 ms 차이 가능 → 순서 tie 범위(§6)로 흡수.  
2. **(후속, 승인 시)** 호스트/서버가 D를 브로드캐스트 — 트래픽·스키마 증가. 1차에서는 1만.

1차를 **1**로 권고. B 측정에서 공통 D 고정 시(이상화) stall 제외 mismatch≈0.

## 5. 변경 범위 · 트래픽 · 단계

### 5.1 터치 파일 (승인 후 예상)

| 영역 | 파일 | 변경 |
|------|------|------|
| 서버 offset | 신규 소형 모듈 예 `peerMotion/serverClockOffset.ts` | `.info/serverTimeOffset` 구독·캐시·불확실 플래그 |
| 송신 | `liveLocationSnapshot` / motion encode | 선택 필드 `tSrv` (A안). **기존 t 유지** |
| self 표시 버퍼 | 신규 `selfDisplayBuffer.ts` 등 | `(tSrv 또는 localMapped, distM)` 링버퍼 |
| 표시 시계 | `App.tsx` liveForMap · `rideCameraFraming` | peer 있을 때 renderTime 공유 |
| peer | `integrator` / Registry | 가능하면 tSrv 축만 정렬. DELAY 상한 coview와 공유 getter |
| HUD | 표시 거리 vs raw 거리 분리 명시 | Claim/raw는 즉시 |
| 시험 | `two-view-order-harness` · peer-spacing gate | 창 간 mismatch 게이트 추가 |
| **제외 1차** | Rules 대변경, FS 송신 주기, 경쟁 판정 서버화 | 별도 승인 |

### 5.2 wire / API / Rules

| 항목 | 1차 | 승인 메모 |
|------|-----|-----------|
| 기존 `t` 의미 변경 | **하지 않음** | B안이면 별도 승인 |
| 신규 `tSrv` (number, ms) | 권고 | RTDB payload optional. 구클라 무시 |
| FS schema | 불변 | 표시용 FS 증가 금지(4s steady) |
| Rules | `tSrv` 숫자·범위 정도면 소폭 | 의미 있는 Rules 완화 없음 |
| 송신 주기 | 불변 200ms | 일치 요구로 주기 축소 금지 |

### 5.3 트래픽

| 항목 | 증분 |
|------|------|
| `.info/serverTimeOffset` | SDK 내장 메타. motion과 별도 대량 송신 없음 |
| `tSrv` 필드 | 패킷당 수 바이트. 5Hz × peer 수 — **미미** |
| motion 송신 빈도 | **0** |
| FS read/write | **0** (표시용 추가 구독 금지) |

### 5.4 단계

1. **측정 고정**(완료): stamp 게이트·전환·two-view 수치.  
2. **승인**: 본 권고(공통 과거+D=floor440/max500+tSrv+offset).  
3. **구현**: offset → tSrv → self 버퍼 → 카메라/표시 결합. raw/Claim 분리.  
4. **회귀**: `test:peer-spacing` · two-view mismatch(stall 제외 0) · fallback 54 · smoothness/liveness · 혼자 D=0.

## 6. stall · 미도착 · tie

어떤 방법도 패킷이 안 오면 **「현재 진실」을 확정하지 못한다.**

| 상황 | 표시 | 순서 |
|------|------|------|
| peer stall > `PEER_INTERP_MAX_EXTRAP_MS`(1200ms) | hold(현행). self도 같은 renderTime | 간격이 벌어져 보일 수 있음 = 신호 공백. **순서로 단정하는 UI 문구 금지** |
| 한쪽만 stall | 공통 D로도 mismatch 잔존(B: 167–197/1800) | 「신호 약함」정도. 앞뒤 배지 숨김 또는 점선 |
| 거의 같은 위치 | \|Δdist\| < **tieM** | 동률. 권고 **tieM = max(0.5m, v·0.05s)** ≈ 0.5–0.8m @20km/h. B 하네스 부호 동률 임계 0.05m는 측정용; 제품 UI는 더 넓게 |
| offset 불확실 | 공통 시계 배지 off | 창 안 상대만 맞추고 창 간 절대 일치는 비주장 |

UI 기능(배지·점선·동률)은 **계획만** — 승인 후 구현.

## 7. 검증 완료 조건 (승인·구현 후)

1. two-view: 등속·대칭·\|g\|>v·D 및 \|g\|<v·D 모두에서 **창 간 순서 mismatch ≈ 0** (공통 정책 적용 후).  
2. 비대칭 RTT: 동일.  
3. stall: mismatch 잔존을 **허용**하되 UI가 순서를 단정하지 않음.  
4. `test:peer-spacing` · fallback · smoothness 회귀 PASS.  
5. 혼자 D=0.  
6. 1s/3s 송신은 게이트 대상 외(문서화).  
7. Chief 육안: uid·이름표·경로 거리 기준 앞뒤 일치(색 무시).

## 8. Chief에 물을 것

1. 본 권고(공통 과거 + floor 440/max 500 + `tSrv` 추가 + offset) **승인 여부**.  
2. 기존 `t` 의미 변경(B안)은 **하지 않음** 확인.  
3. 경쟁·보상 판정을 화면과 분리할지(서버 통과 시각) — 필요 시 별도 묶음.  
4. 1s 이상 송신 지원을 제품에 넣을지(넣으면 D 상한·stale 정책 재설계).

## 9. 비범위

- 승인 전 카메라/HUD/self 지연/wire 구현 금지.  
- 송신 주기 축소로 일치 「해결」금지.  
- TASK-02/03 stamp·게이트와 표시 정책을 한 커밋에 섞지 말 것.
