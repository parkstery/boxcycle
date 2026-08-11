# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> S3-DIAG 보고서는 **감리가 이미 `REPORT-S3D.md` 로 보존**했다. 너는 **새 `REPORT.md` 만 작성**하고
> 기존 보고서(`REPORT-S1.md` · `REPORT-S2.md` · `REPORT-S3D.md`)를 옮기거나 덮지 마라.
> 마치면 이 파일 `상태` → `보고완료`. 보고 형식은 `../cyclefit-relay/SUPERVISOR-PROTOCOL.md` §1-3 **UAG**
> (rider 전용 규율 — §4 그림 확인 · `rider-cycle-fit` 로드 · `.out/candidates` — 는 이 작업선에 해당 없음).

- **지시번호**: S3-DIAG-R2 (체인 재판정 — 개정2)
- **발신**: 클로드감리0811 · **일시**: 2026-08-11 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`)

---

## 0. S3-DIAG 판정 — 계측은 채택, 결론은 기각

**잘한 것**: `sampleVirtualDistanceM` 을 `sampleLiveLngLat` 패턴대로 추가 · 폐기 3분류 · **전진 폐기 0**
게이트 PASS · `s1-metrics.mjs` §2 정정으로 depart·cruise 가 「D_eff 산출 불가」로 나온 것 ·
known-fail 2 건 · seq 오염을 스스로 발견해 재측정하고 그 사실을 보고에 남긴 것. **이 배선은 그대로 쓴다.**

**기각 — 「최초 이탈 = ①→②」**. 근거가 `dist 0.573 m` 지점의 Δ 0.45 m 이고 분포는 p50 **0.25 m**,
max **0.79 m** 다. 0.25 m ÷ 0.2 s = 1.25 m/s = 출발 속도 5 km/h — `METRICS_UI_MS = 200` 이
**설계대로 동작한 결과**이고 D-0 로 이미 기록된 동작이다. **수십 m 증상을 설명할 수 없다.**

**감리 자책 1건** — §1-5 반증 조건(「②③④ `d` 가 일치하면 전송이 아니다」)은 **잘못 쓴 것**이다.
같은 seq 의 ②③④ 는 같은 값을 복사한 것이라 언제나 일치하며, 전송의 실제 실패 양식인
**지연·순서 뒤바뀜**은 원리적으로 탐지하지 못한다. 245/245 일치는 전송 건전성의 증거가 아니다.
네가 문구를 정확히 따른 것이 맞다.

---

## 1. 판정 기준을 바꾼다 — 순번이 아니라 **초과량**, 단위는 **미터**

각 링크마다 **설계상 예상 괴리**를 먼저 명시하고, 실측이 그 예상을 **얼마나 초과했는지**로 순위를 매긴다.

**초과량 최대 링크를 고를 때 모든 결과를 「위치 상당 오차(m)」로 환산한다.** ms 와 m 를 섞어 비교하지 마라.

```
시간 초과량 → 거리 환산     excessM = speedMps × excessMs / 1000
                             ★ 원래 excessMs 도 반드시 병기한다
speedMps 는 그 구간의 실제 진행속도(①의 미분 또는 appliedSpeedKmh/3.6)를 쓴다.
발행 speedMps(D-1 로 틀린 값)를 환산에 쓰지 마라.
```

| 링크 | 설계상 예상 괴리 | 초과량 산출 |
|---|---|---|
| ①→② | 샘플링 200 ms × 현재 속도 | m (직접) |
| ②→③ | 0 (같은 값 복사) + 반올림 0.05 m | m (직접) |
| ③→④ | 네트워크 — **예상값을 이번에 측정한다** | ms → m 환산 (§2) |
| ④→⑤ | 0 (수용 시) | 폐기로 잃은 거리 m |
| ⑤→⑥ | **고정 160 ms 아님 — §5 의 모드별 동적 기대값** | ms → m 환산 |
| ⑥→⑦ | 0 (같은 geometry 일 때) | m (직접) |

**「최초 이탈」이라는 표현을 쓰지 마라. 「초과량 최대 링크」로 보고하라.**

---

## 2. 구간별 시각 계측 — `recvAt − t` 를 그대로 쓰지 마라

⚠ `recvAt` 은 **B 시계**, `t` 는 **A 시계**다. 두 시계를 섞은 값이라 시계 오차가 그대로 실린다.
S3-DIAG 가 관측한 **4 초는 확정이 아니라 가설**이다. 다음 4 개를 새로 기록해 구간을 쪼갠다.

```
snapshotCapturedAt      A  스냅샷 생성 시점 — §2-2 대로 ①②와 **동기 기록**
motionWriteStartAt      A  RTDB set() 호출 직전
motionWriteDoneAt       A  set() await 반환 직후
firstSeenAt             B  해당 (uid, seq) 를 **처음** 관측한 시각
```

**시계에 불변인 A 내부 구간을 먼저 판정한다.**

```
publishQueueMs = motionWriteStartAt − snapshotCapturedAt     ← 발행 대기(in-flight 적체)  시계 불변
writeRttMs     = motionWriteDoneAt  − motionWriteStartAt     ← RTDB 쓰기 왕복           시계 불변
```

### 2-1. 전송 계측은 `endToEndMs` 로 한다

⚠ **`deliveryMs = firstSeenAt − motionWriteDoneAt` 은 폐기한다.** 전송 계측으로 쓰지 마라.
`motionWriteDoneAt` 은 **ack 반환 시각**이라 그 시점에 이미 수신 측에 도달했을 수도, 아닐 수도 있다.
두 시계 혼합에 ack 타이밍 불확정성까지 겹쳐 해석이 불가능하다.

```
endToEndMs      = firstSeenAt − motionWriteStartAt      ★ 전송 계측 정본 (시계 보정 후)
receiveVsAckMs  = firstSeenAt − motionWriteDoneAt         참고값으로만 기록 · 판정 근거 금지
```

`endToEndMs` 를 보고하려면 **S1 방식으로 두 기기 시계 오차를 측정 직전·직후 각 1 회 기록**하고
보정값을 명시하라. **보정값을 명시하지 않은 `endToEndMs` 는 무효로 처리한다.**

각 항목 **p50 · p95 · max · 1 s 초과 비율**을 내고, §1 대로 **m 환산치를 병기**한다.

### 2-2. 스냅샷 시점 동기 기록 — 기존 pt1·pt2 를 근거로 쓰지 마라

⚠ **S3-DIAG 가 ①→② 근거로 쓴 fanout 내부 pt1·pt2 는 서로 다른 순간에 찍힌 값이다.**
그 0.25 m 가 UI 지연인지 계측 시점 차이인지 분리되지 않는다. **①→② 근거로 재사용 금지.**

스냅샷을 만드는 **그 자리에서 세 값을 동기적으로 한 번에** 기록한다.

```
snapshotCapturedAt      기록 시각
authDistAtCapture       ① sampleVirtualDistanceM()      ← 같은 실행 경로에서 즉시 호출
snapshotDistAtCapture   ② snapshot.distMetersAlongRoute
```

세 값 사이에 await·tick 경계가 끼어서는 안 된다. 이 셋과 `seq` 를 한 레코드로 남겨라.
**①→② 초과량은 오직 이 레코드로만 산출한다.**

### 2-3. 발행 tick 동시 in-flight 수

publish tick 의 await 진입 시 +1, 반환 시 −1 하는 카운터를 두고 **최대 동시 in-flight 수**와
그 시각의 `publishQueueMs` 를 함께 남겨라. 적체가 있으면 여기서 보인다.

⚠ **감소는 반드시 `finally` 에서 한다.** 정상·예외 양쪽에서 실행되어야 한다.
`catch` 에만 두거나 await 뒤에만 두면 **쓰기 실패 때 카운터가 영구 누설**되어 이후 전 표본이 오염된다.

```ts
inFlight += 1;
try { await set(...); } finally { inFlight -= 1; }
```

---

## 3. 전 이벤트 보존 — `rawTail` 금지

`rawTail` 30 줄로는 분포를 말할 수 없다. **pt1~pt7 의 모든 방출 이벤트를 파일로 보존**한다.

```
document/ops/sync-relay/S3R-chain-events.json     ← pt1~pt7 전량 (A·B 양쪽) · 표본 추출 금지
document/ops/sync-relay/S3R-summary.json          ← 집계·판정
```

⑥(§5-1)·⑦ 도 포함이다. ⑥ 은 rAF 마다 발생하므로 양이 크다 — `?peerSyncLogMs` 로 방출 주기를
조절하되, **방출한 것은 전부 보존**하라. 콘솔 tail 로 대체하지 마라.

`S3-chain-join.json` 처럼 요약만 남기지 마라. 감리가 원본을 재계산할 수 있어야 한다.

---

## 4. (uid, seq) 최초 수신과 반복 관측 분리

RTDB 부모 노드 `onValue` 는 자식 1 건 변경마다 **노드 전체를 재전달**한다.
S3-DIAG tail 에서 동일 seq `46844634` 가 **6 회** 반복 관측됐다.

```
(uid, seq) 별로
  firstSeenAt        최초 관측 시각
  repeatSeenCount    이후 반복 관측 횟수
```

**최초 수신만 지연·순서 판정에 쓴다.** 반복 관측을 지연으로 세지 마라.

### 4-1. 역행 폐기 149 건 분해 (필수)

```
A. 최초 수신 역행     (uid,seq) 최초 관측인데 distM < newest        ← 진짜 순서 뒤바뀜
B. 동일 seq 재관측     repeatSeenCount ≥ 1 인 재전달                ← onValue 부작용
C. 그 외              A·B 어디에도 안 들어가는 것 — 전수 나열
```

건수·비율과 **C 의 원문 로그 전수**를 보고하라. C 가 0 이 아니면 그것이 다음 조사 대상이다.

---

## 5. ⑤→⑥ — 고정 160 ms 로 계산하지 마라

`stepPeerMotionEntity`(`integrator.ts:129-174`)는 **네 갈래**로 갈리고 각각 기대 지연이 다르다.
`PEER_INTERP_DELAY_MS(160) × 속도`를 예상 괴리로 쓰면 세 갈래를 전부 오판한다.

### 5-1. 매 step 기록 (⑥ 이벤트)

```
renderTime      = nowMs − PEER_INTERP_DELAY_MS
newestAgeMs     = nowMs − newest.recvAtMs
mode            oldest | interpolate | extrapolate | paused
buffer          buf.length
displayDistM    실제 결과
entitySpeedMps  외삽에 쓰인 entity.speedMps
```

모드별 추가 기록 — **⑥·⑦ 을 `newest.seq` 하나에 귀속시키지 마라.**

| mode | 조건 | 귀속 seq · 추가 기록 |
|---|---|---|
| `paused` | `phase` = paused/completed | `newestSeq` · `newest.distM` |
| `oldest` | `renderTime ≤ oldest.recvAtMs` | `oldestSeq` · `oldest.recvAtMs` · `oldest.distM` |
| `interpolate` | 그 사이 | **`s0Seq` · `s1Seq` 양쪽** · 각 `recvAtMs` · 각 `distM` · 보간 `t` |
| `extrapolate` | `renderTime ≥ newest.recvAtMs` | `newestSeq` · **`aheadMs`** · `newest.recvAtMs` · `newest.distM` |

`aheadMs = min(renderTime − newest.recvAtMs, PEER_INTERP_MAX_EXTRAP_MS)` 를 **cap 적용 전후 둘 다** 남겨라.
cap 에 걸렸는지가 stall 판별의 핵심이다.

### 5-2. 두 가지를 분리해 판정한다

**(a) 계약 준수 오차** — 기록된 입력으로 `stepPeerMotionEntity` 공식을 그대로 재계산해 비교한다.

```
paused/completed  expected = clampRouteDist(newest.distM, routeLenM)
oldest            expected = oldest.distM
interpolate       t = (renderTime − s0.recvAtMs) / (s1.recvAtMs − s0.recvAtMs)   ※ span ≤ 0 이면 t = 0
                  expected = s0.distM + (s1.distM − s0.distM) × t
extrapolate       expected = newest.distM + entitySpeedMps × aheadMs / 1000

계약 준수 오차 = displayDistM − expected      ← 0 이어야 한다. 0 이 아니면 구현 결함
```

**(b) 모드별 기대 지연** — 이것이 ⑤→⑥ 의 예상 괴리다.

| mode | 기대 지연 | 초과량 |
|---|---|---|
| `interpolate` | 160 ms + `(s1.recvAtMs − s0.recvAtMs)` 만큼의 격자 오차 | 실측 − 기대 |
| `extrapolate` | 160 ms + `aheadMs` — **이 구간은 지연이 아니라 추측**이다 | `aheadMs` 전체를 초과량으로 본다 |
| `oldest` | `nowMs − oldest.recvAtMs` — 버퍼가 얕아 임의로 크다 | 그 값 전체 |
| `paused` | 정의 없음 | **판정 제외** — 건수만 센다 |

**`extrapolate` 는 별도 집계한다.** 외삽 거리 `entitySpeedMps × aheadMs / 1000` 와, 그 구간 A 의
실제 이동거리를 대조해 **외삽 오차(m)** 를 낸다. 여기가 D-1(틀린 속도)이 위치 오차로 바뀌는 지점이다.

모드별 **점유 비율**(전체 step 대비)을 반드시 보고하라. `extrapolate`·`oldest` 비율이 높으면
그 자체가 stall 의 직접 증거다.

---

## 6. 범위 밖으로 분리 — `routeLen ≠ geoLen` (D-8)

```
A_routeLen 1500   A_geoLen 1029.633   B_routeLen 1029.633
```

**경로·완주 계열 결함으로 분리 기록만 하고, 현재 peer 위치 증상의 원인으로 단정하지 마라.**
이번 지시 범위 밖이다. 1029.6 m 를 넘기는 주행 실험도 하지 마라.

---

## 7. 금지

- **계측 완료 전** 보간 상수 · 발행 주기 · throttle · integrator 상수(`rideSyncPolicy.ts`) ·
  **RTDB 구독 방식** 수정
- **제품 동작 변경 일체** — 이번은 계측 추가만이다. `stepPeerMotionEntity` 의 분기·공식을
  「개선」하지 마라. 계약 준수 오차가 0 이 아니면 **고치지 말고 그대로 보고**하라
- 적용속도 발행(D-1) · 저줌(D-2) 수정 — **S3 사안이며 보류**
- **cyclefit 자산·코드·스킬 일체 수정** — `document/ops/cyclefit-relay/` · `blender/` ·
  `rider-cycle-fit`·`rider-preview` 스킬 · rider GLB. **이 작업선은 cyclefit 을 더 건드리지 않는다**
- 알고리즘 반복을 2-브라우저 e2e 로 검증 — replay 로만. e2e 는 계측에만
- `main2` 병합 · PR · `--no-verify`

---

## 8. 보고

**새 `REPORT.md` 만 작성한다.**

```
UAG   **초과량 최대 링크 1개** + 링크별 (실측 − 예상) 표 — **전부 m 환산, ms 병기**
기술  publishQueueMs · writeRttMs · endToEndMs 각 p50/p95/max/1s초과율 + m 환산 · 시계 보정값
      receiveVsAckMs (참고값 표기)
      §2-2 동기 레코드 기반 ①→② 초과량 · 최대 동시 in-flight 수(finally 처리 확인)
      §5 모드 점유 비율(oldest/interpolate/extrapolate/paused) · 계약 준수 오차 ·
        extrapolate 의 aheadMs 분포와 cap 히트율 · 외삽 오차(m)
      역행 149건 A/B/C 분해(C 는 원문 전수) · repeatSeenCount 분포
      보존 파일 경로(pt1~pt7 전량) · 실패·미완 전수 · 이견 · 커밋
```

**`endToEndMs` 는 시계 보정값을 명시하지 않으면 무효로 처리한다.**
**`deliveryMs`·`receiveVsAckMs` 를 판정 근거로 쓴 결론은 반려한다.**
**e2e 실행 시간을 분 단위로 적어라.**
