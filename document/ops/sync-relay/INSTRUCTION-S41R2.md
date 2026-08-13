# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> S4-1R 보고서는 **감리가 `REPORT-S41R.md` 로 보존**했다. 새 `REPORT.md` 만 갱신한다.
> 보고 형식은 `../cyclefit-relay/SUPERVISOR-PROTOCOL.md` §1-3 **UAG**.

- **지시번호**: S4-1R2 (2 s 초과 지연 · 같은 Trail 재시작 경쟁 종결)
- **발신**: 클로드감리0813 · **일시**: 2026-08-13 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`) · 기준 HEAD `cc64279`
- **수행**: **S4-1R2에 한한 Chief 1회 예외 승인 — 이후 Cursor 구현 원칙 복귀**
  (감리는 분석·지시서 작성·결과 감리만 수행하고 제품·시험 코드를 직접 수정하지 않는다)

---

## 0. 왜 다시 하는가 — S4-1R 은 **채택 보류**다

성능·구현 방향은 유지한다. 문제는 **시험이 결함을 밟지 못했다**는 것이다.

```
① 강제 지연 1,200 ms  <  배수 예산 2,000 ms
   → awaitRouteFlightSettled 가 항상 true → 안전 삭제 경로는 한 번도 실행되지 않았다
   ⚠ 정상 3 런 실측 FS route RTT max = 640 / 6,184 / 4,173 ms — 2 s 를 넘는다

② 안전 삭제가 「늦은 쓰기가 실제로 끝난 시점」과 연결돼 있지 않다
   시간 초과 직후 삭제 → 그 뒤 늦은 쓰기 착지 → 행 부활

③ T3 oldEpochOk1=1 이 새 세션 시작 전후를 구분하지 않는다

④ 기존 T1~T4·정상 3 런 증거는 전부 HEAD cc64279 이전 산출물이다
```

**`ROUTE_FLIGHT_DRAIN_TIMEOUT_MS = 2000` 을 늘려서 피하지 않는다.** 시간이 아니라
**완료 시점에 연결**하는 것이 이번 수정의 요지다.

---

## 1. 판단 기준 (Chief)

```
가. 2 s 를 넘는 강제 지연에서도, 늦은 쓰기가 끝난 뒤 행이 다시 남지 않는다
나. 같은 Trail 의 빠른 세션 재시작에서 이전 cleanup 이 새 세션 행을 삭제하지 않는다
다. 새 epoch 시작 이후 이전 epoch 의 성공 쓰기는 0 건이다
```

---

## 2. 구현 계약

### 2-1. 지연 정리 — 시간이 아니라 완료에 건다

`routePublishFlight.ts`

```
requestRouteRowCleanup({ epoch, sessionKey, run })
   flight 가 idle 이면 즉시, 아니면 대기열에 넣고
   runRouteJob 의 finally 가 writing=false 로 갈 때(= 늦은 쓰기가 실제로 끝난 시점) 실행한다
   실행 직전 세션 소유권을 다시 확인한다
```

### 2-2. 세션 소유권 — 같은 키의 새 세션이 있으면 옛 정리는 하지 않는다

```
sessionKey = `${uid}|${sanitizeTrailId(trailId)}`
nextRoutePublishEpoch(sessionKey) 가 epoch → sessionKey 를 기록한다
isRouteSessionLive(sessionKey) 가 true 면 옛 cleanup 은 전부 건너뛴다
   ← 안전 삭제뿐 아니라 finalize·cleanupLiveLocationPublish 까지 전부다
```

**이유** — React 는 옛 cleanup 을 동기 실행한 뒤 새 effect 를 곧바로 돌린다. 옛 cleanup 의
비동기 후속(2 s 뒤 삭제)이 **새 세션의 행·presence·motion 을 지운다.**

### 2-3. 관측 (DEV)

```
window.__rtwRouteEpochStarts   [{ epoch, sessionKey, at }]     ← 전후 구분용
__rtwRouteFlightDebug 에 deferredPending · deferredRunTotal · deferredSkipTotal 추가
pt9 에 deferredCleanup=1 · reason(run | skip-live-session) 방출
```

---

## 3. 시험 — T1~T5

```
공통   강제 지연 WRITE_DELAY_MS = 3,500 ms   ← 배수 예산 2,000 ms 를 넘긴다 (시험 파라미터)
       관측 전에 지연 주입을 끄지 않는다. 끄면 timeout 경로가 사라진다
       flight idle + deferredPending=0 을 확인한 뒤에 행을 관측한다

T1  종료 중 지연 쓰기            → 행 부재
T2  pageVisible=false · 종료      → 행 부재 (두 경로 각각)
T3  Trail 전환                    → 이전 Trail 행 부재 · epoch 폐기 ≥1 ·
                                    **새 epoch 시작 이후 옛 epoch ok=1 = 0**
T4  첫 쓰기 강제 실패             → pt9 ok=0 ≥1 · 사용자 오류 전달 · 이후 최신 쓰기 ok=1
T5  같은 Trail 빠른 재시작        → **새 세션 행이 계속 존재한다** (지연 6,000 ms)
```

---

## 4. 수용 조건

```
가.  T1~T5 전부 PASS (최신 HEAD 에서 재시험)
나.  §2-1·2-2 계약이 코드에 있고 두 정리 경로 모두에 적용됐다
다.  ROUTE_FLIGHT_DRAIN_TIMEOUT_MS = 2000 불변 · 위치 산식·예산 불변
라.  정상 3 런 — z15 예산(3 런 중앙값) · FS/RTDB 쓰기량 · 가드 유지
     중앙값과 **최댓값**을 함께 보고
```

---

## 5. 금지

- `ROUTE_FLIGHT_DRAIN_TIMEOUT_MS` **증액** · 예산·판정 규칙 변경
- S4-2 · S4-3 · motion 경로 · D 계열 배선 · spectator 산식 · Orchestrator
- **미커밋 `S41-*` 산출물 접촉** (다른 작업선) · 오케스트레이션 미커밋 파일 접촉
- cyclefit 일체 · `main2` 병합 · PR · `--no-verify`
