# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> S3A-VR 보고서는 **감리가 `REPORT-S3AVR.md` 로 보존**했다. 너는 **새 `REPORT.md` 만 작성**하고
> 기존 보고서를 옮기거나 덮지 마라. 마치면 이 파일 `상태` → `보고완료`.
> 보고 형식은 `../cyclefit-relay/SUPERVISOR-PROTOCOL.md` §1-3 **UAG** (rider 전용 규율은 해당 없음).

- **지시번호**: S3B-1 (D-0 샘플링 낡음 제거)
- **발신**: 클로드감리0812 · **일시**: 2026-08-12 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`)

---

## 0. 출발점 — 확정된 사실 (재조사 금지)

S3A-VR 로 확정. 근거는 `HANDOFF.md` §3-5, 재현은 `s3avr-summarize.mjs`.

```
z15 스케일    종결   S1 48 %  →  0.94 %
z15 정확도    미종결  D_eff 560/540 > 350 · cruise max 2.746 > 2.5 · RMSE 는 여유
확정 사슬     ① 샘플링 낡음 231/217 · ② publishQueue 7/3 · ③ 전송 155/151 · ④ 보간 160
              (writeRtt 는 ③ 과 겹치므로 단계가 아니다)
```

**최대 단계는 ① 샘플링 낡음**이고, 전송(151~155)이나 보간 지연(160)보다 크다.

---

## 1. S3B 전체 계획 — 3 단계로 나눈다

**한 번에 셋을 넣지 마라.** 지금까지 원인 귀속이 흐려진 적이 반복됐다. 각 단계를 **단독으로 착지시키고
측정한 뒤** 다음으로 간다. 이번 지시는 **S3B-1 뿐**이다.

| 단계 | 내용 | 대상 | 근거 |
|---|---|---|---|
| **S3B-1** | **D-0** — 발행 스냅샷을 rAF 원본에서 만든다 | z15 정확도 | ① 217~231 ms, 사슬 최대 단계 |
| S3B-2 | D-1 — 적용속도 발행 | 저줌 선행 조건 | 외삽 오차는 이미 작다(max 0.98 m). 주 가치는 ③ 아래 |
| S3B-3 | D-2 — 저줌 2건 (registry 적분 유지 · spectator 실제속도) | z13 판정 재개 | z13 현재 RMSE 1.14 · max 3.22 |

### 1-1. 순서를 이렇게 잡은 이유

- **S3B-1 단독으로 z15 정확도가 닫힐 가능성이 크다.** ① 을 없애면 `D_eff` 는
  560−231 = **329**, 540−217 = **323** 으로 예산 350 안이다. 닫히면 S3B-2 의 우선순위가 바뀐다 —
  **먼저 확인하고 나서 다음을 정한다.**
- **S3B-3 은 S3B-2 뒤에만** 온다(`HANDOFF` 순서 의존 1). spectator 가 읽는 `speedMps` 는
  Firestore 값이고 그 값 자체가 목표속도다. 순서를 뒤집으면 **틀린 속도로 외삽만 정교해진다.**
- S3B-2 를 S3B-1 뒤에 둔 것은 우선순위가 아니라 **귀속 분리**다. 둘을 같이 넣으면 어느 쪽이
  `D_eff` 를 줄였는지 알 수 없다.

---

## 2. 이번 지시 — S3B-1 범위

`buildLiveLocationSnapshot`(`liveLocationSnapshot.ts:89`)이 `input.virtualDistanceMeters` 를 쓴다.
그 값은 `useLiveLocationPublishSession` 의 `inputRef` 를 거쳐 온 **React 상태**이고
`METRICS_UI_MS = 200` 마다만 갱신된다.

**rAF 원본을 읽는 sampler 는 이미 있고, 같은 함수 안에서 이미 호출되고 있다.**

```ts
// liveLocationSnapshot.ts:125  — 현재는 DEV diagCapture 용으로만 호출
authDistAtCapture: peekSampleVirtualDistanceM(),
```

`registerPeerSyncDistanceSamplers`(`useVirtualRideSession.ts:197`)는 **DEV 게이트가 없다.**
운영에서도 사용 가능하다.

### 2-1. 요구사항

```
가. 발행 스냅샷의 거리를 rAF 원본에서 만든다
    peekSampleVirtualDistanceM() 이 유한값이면 그것을 쓰고,
    NaN(미등록·idle)이면 input.virtualDistanceMeters 로 폴백한다

나. distMetersAlongRoute 와 progressRatio 를 같은 값에서 유도한다
    둘이 다른 원천을 쓰면 RTDB 의 d 와 Firestore 의 progressRatio 가 어긋난다

다. 발행 경로만 바꾼다
    App.tsx 의 rideMetrics 소비처(거리 표시·완주 판정·기록 저장)는 건드리지 마라
    — :535 :1027 :1599 :1829 등. 이번 변경은 publish 스냅샷에 한정한다
```

**`speedKmh` 는 이번에 바꾸지 마라.** D-1 은 S3B-2 다.

---

## 3. 수용 조건

### 3-1. 정확도 (승인된 예산 — 변경 금지)

`S3AV`/`S3AVR` 와 **같은 조건**으로 재측정한다(같은 spec, 같은 창 조건, skew = 0, 앞 2 s 폐기,
`maxDelayMs = 3000`, 겹침 ≥ 0.7).

| case | `D_eff` | RMSE | max |
|---|---:|---:|---:|
| z15-depart | ≤ 350 ms | ≤ 1.0 m | ≤ 2.5 m |
| z15-cruise | ≤ 350 ms | ≤ 1.0 m | ≤ 2.5 m |

### 3-2. 사슬 재산출 — ① 이 사라졌는지 직접 확인

```
① 샘플링 낡음 p50 ≤ 20 ms      (현재 231 / 217)
사슬 합계와 D_eff 교차검산      |합계 − D_eff| ≤ 50 ms      ← S3A-VR 게이트 유지
```

### 3-3. S3A 성과 회귀 가드 — 전부 유지되어야 한다

```
inFlightMax                    ≤ 1        (현재 1)
A_firstOutOfOrder              = 0        (현재 0)
전진 packet 폐기                = 0
pt3 ok=0                       = 0
publishQueueMs                 p50 ≤ 150 · p95 ≤ 400 · max ≤ 800 · 1 s 초과 0 %
```

single-flight · latest-wins 는 **유지한다. 손대지 마라.**

### 3-4. 쓰기량 회귀 — 측정해서 보고

D-0 이 들어가면 `distM` 이 매 발행마다 달라져 **`integrator.ts:64` dedup 이 더는 버리지 않는다.**
accepted 스냅샷 수가 늘고, 버퍼가 빨리 찬다. 이건 의도된 결과다.

```
보고 필수   RTDB 쓰기 건수 / 초        S3AV 대비
            accepted · sameDist 폐기 건수  S3AV 대비
            Firestore 쓰기 건수 / 초      S3AV 대비 (변화 없어야 정상)
게이트      RTDB 쓰기 건수가 S3AV 대비 1.3 배를 넘으면 FAIL 로 보고
            (single-flight 가 상한을 잡고 있으므로 크게 늘 이유가 없다)
```

**임계를 넘으면 완화하지 말고 그대로 보고하라.**

### 3-5. known-fail 뒤집기

`d0-duplicate-distm` 은 「연속 중복 `distM` ≥ 40 %」를 현재 동작으로 단언하는 테스트다.
**이번 수정으로 깨지는 것이 정상이다.** 기대값을 뒤집고, 뒤집었다는 사실을 보고에 명시하라.
`d1-target-vs-applied` 는 **그대로 PASS 여야 한다** — 깨지면 범위를 넘은 것이다.

---

## 4. 반증 조건 (해당하면 즉시 보고하고 멈춰라)

> *"① 샘플링 낡음을 20 ms 이하로 줄였는데도 `D_eff` 가 450 ms 를 넘으면,
> 「① 이 사슬 최대 단계이고 이를 제거하면 예산 안에 들어온다」는 감리의 예측이 틀린 것이다."*

예측은 `D_eff` ≈ 330 ± 30 ms 다. **크게 벗어나면 원인을 찾으려 들지 말고 보고하라.**

---

## 5. 보존

```
document/ops/sync-relay/S3B1-chain-events.json    pt1~pt7 전량 · 표본 추출 금지
document/ops/sync-relay/S3B1-summary.json         §3-1~3-4 판정 · 사슬 재산출
```

---

## 6. 금지

- **`speedKmh` / 적용속도 발행 (D-1)** — S3B-2
- **저줌 2건 (D-2)** — S3B-3
- **F-1 · F-2** — 계속 보류. 발견해도 고치지 마라
- **S4 · Orchestrator** — 이번 작업에 섞지 마라
- 판정 예산 변경 · 새 판정 기준 신설
- 보간 상수(`rideSyncPolicy.ts`) · `SPEED_PUBLISH_DELTA_MPS` · `METRICS_UI_MS` 변경
  — **`METRICS_UI_MS` 를 줄여서 해결하지 마라.** 그건 UI 렌더 주기이고 원인 제거가 아니다
- `integrator.ts` 분기·dedup 조건 변경 · RTDB 구독 방식 변경
- single-flight · latest-wins 구조 변경
- cyclefit 자산·코드·스킬 일체 수정
- `main2` 병합 · PR · `--no-verify`

---

## 7. 보고

**새 `REPORT.md` 만 작성한다.**

```
반증  §4 해당 여부   ← 먼저

UAG   수용 판정표: §3-1 정확도 2 케이스 · §3-2 사슬 · §3-3 회귀 가드 5 · §3-4 쓰기량
      before/after 대조 (S3AV/S3AVR 대비)
      한 줄 결론

기술  구현 요약 (폴백 경로 포함) · distMetersAlongRoute 와 progressRatio 원천 일치 확인
      사슬 4 단계 재산출표 (p50 / p95 / n / m 환산)
      known-fail 뒤집기 내역 · d1 은 PASS 유지 확인
      보존 파일 경로 · 실패·미완 전수 · 이견 · 커밋
```

**「부분 성공」은 없다. §3-1~3-4 가 전부 충족될 때만 PASS 다.**
**e2e 는 백그라운드로 던지고 산출물 파일만 확인하라. 실행 시간을 분 단위로 적어라.**
