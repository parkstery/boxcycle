# 멀티라이더 위치 동기화 — 인수인계 (SoT)

- **브랜치**: `fix/multiplayer-position-sync` (base `main2`)
- **릴레이**: 이 디렉터리. `cyclefit-relay`와 **별개 작업선** — 서로의 `INSTRUCTION.md`를 덮지 마라.
- **작성**: 클로드감리 2026-08-10 (조사 단계 결과 이관)

---

## 1. 현재 구조 요약

**이중 전송**

| 경로 | 주기 | 타임스탬프 | 용도 |
|---|---|---|---|
| RTDB `trails/{tid}/motion/{uid}` | 100ms 발행 / **실효 5Hz** | **송신 기기 시계** `Date.now()` | 보간용 주 경로 |
| Firestore `trails/{tid}/livePublicationRides/{uid}` | 1s | `serverTimestamp()` | 목록·저줌·폴백 |

**렌더** — peer는 `now − PEER_INTERP_DELAY_MS(160)` 시점으로 보간(`integrator.ts stepPeerMotionEntity`),
버퍼 밖이면 `PEER_INTERP_MAX_EXTRAP_MS(1200)`까지 외삽 후 고정.

**구독 허브** — `livePublicationRidesSubscriptionHub.ts` / `rtdbMotionSubscriptionHub.ts`가
trailId당 구독 1개로 refcount 관리한다. **consumer 중복 구독은 이미 제거되어 있다** — 다시 손대지 마라.
남은 증폭은 (a) Firestore 컬렉션 전체 구독 → 클라 N × 문서 N = **N²**, (b) RTDB 부모 노드 `onValue` →
자식 1건 변경마다 노드 전체 다운로드, (c) `subscribeTrailIdsWithActiveLiveRides`
(`firestoreTrailLivePublicationRides.ts:230`) 전역 collectionGroup 실시간 구독.

---

## 2. 확정된 원인 (코드 근거 있음)

| # | 원인 | 위치 |
|---|---|---|
| **D-0** | 200ms 샘플 vs 100ms 발행 → 중복 패킷이 dedup에서 폐기. **10Hz 상향 실효 0, write만 2배** | `useVirtualRideSession.ts:22` · `useLiveLocationPublishSession.ts:26` · `integrator.ts:64` |
| **D-1** | 발행 속도가 **목표속도**(슬라이더)라 램프 중 실제와 불일치 → 외삽 과대 | `App.tsx:1438` ← `App.tsx:201` |
| **D-2** | zoom ≤ 14에서 peer 적분 중단, spectator는 **고정 5km/h** 외삽 | `MapView.tsx:2258` · `useTrailLivePublicationRideSpectatorOverlay.ts:151-161` |
| **D-3** | 구조적 지연 예산 ≈ 326ms 평균 / 476ms 최악 (네트워크 제외) | 위 경로 합산 |
| **D-4** | dedup **이전에** `speed`·`phase`를 갱신 → 폐기될 패킷도 상태 오염 | `integrator.ts:46-54` |
| **D-5** ★ | **지배 원인** — publish in-flight 미방지 + motion 이 Firestore 뒤 순차 await | `useLiveLocationPublishSession.ts:232·248·273` · `publishLiveLocationFanout.ts:34·39·52` |

**★ D-5 가 이 결함의 지배 원인이다** (S3-DIAG-R2 실측, §3-4). 나머지 D 는 부차적이다.

**추정 (미확인)** — D-6 RTDB row staleness 미검사(`syncFromPresence.ts:62`),
D-7 송수신 geometry 불일치 가능성.
**D-8** `routeLen ≠ geoLen` — 경로·완주 계열 별건(§3-3).

### D-0 · D-1 실측 확정 (S1 실패킷 91건 — `s2-z15-cruise-scenario.json`)

```
연속 중복 distM      38 / 90 = 42%                      ← D-0 현장 확정
첫 6 s 실제 진행속도  6.23 m/s  vs 발행 speedMps 8.05    ← D-1 (+29% 과대)
depart 구간 발행 spd  1.39 m/s 고정(=5km/h 초기 슬라이더) ← D-1 (A 는 8 m/s 로 가속 중)
```

### 체인 진단 전에 알아둘 것 (감리 확인 완료 — 재조사 금지)

- **S1 의 `self` 로그는 ① 이 아니라 ② 다.** `useLiveLocationPublishSession.ts:209` 가
  `setPeerSyncSelfDistM(snapshot.distMetersAlongRoute)` 이다.
  → **① authoritative(rAF 원본)는 아직 한 번도 계측된 적이 없다.**
  ①→② 변환은 `rideDistanceAlongRoute`(`liveLocationSnapshot.ts:42-52`)이고
  `min(routeDistanceMeters, geometryLengthMeters)` 로 **clamp** 한다 — 항등이 아니다.
- **발행 게이트는 속도를 억제하지 않는다.** `shouldPublishPeerMotion`
  (`liveLocationSnapshot.ts:179-195`)은 시간 기반 100 ms + 속도 델타 우회다.
  "속도가 낮아서 발행이 막혔다"는 가설은 **이미 반증됐다.**
- ✅ **지배 링크 확정 = ②→③ (발행 큐)**. S3-DIAG-R2 실측. §3-4 참조.

---

## 3. 단계 계획

| 단계 | 내용 | 상태 |
|---|---|---|
| **S1** | 증상 정량화 (`D_eff` / `residual`, 8케이스) | **보고완료 — ⚠ 절반만 유효** (아래) |
| **S2** | S1 재분석 + replay 하네스(`truth(t)` · 지연 모델 · 시나리오 5종 · 불변식) | **보고완료** (`REPORT.md`) |
| **S3-DIAG** | 패킷 단위 체인 진단 | **보고완료 — ⚠ 최초 이탈 판정 기각** (`REPORT-S3D.md`, 아래 §3-1) |
| **S3-DIAG-R2** | 체인 재판정 | **보고완료 — 진단 종결** (`REPORT-S3DR2.md`, §3-4) |
| **S3A** ★ | 발행 큐 제거 — motion 을 Firestore 선행 await 에서 분리 · single-flight · latest-wins | **보고완료 — 수용 6/6 PASS** (`REPORT-S3A.md`) |
| **S3A-V** | 증상 종결 검증(측정 전용) | **보고완료 — 스케일 PASS · 시계 보정 무효** (`REPORT-S3AV.md`, §3-5) |
| **S3A-VR** | 정확도 재검산 고정 — skew=0 · 중복 없는 지연 사슬 · 교차검산 게이트 | **보고완료 — 게이트 2/2 PASS** (`REPORT-S3AVR.md`) |
| **S3B-1** | D-0 제거 — 발행 스냅샷을 rAF 원본에서 | **보고완료 — PASS 채택** (`REPORT-S3B1.md`, §3-7) |
| S3B-2 | D-1 — 적용속도 발행 + **Firestore 쓰기량 계측** | 대기 (S3B-1 뒤) |
| S3B-3 | D-2 — registry 적분 유지 + spectator 실제속도 **+ 시간 기준 정리** | 대기 (S3B-2 뒤) |
| **S4** | 비용 3차 (heartbeat · Trail touch · RTDB child listener · 전역 목록) | 대기 |

### ⚠ S3 재정의 (감리0811)

기존 S3(적용속도 발행 D-1 → 저줌 D-2)를 **S3B 로 미루고, 발행 큐 제거(S3A)를 앞으로 당긴다.**

**사유** — D-1 이 위치 오차로 바뀌는 지점은 외삽 구간인데, S3-DIAG-R2 실측 외삽 오차는
**p50 0.15 m · max 3.85 m** 로 작다. 반면 발행 큐는 **p50 37.7 m · max 115.9 m** 다.
D-1 을 먼저 고쳐도 지배 원인이 남아 증상이 그대로다. **순서를 뒤집는다.**

「안정성 2차」의 in-flight 방지는 **S3A 로 흡수**됐다(더 이상 2차가 아니라 1차다).

### ⚠⚠ 기준선 무효 — 인용 금지 (감리0811 판정)

```
[무효 1] z13 4케이스 = 합성       extrapolateSpectator() 가 5km/h 로 표본을 찍어냈다
                                  「최대 residual 392.80m」은 관측이 아니다
[무효 2] D_eff 7140ms · residual 54.9m  ← S2 가 "S3 목표 기준선"으로 올린 값. **무효**
[무효 3] z15-depart D_eff ≥10000ms                                          **무효**
```

**무효 사유** — `D_eff`는 *하나의 전역 시간 이동*을 가정한다. depart·cruise 는 그 가정이 성립하지 않는다.

| case | A.self 이동 | B.newest 이동 | 같은 창 | 판정 |
|---|---:|---:|---:|---|
| z15-depart | **89.8 m** | **14.0 m** | 16.5 s | 스트림 사실상 정지 — `age` 중앙 2,741 · 최대 15,121 ms, 외삽캡 초과 59%, `disp` 정지 55% |
| z15-cruise | 178.7 m | **264.4 m** | 22.1 s | 81 m 뒤에서 시작해 따라잡는 구간 — 정상 주행 아님 |
| z15-decel | 26.8 m | 29.3 m | 7.1 s | 정확도 예산 PASS · **스케일 판정 유보**(저속·짧은 창) |
| z15-pause | 8.0 m | 8.0 m | 12.5 s | 정확도 예산 PASS · **스케일 판정 유보**(저속·짧은 창) |

교차 증거: cruise 의 `age` 중앙값은 **171 ms** 다. 실제 파이프라인 지연은 ~330 ms 이지 7.1 초가 아니다.
40배 어긋나는 것 자체가 적합 실패의 증거다. 옵티마이저가 **거리 오프셋을 시간으로 환산**했다
(81 m ÷ 8.33 m/s ≈ 9.7 s).

> **현재 「상당한 차이」는 미터 단위로 정량화되지 않았다.** 유효 케이스 2건은 모두 PASS,
> 나머지 6건은 무효다. 이 상태에서 정확도 수정에 착수하면 목표 없이 코드를 고치는 것이다.

**유효성 게이트 — `newest − self` 중앙값 0 을 쓰지 마라.**
정상 파이프라인도 샘플링·전송 지연만큼 **음수**여야 하고, 저속에서는 그 값이 0 으로 수렴해
스케일 오류를 가린다. 올바른 게이트는 **구간 이동량 일치**다(시간 이동에 불변).

```
판정 전제   Δ(A.self) ≥ 100 m   AND   창 ≥ 20 s      ← 미달이면 「판정 유보」, PASS 아님
게이트      |Δ(A.self) − Δ(B.newest)| / Δ(A.self) ≤ 0.1
```

**이 전제를 적용하면 위 표 4건 중 판정 가능한 것은 z15-cruise 뿐이고, 48% 이탈로 FAIL 이다.**
z15-decel(7.1 s · 26.8 m)·z15-pause(12.5 s · 8.0 m)는 **정확도 예산은 통과했으나 저속·짧은 창이라
스케일 검증에는 쓸 수 없다** — 「PASS」로 인용하지 마라.

원본 S1 보고는 `REPORT-S1.md`, S2 보고는 `REPORT-S2.md`, S3-DIAG 보고는 `REPORT-S3D.md` 에 보존.

### 3-1. S3-DIAG 「최초 이탈 = ①→②」 기각 (감리0811)

**기각 사유 — 규모가 증상을 설명하지 못한다.** 지목된 근거는 `dist 0.573 m` 지점의 Δ 0.45 m 이고
분포는 p50 **0.25 m** · max **0.79 m** 다. 0.25 m ÷ 0.2 s = 1.25 m/s = 출발 속도 5 km/h —
`METRICS_UI_MS = 200` 이 **설계대로 동작한 결과**이며 D-0 로 이미 기록된 알려진 동작이다.

**판정 기준 자체가 틀렸다.** ①→② 는 체인상 *항상* 200 ms 만큼 벌어지므로 「시간순 최초」로 고르면
답은 언제나 ①→② 가 된다. **순번이 아니라 「설계상 예상 괴리를 초과한 양」으로 순위를 매겨야 한다.**

### 3-2. ③→④ 전송 지연 — **가설이며 확정이 아니다**

`S3-chain-join.json` `rawTail` 8 표본에서 `recvAt − t` 가 `92·109·174·185·194 | 3958·4160·4496 ms`
로 이봉 분포를 보였고, 같은 seq 에서 `newest 57.8 − d 24.7 = 33.1 m`(≈ 4.0 s × 8.28 m/s)가 관측됐다.

**그러나 확정 표현은 철회한다.**

```
① recvAt 은 B 시계, t 는 A 시계 → 두 시계를 섞은 값이다. 시계 오차가 그대로 실린다
② 표본이 rawTail 8 건뿐이다 — 전 구간 분포가 아니다
③ 동일 seq 46844634 가 tail 에서 6 회 반복 관측된다. 부모 노드 onValue 재전달과
   진짜 지연 도착이 분리되어 있지 않다
```

→ **「③→④ 배달 지연이 지배 링크」는 S3-DIAG-R2 이 검증할 가설로 둔다.**
역행 폐기 149 건도 원인 미분해 상태다.

### 3-3. D-8 — `routeLen ≠ geoLen` (**별건 · peer 위치 증상의 원인으로 단정 금지**)

```
A_routeLen 1500 (Directions)   A_geoLen 1029.633   B_routeLen 1029.633
clamp cap = min(1500, 1029.633) = 1029.633
```

A 는 1500 m 를 목표로 달리지만 ② 는 1029.633 m 에서 clamp 된다. **경로·완주 계열 결함**으로
분리해 기록하며, 현재 peer 위치 어긋남의 원인으로 지목하지 않는다. S3-DIAG-R2 범위 밖이다.

### 3-4. ✅ 진단 종결 — 지배 링크 **②→③ (발행 큐)** (S3-DIAG-R2, 감리0811 검산)

**측정** (`S3R-summary.json` · pt1~pt7 전량 4,671건 · `clockSkewMs=77` 명시)

| 구간 | p50 | p95 | max | 1 s 초과 | m 환산 @8.33 m/s |
|---|---:|---:|---:|---:|---|
| **`publishQueueMs`** | **4,520 ms** | 9,737 | **13,904** | **69.4 %** | **37.7 / 81.1 / 115.9 m** |
| `writeRttMs` | 206 ms | 268 | 286 | 0 % | 1.7 / 2.2 / 2.4 m |
| `endToEndMs` | 93 ms | 160 | 1,013 | 0.4 % | 0.78 / 1.33 / 8.44 m |

⚠ **전송은 결백하다** (`endToEndMs` p50 93 ms). 「③→④ 4 초」 가설은 **반증됐다.**

**감리 자책 2건째** — 지시서 §1 링크 표에서 ②→③ 예상을 「0 m (같은 값 복사)」로만 적어
**시간 비용이 순위에 들어갈 자리가 없었다.** 개발팀장은 `publishQueueMs` 를 정확히 측정해
보고했으나(§기술 A 내부) 링크 순위에는 올리지 못했다. 최대 링크 지목이 ④→⑤(23.2 m)로 간 것은
표의 결함이다. **정정 — ②→③ 예상 = 0 m 값 변화 + `publishQueueMs`.**

**기전 (전부 코드 근거)**

```
useLiveLocationPublishSession.ts:273   setInterval(tick, PUBLISH_TICK_MS = 100)
                              :232   await publishLiveLocationFanout(...)
                              :248   markPeerMotionPublished(...)   ← await 뒤에서 갱신
   → 대기 중 motionWriteAt 이 옛 값이라 100 ms tick 이 전부 게이트를 통과. in-flight 가드 없음

publishLiveLocationFanout.ts:34   await mergeGlobalLivePresence()               Firestore
                           :39   await mergeTrailLivePublicationRideSnapshot()  Firestore
                           :52   → 그 뒤에야 RTDB motion set()
   → 10 Hz 지연 민감 경로가 1 Hz Firestore 쓰기 두 건 뒤에 줄을 선다

writeRttMs 206 ms > PUBLISH_TICK_MS 100 ms  →  적체는 구조적으로 필연
```

**관측된 인과 사슬 — 모든 수치가 이 하나에 들어맞는다**

```
in-flight 최대 10  →  publishQueueMs p50 4.5 s
  →  옛 스냅샷이 뒤늦게 도착  →  최초 수신 역행 77 건 폐기(전진 폐기는 0)
  →  newest 정체  →  extrapolate 점유 58.9 % · cap(1.2 s) 히트 22.8 %
```

⚠ **`publishQueueMs × 속도`(37.7 m / 115.9 m)를 화면 위치 오차와 동일시하지 마라.**
그것은 **발행되는 스냅샷이 얼마나 낡았는가**이지 사용자가 보는 어긋남이 아니다.
수신 측이 외삽으로 일부를 보상하므로 화면 오차는 그보다 작다. 이 두 값은 별개이며,
**화면 오차는 S3A-V 의 종단 측정으로만 확정된다.**

**부수 확정**

- **`stepPeerMotionEntity` 는 결백하다** — 계약 준수 오차 max **0.009 m**. 보간 상수를 건드릴 이유가 없다
- 외삽 알고리즘도 결백 — 외삽 vs A 실제 이동 오차 p50 0.15 m · max 3.85 m. **먹이는 데이터가 늦을 뿐이다**
- 역행 212 = 최초 역행 77 + `onValue` 재관측 135, **C = 0**. `repeatSeenCount` p50 4 · max 32
- ①→② 초과 max 1.39 m · ②→③ 값 초과 0 · ⑥→⑦ 0

> **스냅샷 낡음 규모(37.7 m / 115.9 m)는 신고된 「상당한 차이」와 처음으로 자릿수가 맞는 값이다.**
> S1~S3-DIAG 의 0.25 m · 0.79 m · 23.2 m 는 자릿수부터 맞지 않았다.
> 다만 위 ⚠ 대로 이는 화면 오차가 아니다 — **증상 종결 판정은 S3A-V 종단 측정에 맡긴다.**

### 3-5. z15 종단 측정 — **스케일 종결 · 정확도 미종결** (S3A-VR 로 확정)

> ✅ **이 절의 수치는 확정값이다.** 감리 임시 스크립트와 개발팀장 `s3avr-summarize.mjs` 가
> **독립적으로 작성돼 4~5 유효숫자까지 일치**했고(`D_eff` 560/540 · RMSE 0.63933/0.75070 ·
> max 2.11704/2.74615), 시간축 적합과 단계 합산이라는 **두 독립 경로가 7~9 ms 안에서 수렴**했다.
> 재검산 근거는 `S3AVR-summary.json`, 재현은 `apps/web/scripts/peer-sync/s3avr-summarize.mjs`.

**스케일 게이트는 닫혔다** (비율이라 시계 오차에 불변 — 신뢰 가능)

```
z15-cruise 이탈   S1 48 %  →  0.94 %          z15-depart  1.15 %
```

**정확도는 재검산이 필요했다.** S3A-V 가 두 페이지의 `Date.now()` 순차 호출로 얻은
`before 6 / after 320 ms` 를 드리프트로 보고 선형 보정했는데, 그 값은 **호출 간 실행 지연**이다.

> **이 측정에서 skew 는 0 이다.** Playwright 한 프로세스의 두 브라우저 컨텍스트이므로
> **같은 머신의 같은 OS 시계**를 읽는다. 데이터로도 확인됨 — 판정 창 구간 양방향 추정
> −0.5 / 0.0 / 3.0 ms. 양방향 지연 차(A→B 166 vs B→A 155, **11 ms**)는
> **전송 비대칭 참고값**일 뿐 skew 가 아니다.

**skew = 0 재검산 결과**

| case | `D_eff` | RMSE | max | 판정 |
|---|---:|---:|---:|---|
| z15-depart | **560 ms** ✘ | 0.639 ✔ | 2.117 ✔ | 미종결 |
| z15-cruise | **540 ms** ✘ | 0.751 ✔ | 2.746 ✘ | 미종결 |

허위 보정이 **지연을 가리고 있었다**(보고값 400 / 320). 잔차는 거의 안 움직였다.
**남은 문제는 흔들림이 아니라 지연이다.**

**지연 사슬 — 중복 없는 4 단계** (`writeRtt` 는 단계가 아니다)

⚠ `receiveVsAckMs` p50 **−108 ms** — B 수신이 write ACK 보다 **먼저** 일어난다.
`writeRtt` 는 ③ 과 **겹쳐 관측된 값**이므로 사슬에 더하면 이중 계산이다. 별도 관측치로만 다룬다.

| case | ① 샘플링 낡음 | ② publishQueue | ③ 전송(ws→recv) | ④ 보간 지연 | 합계 | 적합 `D_eff` |
|---|---:|---:|---:|---:|---:|---:|
| z15-depart | 231 ms | 7 | 155 | 160 | **553** | 560 |
| z15-cruise | 217 ms | 3 | 151 | 160 | **531** | 540 |

시간축 적합과 단계 합산이 **독립적으로 7~9 ms 안에서 일치**한다.
**최대 단계는 ① 샘플링 낡음(217~231 ms)** 이고, 이는 D-0 다(`App.tsx:1437` 이 200 ms 낡은 React
상태를 발행에 먹인다 — `sampleVirtualDistanceM()` 은 만들어졌으나 배선되지 않았다).
**S3B 사안이며 지금 고치지 않는다.**

### 3-6. S3B 계획 — 3 단계 분할 (감리0812 · Chief 승인)

**한 번에 셋을 넣지 않는다.** 이 작업선에서 원인 귀속이 흐려진 사고가 반복됐다.
각 단계를 **단독 착지 → 측정 → 다음** 순으로 간다.

```
S3B-1  D-0  발행 스냅샷을 rAF 원본에서            ← ① 217~231 ms, 사슬 최대 단계
S3B-2  D-1  적용속도 발행 + Firestore 쓰기량 계측  ← S3B-3 의 선행 조건
S3B-3  D-2  registry 적분 유지 + spectator 실제속도 + 시간 기준
```

**S3B-1 단독으로 z15 정확도가 닫힐 수 있다** — `560−231 = 329`, `540−217 = 323` 으로 예산 350 안이다.
닫히면 S3B-2 의 성격이 「z15 정확도」에서 「저줌 선행 조건」으로 바뀐다. **확인 후 다음을 정한다.**

**조사에서 확인된 사실 3 건 (S3B 착수 전 필독)**

1. **샘플러는 이미 스냅샷 함수 안에서 호출된다.** `liveLocationSnapshot.ts:125` 가
   `peekSampleVirtualDistanceM()` 를 **DEV `diagCapture` 용으로만** 쓰고 있고, 실제 발행값은
   `:97` `:112` 가 `input.virtualDistanceMeters`(React 200 ms) 를 쓴다.
   등록부 `useVirtualRideSession.ts:197` 에 **DEV 게이트가 없어** 운영에서도 사용 가능하다.
   → D-0 은 배선 한 곳. 단 `distMetersAlongRoute` 와 `progressRatio` 를 **같은 원천**에서 유도해야
   RTDB `d` 와 Firestore `progressRatio` 가 어긋나지 않는다.

2. **D-1 에 Firestore 쓰기 증폭 위험.** `SPEED_PUBLISH_DELTA_MPS = 0.28`(≈1 km/h)
   (`liveLocationSnapshot.ts:176`)의 속도 델타 우회가 `shouldPublishRouteProgress`(`:192`) 에도 걸려 있다.
   지금은 발행 속도가 **슬라이더 목표값**이라 사용자가 만질 때만 바뀌지만, 적용속도로 바꾸면
   램프 구간에서 **연속 발화**한다. RTDB 는 single-flight 가 막지만 **Firestore 1 Hz 경로엔 상한이 없다.**
   → S3B-2 는 Firestore 쓰기량을 반드시 계측한다. **임계 상수를 올려 회피하지 마라.**

3. **D-2 는 속도만 고치면 악화될 수 있다.**
   `useTrailLivePublicationRideSpectatorOverlay.ts:155-156` 이
   `lastSeenAtMs`(Firestore **serverTimestamp** = 서버 시계)와 `Date.now()`(로컬 시계)를 뺀다.
   지금은 5 km/h 외삽이라 오차가 눌려 있지만 실제 속도(30 km/h)로 바꾸면 **같은 시계 오차가 6 배**가 된다.
   → S3B-3 은 속도 교체와 **시간 기준 정리를 함께** 한다.

### 3-7. ✅ S3B-1 채택 — **D-0 제거 · z15 정확도 종결** (감리0812)

**게이트 4/4 PASS.** 감리가 저장 이벤트로 독립 재계산한 값이 보고서와 **완전히 일치**했다.

| case | `D_eff` | RMSE | max | 겹침 | 스케일 | 판정 |
|---|---:|---:|---:|---:|---:|---|
| z15-depart | **340** ✔ | 0.394 ✔ | 1.245 ✔ | 1.000 | 0.57 % | **PASS** |
| z15-cruise | **300** ✔ | 0.322 ✔ | 1.303 ✔ | 1.000 | 0.12 % | **PASS** |

예산 `D_eff ≤ 350 · RMSE ≤ 1.0 · max ≤ 2.5` — **변경 없이 그대로 적용**했다.

**before / after**

```
D_eff        560 / 540   →   340 / 300      (−220 / −240 ms)
① 샘플링 낡음  231 / 217   →     0 /   0
cruise max     2.746     →   1.303
```

제거된 ①(231/217)과 `D_eff` 감소분(220/240)이 **10~25 ms 안에서 일치**한다. 인과가 닫혔다.
사슬 교차검산 |합계 − `D_eff`| = 14 / 7 ms.

**변경 범위** — `src/` 는 `liveLocationSnapshot.ts` **7 줄**뿐. `peekSampleVirtualDistanceM()` 이
유한이면 그 값, 아니면 `input.virtualDistanceMeters` 폴백. `distMetersAlongRoute` 와 `progressRatio`
동일 원천. `speedKmh` 미변경. `App.tsx` 의 `rideMetrics` 소비처 미변경.

**회귀 가드 유지** — `inFlightMax` 1 · `A_firstOutOfOrder` 0 · 전진 폐기 0 · `pt3 ok=0` 0 ·
`publishQueueMs` 3 / 110 / 446 · 1 s 초과 0 %. RTDB 쓰기 1.06 배(게이트 1.3).

> ⚠ **범위 한정** — 종결된 것은 **「z15 정확도(D-0)」** 뿐이다.
> **「멀티라이더 위치 동기화 결함 종결」로 확대하지 마라.** S3B-2(D-1)·S3B-3(D-2)이 남아 있다.

**주의 2건 (앞으로 인용할 때)**

- **① 지표는 이제 자기참조다.** `authDistAtCapture` 와 발행 거리가 같은 샘플러에서 나오므로
  ① = 0 은 정의상 0 이다. **「낡음이 없다」의 증거로 쓰지 마라.**
  실제 증거는 **`D_eff` 감소**와 **발행 중복 0 / 294**(`d0-duplicate-distm` 기대값 뒤집힘) 두 개다.
- **§3-4 Firestore 대조는 성립하지 못했다** — S3AV 에 기준선이 없었다. 다만
  `shouldPublishRouteProgress`(`liveLocationSnapshot.ts:182-199`)는 `_progressRatio`·
  `_distMetersAlongRoute` 를 **쓰지 않으므로** D-0 이 Firestore 쓰기량을 바꿀 수 없다. 공백은 무해하다.

**참고 관측 (불안정 · 판정 미사용)**

```
Firestore route 쓰기 ≈ 4.2 /s   ← 텍스트 파싱 기반. 개발팀장이 불안정하다고 명시했다.
                                  1 Hz heartbeat 기대와 어긋나지만 확정치가 아니다.
미검증 가설  markRouteProgressPublished(:256)가 await(:249) 뒤라 대기 중 tick 이 게이트를
             통과할 수 있다 — S3A 가 motion 에서 없앤 것과 같은 구조. **미확인이며 S4 사안.**
             이 수치·가설을 근거로 결론을 세우지 마라. 별도 계측이 필요하다.
수신 측 sameDist 1044 / 발행 중복 0 → 전부 부모 `onValue` 재전달. S4 사안.
```

**순서 의존 2건 (위반 금지)**

1. S3의 「저줌 실제속도」는 「적용속도 발행」 **뒤에** 온다. spectator가 읽는 `speedMps`는 Firestore 값이고
   그 값 자체가 목표속도 버그를 갖는다(`publishLiveLocationFanout.ts:41`). 순서가 바뀌면 **틀린 속도로
   외삽만 정교해진다.**
2. 「숨김 중 적분 유지」는 **zoom 저줌에만** 적용한다. 탭 숨김(`pageVisible=false`)에서는 구독이 통째로
   해제되므로(`PublicationSharedPresence.tsx:156,197,230`) 적분을 유지하면 **데이터 없이 외삽이 폭주**한다.

---

## 4. 승인된 판정 예산

`D_eff ≤ 350ms` · `residual RMSE ≤ 1.0m` @30km/h · `residual max ≤ 2.5m` (zoom 13 동일)

---

## 5. S3A 후속 항목 (보존 — S3A-V 결과 뒤 처리 순서 재판단)

**F-1. peer visibility 초기 시각 0** — `PublicationSharedPresence.tsx:120·295·355·362`

```ts
const [visibilityNowMs, setVisibilityNowMs] = useState(0);          // 초기 0
window.setInterval(() => setVisibilityNowMs(Date.now()), 1_000);    // 첫 발화도 1초 뒤
const age = row.serverAtMs > 0 ? now - row.serverAtMs : 0;          // now = 0 → age 음수
```

마운트 후 최소 1 초 동안 `now = 0` 으로 판정되어 **모든 age 가 음수 → stale peer 까지 전부 「신선」**
으로 보인다. 또 `liveRideRows.length === 0 && motionRows.length === 0` 이면 인터벌을 아예 걸지 않아
행이 사라진 뒤 마지막 값에 고정된다. → **측정에서는 앞 2 초를 폐기해 회피**(S3A-V §2-3).

**F-2. RTDB 쓰기 오류가 조용히 삼켜짐** — `lib/peerMotion/motionPublishFlight.ts:45·49·85·89`

```ts
void runMotionJob(job);                    // fire-and-forget
async function runMotionJob(...) { try { ... await mergeTrailMotionSnapshot(...) } finally { ... } }
                                           // catch 없음 → reject 시 unhandled rejection
```

S3A 이전에는 fanout 이 await 했으므로 오류가 호출부 try/catch 로 표면화됐다. 지금은 **앱이 쓰기 실패에
반응할 수 없다** — 재시도·경고·텔레메트리 어느 것도 못 한다. `finally` 로 `writing` 은 풀리므로 정지는 없다.

**계측은 눈이 멀지 않았다.** `rtdbTrailMotion.ts:158-166` 의 catch 가 pt3 `ok=0` 을 방출한 뒤 rethrow 한다.
→ **S3A-V 는 pt3 `ok=0` 으로 실패를 판정**하고, `pt2 − pt3` 는 **측정 종료 시점 미완료·로그 누락 후보**로만
따로 센다(실패로 세지 않는다). 코드 변경 없이 관측 가능하다.

⚠ **둘 다 이번(S3A-V)에 고치지 않는다.** 종결 판단 뒤 순서를 다시 정한다.

---

## 6. 알려진 정리 대상 (별건, 지금 손대지 말 것)

- `hooks/useTrailLivePublicationRidePublisher.ts` — 호출처 없음
- `lib/peerMotion/mergePackets.ts` `mergePeerMotionPackets` — `syncFromPresence`가 쓰지 않음
