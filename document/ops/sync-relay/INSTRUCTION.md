# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> 이전 지시(S4-1R2-D) 본문·결과는 §1-0 에서 `INSTRUCTION-S41R2D.md` 로 보존한 뒤 이 파일을 쓴다.
> **새 `REPORT.md` 를 만들지 마라** — 결과는 §6 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: S4-M0 (기준점 고정) + **S4-M1** (motion 발행 수명주기 · F-2 종결)
- **발신**: 클로드감리0814 · **일시**: 2026-08-14 · **상태**: 착수대기
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`) · 기준 HEAD `b6aa635`

---

## 0. 왜 하는가 — 한 문장

route 에서 실제로 터졌던 결함(늦은 쓰기가 지운 자리를 되살리고, 옛 정리가 새 세션을 지우는 것)이
**motion 경로에는 구조 그대로 남아 있다.** S4-1R2 에서 route 만 고쳤기 때문이다.

근거는 HANDOFF §3-17 이다. 추정이 아니라 코드 확인 사실이다.

```
epoch·취소        없음   죽은 세션의 job 도 그대로 RTDB 에 쓴다
배수 후 삭제      없음   cleanupLiveLocationPublish 가 deleteTrailMotion 을 즉시 호출한다
세션 소유권       없음   옛 정리가 새 세션의 motion 노드를 지운다
지연 삭제         없음   늦은 쓰기가 착지해도 다시 정리할 수단이 없다
오류 전달         없음   runMotionJob 에 catch 가 없어 unhandled rejection 으로 샌다 (F-2)
```

⚠ **과장하지 마라.** motion 에는 `onDisconnect().remove()` 가 걸려 있어 탭이 닫히면 서버가 지운다.
부활 노출은 **탭이 살아 있는 동안**뿐이다 — 종료·숨김·Trail 전환·같은 Trail 재시작이 그 구간이다.
이 사실을 보고서에도 그대로 적어라.

---

# 1차 — S4-M0. 기준점을 clean 하게 고정한다

## 1-0. 먼저 보존

```
git show b6aa635:document/ops/sync-relay/INSTRUCTION.md
   → document/ops/sync-relay/INSTRUCTION-S41R2D.md 로 저장 (내용 그대로)

현재 워킹트리의 REPORT.md
   → document/ops/sync-relay/REPORT-S4STATUS.md 로 복사 (내용 그대로)
```

**복사가 먼저다.** 다음 지시에서 `REPORT.md` 를 다시 덮어쓰면 이 상태 보고가 사라진다.

## 1-1. `REPORT.md` 는 **내용을 고치지 마라**

감리 채널 판정(WARNING 3 건) 중 ②③(지시번호 자칭 `S4-STATUS` · REPORT 전면 교체)은
**Chief 가 내용 수정 없이 커밋하기로 결정**했다. 정정하지 마라. ① 미커밋만 이 커밋으로 해소한다.

지금 워킹트리의 `REPORT.md` sha256 은 `cbf155455e8308aa3202fa39ee2c9dec9e727a19824b46b2b2a9a35a2fa05fe0`
이다. **커밋 직전에 다시 계산해 이 값과 같은지 확인하고, 다르면 멈추고 보고하라.**

## 1-2. 비코드 커밋 1 개

담을 파일은 정확히 5 개다. 경로를 지정해 담아라.

```
document/ops/sync-relay/REPORT.md                  ← 내용 무수정
document/ops/sync-relay/REPORT-S4STATUS.md         ← §1-0 사본
document/ops/sync-relay/INSTRUCTION.md             ← 이 지시서
document/ops/sync-relay/INSTRUCTION-S41R2D.md      ← §1-0 사본
document/ops/sync-relay/HANDOFF.md                 ← 감리가 §3-17·§3-18 추가해 둠. 그대로 담아라
```

```
docs(sync): S4 상태 보고 고정 + S4-M1 지시 — 기준점 clean

본문에 남겨라
  - REPORT.md 는 내용 무수정 커밋 (채널 감리 WARNING ① 해소)
  - S4-1R2-D 지시서를 INSTRUCTION-S41R2D.md 로 보존
  - 상태 보고를 REPORT-S4STATUS.md 로 보존
```

**`git add -A` · `git add .` · `git commit -a` 금지.** 커밋 뒤 `git status --short` 가 비어야 한다.
**여기서 멈추지 말고 곧바로 2차로 넘어가라.**

---

# 2차 — S4-M1. motion 발행 수명주기 · F-2

## 2-1. 먼저 반례를 잡아라 (수정 전)

route 때 `S41R-lifecycle-baseline.json` 이 판정을 구했다. 같은 순서를 지켜라.

**수정 전 코드로** 시험을 먼저 돌려 **M1·M3·M4 가 실제로 실패하는 것**을 기록한다.
→ `document/ops/sync-relay/S4M1-lifecycle-baseline.json`

**반례가 안 잡히면 거기서 멈추고 보고하라.** 재현되지 않는 결함을 고쳤다고 보고하는 것이
S4-1R 이 보류된 이유다. 지연을 키우거나 시나리오를 바꿔 재현을 시도하는 것은 좋다 —
**단, 제품 상수를 건드려 재현하지는 마라.**

## 2-2. 구현 — route 와 같은 계약을 motion 에 세운다

`routePublishFlight.ts` 가 정본이다. **베끼되 route 파일은 고치지 마라.**

```
motionPublishFlight.ts 에 세울 것

① epoch        nextMotionPublishEpoch(sessionKey) · cancelMotionPublish(epoch)
                취소된 epoch 의 job 은 슬롯에서도 버린다 (대기 슬롯 비우기 포함)
② 배수         awaitMotionFlightSettled(MOTION_FLIGHT_DRAIN_TIMEOUT_MS)
                writing=false 이고 slot=null 인 순간이 정착이다
③ 세션 소유권   isMotionSessionLive(sessionKey)  — sessionKey = `${uid}|${sanitizeTrailId(trailId)}`
④ 지연 삭제     requestMotionNodeCleanup({ epoch, sessionKey, run })
                flight 가 idle 이면 즉시, 아니면 runMotionJob 의 finally 에서 배수
                살아 있는 같은 세션이 있으면 **실행하지 않는다**(skip-live-session)
⑤ 오류 전달     runMotionJob 에 catch 를 세워 job.onError?.(e) 로 호출부까지 올린다
```

`MOTION_FLIGHT_DRAIN_TIMEOUT_MS` 는 `rideSyncPolicy.ts` 에 **2_000** 으로 새로 둔다.
**이 값을 늘려서 시험을 통과시키지 마라.** `ROUTE_FLIGHT_DRAIN_TIMEOUT_MS` 도 2000 그대로다.

`useLiveLocationPublishSession.ts` — 지금 route 만 배수하는 두 정리 경로(`pageVisible=false`,
effect cleanup)에서 **motion 도 같이 배수·소유권 확인 뒤 삭제**되게 하라.
`cleanupLiveLocationPublish` 가 `deleteTrailMotion` 을 곧바로 호출하는 지금 구조가 결함 지점이다.
route 행 삭제와 motion 노드 삭제가 **서로의 배수를 기다리느라 늦어지지 않게** 하라 —
두 배수를 직렬로 이어 붙이면 정리가 4 초로 늘어난다.

### F-2 — 오류가 앱까지 온다

`enqueueMotionPublish` 는 즉시 반환하므로 `tick` 의 `try/catch` 로는 절대 안 잡힌다.
`onRouteError` 와 같은 방식으로 `onMotionError` 를 fanout → 훅의 `reportError` 까지 연결하라.

**새 로깅을 만들지 마라.** `rtdbTrailMotion.ts:157-166` 이 이미 pt3 `ok=0` 을 방출하고 rethrow 한다.
F-2 의 결함은 로그 부재가 아니라 **앱이 반응하지 못하는 것**이다.
덧붙여 `deleteTrailMotion` 의 `.catch(() => {})` 는 삭제 실패를 통째로 삼킨다 — DEV 게이트로
실패 사실만 남겨라(동작은 그대로 — 삭제 실패로 정리를 멈추지 마라).

## 2-3. W-1 · W-2 를 종결한다 — 카운터와 **시각**으로

route 에서 남긴 부채다. 이번 하네스가 **motion·route 양쪽 모두**에 대해 아래를 기록해야 한다.

```
W-1  지연 정리의 run 경로(run>0)를 카운터로 직접 증명
     deferredRunTotal ≥ 1 인 런이 실제로 있어야 한다.
     행/노드 부재만으로 「실행됐다」고 쓰지 마라 — 그게 W-1 이 남은 이유다
W-2  선후를 시각으로 기록
     late-write done(ms) · delete done(ms) 를 같은 시계로 남기고 대소를 판정에 쓴다
     「늦은 쓰기가 끝난 **뒤** 삭제가 돌았다」를 부등호로 보일 것
```

route 쪽은 **제품 로직을 고치지 마라.** 이미 있는 `deferredRunTotal` · `deferredSkipTotal` · pt9
`reason` 을 읽는 것으로 끝내라. 시각 기록에 DEV 게이트 필드가 꼭 필요하면 **최소 1 개만** 추가하고
무엇을 왜 추가했는지 보고서에 적어라. 그 이상이 필요하면 멈추고 보고하라.

## 2-4. 시험 — `apps/web/e2e/peer-sync-s4m1.spec.ts` (신규)

기존 spec 을 고치지 말고 새로 만들어라. `playwright test peer-s4m1` 로 이것만 걸리게 하라.

| | 시나리오 | 통과 조건 |
|---|---|---|
| M1 | 주행 종료 중 늦은 motion 쓰기 | 종료 후 내 motion 노드 부재 · `deferredRunTotal ≥ 1` |
| M2 | `pageVisible=false` · 종료 두 경로 | 두 경로 모두 노드 부재 |
| M3 | Trail 전환 | 이전 Trail 노드 부활 0 · **새 epoch 시작 이후 옛 epoch 성공 쓰기 0** |
| M4 | 같은 Trail 빠른 재시작 (숨김→복귀) | **새 세션 노드 유지** · `skip-live-session` 발동 |
| M5 | 첫 쓰기 강제 실패 | pt3 `ok=0` 1 건 · **`onMotionError` 가 호출부까지 도달** · 이후 최신 쓰기 성공(큐 잠김 없음) |
| M6 | W-2 선후 | `lateWriteDoneAt < deleteDoneAt` 을 만족하는 표본 ≥ 1 |

```
지연 주입   3,500 ms 이상 (M4 는 6,000 ms)  ← 배수 예산 2,000 ms 를 실제로 넘겨야 timeout 경로를 밟는다
            시험 파라미터다. 제품 상수가 아니다
관측 순서   지연을 끄지 않은 채 flight idle + deferredPending=0 을 확인한 뒤 노드를 본다
            ← 관측 직전에 지연을 0 으로 되돌리면 timeout 경로가 지워진다 (S4-1R 이 그래서 보류됐다)
M4 주의     새 주행 시작은 새 Trail 을 만들 수 있다. 반드시 숨김→복귀로 같은 Trail 을 유지하고
            trailId 가 같은지 assert 하라
```

증거 → `document/ops/sync-relay/S4M1-lifecycle.json` (`allPass` 포함).
**베이스라인 파일을 덮어쓰지 마라.**

## 2-5. 회귀 — 예산은 그대로다

```
npm run test:peer-s3a-replay        d0-duplicate-distm PASS · d1-target-vs-applied 뒤집힌 상태 유지
정상 3 런                            산출물 태그 S4M1-*  ← 기존 S41*·S41R2* 를 덮어쓰지 마라
```

| 지표 | 유지 기준 |
|---|---|
| z15 `D_eff` depart / cruise | **중앙값 ≤ 350** (현행 240 / 240) |
| 잔차 RMSE / max | 중앙값 RMSE ≤ 1.0 · max ≤ 2.5 · **3 런 최댓값도 병기** |
| 스케일 | ≤ 10 % |
| RTDB 쓰기 /s | 현행(≈5.4) 대비 **증가 금지** — motion 은 RTDB 경로다. 여기가 이번 회귀 위험 지점이다 |
| FS route 쓰기 /s | 현행 ≈0.96 유지 |
| motion `inFlightMax` | ≤ 1 |
| spectator 오차 | p50 ≤ 57 · max ≤ 87 · **런별 값 전부 병기** (중앙값 뒤에 이상치를 숨기지 마라) |

**보간·외삽 상수(`PEER_INTERP_MAX_EXTRAP_MS` 1200 · `SPECTATOR_MAX_EXTRAP_MS` 3000)는 불변이다.**

## 2-6. 커밋

S4-M1 은 **제품 / 시험·도구 / 증거·문서 3 개로 나눠** 커밋하라(S4-1R2 와 같은 방식).
경로 지정. `git add -A` 금지. **push · `main2` 병합 · PR 금지.**

---

## 3. 수용 판정

| | 항목 | 기준 |
|---|---|---|
| 가 | 수정 전 반례가 잡혔다 | `S4M1-lifecycle-baseline.json` 에 M1·M3·M4 실패 기록 |
| 나 | M1~M6 전부 PASS | `S4M1-lifecycle.json` `allPass=true` |
| 다 | 다섯 계약이 두 정리 경로 모두에 적용 | epoch·배수·소유권·지연삭제·오류전달 |
| 라 | W-1 종결 | `deferredRunTotal ≥ 1` 을 카운터로 제시 |
| 마 | W-2 종결 | `lateWriteDoneAt < deleteDoneAt` 을 시각으로 제시 |
| 바 | 상수 불변 | drain 2000 (route·motion 둘 다) · 보간/외삽 상수 · 예산 |
| 사 | 회귀 | replay PASS · 3 런이 §2-5 표를 만족 |

**하나라도 미달이면 통과라고 쓰지 마라.** 미달 항목과 관측치를 그대로 보고하면 감리가 판단한다.

---

## 4. 금지

- **S4-2 · S4-3 혼입** (읽기 증폭 · `touchTrailInstanceActivity` · heartbeat)
- **route 재개발** — `routePublishFlight.ts` 제품 로직 수정 금지 (읽기·DEV 계측 최소 1 필드만 예외)
- **보간·외삽 정책 변경** · **RTDB 구독 구조(`subscribeTrailMotion`·`onValue`) 변경**
- **시험 통과를 위한 임계 상수 완화·증액** — drain 2000 을 늘리지 마라
- 관측 직전 지연 주입 해제 · 기존 spec 수정 · 기존 산출물(`S41*` · `S41R*` · baseline) 덮어쓰기
- `git add -A` 계열 · `--no-verify` · **stash 조작(`drop`·`clear`·`pop`)** · **push · 병합 · PR**
- Orchestrator 문서(`CLAUDE.md` · 260707 결정 로그) 접촉 · cyclefit 일체

---

## 5. 막히면

재현이 안 되거나(§2-1), route 계측 필드가 1 개로 안 되거나(§2-3), 회귀가 §2-5 를 못 맞추면
**임계값을 움직이지 말고 멈추고 보고하라.** 관측치를 그대로 주면 감리가 판정을 정정한다.
S4-1R2 의 T3 정정이 그렇게 나왔다.

---

## 6. 보고 — 이 파일 아래에 §6 형식으로

```
문서에 적는다
  - 첫머리 3~4 줄: 화면에서 무엇이 좋아졌는지 평문으로 (용어: Trail · 내 도로망)
  - S4-M0 커밋 파일 5 개 · REPORT.md sha256 재확인 결과
  - §2-1 반례 표 (수정 전 M1·M3·M4)
  - M1~M6 결과 표 + 근거 필드명
  - W-1 카운터 값 · W-2 시각 부등호 실측치
  - §2-5 회귀 표 (중앙값 + 3 런 최댓값 + spectator 런별 전부)
  - 추가한 DEV 계측 필드가 있으면 무엇을 왜
  - 실패·미완·이견 전수 — 없으면 「없음」이라고 명시

최종 응답에만 적는다
  - 커밋 해시 (S4-M0 1 개 + S4-M1 3 개)
  - 최종 git status --short · git stash list (2 건 유지)
```
