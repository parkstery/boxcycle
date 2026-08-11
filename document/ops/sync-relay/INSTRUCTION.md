# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> S3-DIAG-R2 보고서는 **감리가 이미 `REPORT-S3DR2.md` 로 보존**했다. 너는 **새 `REPORT.md` 만 작성**하고
> 기존 보고서(`REPORT-S1.md` · `REPORT-S2.md` · `REPORT-S3D.md` · `REPORT-S3DR2.md`)를 옮기거나 덮지 마라.
> 마치면 이 파일 `상태` → `보고완료`. 보고 형식은 `../cyclefit-relay/SUPERVISOR-PROTOCOL.md` §1-3 **UAG**
> (rider 전용 규율은 이 작업선에 해당 없음).

- **지시번호**: S3A (발행 큐 제거 — **진단 종결 후 첫 수정**)
- **발신**: 클로드감리0811 · **일시**: 2026-08-11 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`)

---

## 0. S3-DIAG-R2 판정 — **채택. 진단 종결**

시계 보정 명시 · pt1~pt7 전량 4,671 건 보존 · 계약 준수 오차 ≈ 0 확인 · 역행 A/B/C 분해(C=0)
— 요구사항을 전부 이행했고 숫자도 `S3R-summary.json` 재계산으로 일치를 확인했다.

**단, 최대 링크 지목만 정정한다. 그리고 그 원인은 감리 지시서 결함이다.**

지시서 §1 링크 표가 ②→③ 예상을 「0 m (같은 값 복사)」로만 적어 **시간 비용이 순위에 들어갈 자리가
없었다.** 너는 `publishQueueMs` 를 정확히 측정해 보고했으나(§기술 A 내부) 링크 순위에 올리지 못했다.

```
정정   ②→③ 예상 = 0 m (값) + publishQueueMs (시간)
       초과량 최대 링크 = ②→③   p50 37.7 m · max 115.9 m
                        (④→⑤ 23.2 m 보다 한 자릿수 크다)
```

**전송은 결백하다** — `endToEndMs` p50 93 ms. 「③→④ 4 초」 가설 반증.
**`stepPeerMotionEntity` 도 결백하다** — 계약 준수 오차 max 0.009 m.

기전·인과 사슬은 `HANDOFF.md` §3-4 에 정리했다. **읽고 시작하라.**

---

## 1. 이번에 고치는 것 — 발행 큐 하나

**세 가지 원인이 겹쳐 있다. 셋 다 없앤다.**

| # | 원인 | 위치 |
|---|---|---|
| **가** | motion 이 Firestore 쓰기 두 건 **뒤에 순차 await** | `publishLiveLocationFanout.ts:34·39·52` |
| **나** | **in-flight 가드 없음** — `markPeerMotionPublished` 가 await 뒤라 대기 중 tick 이 전부 통과 | `useLiveLocationPublishSession.ts:232·248·273` |
| **다** | 대기 중 쌓인 **옛 스냅샷을 그대로 전송** — 늦게 도착해 역행 폐기를 만든다 | 위 두 개의 결과 |

`writeRttMs` 206 ms > `PUBLISH_TICK_MS` 100 ms 이므로 **가드가 없으면 적체는 구조적으로 필연**이다.
주기를 늘려 회피하지 마라 — 그건 원인 제거가 아니다.

### 1-1. 설계 방향 (구현 방식은 재량)

```
motion 발행을 Firestore fan-out 과 분리된 독립 경로로 둔다
그 경로에 단일 슬롯(single-flight)을 둔다
  · 진행 중인 쓰기가 있으면 새 tick 은 쓰기를 시작하지 않는다
  · 대신 「대기 슬롯」의 스냅샷을 최신값으로 덮어쓴다 (latest-wins)
  · 쓰기가 끝나면 대기 슬롯에 값이 있을 때만 즉시 다음 쓰기를 시작한다
  · 중간에 덮여 사라진 스냅샷은 버린다 — 그게 정상이다
```

**대기 슬롯은 큐가 아니라 슬롯 1개다.** 배열로 쌓지 마라. 쌓는 순간 같은 결함이 돌아온다.

Firestore 경로(`mergeGlobalLivePresence` · `mergeTrailLivePublicationRideSnapshot`)의 **주기·내용은
이번에 바꾸지 않는다.** motion 이 그 뒤에 줄 서지만 않으면 된다.

`markPeerMotionPublished` 갱신 시점도 single-flight 안에서 일관되게 정리하라 —
**대기 중 tick 이 게이트를 통과해도 실제 쓰기가 시작되지 않으면 그만이다.**

---

## 2. 수용 조건 — 6 건 전부 충족해야 PASS

하나라도 미달이면 FAIL 로 보고하라. **완화·재해석 금지.**

| # | 조건 | 판정 방법 |
|---|---|---|
| **가** | motion 경로가 Firestore 선행 작업에 막히지 않음 | 코드상 `await` 의존 제거 + pt2→pt3 사이에 Firestore 호출이 없음을 로그로 입증 |
| **나** | 동시에 진행되는 motion publish 가 제한됨 | **`inFlightMax` ≤ 1** (계측값. 10 → 1) |
| **다** | 대기 중 새 snapshot 이 오면 오래된 것을 버리고 최신값 사용 | 「덮어써서 폐기된 스냅샷 수」를 계측·보고. 0 이면 latest-wins 가 동작 안 한 것이니 이유를 밝혀라 |
| **라** | 역행 first-seen packet 이 사라짐 | **`retrograde.A_firstOutOfOrder` = 0** (77 → 0). `B_onValueRepeat` 는 이번 대상 아님 |
| **마** | `publishQueueMs` 가 구조적 예산 안으로 감소 | 아래 §2-1 |
| **바** | 저장된 패킷 시나리오/replay + 최종 e2e 로 회귀 확인 | 아래 §2-2 |

### 2-1. `publishQueueMs` 구조적 예산

single-flight 에서 한 스냅샷이 기다릴 수 있는 최대치는 **직전 쓰기의 잔여 시간**이다.
실측 `writeRttMs` p50 206 · p95 268 · max 286 ms 로부터 예산을 도출한다.

```
p50 ≤ 150 ms        (≈ writeRtt p50 의 절반 — 평균 대기)
p95 ≤ 400 ms        (≈ writeRtt p95 268 + tick 100)
max ≤ 800 ms
1 s 초과 비율 = 0 %                         ← 현재 69.4 %
m 환산 @8.33 m/s   p50 ≤ 1.3 m · max ≤ 6.7 m   ← 현재 37.7 / 115.9 m
```

이 값은 실측 `writeRttMs` 에서 도출한 것이다. **RTT 가 크게 달라졌다면 예산을 다시 유도해
근거와 함께 보고하라** — 임의로 완화하지는 마라.

### 2-2. 회귀 확인 2단

```
1) replay   S3R-chain-events.json 을 시나리오로 변환해 peer-sync 하네스에 고정
            기존 시나리오·불변식 전부 통과 유지
            known-fail d0-duplicate-distm · d1-target-vs-applied 는 그대로 PASS 여야 한다
              (이번 수정은 D-0·D-1 을 건드리지 않는다. 깨지면 범위를 넘은 것이다)
2) e2e      S3-DIAG-R2 와 같은 조건으로 재측정
            pt1~pt7 전량을 S3A-chain-events.json 에 보존
            S3A-summary.json 에 수용 조건 6 건 판정 수록
```

**e2e 는 백그라운드로 던지고 산출물 파일만 확인하라.**

### 2-3. 반증 조건 (해당하면 즉시 보고하고 멈춰라)

> *"발행 큐를 없앴는데(가·나·다 충족) `extrapolate` 점유가 여전히 50 % 이상이거나
> `publishQueueMs` p50 이 1 s 를 넘으면, 감리의 §3-4 진단이 틀린 것이다."*

현재 `extrapolate` 점유 58.9 % · cap 히트 22.8 % 는 **큐 적체의 결과라는 것이 감리의 주장**이다.
큐를 없앤 뒤에도 그대로면 주장이 반증된다. **그 경우 고치려 들지 말고 보고하라.**

---

## 3. 금지

- **보간 상수 수정** — `PEER_INTERP_DELAY_MS` · `PEER_INTERP_BUFFER_MAX` ·
  `PEER_INTERP_MAX_EXTRAP_MS` · `PEER_MOTION_PUBLISH_INTERVAL_MS`(`rideSyncPolicy.ts`).
  계약 준수 오차 0.009 m 로 **보간은 결백함이 입증됐다.** 건드릴 이유가 없다
- **`integrator.ts` 의 분기·공식 변경** — dedup 조건 포함
- **RTDB 구독 방식 변경** — 부모 `onValue` → child 전환은 **S4** 사안
- **D-1(적용속도 발행) · D-2(저줌) 수정** — **S3B** 사안. 이번에 함께 고치지 마라
- **발행 주기를 늘려 적체를 회피하는 것** — 원인 제거가 아니다
- **cyclefit 자산·코드·스킬 일체 수정**
- `main2` 병합 · PR · `--no-verify`

---

## 4. 보고

**새 `REPORT.md` 만 작성한다.**

```
반증  §2-3 해당 여부   ← 먼저
UAG   수용 조건 6 건 판정표 (가~바) · 각 근거 수치
      before/after 대조: publishQueueMs · inFlightMax · A_firstOutOfOrder ·
                        extrapolate 점유 · cap 히트율 · endToEndMs
기술  구현 방식 요약(single-flight · latest-wins) · 덮어써서 폐기된 스냅샷 수
      replay 전 시나리오 + known-fail 2 건 결과 · e2e 실행 시간(분)
      보존 파일 경로 · 실패·미완 전수 · 이견 · 커밋
```

**6 건 중 하나라도 미달이면 「부분 성공」이 아니라 FAIL 이다.**
