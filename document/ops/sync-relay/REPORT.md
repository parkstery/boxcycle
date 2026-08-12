# S4-1R REPORT — route flight 수명주기 (종료·전환·실패 안전성)

주행을 끝내거나 탭을 숨기거나 Trail을 바꿔도, 늦게 도착하는 진행률 쓰기가 지워진 행을 다시 살려 목록에 「아직 달리는 사람」처럼 남는 일이 생길 수 있었다. 이제 종료·전환 때 남은 발행을 먼저 정리한 뒤에 지우므로 그런 유령 행이 남지 않는다. 쓰기 실패가 나도 한 번 기록되고 다음 최신 값으로 이어지며, 큐가 멈추지 않는다. 평소 주행 중 쓰기량과 동행 위치 감각은 S4-1에서 맞춘 수준을 유지한다.

- **지시번호**: S4-1R
- **일시**: 2026-08-12
- **브랜치**: `fix/multiplayer-position-sync` · 제품 HEAD `badb830` (③ 전)
- **e2e**: 수명주기 **~1.5 분** · 정상 3런 **~1.4·1.4·1.4 분** (합계 **~5.7 분**)
- **보존**: `S41R-lifecycle-baseline.json` · `S41R-lifecycle.json` · `S41R-run{1,2,3}-events.json` · `S41R-summary.json`

---

## 반증 — §4

해당 없음. 수정 전(HEAD `507bd68`+① 주입)에서 T1·T2·T3가 행 부활로 FAIL 했고, 수정 후 T1~T4 전부 PASS다. 「이 조건에서 재현되지 않는다」는 반증 조건은 성립하지 않았다.

---

## UAG — §3 가~사

**S4-1R PASS(route 큐 수명주기 종결) · S4-1 성능 유지**

| 항목 | 결과 |
|---|---|
| **가** epoch 폐기 관측 | **PASS** (T3 `epochDiscard=1`) |
| **나** cancel/settle API + 정리 순서 두 경로 | **PASS** (`:206-208` · `:289-308`) |
| **다** T1~T4 | **PASS** (정착·finalize 이후 3 s 관찰) |
| **라** 수정 전 반례 ≥1 FAIL | **PASS** (T1·T2·T3 행 부활) |
| **마** 성능 (3런 중앙값) | **PASS** (FS **0.95**/s · in-flight **1**) |
| **바** z15 정확도 | **PASS** (depart **280** · cruise **240**) |
| **사** spectator ≤57/87 | **PASS** (p50 **1.53** · max **14.5**) |

---

## 기술

### 계약

1. 세션마다 `nextRoutePublishEpoch()` — `enqueue`/`runRouteJob`이 쓰기 전·슬롯 승계 전 epoch 확인, 아니면 폐기(계수)
2. `cancelRoutePublish(epoch)` — 슬롯 폐기 + epoch 무효화 (진행 중 await는 취소 불가)
3. `awaitRouteFlightSettled(2000)` — 진행 중 쓰기 정착 대기
4. 정리 순서: interval 정지 → cancel → settle → finalize/delete → 시간 초과 시 삭제 1회 더
5. `ROUTE_FLIGHT_DRAIN_TIMEOUT_MS = 2000` 고정 (늘리지 않음)

### 커밋

| # | 해시 | 내용 |
|---:|---|---|
| ① | `3b395d9`…`772c441` | 집중시험 + DEV 주입·관측 강화 (수명주기 미수정) |
| ② | `badb830` | epoch + cancel/settle + 정리 순서 |
| ③ | `abe0f9d` | 산출물·보고 |

### §2-2 반례 (수정 전)

`S41R-lifecycle-baseline.json` — T1·T2·T3 모두 `existsAfterSettle=true`(늦은 쓰기가 삭제 뒤 행 부활). T4는 당시 fault 후 ok=1 순서 관측 실패(시험 강화 후 after에서 PASS).

### §2-1 T1~T4 (수정 후)

정착·finalize burst 이후 최소 3 s 관찰. T1 종료 / T2 pageVisible·종료 / T3 Trail 전환 행 부재 · epochDiscard≥1 / T4 ok=0 1건 + routeError 경로 + 이후 ok=1.

### 정상 3런 (중앙값 / 최댓값)

| 지표 | 중앙값 | 최댓값 | 기준 |
|---|---:|---:|---|
| FS route /s | **0.95** | 1.03 | ≤1.3×1.03 |
| RTDB /s | **4.81** | 5.27 | ≤1.3×5.03 |
| FS RTT p50 | **140** | 161 | (참고) |
| route in-flight | **1** | 1 | ≤1 |
| z15 depart D_eff | **280** | 320 | ≤350 |
| z15 cruise D_eff | **240** | 260 | ≤350 |
| spectator p50 | **1.53** | 1.90 | ≤57 (S4-1 after 1.65) |
| spectator max | **14.5** | 26.2 | ≤87 (S4-1 after 13.9) |

### DEV 주입 · motion

주입점(`__rtwRouteWriteFaultOnce` · `__rtwRouteWriteDelayMs` · probe)은 전부 `import.meta.env.DEV` 게이트 — 운영 번들에 남지 않는다.

**motion** (`motionPublishFlight.ts`)에도 세션 전환 시 drain/epoch 계약이 없다. 같은 구조로 보이지만 **이번엔 손대지 않았다** (지시 §7).

### 이견 · 미완

없음. S4-2·S4-3·F-1·F-2(motion)는 범위 밖. S4-2는 S4-1R 채택 뒤 재개.
