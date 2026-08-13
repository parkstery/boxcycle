# S4-1R2 REPORT — 2 s 초과 지연 · 같은 Trail 재시작 경쟁 종결

주행을 끝냈는데 목록에 내가 계속 달리는 것처럼 남을 수 있었다. 종료할 때 정리가 2초만 기다렸다가
지워버려서, 그보다 늦게 도착한 마지막 쓰기가 지운 자리를 다시 채웠기 때문이다.
이제는 시간을 재는 대신 **마지막 쓰기가 실제로 끝난 순간에** 정리한다.

반대 사고도 막았다. 같은 코스를 곧바로 다시 시작하면 앞 세션의 뒤늦은 정리가 **새로 시작한 내 행을
지워버릴 수 있었다.** 이제는 같은 사람·같은 Trail의 세션이 살아 있으면 앞 세션의 정리를 아예 하지 않는다.

화면에서 보이는 위치와 속도는 그대로다. 이번 변경은 「언제 멈추고 언제 지우는가」만 바꿨다.

- **지시번호**: S4-1R2 · **일시**: 2026-08-13 · **기준 HEAD**: `cc64279` (미커밋 상태로 종료)
- **수행**: 감리 직접 구현 — **S4-1R2에 한한 Chief 1회 예외 승인. 이후 Cursor 구현 원칙 복귀**
- **e2e**: 수명주기 T1~T5 **1.9 분** · 정상 3 런 **1.3 · 1.4 · 1.3 분**
- **보존**: `S41R-lifecycle.json` · `S41R2-after-run{1,2,3}-events.json` · `S41R2-summary.json`
- **커밋 없음** — Codex 독립 검토 대기

---

## 0. S4-1R 보류 사유가 해소됐는가

| 보류 사유 | 해소 |
|---|---|
| ① 강제 지연 1,200 ms < 배수 예산 2,000 ms → timeout 경로 미실행 | **해소** — 지연 **3,500 ms**(T5는 6,000 ms)로 timeout 경로를 실제로 밟음 |
| ② 안전 삭제가 늦은 쓰기 완료 시점과 무연결 | **해소** — `requestRouteRowCleanup` 이 flight idle 전이 시점에 실행 |
| ③ T3 `oldEpochOk1` 이 새 세션 전후 미구분 | **해소** — `__rtwRouteEpochStarts` 기준으로 **이후만** 집계 |
| ④ 증거가 `cc64279` 이전 산출물 | **해소** — 최신 코드로 T1~T5 · 정상 3 런 전부 재취득 |

---

## 1. 수용 판정 (지시서 §4)

| | 항목 | 결과 |
|---|---|---|
| 가 | T1~T5 전부 PASS (최신 HEAD 재시험) | **PASS** (`S41R-lifecycle.json` · `allPass: true`) |
| 나 | 지연 정리·세션 소유권 계약이 두 정리 경로 모두에 적용 | **PASS** |
| 다 | `ROUTE_FLIGHT_DRAIN_TIMEOUT_MS = 2000` 불변 · 위치 산식·예산 불변 | **PASS** |
| 라 | 정상 3 런 회귀 (중앙값 + 최댓값) | **PASS** |

### 1-1. T1~T5

| | 시험 | 결과 | 근거 |
|---|---|---|---|
| T1 | 종료 중 지연 쓰기 | PASS | 행 부재 (관측 표본 전부 false) |
| T2 | `pageVisible=false` · 종료 두 경로 | PASS | `pageVisibleGone` · `routeDisableGone` 둘 다 true |
| T3 | Trail 전환 | PASS | 이전 Trail 행 부활 0 · **새 epoch 시작 이후 옛 epoch ok=1 = 0** · `epochDiscard` 1 |
| T4 | 첫 쓰기 강제 실패 | PASS | pt9 ok=0 **1** · 오류 이벤트 1 · 이후 최신 쓰기 ok=1 (큐 잠김 없음) |
| T5 | 같은 Trail 빠른 재시작 | PASS | **새 세션 행 유지**(6/6 true) · `deferredSkipTotal` **2** (`skip-live-session` 발동) |

### 1-2. 정상 3 런 (S4-1 before 대비)

| 지표 | before | after (중앙값) | 판정 |
|---|---:|---:|---|
| FS route 쓰기 /s | 4.24 | **0.96** (비 **0.226**) | ✔ ≤0.5 |
| — cruise | 1.31 | 0.95 | ✔ 1 Hz 수렴 |
| RTDB 쓰기 /s | 5.14 | 5.36 (비 1.04) | ✔ ≤1.3 |
| route in-flight max | 45 · 59 · 64 | **1 · 1 · 1** | ✔ |
| FS write RTT p50 / p95 | 2,380 / 6,723 ms | **154 / 591 ms** | 관측 |
| RTDB RTT p50 (대조군) | 170 | 163 ms | 불변 |
| touch pt11 /s | 5.03 | 0.98 | 판정 미사용 (S4-3) |

**z15 (3 런)**

| | 중앙값 `D_eff` | 중앙값 RMSE | 중앙값 max | **3 런 최댓값 max** |
|---|---:|---:|---:|---:|
| depart | **240** | 0.294 | 1.071 | **2.317** |
| cruise | **240** | 0.303 | 1.173 | **1.319** |

예산 `D_eff ≤350 · RMSE ≤1.0 · max ≤2.5 · 스케일 ≤10 %` — **중앙값·최댓값 모두 예산 안**이다.
S3B-3 run1 2.51 · S4-1 run1 4.93 로 이어지던 **단일 런 max 초과 추세는 이번에 재현되지 않았다**(최댓값 2.317).

**경로 B (spectator)** — 3 런 중앙 p50 **2.55 m** · max **19.6 m** (상한 57.0 / 87.0 안). 런별 p50 1.29 / 4.48 / 2.55.

**가드** — `pt9 ok=0` 0 · `pt3 ok=0` 0 · motion `inFlightMax` ≤1 · `A_firstOutOfOrder` 0 · 전진 폐기 0 ·
`publishQueueMs` 예산 내 · `d0-duplicate-distm` PASS 유지 · `d1-target-vs-applied` 뒤집힌 상태 유지
(`npm run test:peer-s3a-replay` 재확인).

---

## 2. 구현

### 2-1. 지연 정리 — 시간이 아니라 완료에 건다

`routePublishFlight.ts`

```
requestRouteRowCleanup({ epoch, sessionKey, run })
   flight 가 idle 이면 즉시, 아니면 대기열 → runRouteJob 의 finally 가 writing=false 로 갈 때 실행
   = 「늦은 쓰기가 실제로 끝난 시점」. ROUTE_FLIGHT_DRAIN_TIMEOUT_MS 는 2000 그대로다
```

### 2-2. 세션 소유권 — 옛 정리가 새 세션을 지우지 못한다

```
sessionKey = `${uid}|${sanitizeTrailId(trailId)}`
nextRoutePublishEpoch(sessionKey) 가 epoch → sessionKey 를 기록
isRouteSessionLive(sessionKey) 가 true 면 옛 cleanup 은 전부 건너뛴다
   ← 안전 삭제뿐 아니라 finalize · cleanupLiveLocationPublish 까지 전부
```

**이유** — React 는 옛 cleanup 을 동기 실행한 뒤 새 effect 를 곧바로 돌린다. 옛 cleanup 의 비동기
후속(2 s 뒤 삭제)이 **새 세션의 행·presence·motion 을 지운다.** `drainRouteFlightThen` 은 배수 직후
소유권을 확인하고, 걸리면 아무 일도 하지 않는다.

### 2-3. 관측 (DEV 전용)

`__rtwRouteEpochStarts`(epoch · sessionKey · at) · `__rtwRouteFlightDebug` 에 `deferredPending` ·
`deferredRunTotal` · `deferredSkipTotal` 추가 · pt9 에 `deferredCleanup=1` · `reason(run | skip-live-session)`.
전부 `import.meta.env.DEV` 게이트다.

---

## 3. 시험 강화 내역

```
WRITE_DELAY_MS    1,200 → 3,500 ms     배수 예산 2,000 ms 를 넘긴다 (시험 파라미터. 제품 상수 아님)
RESTART_DELAY_MS  6,000 ms (T5)        늦은 쓰기가 재시작 이후에 착지하도록
관측 순서         지연 주입을 끄지 않은 채 flight idle + deferredPending=0 확인 후 행 관측
                  ← 예전 판정은 관측 직전에 지연을 0 으로 되돌려 timeout 경로를 지웠다
T3                새 epoch 시작 시각 이후의 옛 epoch ok=1 만 집계
T5 (신설)         숨김→복귀로 같은 Trail·같은 uid 세션 재시작
                  ← 새 주행 시작은 새 Trail 을 만들 수 있어 「같은 Trail」 조건이 깨진다
```

### 3-1. 판정 완화가 아닌 정정 1 건 — 밝혀 둔다

T3 통과 조건에서 **`epochDiscard ≥ 1` 을 뺐다. 기준 완화가 아니다.**

```
① Chief 판단 기준은 「이전 Trail 행 부활 0」과 「새 epoch 시작 이후 옛 epoch 성공 쓰기 0」 두 건이다.
   epochDiscard 는 그 둘 중 어느 것도 아니다
② 배수가 깨끗하게 끝나면 폐기할 작업이 없는 것이 정상이고, Trail 전환이 페이지 재적재를 동반하면
   모듈 상태(epoch 카운터)가 초기화된다 — 실제로 epochStartCount=1 인 런이 관측됐다
```

관측치로는 계속 보고한다(최종 런 `epochDiscard=1` · `epochStartCount=2`).

---

## 4. 실패·미완 · 이견

- **커밋하지 않았다.** 전부 미커밋으로 남긴다 — Codex 독립 검토 대기(Chief 지시).
- `S41R-lifecycle.json` 은 같은 spec 이 쓰는 파일이라 **S4-1R 결과가 S4-1R2 결과로 갱신**됐다
  (`instruction: "S4-1R2"`). 수정 전 반례는 `S41R-lifecycle-baseline.json` 에 그대로 있다.
- 정상 3 런은 `S41R2-*` 로 냈다. **미커밋 `S41-*` 산출물은 읽기만 했고 수정하지 않았다**
  (`S41-after-run*.json` · `S41-summary.json` 타임스탬프 8/12 유지 확인).
- **범위 밖 미처리** — motion 경로(`motionPublishFlight.ts`)에 같은 수명주기 공백이 남아 있다.
  S4-1R2 범위가 아니라 손대지 않았다. **별도 지시 대상.**
- 이견 없음.

---

## 5. 결론

**S4-1R2 PASS(route 큐 수명주기 종결) · S4-1 성능 유지.**
「비용 종결」·「멀티라이더 위치 동기화 결함 종결」이 아니다 — S4-2 · S4-3 · F-1 · F-2 와
motion 수명주기 공백이 남아 있다.
