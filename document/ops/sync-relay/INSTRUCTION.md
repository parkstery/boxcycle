# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> S3B-1 보고서는 **감리가 `REPORT-S3B1.md` 로 보존**했다. 너는 **새 `REPORT.md` 만 작성**하고
> 기존 보고서를 옮기거나 덮지 마라. 마치면 이 파일 `상태` → `보고완료`.
> 보고 형식은 `../cyclefit-relay/SUPERVISOR-PROTOCOL.md` §1-3 **UAG** (rider 전용 규율은 해당 없음).

- **지시번호**: S3B-2 (D-1 적용속도 발행 + Firestore 쓰기량 검증)
- **발신**: 클로드감리0812 · **일시**: 2026-08-12 · **상태**: 배포
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`)

---

## 0. 출발점 — S3B-1 은 채택됐다 (재조사 금지)

```
z15 스케일          종결
z15 정확도(D-0)     종결   D_eff 340/300 · RMSE 0.394/0.322 · max 1.245/1.303
```

근거는 `HANDOFF.md` §3-7. **이 결과는 이번 작업에서 지켜야 할 회귀 기준선이다.**

### 0-1. 이번 지시의 목적 — z15 를 다시 고치는 것이 아니다

**S3B-3(저줌)의 선행 조건을 만드는 것이다.** spectator 가 읽는 `speedMps` 는 Firestore 값이고,
그 값이 지금 **슬라이더 목표속도**다. 이걸 바로잡지 않고 저줌 외삽만 실제 속도로 바꾸면
**틀린 속도로 외삽만 정교해진다**(`HANDOFF` 순서 의존 1).

z15 정확도 개선은 이번 목표가 **아니다.** 유지만 하면 된다.

### 0-2. 인용 금지

`HANDOFF` §3-7 의 **Firestore ≈ 4.2 /s 는 텍스트 파싱 기반 불안정 참고값**이다.
**기준선으로 쓰지 마라.** 이번에 신뢰할 수 있는 계측을 새로 만들고 **기준선도 새로 뜬다.**

---

## 1. 고칠 것 — D-1 하나

`buildLiveLocationSnapshot`(`liveLocationSnapshot.ts:101-107`)이 `input.speedKmh` 를 쓴다.
그 값은 `App.tsx:201` 의 **슬라이더 목표속도**가 `:1438` `:1456` 을 거쳐 온 것이다.

**실측 증거** (`HANDOFF` §2)

```
정속 구간   실제 진행속도 6.23 m/s  vs  발행 speedMps 8.05      (+29 % 과대)
출발 구간   발행 spd 1.39 m/s 고정(=5 km/h 초기 슬라이더)  ← A 는 8 m/s 로 가속 중
```

### 1-1. 요구사항

```
가. 발행 속도를 rAF 적용속도에서 만든다
    peekSampleAppliedSpeedKmh() 가 유한값이면 그것을 쓰고,
    NaN(미등록·idle)이면 input.speedKmh 로 폴백한다     ← S3B-1 의 D-0 와 같은 관용구

나. routeRidePhase === "paused" 일 때 speedMps = 0 인 현재 동작은 유지한다

다. 발행 경로만 바꾼다
    App.tsx 의 rideMetrics 소비처(HUD 속도 표시 :1623 · :1810 등)는 건드리지 마라
```

**`buildLiveLocationSnapshot` 안에서 고쳐라.** 그러면 `:1438`·`:1456` 두 경로가 함께 덮인다.
`App.tsx` 를 수정할 필요가 없다.

---

## 2. Firestore 쓰기량 — **신뢰할 수 있는 계측을 먼저 만든다**

적용속도는 램프 구간에서 **연속으로 변한다.** `SPEED_PUBLISH_DELTA_MPS = 0.28`(≈1 km/h,
`liveLocationSnapshot.ts:179`)의 델타 우회가 `shouldPublishRouteProgress`(`:182-199`)에도 걸려 있어
**Firestore 1 Hz 경로가 증폭될 수 있다.** RTDB 는 single-flight 가 상한을 잡지만 Firestore 는 아니다.

### 2-1. 계측 신설 (DEV 전용)

`mergeTrailLivePublicationRideSnapshot` 호출 지점(`publishLiveLocationFanout.ts:39`)에
**pt3 와 같은 형태**로 방출점을 하나 추가한다.

```
pt9   fsWriteStartAt · fsWriteDoneAt · fsWriteRttMs · ok(1/0) · uid
      기존 peerSyncChainLog 를 재사용한다. 새 로깅 프레임워크 금지
      import.meta.env.DEV 게이트 필수
```

**텍스트 파싱으로 세지 마라.** 방출점 건수로 센다.

### 2-2. 기준선을 새로 뜬다 — **같은 계측기로 2 회 측정**

```
1) 기준선 런   pt9 계측만 넣고 D-1 은 아직 적용하지 않은 상태로 측정
2) 사후 런     D-1 적용 후 같은 spec·같은 조건으로 측정
```

**커밋도 이 순서로 나눠라** — ① 계측 추가, ② D-1 적용. 한 커밋에 섞지 마라.
기존 `S3AV`·`S3B1` 의 Firestore 수치는 **기준선으로 쓰지 마라.**

### 2-3. 구간을 나눠서 낸다

증폭 위험은 **램프 구간에 몰린다.** 전체 평균으로 뭉개면 보이지 않는다.

```
depart(램프) · cruise(정속) 각각   Firestore 쓰기 건수 / 초 · pt9 n · fsWriteRttMs p50/p95
```

---

## 3. 수용 조건 — 전부 충족해야 PASS

### 3-1. D-1 이 실제로 고쳐졌는가

```
known-fail d1-target-vs-applied 기대값 뒤집기
   현재: 발행 speedMps 가 실제 진행속도와 ≥ 20 % 어긋남을 단언
   이후: < 20 % 로 뒤집는다. 뒤집었다는 사실을 보고에 명시
출발 구간 발행 speedMps 가 5 km/h 에 고착되지 않는다   ← 실측으로 보여라
```

`d0-duplicate-distm` 은 **그대로 PASS** 여야 한다(S3B-1 에서 이미 뒤집힌 상태).

### 3-2. z15 정확도 회귀 금지 — S3B-1 결과를 지킨다

`S3B1` 과 **같은 조건**으로 재측정한다(같은 spec, skew = 0, 앞 2 s 폐기, `maxDelayMs = 3000`,
겹침 ≥ 0.7, 전제 Δ ≥ 100 m · 창 ≥ 20 s).

| case | `D_eff` | RMSE | max |
|---|---:|---:|---:|
| z15-depart | ≤ 350 ms | ≤ 1.0 m | ≤ 2.5 m |
| z15-cruise | ≤ 350 ms | ≤ 1.0 m | ≤ 2.5 m |

**예산은 변경 금지.** 스케일 게이트(≤ 10 %)도 유지.

### 3-3. S3A 성과 회귀 가드

```
inFlightMax          ≤ 1
A_firstOutOfOrder    = 0
전진 packet 폐기      = 0
pt3 ok=0             = 0
pt9 ok=0             = 0        ← 신설
publishQueueMs       p50 ≤ 150 · p95 ≤ 400 · max ≤ 800 · 1 s 초과 0 %
```

### 3-4. 쓰기량

```
RTDB        사후 / 기준선 ≤ 1.3
Firestore   사후 / 기준선 ≤ 1.3        ← §2-2 의 새 기준선 대비. 구간별로도 확인
```

⚠ **초과하면 FAIL 로 보고하고 멈춰라.**
`SPEED_PUBLISH_DELTA_MPS` · `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS` 를 **건드려 통과시키지 마라.**
상수 조정은 제품 정책이며 **Chief 결정 사항**이다. 증가분을 숨기지 말고 수치 그대로 올려라.

---

## 4. 반증 조건 (해당하면 즉시 보고하고 멈춰라)

> *"적용속도로 바꿨는데 Firestore 쓰기가 기준선 대비 1.3 배 이내이고 램프 구간에서도
> 증가가 없다면, 「적용속도가 델타 우회를 통해 Firestore 를 증폭시킨다」는 감리의 예측이 틀린 것이다."*

반대로 **1.3 배를 넘으면** 그것도 즉시 보고 대상이다. **어느 쪽이든 원인을 찾으려 들지 말고
수치를 그대로 보고하라.** 다음 판단은 Chief 가 한다.

---

## 5. 보존

```
document/ops/sync-relay/S3B2-base-events.json     기준선 런 pt1~pt7 + pt9 전량
document/ops/sync-relay/S3B2-chain-events.json    사후 런  pt1~pt7 + pt9 전량
document/ops/sync-relay/S3B2-summary.json         §3-1~3-4 판정 · 구간별 쓰기량 · before/after
```

표본 추출 금지. 방출한 것은 전부 보존한다.

---

## 6. 금지

- **저줌 2건 (D-2)** — `MapView.tsx` peer 적분 · spectator 외삽. **S3B-3 이다. 손대지 마라**
- **F-1 · F-2** — 계속 보류. 발견해도 고치지 마라
- **S4 · Orchestrator** — 이번 작업에 섞지 마라
- 판정 예산 변경 · 새 판정 기준 신설
- `SPEED_PUBLISH_DELTA_MPS` · `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS` · `METRICS_UI_MS` ·
  보간 상수(`rideSyncPolicy.ts`) 변경
- `integrator.ts` 분기·dedup 조건 변경 · RTDB 구독 방식 변경
- single-flight · latest-wins 구조 변경
- S3B-1 의 D-0 배선 되돌리기
- cyclefit 자산·코드·스킬 일체 수정
- `main2` 병합 · PR · `--no-verify`

---

## 7. 보고

**새 `REPORT.md` 만 작성한다.**

```
반증  §4 해당 여부 (양방향 — 1.3 배 이내인지 초과인지)   ← 먼저

UAG   수용 판정표: §3-1 D-1 · §3-2 z15 회귀 · §3-3 가드 6 · §3-4 쓰기량
      한 줄 결론 — 「S3B-2 PASS(D-1 교정) · z15 유지」 형태로. 범위를 넓히지 마라

기술  구현 요약 (폴백 경로 · paused 처리)
      Firestore 쓰기량: 기준선 런 vs 사후 런, depart/cruise 구간별, pt9 n·RTT
      known-fail 뒤집기 내역 · d0 은 PASS 유지 확인
      z15 재측정 4 지표 before(S3B1)/after 대조
      보존 파일 경로 · 실패·미완 전수 · 이견 · 커밋(2 개 — 계측 / D-1)
```

**「부분 성공」은 없다.** §3-1~3-4 가 전부 충족될 때만 PASS 다.
**「멀티라이더 위치 동기화 결함 종결」이라고 쓰지 마라** — S3B-3 이 남아 있다.
**e2e 는 백그라운드로 던지고 산출물 파일만 확인하라. 실행 시간을 분 단위로 적어라.**
