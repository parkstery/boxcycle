# Result 22 / 23 — S4-1R T5 stabilization

Status: **DONE (T5 PASS — reliable)**
Task: TASK-22 — Public Trail Traffic 회귀 검증 T5 안정화 및 작업 큐 갱신
Date: 2026-09-29
Product source: **unchanged** (`routePublishFlight.ts` / publish session untouched)
Allowed edit: `apps/web/e2e/peer-sync-s41r.spec.ts` only
No commit / push / deploy / live Firebase

---

## Cause (test race, not product regression)

Prior gate (`20-result-s41r-t5.md`): `newSessionRowKept=true` but `deferredRunTotal=0`, `deferredSkipTotal=0`, `guardFired=false`.

Root mechanism:

1. **Arm-before-hold / delay-budget burn** — latching an in-flight write that started before delay injection, or holding writing for >2 s before hide, leaves too little of the 6 s delay so `awaitRouteFlightSettled(2000)` returns `settled=true` → `requestRouteRowCleanup` never queues → counters stay 0 while the new session recreates the row.
2. **Fixed sleep after hide** — 3 s blind wait did not assert `deferredPending ≥ 1` while still hidden.
3. **Delay left on after resume** — new epoch keeps delayed slot chaining; `drainDeferredCleanups` only runs when `writing` becomes false with empty slot. Clearing delay **after** a new live epoch exists is required so the queued skip can run.

Product `skip-live-session` path (`isRouteSessionLive` in `runDeferredCleanup`) is intact.

---

## Fix (test-only)

`apps/web/e2e/peer-sync-s41r.spec.ts`:

- `S41R_ONLY_T5=1` skips T1–T4; writes `S41R-lifecycle-t5-only.json`.
- `waitProvenDelayedInFlight` — clear delay → `waitFlightIdle` → re-arm `RESTART_DELAY_MS` → take the **next** `writing===true` (full delay budget) → hide immediately.
- Hide → poll `deferredPending ≥ 1` **while still hidden** (`dbgArmed`).
- Show → wait new `__rtwRouteEpochStarts` epoch → **clear delay** → poll `deferredSkipTotal ≥ 1` and `deferredPending===0`.
- `guardFired` requires counter **and** chain log `deferredCleanup=1 reason=skip-live-session` (assertion not weakened).

---

## Commands / results

| Command | Result | Exit |
|---|---|---|
| `$env:RTW_DEV_PORT='5017'; $env:S41R_ONLY_T5='1'; npm run test:e2e:peer-s41r` | **1 passed** (~52 s) — first stabilize attempt (hold-based) | **0** |
| `$env:RTW_DEV_PORT='5019'; $env:S41R_ONLY_T5='1'; npm run test:e2e:peer-s41r` | **1 passed** (~0.8 min) — drain→re-arm fix | **0** |
| `$env:RTW_DEV_PORT='5020'; npm run test:e2e:peer-s41r` (full T1–T5) | T5 PASS; **T2 flake** (`routeDisableGone=false`, samplesEnd briefly true) — not claimed green | **1** |
| `$env:RTW_DEV_PORT='5021'; npm run test:e2e:peer-s41r` (full T1–T5) | **1 passed**, `allPass: true`, T1–T5 all PASS (~2.9 min) | **0** |
| `npx eslint e2e/peer-sync-s41r.spec.ts` | PASS | **0** |

Logs: `document/ops/20260929-public-trail-traffic/.t5-only-run.log`, `.t5-only-run2.log`, `.s41r-full-run2.log`, `.s41r-full-run3.log`
JSON: `apps/web/.out/sync-relay/S41R-lifecycle-t5-only.json`, `apps/web/.out/sync-relay/S41R-lifecycle.json`

### T5 evidence (full suite green run, port 5021)

| Field | Value |
|---|---|
| `pass` | `true` |
| `newSessionRowKept` | `true` (6/6) |
| `deferredRunTotal` | `0` |
| `deferredSkipTotal` | `2` |
| `skipLiveLogCount` | `2` |
| `guardFired` | `true` |
| `dbgBeforeHide.writing` | `true` |
| `dbgArmed.deferredPending` | `1` (still writing) |
| `epochStarts` | epoch 1 → 2, **same** `sessionKey` |
| `elapsedMin` | `2.9` (full suite) |

Not a lucky pass: arm observed (`deferredPending=1` before resume), then skip counter + chain `reason=skip-live-session` after overlapping new epoch.

---

## Remaining defects / follow-ups

- One full-suite run showed intermittent T2 `routeDisableGone` under emulator load (samplesEnd `[true,true,false…]`); subsequent full run green. Not a T5 product regression; optional follow-up if T2 flakes recur.
- Production deploy / merge: **NEEDS_APPROVAL** (`22-task-queue.md` R1–R2).
- Live billed read/write + 5Hz quality still unmeasured (R3).
- Motion-flight lifecycle parity remains out of S4-1R2 scope.

---

## Changed files

- `apps/web/e2e/peer-sync-s41r.spec.ts` — T5 determinism + `S41R_ONLY_T5`
- `document/ops/20260929-public-trail-traffic/22-task-queue.md` — queue statuses
- `document/ops/20260929-public-trail-traffic/23-result-t5.md` — this file
- `document/ops/20260929-public-trail-traffic/PROGRESS.md` — append
