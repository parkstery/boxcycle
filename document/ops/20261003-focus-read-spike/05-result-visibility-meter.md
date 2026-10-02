# Result 02 — visibility 복귀 operation proxy baseline

| 항목 | 내용 |
|---|---|
| 상태 | DONE (계측·재현만, 최적화 미구현) — **수치·해석은 [08 재작업 결과](08-result-visibility-meter-rework.md)가 우선** |
| 지시 | [04-task-visibility-meter.md](04-task-visibility-meter.md) · [03 검수](03-review-root-cause-audit.md) |
| 날짜 | 2026-10-03 |
| Owner | Cursor CLI Developer |
| 제약 | production 접속·write·deploy·commit·push 없음. 제품 동작 최적화 없음 |

> **정정 (TASK-02R):** `activityWorldBatch` +10 / “one-shot 합 30+”를 실제 network read로 읽지 말 것 — batch 진입은 **invocation proxy**였고 cache-hit도 포함했다. production override subscribe도 완전 no-op이 아니었다. 분리 계측·proxy 표·N=3 근거는 [08-result-visibility-meter-rework.md](08-result-visibility-meter-rework.md).

---

## 결론 요약

Trailhead idle에서 `hidden→visible` 10회는 **앱이 명시적으로 닫았다가 다시 여는 경로**만으로도 결정적 operation proxy delta를 만든다. Emulator E2E(라이브 Trail N≈0)와 순수 harness(N=3)를 합치면, 앱 제어 가능 항목 상위는 다음이다.

1. **Activity World immediate tick** — visible 복귀마다 `summary` + `global` + `batch` one-shot (± `liveIds`는 클라이언트 TTL 캐시 시 0)
2. **published catalog `publications` getDocs** — visible 복귀마다 1회
3. **world `trailLiveRides` × N 재구독** (N>0일 때 listener open/close 지배) + **`trailMembers` 재구독** (N과 무관하게 복귀당 1)

유지 리스너(listing / CG / users / economy / conquest)는 앱 open/close delta **0**. SDK reconnect billed는 **미계측(`sdk_unmetered`)**.

모든 수치는 **operation proxy**이며 Firebase Console billed read가 아니다.

---

## 구현 파일

| 구분 | 경로 |
|---|---|
| path meter | `apps/web/src/lib/debug/visibilityReadMeters.ts` |
| visibility override seam | `apps/web/src/lib/debug/documentVisibilityOverride.ts` · `apps/web/src/hooks/useDocumentVisibility.ts` |
| `__rtwReadSubs` 확장 | `apps/web/src/lib/debug/installReadSubscriptionDebug.ts` (`visibility`, `setVisibilityOverride`, `resetVisibilityMeters`) |
| listener 배선 | `firestoreOpenTrailListings` · `firestoreTrail`(members+presence) · `firestoreTrailLivePublicationRides`(기존 `__rtwReadSubs` 종류와 중첩, Firebase 이중 호출 없음) · `firestoreRouteToken` · `firestoreRouteTokenEconomy` · `firestoreConquest` · `useUserTier` |
| one-shot 배선 | `firestoreWorldPresence` · `firestoreWorldActivity` · `firestoreRouteActivity` · `firestoreRoutePublications` · `firestoreUser`(labels) · `firestoreCourses`(geometry gap-fill) |
| harness / 계약 테스트 | `apps/web/scripts/focus-read-spike/*` |
| E2E | `apps/web/e2e/focus-read-spike.spec.ts` |
| scripts | `apps/web/package.json` → `test:focus-read-spike` · `test:e2e:focus-read-spike` |
| dep | `apps/web/dep-layers.json`에 debug 파일 2개 등재 |

production(`import.meta.env.DEV` false)에서 meter note/track은 no-op(또는 unsub 그대로 반환). override API도 DEV에서만 동작.

---

## 검증 명령과 결과

| 명령 | 결과 |
|---|---|
| `npm run test:focus-read-spike` (apps/web) | **PASS** 12/12 |
| `npm run test:s42-meters` | **PASS** 15/15 (기존 hub/`__rtwReadSubs` 회귀 없음) |
| `npm run check:dep` (repo root) | **PASS** 방향 위반 0 · 순환 0 |
| `npx tsc -p tsconfig.json --noEmit` (apps/web) | **PASS** |
| `npx eslint` (변경 소스 목록) | **PASS** |
| `npm run test:e2e:focus-read-spike` | 1차 **FAIL** — `http://127.0.0.1:5000` 이미 사용 중 |
| `$env:RTW_DEV_PORT='5015'; npm run test:e2e:focus-read-spike` | **PASS** 1/1 · artifact `apps/web/.out/focus-read-spike/visibility-e2e-delta.json` |

---

## Baseline 표 — operation proxy delta

### A. Emulator E2E (Guest Trailhead idle, live Trail N≈0)

창: settle 후 control(추가 전환 0) vs `setVisibilityOverride`로 hidden→visible ×10.

| 경로 | class | control Δ | ×10 Δ | 비고 |
|---|---|---|---|---|
| openTrailListings | kept | 0/0 | 0/0 | 앱 재구독 없음 |
| collectionGroupLiveRides | kept | 0/0 | 0/0 | OpenTrails가 CG 유지 |
| trailMembers | app_resubscribe | 0/0 | **10/10** | visible 게이트 |
| trailLiveRides | app_resubscribe | 0/0 | **0/0** | 시드된 live Trail 없음(N=0) |
| users | kept | 0/0 | 0/0 | tier+token 유지 |
| economy | kept | 0/0 | 0/0 | |
| conquest | kept | 0/0 | 0/0 | |
| activityWorldSummary | one-shot | 0 | **10** | |
| activityWorldGlobal | one-shot | 0 | **10** | |
| activityWorldLiveIds | one-shot | 0 | **0** | 45s TTL 캐시 hit |
| activityWorldBatch | one-shot | 0 | **10** | |
| catalogPublications | one-shot | 0 | **10** | |
| catalogLabels | one-shot | 0 | **0** | applicant uid 없음 |
| routeGeometryGapFill | one-shot | 0 | **0** | 캐시/필요 없음 |
| trailPresenceWrites | write proxy | 0 | **10** | read와 합산 금지 |

동일 시나리오 순수 harness 반복 실행도 delta 동일(결정성 PASS).

### B. 순수 harness (N=3 world trails, labels=4, geometry=1) — 앱 fanout 상한 모델

`createTrailheadIdleVisibilityHarness` — Firebase 없음. **검증:** 앱 제어 open/close·one-shot 계수. **추론만:** SDK reconnect.

| 경로 | ×10 Δ openTotal/closeTotal 또는 calls |
|---|---|
| kept (listing/CG/users/economy/conquest) | 0 |
| trailMembers | 10 / 10 |
| trailLiveRides | **30 / 30** (=10×N) |
| activityWorld summary/global/liveIds/batch | 각 10 |
| catalogPublications | 10 |
| catalogLabels | 40 (=10×4) |
| routeGeometryGapFill | 10 |
| trailPresenceWrites | 10 |

control ×0 → 전 항목 0.

---

## 가장 큰 앱 제어 가능 항목 (확정 1~3)

| 순위 | 항목 | 근거 |
|---|---|---|
| 1 | Activity World visible 복귀 immediate full sync | E2E ×10에서 one-shot 합 **30+**(summary+global+batch); liveIds는 캐시로 줄 수 있음 |
| 2 | published catalog refresh (`listPublishedRoutePublications`) | E2E ×10에서 publications **+10**; labels는 데이터에 비례 |
| 3 | world `trailLiveRides` × N 재구독 + `trailMembers` | harness에서 N=3이면 rides **30** open/close가 listener 최대; E2E(N=0)에서는 members **10**이 listener 최대 |

presence write(+10)는 별도 write proxy — read 저감 후보와 분리해 다룰 것.

---

## 다음 최소 수정안 (제안만 — 미구현)

1. **Activity World:** hide→show 시 즉시 `runTick`을 짧은 grace/TTL 내 skip 또는 stale-while-revalidate(캐시 hit 시 meta만).
2. **Catalog:** `pageVisible` 복귀 시 TTL(예: 수 분) 안이면 `refreshPublishedPublicCourseCatalog` skip.
3. **World overlay:** 복귀 debounce 또는 N 상한/뷰포트 필터 — 제품 의미 영향 있어 Supervisor/Chief 확인 후.

하지 말 것(감사·검수와 동일): OpenTrails에 pageVisible 맹목적 추가, Rules/데이터 모델 변경, billed 귀속 없는 넓은 패치.

---

## 한계

- SDK WebChannel 재연결로 유지 리스너가 받는 billed read는 **계측 없음**.
- E2E Emulator 월드는 live Trail·catalog label이 비어 N·labels 상한을 실측하지 못함 → harness로 N 스케일만 모델.
- `activityWorldLiveIds`·`routeGeometryGapFill`·`catalogLabels`는 캐시/데이터에 따라 delta가 줄 수 있음(정상).
- 1차 E2E는 포트 5000 충돌로 실패; `RTW_DEV_PORT=5015`로 재실행 PASS.
- production Firebase / Console 숫자는 대조하지 않음.

---

## Git

지시대로 **commit / push / deploy 하지 않음**. 작업 트리에 계측·테스트·본 결과·ops 상태 문서 변경이 남아 있다.
