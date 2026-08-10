# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> 마치면 `REPORT.md` 작성, 이 파일 `상태` → `보고완료`.
> 보고 형식은 `../cyclefit-relay/SUPERVISOR-PROTOCOL.md` §1-3 **UAG** 준용.

- **지시번호**: S1 (증상 정량화)
- **발신**: 클로드감리 · **일시**: 2026-08-10 · **상태**: 배포
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`) — 이 브랜치에서만 작업

---

## 0. 배경 — 이미 확정된 사실 (재조사 금지)

`METRICS_UI_MS = 200`(`useVirtualRideSession.ts:22`)이 `distM`의 실제 갱신 주기다.
`PUBLISH_TICK_MS = 100`(`useLiveLocationPublishSession.ts:26`)으로 200ms 창에 2번 발행되지만
두 패킷의 `distM`이 **동일**하고, 두 번째는 `integrator.ts:64`의 dedup에서 버려진다.

> **10Hz 상향은 RTDB write를 2배로 늘렸을 뿐, 보간 버퍼 입력은 여전히 5Hz다.**

→ "주기를 줄이면 정확해진다"는 가정은 **코드상 이미 반증**되었다. S1은 이걸 다시 검증하는 게 아니라,
**남은 오차가 몇 미터인지** 확정한다.

---

## 1. 이번 지시의 범위

**코드 수정은 아래 1건뿐이다. 동기화 로직·상수·발행 경로는 절대 건드리지 마라.**

`apps/web/src/lib/peerRidersDrive.ts:14` — 로그 throttle 1,000ms 고정을 DEV 전용 가변으로.

```ts
// 예시 — 구현 방식은 재량
const ms = Number(new URLSearchParams(location.search).get("peerSyncLogMs")) || 1_000;
if (nowMs - peerDriveDevLogAt < ms) return;
```

이유: 출발(램프 최대 11.25s)·감속(4.5s) 구간이 1초 throttle에서는 표본 4~11개뿐이라
시간축 정렬이 불가능하다. `?peerSyncLogMs=200`으로 낮춰 측정한다.

---

## 2. 측정 프로토콜

**기기 2대**(A=송신·관측대상, B=수신·화면). 같은 Trail, 같은 publication.

### 2-1. 로그 소스 (신규 계측 코드 작성 금지)

| 값 | 출처 |
|---|---|
| `self` (A의 authoritative distM) | **A 기기** 콘솔 `[peerSync] self=` |
| `newest` · `disp` · `age` · `buf` · `spd` | **B 기기** 콘솔 `[peerSync] … uid: …` |

⚠ B의 `gap(newest-self)`는 **B 자신의 거리와의 차이**이므로 오차가 아니다. 판정에 쓰지 마라.
정답값은 **A 기기 로그의 `self`** 뿐이다.

### 2-2. 시각 정렬

양쪽 로그 줄에 `Date.now()` 원값이 함께 남도록 하고, 두 기기의 시계 오차를 **측정 직전·직후 각 1회**
(예: 같은 시각 표시 페이지를 동시 캡처, 또는 두 기기에서 동일 NTP 소스 확인) 기록해 보고서에 적어라.
보정하지 않은 채 미터 오차를 주장하지 마라.

### 2-3. 측정 매트릭스 — 8케이스 전부

| zoom | 구간 |
|---|---|
| **15** (보간 경로) | 출발 / 정속 / 감속 / 일시정지 |
| **13** (spectator 5km/h 경로) | 출발 / 정속 / 감속 / 일시정지 |

- 정속은 30 km/h 기준, 최소 20초 유지.
- 출발은 0 → 30 지정 후 램프 종료까지 전 구간.
- 일시정지는 정지 후 최소 10초 관측(외삽 폭주 여부).

---

## 3. 산출물 — `REPORT.md`

### 3-1. 케이스별 표 (8개)

같은 시간축에 정렬한 원시 표를 그대로 싣는다. 요약만 쓰지 마라.

```
t(ms)   A.self   B.newest   B.disp   B.age   B.buf   B.spd
```

### 3-2. 케이스별 2개 지표

```
D_eff    = RMSE( B.disp(t) , A.self(t − D) ) 를 최소화하는 D    ← 실효 지연(ms)
residual = 그 D_eff 에서의 오차 RMSE · P95 · max                 ← 잔차(m)
```

- `D_eff`는 "얼마나 뒤처지는가", `residual`은 "얼마나 흔들리는가"에 답한다.
- **의도된 160ms 보간 지연은 `D_eff`에 흡수되므로 잔차를 오염시키지 않는다.**
  단순히 `A.self(t)`와 비교해 "오차 X m"라고 보고하면 **반려한다.**
- 계산은 스프레드시트·간단 스크립트 무엇이든 좋다. 산출 근거를 첨부하라.

### 3-3. 판정 기준 (승인됨)

| 지표 | 상한 |
|---|---|
| `D_eff` | **350 ms** (30km/h에서 2.9 m) |
| `residual` RMSE | **1.0 m** @30km/h |
| `residual` max | **2.5 m** |

zoom 13에도 같은 상한을 적용한다.

### 3-4. 필수 결론 3줄

1. 8케이스 중 상한 초과 케이스 목록
2. 사용자가 말한 "상당한 차이"가 **몇 미터·어느 케이스**였는지 확정
3. S2(replay 하네스)의 지연 모델에 넣을 **실측 지연 base·jitter 분포**

---

## 4. 금지

- 동기화 상수(`rideSyncPolicy.ts`) 변경 — S3 이후 사안
- 발행 경로·속도 필드 수정 — S3 사안 (원인은 이미 특정됨, 지금 고치면 증상이 사라져 정량화 불가)
- 신규 계측 유틸 작성 — 기존 `peerRidersDrive.ts` / `PeerMotionRegistry.debugSnapshot` 재사용
- 커밋은 §1의 1건 변경만. `main2` 병합 금지
