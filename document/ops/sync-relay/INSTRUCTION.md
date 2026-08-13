# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> 이전 지시(S4-M0 + S4-M1)와 그 결과는 §1-0 에서 `INSTRUCTION-S4M1.md` 로 보존한 뒤 이 파일을 쓴다.
> **새 `REPORT.md` 를 만들지 마라** — 결과는 §9 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: S4-M1R (반례 하네스 정정 → 재취득 → **막히지 말고 구현까지**)
- **발신**: 클로드감리0814 · **일시**: 2026-08-14 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`) · 기준 HEAD `4089e2c`

---

## 0. 감리 판정 — 멈춘 판단은 옳았다. 결론이 과대했다

**S4-M0 통과.** `REPORT.md` 는 HEAD 블롭 sha256 이 `cbf1554…` 로 지시값과 일치했고, 커밋 `4089e2c`
는 `document/` 5 파일뿐이다. 채널 감리 WARNING ① 해소.

**M1·M2·M3 반례는 진짜다.** `existsAfterSettle` 7/7 · 두 경로 모두 잔존 · `previousTrailResurrected`
6/6. HANDOFF §3-17 이 예측한 그대로다.

**반례가 안 잡혀 멈춘 것도 규율대로다.** 다만 결론 하나가 틀렸다.

```
[정정] 「deferred 가 없는 구조에서는 M4 경쟁이 성립하지 않는다」 — 과대 결론이다

  spec:444  armDelayedWrites(page, 6_000) 을 숨김 **전에** 걸었다
            __rtwMotionWriteDelayMs 는 전역 플래그다 — 복귀한 **새 세션에도 그대로 적용**된다
  결과      옛 정리의 deleteTrailMotion 은 route 배수 직후 ~2s 에 돈다
            새 세션의 첫 motion 쓰기는 6s 뒤에 착지한다
            → 삭제가 빈 경로를 지운다. 경쟁이 성립할 수 **없는 배치**였다

  구조상 경쟁은 있다: 복귀(400ms) → 새 세션이 5Hz 로 쓴다 → ~2s 에 옛 삭제가 돈다
                      그 순간 노드는 **살아 있는 새 세션의 것**이다
```

**결정** — M4 는 뺄 항목이 아니다. §2-1 대로 고쳐 다시 잡아라.

---

## 1. 하네스 3 건을 먼저 고친다 (제품 아님)

### 1-0. 먼저 보존

```
현재 워킹트리의 INSTRUCTION.md (S4-M0+S4-M1 지시 + 결과)
   → document/ops/sync-relay/INSTRUCTION-S4M1.md 로 복사 (내용 그대로)
```

`S4M1-lifecycle-baseline.json` 은 **덮어쓰지 마라.** 재취득본은 `S4M1-lifecycle-baseline-r.json` 이다.

### 1-1. M4 — 지연 배치와 관측 방식

```
① 복귀 직후 지연을 새 세션에 적용하지 마라
   setPageHidden(false) 직전(또는 직후 즉시) __rtwMotionWriteDelayMs = 0
   새 세션의 첫 쓰기가 옛 삭제(~2s)보다 **먼저** 착지해야 경쟁이 성립한다
   숨기기 전 옛 세션에 건 지연은 그대로 둔다 — 늦은 쓰기를 만드는 쪽은 옛 세션이다

② 정상상태 샘플링으로는 절대 안 잡힌다
   motion 은 5Hz 다. 삭제돼도 ~200ms 안에 재생성된다.
   9 초 뒤 400ms 간격 6 회 샘플링은 무조건 「존재」만 본다 — 지금 M4 가 그랬다
   복귀 시점부터 +4s 를 **100ms 간격으로 연속 관측**해
   존재 → 부재 → 존재 의 **딥(dip)** 이 있었는지를 판정에 써라
   RTDB onValue 구독으로 전이를 기록하는 편이 폴링보다 정확하다 — DEV 게이트로 하네스에 두어라
```

수정 전 통과 조건은 **「딥이 관측된다 = 반례 성립」** 이다.
수정 후 통과 조건은 **「딥 0 회 + `deferredSkipTotal ≥ 1`(skip-live-session 발동)」** 이다.

### 1-2. M5 — 폴트 주입 위치가 틀렸다

```
지금  motionPublishFlight.ts 가 mergeTrailMotionSnapshot **호출 전에** throw 한다
      → rtdbTrailMotion.ts:157-166 의 catch 가 아예 실행되지 않는다
      → baseline 의 「pt3 ok=0 = 0」은 제품 근거가 아니라 주입 위치의 산물이다
      → 수정 후 통과 조건 ok0 ≥ 1 (spec:392-401) 은 현 배선으로 **원리상 충족 불가**다

고쳐  주입을 실제 쓰기 경로 안(set() 직전)으로 옮겨라
      그래야 기존 catch 가 pt3 ok=0 을 방출하고 rethrow 한다 — 이게 F-2 가 타야 할 경로다
```

**새 로깅을 만들지 마라.** pt3 `ok=0` 은 이미 나온다. 안 나온 이유는 거기까지 못 갔기 때문이다.

### 1-3. 디버그 카운터가 0 상수다

`syncMotionFlightDebug()` 가 `epochDiscardTotal` · `currentEpoch` · `deferredPending` ·
`deferredRunTotal` · `deferredSkipTotal` 을 **전부 0 리터럴로** 채운다. 그런데 baseline 의
M1 `deferredRunTotal=0` · M4 `deferredSkipTotal=0` 이 이 상수를 근거처럼 인용했다. **측정이 아니다.**

구현 단계에서 **실제 모듈 상태를 읽도록 반드시 교체하라.** 교체 전에는 이 필드를 판정에도
보고서 표에도 쓰지 마라. 이대로 두면 W-1 종결 근거가 다시 허수가 된다.

---

## 2. 반례 재취득 → **막히지 말고 구현까지**

### 2-1. 재취득

수정 전 코드로 다시 돌려 `S4M1-lifecycle-baseline-r.json` 을 낸다. M1·M2·M3 는 이미 잡혔으니
**M4·M5 가 이번에 잡히는지**가 관심사다.

### 2-2. 갈림길 — 여기서 다시 멈추지 마라

```
M4 딥이 관측된다        → 예상대로다. 그대로 §3 구현으로 진행하라
M4 딥이 안 잡힌다       → **그때도 멈추지 말고 §3 구현을 진행하라.**
                          M4 를 「수정 전 반례 없음 · 수정 후 회귀 가드」로 격하해 기록하고
                          가 게이트는 M1·M3 반례로 충족된 것으로 본다 (감리 사전 결정)
                          단, 왜 안 잡혔는지 관측치를 그대로 보고하라
M5 ok=0 이 안 나온다    → 주입 위치를 더 안쪽으로 옮겨 보고, 그래도 안 되면
                          관측치와 함께 보고하되 §3 은 계속 진행하라
```

**이번에는 §2 에서 멈추는 것을 금지한다.** 멈춰야 할 유일한 경우는 §7 회귀가 예산을 깨는 때다.

---

## 3. 구현 — route 와 같은 계약을 motion 에 세운다

`routePublishFlight.ts` 가 정본이다. **베끼되 route 파일은 고치지 마라.**

```
① epoch        nextMotionPublishEpoch(sessionKey) · cancelMotionPublish(epoch)
                취소된 epoch 의 job 은 대기 슬롯에서도 버린다
② 배수         awaitMotionFlightSettled(MOTION_FLIGHT_DRAIN_TIMEOUT_MS)
                writing=false 이고 slot=null 인 순간이 정착이다
③ 세션 소유권   isMotionSessionLive(sessionKey) — sessionKey = `${uid}|${sanitizeTrailId(trailId)}`
④ 지연 삭제     requestMotionNodeCleanup({ epoch, sessionKey, run })
                flight idle 이면 즉시, 아니면 runMotionJob 의 finally 에서 배수
                살아 있는 같은 세션이 있으면 실행하지 않는다 (skip-live-session)
⑤ 오류 전달     runMotionJob 에 catch → job.onError?.(e) → fanout onMotionError → 훅 reportError
```

`MOTION_FLIGHT_DRAIN_TIMEOUT_MS` 는 `rideSyncPolicy.ts` 에 **2_000**. **늘려서 통과시키지 마라.**
`ROUTE_FLIGHT_DRAIN_TIMEOUT_MS` 도 2000 그대로다.

`useLiveLocationPublishSession.ts` 의 두 정리 경로(`pageVisible=false` · effect cleanup)에서
**motion 도 배수·소유권 확인 뒤 삭제**되게 하라. 지금은 `cleanupLiveLocationPublish` 가
`deleteTrailMotion` 을 곧바로 부른다 — 여기가 결함 지점이다.

⚠ **route 배수와 motion 배수를 직렬로 잇지 마라.** 정리가 4 초로 늘어난다. 같이 기다려라.

`deleteTrailMotion` 의 `.catch(() => {})` 는 삭제 실패를 삼킨다 — DEV 게이트로 실패 사실만 남겨라.
**동작은 그대로다.** 삭제 실패로 정리를 멈추지 마라.

---

## 4. W-1 · W-2

```
W-1  deferredRunTotal ≥ 1 인 런을 **실제 카운터로** 제시 (§1-3 교체가 선행 조건)
     노드 부재만으로 「실행됐다」고 쓰지 마라
W-2  lateWriteDoneAt · deleteDoneAt 을 같은 시계로 남기고 부등호로 보여라
```

route 쪽은 **제품 로직 무수정.** 기존 `deferredRunTotal` · `deferredSkipTotal` · pt9 `reason` 을
읽어 끝내라. DEV 게이트 필드가 꼭 필요하면 **최소 1 개**만, 이유를 보고서에 적어라.

---

## 5. 시험 — `peer-sync-s4m1.spec.ts` (기존 파일 계속 사용)

| | 시나리오 | 수정 후 통과 조건 |
|---|---|---|
| M1 | 종료 중 늦은 motion 쓰기 | 노드 부재 · `deferredRunTotal ≥ 1` (실측 카운터) |
| M2 | 숨김 · 종료 두 경로 | 두 경로 모두 노드 부재 |
| M3 | Trail 전환 | 이전 Trail 부활 0 · 새 epoch 이후 옛 epoch 성공 쓰기 0 |
| M4 | 같은 Trail 재시작 | **딥 0 회** · `deferredSkipTotal ≥ 1` |
| M5 | 첫 쓰기 강제 실패 | pt3 `ok=0` ≥ 1 · `onMotionError` 도달 · 이후 최신 쓰기 성공 |
| M6 | W-2 선후 | `lateWriteDoneAt < deleteDoneAt` 표본 ≥ 1 |

```
지연        옛 세션 8,000ms 유지. M4 는 복귀 시 새 세션에 0 (§1-1)
관측 순서    지연을 끄지 않은 채 flight idle + deferredPending=0 확인 후 노드를 본다
            ← 관측 직전에 지연을 0 으로 되돌리면 timeout 경로가 지워진다
```

증거 → `S4M1-lifecycle.json` (`allPass` 포함). 베이스라인 2 개를 덮어쓰지 마라.

---

## 6. 회귀 — 예산은 그대로다

```
npm run test:peer-s3a-replay     d0-duplicate-distm PASS · d1-target-vs-applied 뒤집힌 상태 유지
정상 3 런                         산출물 태그 S4M1-*
```

| 지표 | 유지 기준 |
|---|---|
| z15 `D_eff` depart / cruise | 중앙값 ≤ 350 (현행 240 / 240) |
| 잔차 RMSE / max | 중앙값 RMSE ≤ 1.0 · max ≤ 2.5 · **3 런 최댓값 병기** |
| 스케일 | ≤ 10 % |
| **RTDB 쓰기 /s** | 현행(≈5.4) 대비 **증가 금지 — 이번 최대 위험 지점** |
| FS route 쓰기 /s | ≈0.96 유지 |
| motion `inFlightMax` | ≤ 1 |
| spectator 오차 | p50 ≤ 57 · max ≤ 87 · **런별 값 전부 병기** |

**보간·외삽 상수(`PEER_INTERP_MAX_EXTRAP_MS` 1200 · `SPECTATOR_MAX_EXTRAP_MS` 3000) 불변.**

---

## 7. 커밋

**제품 / 시험·도구 / 증거·문서 3 개**로 나눠라. 경로 지정. `git add -A` 금지.
**push · `main2` 병합 · PR 금지.** stash 2 건은 건드리지 마라.

---

## 8. 수용 판정

| | 항목 | 기준 |
|---|---|---|
| 가 | 반례 | M1·M3 성립 (+ M4 딥이 잡히면 함께) |
| 나 | M1~M6 | `S4M1-lifecycle.json` `allPass=true` |
| 다 | 다섯 계약 | 두 정리 경로 모두에 적용 |
| 라 | W-1 | 실측 `deferredRunTotal ≥ 1` — 0 상수 아님 |
| 마 | W-2 | 시각 부등호 실측 |
| 바 | 상수 불변 | drain 2000 · 보간/외삽 · 예산 |
| 사 | 회귀 | replay PASS · §6 표 만족 |

---

## 9. 금지 · 보고

- **S4-2 · S4-3 혼입** · **route 재개발**(제품 로직 수정 금지) · 보간·외삽 정책 변경
- **RTDB 구독 구조(`subscribeTrailMotion`) 변경** — 하네스용 DEV 구독은 별개로 두어라
- 임계 상수 완화·증액 · 관측 직전 지연 해제 · 기존 baseline·산출물 덮어쓰기
- `git add -A` · `--no-verify` · **stash 조작** · **push · 병합 · PR** · Orchestrator 문서 접촉

```
문서에 적는다
  - 첫머리 3~4 줄: 화면에서 무엇이 좋아졌는지 평문으로
  - §1 하네스 정정 3 건이 무엇을 바꿨는지 (M4 딥 관측 · M5 주입 위치 · 카운터 실측화)
  - 재취득 반례 표 (M4·M5 가 이번엔 잡혔는지)
  - M1~M6 after 표 + 근거 필드명
  - W-1 카운터 실측값 · W-2 부등호 실측치
  - §6 회귀 표 (중앙값 + 3 런 최댓값 + spectator 런별 전부)
  - 추가한 DEV 필드가 있으면 무엇을 왜 · 실패·미완·이견 전수

최종 응답에만 적는다
  - 커밋 해시 3 개 · 최종 git status --short · git stash list (2 건)
```

---

## 9. 결과 — S4-M1R (2026-08-14) · 보고완료

주행을 끝내거나 Trail을 바꿔도, 늦게 도착한 위치 쓰기가 지운 자리를 다시 그리지 않는다. 같은 Trail에 바로 돌아와도 새 세션의 위치가 옛 정리에 지워지지 않는다. 첫 위치 쓰기가 실패해도 화면은 다음 쓰기로 복구되고, 실패는 훅까지 전달된다.

### §1 하네스 정정

| | 무엇을 바꿨는지 |
|---|---|
| M4 | 복귀 직후 `__rtwMotionWriteDelayMs=0`. 복귀~+4s 를 onValue + 100ms 폴링으로 존재→부재→존재 딥 판정. 9초 뒤 6회 샘플 제거 |
| M5 | 폴트를 `mergeTrailMotionSnapshot` 의 `set()` 직전으로 이동. 기존 pt3 `ok=0` catch 가 타게 함. 새 로깅 없음 |
| 카운터 | `syncMotionFlightDebug` 0 리터럴을 모듈 상태로 교체. 교체 전(baseline-r) 판정·표에 쓰지 않음 |

원본 `S4M1-lifecycle-baseline.json` 은 덮지 않음. 재취득본 `S4M1-lifecycle-baseline-r.json`.

### 재취득 반례 (`S4M1-lifecycle-baseline-r.json`, 3.0 min)

| | 결과 | 관측 |
|---|---|---|
| M1 | FAIL (반례) | `existsAfterSettle=true` 7/7 |
| M2 | FAIL | 숨김·종료 둘 다 잔존 |
| M3 | FAIL (반례) | `previousTrailResurrected=true` 6/6 |
| M4 | 딥 없음 · **격하** | `dip=false`. watch `[true, false]` 후 4s 폴링 18회 전부 `false` — 존재→부재는 있으나 재존재가 없어 딥이 성립하지 않음 |
| M5 | ok=0 잡힘 · 오류전달은 미성립 | `pt3_ok0=1` · `laterOk1=true` · `motionErrorEvents=[]` |
| M6 | FAIL | `w2=null` |

가 게이트: M1·M3 반례로 충족. M4 는 「수정 전 반례 없음 · 수정 후 회귀 가드」로 격하.

### M1~M6 after (`S4M1-lifecycle.json`, `allPass=true`, 2.4 min)

| | 결과 | 근거 필드 |
|---|---|---|
| M1 | PASS | `existsAfterSettle=false` · `deferredRunTotal=1` |
| M2 | PASS | `pageVisibleGone=true` · `routeDisableGone=true` |
| M3 | PASS | `previousTrailResurrected=false` · `oldEpochOk1AfterNew=0` · `newEpoch.epoch=2` |
| M4 | PASS (회귀 가드) | `dip=false` · `deferredSkipTotal=2` · 폴링 18회 전부 존재 |
| M5 | PASS | `pt3_ok0=1` · `motionErrorEvents[0].message=rtw-motion-write-fault-once` · `laterOk1=true` |
| M6 | PASS | 아래 W-2 |

### W-1 · W-2

- W-1 motion `deferredRunTotal=1` (M1). route 기존 카운터 `routeDeferredRunTotal=1`.
- W-2 `lateWriteDoneAt=1786658824472` < `deleteDoneAt=1786658824509` (Δ 37ms). route `w2` 필드는 추가하지 않음 (`routeOk=false`, 제품 로직 무수정).

### §6 회귀

replay: d0 `pass: true` · d1 `pass: true` (뒤집힌 상태 유지).

정상 3런 산출물 태그 **S41M1-*** (s41 하네스 접두어 `S41` + `S41_OUT_TAG=M1`. S41 / S41R2 미덮음). `S41M1-summary.json` `gates.all=true`.

| 지표 | 중앙값 | 3런 최댓값 | 기준 |
|---|---|---|---|
| z15 D_eff depart / cruise | 260 / 240 | 260 / 240 | ≤ 350 |
| 잔차 RMSE depart / cruise | 0.336 / 0.252 | 0.337 / 0.610 | ≤ 1.0 |
| 잔차 max depart / cruise | 1.005 / 0.784 | 1.220 / **3.534 (런1)** | 중앙값 ≤ 2.5 |
| 스케일 depart / cruise | 0.74% / 0.56% | — | ≤ 10% |
| RTDB 쓰기 /s | 5.280 | — | 현행 ≈5.4 대비 증가 금지 (S41R2 after 5.357) |
| FS route 쓰기 /s | all 0.994 · cruise 0.950 | — | ≈0.96 |
| motion inFlightMax | 1 / 1 / 1 | 1 | ≤ 1 |

spectator 런별 전부 (p50 ≤ 57 · max ≤ 87):

| 런 | p50 | max |
|---|---|---|
| 1 | 1.918 | 18.624 |
| 2 | 1.308 | 17.128 |
| 3 | 1.308 | 15.244 |

`PEER_INTERP_MAX_EXTRAP_MS=1200` · `SPECTATOR_MAX_EXTRAP_MS=3000` · `MOTION_FLIGHT_DRAIN_TIMEOUT_MS=2000` · `ROUTE_FLIGHT_DRAIN_TIMEOUT_MS=2000` 불변. route 배수와 motion 배수는 `Promise.all`.

### DEV 필드

- motion `__rtwMotionFlightDebug.w2` `{lateWriteDoneAt, deleteDoneAt}` — W-2 시각. route 에는 안 넣음.
- `__rtwStartMotionWatch` / `__rtwMotionWatchSamples` — 하네스 딥 관측. `subscribeTrailMotion` 미변경.
- 기존 pt3 로그에 `epoch` 키 추가 (M3 after). 새 로그 라인 없음.
- `deleteTrailMotion` 실패 시 DEV `console.debug` 만. 동작(삼킴) 그대로.
- cleanup `skipMotionDelete` — motion 정리를 배수 경로로 옮기기 위함.

### 실패·미완·이견

- M4 수정 전 딥 미관측 — 격하. 숨김 후 노드는 지워지고 4s 안에 재생성되지 않음(옛 6s 지연 슬롯이 새 쓰기를 막음). 구조상 경쟁은 after 의 `deferredSkipTotal=2` 로만 증명.
- 런1 z15-cruise `residualMax=3.534` 는 2.5 를 넘는다. 판정은 중앙값(0.784). 꼬리를 예산으로 보면 감리 판단.
- FS all 0.994 는 ≈0.96 보다 약간 높고, cruise 0.950 은 유지.
- 3런 중 `playwright test peer-sync-s41` 가 `peer-sync-s41r` 도 매칭해 `S41R-lifecycle.json` 을 덮을 뻔함 — 워킹트리에서 원본으로 되돌림. 커밋에 넣지 않음.
- `S3-fixture-gate.json` generatedAt 갱신 — 커밋하지 않음.
