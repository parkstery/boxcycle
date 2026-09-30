# Result 28C / 28D-B — Controlled emulator 1 vs 2 traffic measurement

Status: **DONE** (PASS)
Date: 2026-09-30
Owner: Developer (Cursor). Supervisor does not code.
Scope:

- **TASK-28C** (historical): harness revise + first headless emulator 1v2 run.
- **TASK-28D-B** (this update): verification-only re-run after generation-ticket meter fix (unit **8/8**). Same harness, same 45s windows, longest **2.02 km** route. **No product cadence / payload / HUD / MapHud changes.** No commit / push / deploy / merge.

**Supersession:** Client write success counts and ratios from the earlier 28C PASS (`sessionId t28c-mumzrvyl`, ~03:25 KST) are **superseded**. Those runs could count in-flight completions after `reset` (successes > attempts). Prefer **28D-B** raw numbers below (`sessionId t28c-munauwzr`).

---

## 1. Command (exact)

```powershell
cd apps/web
$env:RTW_DEV_PORT='5050'
npm run test:e2e:public-trail-traffic
```

(= `node scripts/e2e/run-public-trail-traffic-meter.mjs` → `firebase emulators:exec --only auth,firestore,database,functions` → `playwright test public-trail-traffic-1-2 --workers=1 --retries=0`)

- Measure window: `MEASURE_MS=45000`
- Post-setup settle: `SETTLE_MS=3000`
- Route pick: `longest` (solo selectedKm = dual selectedKm = **2.02**)
- Exit: **0** · Playwright **1 passed (3.0m)** · suite elapsedMin **2.97**
- Note: one aborted launch on `RTW_DEV_PORT=5060` hit Chromium `ERR_UNSAFE_PORT` before any measure; verification run used **5050** (no harness change).

---

## 2. Supervisor defect fixes (harness — TASK-28C; unchanged in 28D-B)

| # | Defect | Fix |
|---|---|---|
| 1 | Solo `endRide` catch → dual contamination | Click Stop → assert `livePublicationRides` cleared → close solo context; cleanup fail aborts before dual. Summary-sheet close **not** required. |
| 2 | No settle / duration check | `SETTLE_MS` before meter reset (both); same `ROUTE_PICK`; assert wall duration ∈ `[MEASURE_MS, MEASURE_MS+slack]`. |
| 3 | Missing attempts / docChanges | `TrafficSnap`/deltas include write **attempts** + `fsLiveRideUnderlyingDocChanges`; caveats label callbacks ≠ billed reads. |
| 4 | Identical CF totals under solo+dual | Runner merges **top-level `functionsInvocationsWholeRun` only**; strips solo/dual twin CF blocks. |
| 5 | Production risk | Assert local Auth/FS/RTDB/Functions hosts; refuse non-local / missing. |

**28D meter fix (product meters, pre-verified unit 8/8):** write success/error are generation-ticketed so `reset` drops in-flight completions from prior generation → successes ≤ attempts after reset.

Owned files (28C harness): `e2e/public-trail-traffic-1-2.spec.ts`, `scripts/e2e/run-public-trail-traffic-meter.mjs`, `package.json` script `test:e2e:public-trail-traffic`. Meter: `src/lib/debug/trafficPublishMeters.ts`. This result + raw ops copies.

---

## 3. Measured client deltas (28D-B — same window)

Emulator counts ≠ billed. Prefer these for 1v2 ratios.

### 3.1 Success ≤ attempts gate (post-reset)

| Scope | FS writes ≤ attempts | RTDB writes ≤ attempts | Errors |
|---|---|---|---|
| Solo delta | 41 ≤ 41 | 149 ≤ 149 | 0 / 0 |
| Dual pageA delta | 41 ≤ 41 | 146 ≤ 147 | 0 / 0 |
| Dual pageB delta | 39 ≤ 39 | 150 ≤ 150 | 0 / 0 |
| Dual sum (A+B) | 80 ≤ 80 | 296 ≤ 297 | 0 / 0 |

Solo measure **start after reset** was all zeros (generation ticket). Dual start snapshots may show a few same-generation writes between reset and first read; deltas still satisfy ≤.

### 3.2 Comparison table

| Metric | Solo | Dual (sum A+B) | Dual/Solo |
|---|---:|---:|---:|
| `livePublicationRideWriteAttempts` | 41 | 80 | **~1.95** |
| `livePublicationRideWrites` | 41 | 80 | **~1.95** |
| `rtdbMotionWriteAttempts` | 149 | 297 | **~1.99** |
| `rtdbMotionWrites` | 149 | 296 | **~1.99** |
| `rtdbMotionWriteBytesApprox` | 15239 | 30353 | (~1.99) |
| `fsLiveRideUnderlyingDeliveries` (≠ billed reads) | 83 | 254 | (~3.06) |
| `fsLiveRideUnderlyingDocChanges` (≠ billed reads) | 83 | 254 | (~3.06) |
| `rtdbMotionUnderlyingDeliveries` (≠ billed DL) | 149 | 594 | (~3.99) |

Write ratios ≈ **2×** (expected for 1→2 publishers). Delivery sums are **per-client hub callbacks** summed across two pages — not a single server counter and not billed reads.

Durations: solo **45389 ms**, dual **46099 ms** (both ∈ requested window + slack).
Cleanup: solo `liveRideCleared=true` before dual; dual A+B cleared. `summarySheetCloseRequired=false`.

Listener mid-ride (both phases): CG `open=0`; current Trail FS/RTDB hubs open; `crossCheck.ok=true`.

**Superseded 28C raw (do not use for ratios):** FS writes 43→86 (2.00×) with attempts 41/82 — successes > attempts due to pre-ticket leak. RTDB writes 162→309 (~1.91×).

---

## 4. Functions emulator (whole-run only)

Top-level `functionsInvocationsWholeRun` — **not** solo/dual attributed:

| Function | Begin count (28D-B) |
|---|---:|
| `routeActivityOnLivePublicationRideWritten` | **320** |
| `openTrailListingOnMemberCreated` | 10 |
| `openTrailListingOnTrailWritten` | 11 |
| `openTrailListingOnMemberDeleted` | 5 |
| listing Created/Deleted live-ride | 3 / 3 |
| other (token/conquest/mileage/routeActivityOnRideCreated / ensureRouteToken…) | 3 each |
| **totalBegin** | **367** |

Includes setup + solo + dual + teardown. Emulator invocations ≠ production billed executions.

---

## 5. Phase timestamps (28D-B)

| Phase | ISO (UTC) |
|---|---|
| suite start | 2026-09-29T23:20:40.841Z |
| solo_measure_start | 2026-09-29T23:21:03.715Z |
| solo_measure_end | 2026-09-29T23:21:49.104Z |
| solo_cleanup ok | 2026-09-29T23:21:54.343Z |
| dual_measure_start | 2026-09-29T23:22:39.589Z |
| dual_measure_end | 2026-09-29T23:23:25.688Z |
| dual_cleanup ok | 2026-09-29T23:23:38.752Z |
| suite ok | 2026-09-29T23:23:38.757Z |

Emulator hosts: `127.0.0.1:8080/9099/9000/5001`.

---

## 6. Raw artifact paths

| Artifact | Path |
|---|---|
| Result JSON | `apps/web/.out/firebase-traffic/public-trail-traffic-1-2.json` |
| Phase JSONL | `apps/web/.out/firebase-traffic/public-trail-traffic-1-2-phases.jsonl` |
| Emulator log | `apps/web/.out/firebase-traffic/task28-emulator.log` |
| Ops copies | `document/ops/20260929-public-trail-traffic/public-trail-traffic-1-2.json` · `…-phases.jsonl` · `.task28-emulator.log` · `.task28db-run.log` |

---

## 7. Hard caveats (unchanged)

1. Emulator ≠ production billing.
2. Hub deliveries / docChanges ≠ billed reads.
3. CF begin counts = whole `emulators:exec` run.
4. No RTDB-fail→FS fallback quality in this pass — still a gate before **28T** throttle.
5. Pass ≠ savings claimed.

---

## 8. Next

- Optional: RTDB-fail → FS fallback quality evidence (unlock **28T**).
- **28T** remains DEFERRED until meters **and** fallback quality.
- No merge/deploy without Chief approval.
