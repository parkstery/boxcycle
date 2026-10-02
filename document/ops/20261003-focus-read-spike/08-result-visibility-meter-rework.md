# Result 02R — visibility meter 정확도 재작업

| 항목 | 내용 |
|---|---|
| 상태 | DEVELOPMENT_DONE (계측 정확도만, 최적화 미구현) |
| 지시 | [07-task-visibility-meter-rework.md](07-task-visibility-meter-rework.md) · [06 검수](06-review-visibility-meter.md) |
| 선행 | [05 결과](05-result-visibility-meter.md) — 과장 문구는 본 문서·05 상단 정정 링크가 우선 |
| 날짜 | 2026-10-03 |
| Owner | Cursor CLI Developer |
| 제약 | production 접속·write·deploy·commit·push 없음. 제품 최적화 없음 |

---

## 결론 요약

06의 네 결함만 수정했다.

1. **batch vs getDoc 분리** — `activityWorldBatchInvocation`(진입)과 `activityWorldRouteActivityGetDoc`(cache/inflight miss 후 `getDoc` 직전)으로 나눔. E2E ×10에서 invocation +10 · getDoc **+0**(캐시 hit)로 혼동이 재현되지 않음.
2. **production override** — `subscribeDocumentVisibilityOverride`가 DEV가 아니면 즉시 `() => {}` 반환. set도 기존대로 no-op. 계약 테스트로 고정.
3. **N=3 Emulator** — REST seed로 live Trail 3개를 넣고 ×10에서 `trailLiveRides` **30/30**을 **실측**. baseline(N≈0) E2E와 별도 테스트·artifact.
4. **proxy 표** — 아래 표에서 `actual network call proxy` / `invocation proxy`를 분리. 모든 note 위치가 cache guard 뒤·Firebase 호출 직전임을 소스 계약 테스트로 고정.

---

## 05 정정

| 05 과장·오해 소지 | 정정 |
|---|---|
| `activityWorldBatch` +10 = network read | **invocation**만 +10. 실제 getDoc는 `activityWorldRouteActivityGetDoc`(E2E ×10에서 **0**) |
| “one-shot 합 30+”를 billed/network 합으로 읽기 | summary+global+**batchInvocation**+catalog 등 혼합. network 후보만 합산하려면 getDoc/getDocs proxy만 보라 |
| production override API도 DEV no-op | set은 no-op이었으나 **subscribe는 listener Set에 등록**했음 → 수정 후 완전 no-op |
| world `trailLiveRides`×N = harness만 | Emulator seed N=3에서 **30/30 실측** (별도 artifact). harness는 여전히 결정적 모델로 유지 |

05 상단에 [본 문서](08-result-visibility-meter-rework.md) 우선 링크를 남김.

---

## 변경 파일

| 경로 | 내용 |
|---|---|
| `visibilityReadMeters.ts` | one-shot 키 분리 (`BatchInvocation` / `RouteActivityGetDoc`) |
| `firestoreRouteActivity.ts` | batch 진입=invocation; getDoc 직전=getDoc proxy |
| `documentVisibilityOverride.ts` | production subscribe 즉시 no-op |
| `visibility-lifecycle-harness.ts` | invocation 키 사용 |
| `visibility-read-meters.test.ts` · `visibility-gate-contract.test.ts` | 분리·production no-op·note 위치 계약 |
| `e2e/focus-read-spike.spec.ts` | baseline에 getDoc 키·N=0 rides 고정; **별도** N=3 seed 테스트 |
| `05-result-*.md` · 본 파일 · README · PROGRESS | 정정·상태 |

---

## One-shot proxy 분류표 (결함 4)

| path | class | 위치 근거 |
|---|---|---|
| `activityWorldSummary` | **actual network call proxy** | `fetchWorldPresenceSummary` — cache 없음, `getDoc` 직전 |
| `activityWorldGlobal` | **actual network call proxy** | `fetchWorldActivityGlobal` — `getDoc` 직전 |
| `activityWorldLiveIds` | **actual network call proxy** | TTL cache miss 후, `getDocs` 경로 직전 |
| `activityWorldBatchInvocation` | **invocation proxy** | `fetchRouteActivitiesBatch` 진입 — cache hit여도 +1 |
| `activityWorldRouteActivityGetDoc` | **actual network call proxy** | `fetchRouteActivity` cache/inflight miss 후 `getDoc` 직전 |
| `catalogPublications` | **actual network call proxy** | `listPublishedRoutePublications` — `getDocs` 직전 |
| `catalogLabels` | **actual network call proxy** | uid 비어 있으면 0; 아니면 `getDoc`×N 직전(count=N) |
| `routeGeometryGapFill` | **actual network call proxy** | memory/inflight miss의 uncached 경로만 (`findPublished…`/`getDoc` 앞) |

Listener open/close는 기존과 같이 **subscription open/close proxy**(SDK billed reconnect 아님).

---

## Baseline 수치 (재측정)

### A. Emulator E2E baseline (N≈0) — `visibility-e2e-delta.json`

×10 hidden→visible:

| 경로 | class | ×10 Δ |
|---|---|---|
| trailMembers | app_resubscribe | 10/10 |
| trailLiveRides | app_resubscribe | **0/0** |
| kept (listing/CG/users/economy/conquest) | kept | 0 |
| activityWorldSummary / Global | network | 각 **10** |
| activityWorldLiveIds | network | **0** (TTL cache) |
| activityWorldBatchInvocation | invocation | **10** |
| activityWorldRouteActivityGetDoc | network | **0** |
| catalogPublications | network | **10** |
| trailPresenceWrites | write proxy | **10** |

### B. Emulator E2E N=3 seed — `visibility-e2e-n3-delta.json` (`status: measured`)

REST로 trail×3 + `livePublicationRides` seed 후 ×10:

| 경로 | ×10 Δ |
|---|---|
| trailLiveRides | **30 / 30** |
| trailMembers | 10 / 10 |
| activityWorldBatchInvocation | 10 |
| activityWorldRouteActivityGetDoc | **3** (seed publication 일부 miss; baseline의 0과 별개) |
| catalogPublications | 10 |

geometry 없는 seed publication으로 World overlay warning이 났으나 subscription meter(30/30)에는 영향 없음. baseline 테스트와 **숫자·artifact를 섞지 않음**.

### C. 순수 harness (N=3) — 결정적 모델 (Firebase 없음)

기존과 동일: trailLiveRides 30/30, batch**Invocation** 10, getDoc 경로 0(하네스가 network를 흉내 내지 않음).

---

## 검증

| 명령 | 결과 |
|---|---|
| `npm run test:focus-read-spike` | **PASS** 14/14 |
| `npm run test:s42-meters` | **PASS** 15/15 |
| `npm run check:dep` (repo root) | **PASS** |
| `npx tsc -p tsconfig.json --noEmit` | **PASS** |
| `npx eslint` (변경 파일) | **PASS** |
| `$env:RTW_DEV_PORT='5015'; npm run test:e2e:focus-read-spike` | **PASS** 2/2 |

---

## Git

지시대로 **commit / push / deploy / production 접속 없음**.
