# Result 04 — listener 10초 grace · presence resume throttle

| 항목 | 내용 |
|---|---|
| 상태 | DEVELOPMENT_DONE |
| 지시 | [13-task-listener-grace.md](13-task-listener-grace.md) · [12 검수](12-review-resume-cache.md) |
| 날짜 | 2026-10-03 |
| Owner | Cursor CLI Developer |
| 제약 | production 접속·write·deploy·commit·push 없음 |

---

## 결론 요약

short-hide(200ms) ×10에서 목표 달성.

| path | before (11 baseline) | after (본 측정) |
|---|---|---|
| N=3 `trailLiveRides` open/close | 30/30 | **0/0** |
| `trailMembers` open/close | 10/10 | **0/0** |
| `trailPresenceWrites` | 10 | **0** |
| catalog / Activity World one-shots | 0 | **0** (유지) |

long-hide(≥10s grace): members close 1 → open 1; N=3 `trailLiveRides` close 3 → open 3.

---

## 구현

### A. Read visibility grace (10s)

- 순수 정책: `lib/trail/listenerVisibilityGracePolicy.ts`
  - `LISTENER_VISIBILITY_GRACE_MS = 10_000`
  - `reduceListenerVisibilityGrace` — short hide keep+timer, visible cancel, timeout close, eligibility immediate close
- 훅: `hooks/useVisibilityListenGrace.ts`
  - eligible + pageVisible / graceArmed
  - `sessionKey` 변경 시 render-phase로 grace 즉시 해제
- `useTrailSession` — members `onSnapshot` 만 grace. logout/Trail/eligibility 상실 시 즉시 cleanup
- world overlay — `resolveWorldLivePublicationRideOverlayEligible` (pageVisible 제외) + grace
  - hide 직전 `liveRideTrailIds` state freeze로 CG pageVisible 게이트와 같은 커밋에서도 hub 유지

### B. Presence write resume throttle

- 순수 정책: `lib/trail/presenceWriteResumePolicy.ts` — heartbeat 창 안 fresh resume → schedule remaining
- `useTrailSession` — members listener와 presence write/heartbeat 수명주기 분리
  - visible 일 때만 upsert/heartbeat; hidden 중 heartbeat 없음
  - short hide → `decidePresenceWriteResume` (즉시 반복 upsert 없음)
  - long hide(≥10s) / 새 uid·Trail / stale → immediate
  - `deleteTrailPresence` on session exit 유지

### 비목표 준수

- listener query/schema/hub 의미 변경 없음 (refcount hub 그대로)
- Activity World poll·catalog·writes에 read grace 미적용
- Rules/Functions/RTDB/SDK network 토글 없음
- production deploy 없음

---

## 변경 파일

| 경로 | 내용 |
|---|---|
| `src/lib/trail/listenerVisibilityGracePolicy.ts` | 10s grace 순수 정책 (신규) |
| `src/lib/trail/presenceWriteResumePolicy.ts` | presence resume 순수 정책 (신규) |
| `src/hooks/useVisibilityListenGrace.ts` | grace React 배선 (신규) |
| `src/hooks/useTrailSession.ts` | members grace · presence 분리·throttle |
| `src/features/map-overlays/listenerScopePolicy.ts` | world overlay eligible 분리 |
| `src/features/map-overlays/useAppMapOverlays.ts` | world grace + trailIds freeze |
| `dep-layers.json` | 신규 정책 파일 등재 |
| `scripts/focus-read-spike/listener-grace-policy.test.ts` | 정책 순수 테스트 (신규) |
| `scripts/focus-read-spike/visibility-gate-contract.test.ts` | grace 배선 계약 |
| `scripts/ride-hierarchy/listener-scope-gate-contract.test.ts` | Eligible 배선 |
| `e2e/focus-read-spike.spec.ts` | short-hide 0/0 · long-hide close+open |
| `package.json` | `test:focus-read-spike` 에 grace test 포함 |

---

## 전후 측정 (Emulator E2E)

Artifact: `apps/web/.out/focus-read-spike/visibility-e2e-delta.json` · `visibility-e2e-n3-delta.json`

### Baseline ×10 short-hide (N≈0)

| 경로 | ×10 Δ |
|---|---|
| trailMembers | **0 / 0** |
| trailLiveRides | 0 / 0 |
| trailPresenceWrites | **0** |
| catalog / Activity World one-shots | **0** |
| kept (listing/users/economy/conquest) | 0 |

### Baseline long-hide

| 경로 | Δ |
|---|---|
| trailMembers | close **1** · open **1** |
| trailPresenceWrites | **1** (long-hide immediate upsert) |

### N=3 seed ×10 short-hide

| 경로 | ×10 Δ |
|---|---|
| trailLiveRides | **0 / 0** |
| trailMembers | **0 / 0** |
| trailPresenceWrites | **0** |
| catalog / Activity World | **0** |

### N=3 long-hide

| 경로 | Δ |
|---|---|
| trailLiveRides | close **3** · open **3** |
| trailPresenceWrites | **1** (long-hide immediate upsert) |

---

## 검증

| 명령 | 결과 |
|---|---|
| `npm run test:focus-read-spike` | **PASS** 37/37 (grace 9 + resume 12 + 기존 meters/gate/harness) |
| `npm run test:s42-meters` | **PASS** 15/15 |
| `npm run test:listener-scope` | **PASS** 17/17 |
| `npm run check:dep` (repo root) | **PASS** |
| `npx tsc -p tsconfig.json --noEmit` | **PASS** |
| `npx eslint` (변경 파일) | **PASS** (기존 exhaustive-deps warning만) |
| `$env:RTW_DEV_PORT='5015'; npm run test:e2e:focus-read-spike` | **PASS** 2/2 |

---

## 잔여·비범위

- ActiveLiveRideTrailIds CG 의 pageVisible 즉시 게이트는 유지(이번 grace 대상 아님). world overlay는 freeze로 hub를 지탱.
- Firebase SDK WebChannel reconnect billed read는 여전히 미계측.
- commit/push/deploy/production 접속 없음 — Supervisor 검수 대기.
