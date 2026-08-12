# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> S4-1 보고서는 **감리가 `REPORT-S41.md` 로 보존**했다. 너는 **새 `REPORT.md` 만 작성**하고
> 기존 보고서를 옮기거나 덮지 마라. 마치면 이 파일 `상태` → `보고완료`.
> 보고 형식은 `../cyclefit-relay/SUPERVISOR-PROTOCOL.md` §1-3 **UAG** (rider 전용 규율은 해당 없음).

- **지시번호**: S4-1R (route flight 수명주기 — 종료·전환·실패 안전성 종결)
- **발신**: 클로드감리0812 · **일시**: 2026-08-12 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`) · 기준 HEAD `507bd68`

---

## 0. 목적 — S4-1 의 성능은 지키고, 안전성만 닫는다

```
지킬 것   FS route 쓰기 1.03 /s · RTT p50 159 ms · in-flight 1 · z15 예산 · spectator 개선
닫을 것   종료·전환·실패 시 route 큐가 무엇을 하는지에 대한 계약이 없다
```

**S4-2 는 중단됐다. S4-1R 이 PASS 로 채택된 뒤에 재개한다.**

### 0-1. 확정 사실 (Chief 판단 · 재조사 금지)

```
① routePublishFlight.ts 에는 진행 중 작업·대기 슬롯을 user / Trail / session 전환 시
   폐기하거나 drain 하는 계약이 없다. writing·slot 은 모듈 전역이라 세션을 넘어 살아남는다

② cleanup 은 route flight 와 순서를 맞추지 않는다
   useLiveLocationPublishSession.ts:289-308   effect cleanup 이 interval 만 끄고 곧바로
                                              finalize / delete 를 호출한다
                              :206-208        pageVisible=false 경로도 같다
   → 삭제 뒤에 늦은 쓰기가 착지하면 행이 되살아난다

③ 정상 E2E 의 pt9 ok=0 = 0 은 「실패가 없었다」일 뿐 실패 복구의 증거가 아니다
```

**②의 행 되살아남은 「유령 Trail 목록」으로 표면화된다.** 정책이 아니라 결함이다.

---

## 1. 만들 계약 — 셋

### 1-가. 세대(epoch) — 이전 세션의 작업은 실행되지 않는다

```
발행 세션마다 epoch 를 하나 부여한다   (user.uid + trailId + publicationId 가 바뀌면 새 epoch)
enqueueRoutePublish 는 job 에 epoch 를 싣는다
runRouteJob 은 쓰기를 시작하기 전과 다음 슬롯으로 넘어가기 전에 epoch 를 확인한다
   현재 epoch 가 아니면 쓰지 않고 폐기한다 — 폐기는 세어서 보고한다
```

**모듈 전역 상태를 지우는 것만으로는 부족하다.** 이미 `await` 에 들어간 쓰기는 되돌릴 수 없고,
그 완료 콜백이 다음 슬롯을 이어 실행하는 경로(`runRouteJob` `finally`)를 막아야 한다.

### 1-나. 취소·배수(drain) API

```
cancelRoutePublish(epoch) →  { hadInFlight: boolean, droppedSlot: boolean }
   대기 슬롯을 버린다(카운트) · epoch 를 무효화한다 · 진행 중 쓰기는 취소하지 않는다(불가능)

awaitRouteFlightSettled(timeoutMs) →  boolean   // true = 정착 완료, false = 시간 초과
   진행 중 쓰기가 끝날 때까지 기다린다
```

**새 상수 1 개 추가를 허용한다.**

```
ROUTE_FLIGHT_DRAIN_TIMEOUT_MS = 2000
   근거: S4-1 실측 FS write RTT max 785 ms · p95 413 ms. 최댓값의 2 배 이상을 덮되
         무한정 기다리지 않는다. 이 값을 늘려 시험을 통과시키지 마라
```

### 1-다. 정리 순서 — 삭제는 **정착 뒤에**

`useLiveLocationPublishSession` 의 **두 경로 모두**(`:206-208` · `:289-308`)에 적용한다.

```
1  interval 정지
2  cancelRoutePublish(epoch)                 ← 대기 슬롯을 먼저 버린다
3  await awaitRouteFlightSettled(2000)       ← 진행 중 쓰기가 착지하기를 기다린다
4  finalize / delete 실행
5  안전망: 3 이 시간 초과였다면 삭제를 한 번 더 시도한다 (1 회만. 루프 금지)
```

**React effect cleanup 은 동기다.** 위 순서는 cleanup 이 시작하는 비동기 작업 안에서 돌되,
**4 가 3 보다 먼저 실행되어서는 안 된다.** 언마운트 후에도 이 순서가 지켜져야 한다.

⚠ **motion 경로에 같은 구조가 있으나 이번에 손대지 마라.** route 만이다.

### 1-라. 추가 — **finalize 경로도 계약에 넣어라** (감리 보강 · ① 반례 확인 후)

`finalizeAndDeleteTrailLivePublicationRide`(`firestoreTrailLivePublicationRides.ts:159-176`)는
**flight 를 거치지 않고 직접 merge** 한 뒤 `PEER_LIVE_RIDE_FINAL_BURST_MS` 를 기다렸다가 삭제한다.

```
① 그 대기 창 동안 flight 의 진행·대기 쓰기가 착지할 수 있다
② 삭제 뒤에 착지하면 행이 남는다
```

**①의 baseline 관측이 이것과 일치한다** — `pageVisibleGone: true`(숨김 경로는 정상 삭제)인데
`routeDisableGone: false`(route disable 경로만 행이 남는다). 숨김 경로(`:206-208`)는 finalize 를
거치지 않고 곧장 삭제하고, 실패한 쪽은 finalize 를 거치는 경로다.

```
따라서 §1-다 의 2~3(취소·정착 대기)은 finalize 「앞」에도 와야 한다
   interval 정지 → cancel → settle → finalize(merge+burst+delete) → 안전망 재삭제 1회
finalize 의 merge 자체는 바꾸지 마라 — 순서만 맞춘다
PEER_LIVE_RIDE_FINAL_BURST_MS 값을 바꾸지 마라
```

**epoch·drain 만 넣고 finalize 순서를 그대로 두면 T2 는 계속 FAIL 한다.**

---

## 2. 집중 시험 — 4 건. **전부 실패를 실제로 일으켜서 증명한다**

기존 Playwright 하네스를 쓴다(`peer-sync-s41r.spec.ts`). **새 테스트 러너를 도입하지 마라.**

실패를 강제하려면 **DEV 전용 주입점**을 만든다.

```
import.meta.env.DEV 게이트 필수 — 운영 번들에 남으면 안 된다
예: window.__rtwRouteWriteFaultOnce = 1  이면 다음 route 쓰기 1 회를 강제 실패시킨다
주입점은 route flight 안에만 둔다. merge 함수·Firestore 래퍼를 바꾸지 마라
```

### 2-1. 시험 4 건 (전부 PASS 여야 한다)

```
T1  종료 중 지연 쓰기
    route 쓰기가 진행 중이고 슬롯에도 대기가 있는 상태에서 주행을 종료한다
    → cleanup 이후 Firestore 행이 존재하지 않는다 (정착 뒤 재확인 · 최소 3 s 관찰)

T2  route disable · pageVisible=false 전환
    같은 상태에서 각각 전환한다  →  T1 과 같은 결과

T3  Trail / user 전환
    같은 상태에서 다른 Trail(또는 다른 user)로 넘어간다
    → 이전 Trail 행이 되살아나지 않는다
    → 새 세션에서 이전 epoch 의 쓰기가 실행되지 않는다 (pt9 에 이전 epoch 방출 0 건)

T4  첫 쓰기 강제 실패
    주입점으로 첫 route 쓰기를 실패시킨다
    → pt9 ok=0 이 정확히 1 건 방출된다
    → 사용자 오류 경로(onRouteError → reportError)로 전달된다   ← 관측으로 보여라
    → 그 다음 「최신」 스냅샷 쓰기가 정상 수행된다 (ok=1) — 큐가 잠기지 않는다
    → 실패한 옛 스냅샷이 뒤늦게 쓰이지 않는다 (latest-wins 유지)
```

**「행이 없다」는 삭제 직후가 아니라 정착 뒤에 확인해야 의미가 있다.** 최소 3 s 관찰하라.

### 2-2. 반례 확인 — 시험이 진짜로 잡는지 보여라

**수정 전 코드(HEAD `507bd68`)에서 T1~T4 를 돌려 최소 1 건이 FAIL 하는 것을 먼저 보여라.**
전부 PASS 하면 **시험이 결함을 못 잡는 것**이므로 시험을 고쳐야 한다. **이 절차를 건너뛰지 마라.**

---

## 3. 수용 조건 — 전부 충족해야 PASS

```
가.  §1-가 epoch 가 동작한다 — 이전 세션 작업 폐기 건수가 관측된다
나.  §1-나 API 2 개가 있고, §1-다 순서가 두 정리 경로 모두에 적용됐다
다.  §2-1 T1~T4 전부 PASS
라.  §2-2 반례 — 수정 전 코드에서 FAIL 하는 항목이 최소 1 건 제시됐다
마.  성능 회귀 금지 (3 런 중앙값 · S4-1 after 기준선)
     FS route 쓰기 /s ≤ 1.3 × 1.03 · RTDB 쓰기 /s ≤ 1.3 × 5.03
     route in-flight ≤1 · motion inFlightMax ≤1 · pt3/pt9/pt11 ok=0 = 0 (정상 런에서)
바.  정확도 회귀 금지 (3 런 중앙값)
     z15-depart · z15-cruise   D_eff ≤350 · RMSE ≤1.0 · max ≤2.5 · 스케일 ≤10 %
     d0-duplicate-distm PASS 유지 · d1-target-vs-applied 뒤집힌 상태 유지
사.  spectator 악화 금지 — 오차 p50 ≤ 57.0 m · max ≤ 87.0 m (S3B-3 상한)
     S4-1 after(1.65 / 13.9)와의 대조도 함께 적어라
```

**시험을 통과시키려고 `ROUTE_FLIGHT_DRAIN_TIMEOUT_MS` 를 늘리지 마라.**
2000 ms 로 부족하다면 그 사실이 결과다 — 값을 바꾸지 말고 보고하라.

---

## 4. 반증 조건 (해당하면 즉시 보고하고 멈춰라)

> *"수정 전 코드에서 T1~T4 가 전부 PASS 라면, 「삭제 뒤 늦은 쓰기가 행을 되살린다」는 판단이
> 이 조건에서는 재현되지 않는 것이다."*

그때는 **고치지 말고 멈춰라.** 재현 조건이 무엇이어야 하는지 적어 올려라. 다음 판단은 Chief 가 한다.
**재현이 안 된다고 시험을 느슨하게 만들어 PASS 를 만들지 마라.**

---

## 5. 보존

```
document/ops/sync-relay/S41R-lifecycle.json      T1~T4 결과 · 반례(수정 전) 결과 · epoch 폐기 건수
document/ops/sync-relay/S41R-run{1,2,3}-events.json   정상 3 런 pt1~pt11 전량
document/ops/sync-relay/S41R-summary.json        §3 가~사 판정 · 3 런 중앙값 **및 최댓값**
```

표본 추출 금지. 방출한 것은 전부 보존한다.

---

## 6. 커밋 분할

```
① 집중 시험 spec + DEV 주입점 (수정 없음) — 이 상태로 §2-2 반례를 찍는다
② epoch + cancel/settle API + 정리 순서
③ 정상 3 런 측정 산출물 · 보고
```

**① 을 먼저 커밋하고 반례를 관측하라.** 고친 뒤에 시험을 쓰면 반례를 만들 수 없다.

---

## 7. 금지

- **S4-2 · S4-3** — 읽기 증폭 계측 · `touchTrailInstanceActivity` · heartbeat 재검토.
  **S4-2 는 S4-1R 채택 뒤 재개한다**
- **motion 경로 수정** (`motionPublishFlight.ts` · `rtdbTrailMotion.ts` · S3A single-flight 구조)
  — 같은 결함 구조가 보여도 이번엔 **보고만** 해라
- **D-0 · D-1 · D-2 배선 되돌리기** · `integrator.ts` · `spectatorRideExtrap.ts` 산식 변경
- **기존 상수 값 변경** — `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS` · `SPEED_PUBLISH_DELTA_MPS` ·
  `METRICS_UI_MS` · `PEER_INTERP_*` · `SPECTATOR_MAX_EXTRAP_MS` · `MAP_PEER_SPRITE_MIN_ZOOM`
  (신규 `ROUTE_FLIGHT_DRAIN_TIMEOUT_MS` 1 개 추가만 허용 · 값 2000 고정)
- **발행 내용 변경** — 스냅샷 필드·값·산식. 이번은 「언제 멈추고 언제 지우는가」만이다
- **예산·판정 규칙 변경** (예산 4 종 · 3 런 중앙값 규칙)
- 새 테스트 러너·새 로깅 프레임워크 도입 · 표본 추출 · F-1 수정 · Orchestrator
- **파일 전역 `eslint-disable` 추가** — `MapView.tsx` 건은 이미 부채다. 늘리지 마라.
  훅이 막으면 고치지 말고 보고하라
- 작업공간의 **오케스트레이션 관련 미커밋 파일**(`document/260812-AI-오케스트레이션-*`,
  `scripts/claude-report-audit.mjs`, `document/ops/sync-relay/AUDIT.md`) **읽기·수정·삭제·커밋**
- cyclefit 자산·코드·스킬 일체 수정 · `main2` 병합 · PR · `--no-verify`

---

## 8. 보고

**새 `REPORT.md` 만 작성한다.**

### 8-1. 첫머리는 평문이다

**「무엇이 안전해졌는가」를 지표 없이 3~5 줄로 먼저 써라.** 운영자·사용자가 알아들을 말로.
예: 「주행을 끝냈는데 목록에 내가 계속 달리는 것처럼 남는 경우가 생길 수 있었다.
이제 종료할 때 남은 쓰기를 정리한 뒤 지우므로 그런 행이 남지 않는다.」 **과장 금지.**

### 8-2. 그 다음

```
반증  §4 해당 여부 — 평문 다음, 표보다 먼저

UAG   §3 가~사 판정표
      한 줄 결론은 「S4-1R PASS(route 큐 수명주기 종결) · S4-1 성능 유지」 형태로
      「비용 종결」·「멀티라이더 위치 동기화 결함 종결」이라고 쓰지 마라

기술  계약 요약 (epoch · cancel/settle · 정리 순서 5 단계 · 안전망 1 회)
      §2-1 T1~T4 결과와 관측 근거 (행 부재는 정착 뒤 3 s 확인임을 명시)
      §2-2 반례 — 수정 전 코드에서 무엇이 어떻게 FAIL 했는지
      epoch 폐기 건수 · 슬롯 폐기 건수
      정상 3 런: 쓰기량·RTT·z15·spectator — **중앙값과 최댓값을 함께**
      DEV 주입점이 운영 번들에 없다는 근거
      보존 파일 경로 · 실패·미완 전수 · 이견 · 커밋 3 개
```

**「부분 성공」은 없다.** §3 가~사 가 전부 충족될 때만 PASS 다.
**e2e 는 백그라운드로 던지고 산출물 파일만 확인하라. 런별 실행 시간을 분 단위로 적어라.**
