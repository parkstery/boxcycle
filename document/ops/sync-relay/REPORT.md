# S3A REPORT — 발행 큐 제거

- **지시번호**: S3A
- **일시**: 2026-08-11
- **브랜치**: `fix/multiplayer-position-sync`
- **e2e 실행 시간**: **1.9 분** (프로세스 112 s · `S3A-summary.json` `elapsedMin` 1)
- **보존**: `document/ops/sync-relay/S3A-chain-events.json` (pt1~pt7 **전량 4851건**) · `S3A-summary.json`
- 시계 보정: before B−A=**14 ms** · after=**272 ms** · 판정용 평균 **`clockSkewMs=143`**

---

## 반증 — §2-3

**해당함.** 가·나·다 충족 상태에서 `extrapolate` 점유 **51.3%** ≥ 50%.
`publishQueueMs` p50 은 **22 ms** (1 s 미달).

지시: 고치지 않고 보고. 보간 상수·integrator 는 만지지 않았다.

| | S3R (큐 있음) | S3A (큐 없음) |
|---|---:|---:|
| extrapolate 점유 | 58.9% | **51.3%** |
| cap 히트 | **22.8%** | **0%** |
| ahead raw p50 / max | 337 / 3356 ms | **60 / 840 ms** |
| publishQueue p50 | 4520 ms | **22 ms** |

점유율 문턱만 보면 §3-4「외삽 점유 = 큐 적체의 결과」는 반증된다.
다만 cap·ahead 규모는 큐 제거와 함께 한 자릿수 줄었다. 점유 51.3% 는 n=154(interp 75 / extrap 79) 에서 문턱을 간신히 넘긴 값이다.

---

## UAG — 수용 조건 6건

**6/6 PASS.** (반증은 수용 조건이 아님. 완화 없음.)

| # | 조건 | 판정 | 근거 |
|---|---|---|---|
| **가** | motion 이 Firestore 에 막히지 않음 | **PASS** | 코드: `enqueueMotionPublish` 를 FS `await` 앞에 kick, fan-out 은 motion 을 기다리지 않음. 로그: pt3 `fsAhead=0` 전량 · pt2 `motionFirst=1` |
| **나** | `inFlightMax` ≤ 1 | **PASS** | **1** (S3R 10 → 1). join burst 도 flight 경유 |
| **다** | latest-wins 덮어쓰기 > 0 | **PASS** | `slotDiscard` **11** |
| **라** | `A_firstOutOfOrder` = 0 | **PASS** | **0** (S3R 77 → 0). `B_onValueRepeat`=1 (이번 대상 아님) |
| **마** | `publishQueueMs` 구조적 예산 | **PASS** | p50 **22** ≤ 150 · p95 **150** ≤ 400 · max **464** ≤ 800 · 1 s 초과 **0%**. m @8.33: p50 **0.18** · max **3.87** |
| **바** | replay + e2e 회귀 | **PASS** | 기존 시나리오 전부 통과. known-fail `d0-duplicate-distm` · `d1-target-vs-applied` 그대로 PASS. e2e 본 파일 산출 |

### before / after

| | S3R | S3A |
|---|---:|---:|
| `publishQueueMs` p50 / p95 / max | 4520 / 9737 / 13904 | **22 / 150 / 464** |
| 1 s 초과 | 69.4% | **0%** |
| `inFlightMax` | 10 | **1** |
| `A_firstOutOfOrder` | 77 | **0** |
| extrapolate 점유 | 58.9% | 51.3% |
| cap 히트 | 22.8% | **0%** |
| `endToEndMs` p50 / p95 / max | 93 / 160 / 1013 | **43 / 189 / 552** |

`writeRttMs` p50 **224** (S3R 206). |Δ| < 80 → 예산 재유도 없음. max 950 은 표본 꼬리(발행 예산 max 는 queue 쪽).

---

## 기술

### 구현

1. **`motionPublishFlight.ts`** — 슬롯 1칸, `writing` 중이면 덮어쓰기(latest-wins). 배열 큐 없음. 쓰기 종료 후 슬롯이 있으면 즉시 다음 `set()`.
2. **`publishLiveLocationFanout.ts`** — motion kick 을 `mergeGlobalLivePresence` / `mergeTrailLivePublicationRideSnapshot` **앞**에 두고, motion write 를 await 하지 않음. `markPeerMotionPublished` 는 `onWriteStart`(실제 `set()` 직전)만.
3. **`rideJoinPresenceBurst.ts`** — 직접 `mergeTrailMotionSnapshot` 제거. 같은 flight 로만 발행 (미경유 시 inFlightMax=4 관측).
4. **`PublicationSharedPresence.tsx`** — `motionRowsRef` 를 렌더 state 로 되돌리지 않음. RTDB 콜백에서만 갱신. FS 콜백·effect 가 한 패킷 뒤진 seq 를 재ingest 하면 newest 보다 작은 first-seen 이 **라**로 집계됐다. pt3 `d` 는 이미 단조(역행 0) — 발행 역순이 아니었다.

금지 준수: `rideSyncPolicy` 보간·발행 주기 미변경. `integrator` 분기·dedup 미변경. RTDB `onValue`→child 미전환. D-1·D-2 미수정. 주기 연장 없음. cyclefit 미접촉. `main2` 병합·PR·`--no-verify` 없음.

### replay

- `s3r-to-scenario.mjs` → `s3r-z15-cruise-scenario.json` (firstSeen 239 · forward 200)
- `replay.mjs --check` 전 시나리오 불변식 통과
- converted 시나리오: `s3r-z15-cruise-firstseen` known-fail 그대로(위반 2)
- `s3-fixture-gate.mjs` PASS · known-fail 2건 PASS

### 실패·미완

- 없음 (수용 6건). §2-3 반증은 위 절.
- `B_onValueRepeat` 1건 — S4(부모 onValue) 사안. 손대지 않음.

### 이견

- **라** 를 큐 제거만으로 0 이 된다고 보면 틀리다. 큐 제거 직후 재측정은 `inFlightMax=1`·queue 예산 PASS 인데 `A_firstOutOfOrder=103` 이 남았다. 원인은 FS/effect 가 낡은 RTDB 행을 재ingest 한 것. 수신 배선만 고쳤고 integrator 는 그대로다.
- §2-3 반증은 **점유율 문턱**에만 걸린다. cap·ahead 는 큐 가설과 같은 방향으로 줄었다.

### 커밋

보고 직후 이 브랜치에 푸시. 해시는 커밋 로그 참조.
