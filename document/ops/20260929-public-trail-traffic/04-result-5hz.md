# Result 04 — Controlled RTDB 5Hz candidate and replay evidence

Status: DONE
Task: [04-task-5hz.md](04-task-5hz.md)
Date: 2026-09-29

## Changes

### A. Replay scenario (before constant change)

Added `candidate-5hz-jitter-gap` in `apps/web/scripts/peer-sync/scenarios.mjs`:

- Publish cadence **200ms (5Hz)**; `serverAtMs` / `distM` follow the publish clock.
- Receive `atMs` uses fixed RTT 40ms + deterministic jitter cycle `[0, 55, -35, 60, -25, 45, -50, 30]` ms (no RNG).
- **stop/start**: hold last published dist with `speedMps=0` for 8 ticks, then resume.
- **2s gap**: no packets for 2000ms; resume dist continues as if peer kept cruising (avoids artificial retrograde).

Existing S2 200ms cases left untouched; this scenario specifically guards the proposed publish-interval switch under jitter + pause + stall.

### B. Publish interval

`apps/web/src/lib/ride/rideSyncPolicy.ts`:

- `PEER_MOTION_PUBLISH_INTERVAL_MS`: **100 → 200** (5Hz target).
- Comments in this file that stated “10Hz / 100ms” updated to “5Hz / 200ms” only.
- Unchanged: `PUBLISH_TICK_MS = 100` in `useLiveLocationPublishSession.ts` (compute tick), `MOTION_MAX_IN_FLIGHT = 2`, interpolation / extrapolation constants, RTDB schema, Firestore heartbeat, rules, dependencies.

### C. Functions test wiring

`functions/package.json` `npm test` now includes existing `lib/openTrailListingProjection.test.js` (listing-trigger contract from prior task).

Prior listing-trigger edits (`openTrailListingProjection.ts` / `.test.ts`) were not modified.

## Commands / results

| Command | Result |
|---|---|
| `node scripts/peer-sync/replay.mjs --check --graph` (cwd `apps/web`) **baseline, before** constant change | PASSED — all 11 scenarios incl. `candidate-5hz-jitter-gap` |
| Same after `PEER_MOTION_PUBLISH_INTERVAL_MS=200` | PASSED — identical scenario set |
| `node … --test scripts/peer-sync/interp-smoothness-contract.test.ts scripts/peer-sync/motion-flight-pipeline-contract.test.ts scripts/ride-hierarchy/sync-policy-constants-contract.test.ts` | PASSED — 29/29 |
| `npm run build` (cwd `apps/web`) | PASSED (`tsc -b && vite build`) |
| `npx eslint src/lib/ride/rideSyncPolicy.ts scripts/peer-sync/scenarios.mjs` | PASSED (exit 0) |
| `npm test` (cwd `functions`) | PASSED — 34/34 (includes openTrailListingProjection) |

No commit / push / deploy (per task).

## Expected maximum RTDB event-rate change

Per active rider, motion path `/trails/{trailId}/motion/{uid}`:

- **Before (configured):** publish every 100ms → **≤10 events/s** (ceiling; flight overlap allowed up to 2).
- **After:** publish every 200ms → **≤5 events/s**.
- **Max rate change:** about **−50%** motion writes per rider (10Hz → 5Hz ceiling).

Note: historical single-flight behavior often made *effective* arrival ~5Hz even at a 100ms target; with `MOTION_MAX_IN_FLIGHT=2` the 100ms setting can approach true 10Hz. This change deliberately caps configured publish at 5Hz.

Firestore presence / 1Hz progress heartbeat / listing projection paths are out of scope and unchanged by this task.

## Replay smoothness / lag observations

**Graph** (`candidate-5hz-jitter-gap`, ~25.2s, route 2000m): blue `displayDistM` tracks grey receive packets through jitter; flat hold during stop; continues across the 2s gap then re-locks to packets; no invariant violations (clamp / live backtrack / teleport / extrap cap).

**Measured on candidate timeline** (newest buffer dist − display, live frames, step 100ms):

| Metric | Value |
|---|---|
| frames | 253 |
| lagM mean | 0.58 m |
| lagM abs-mean | 3.51 m |
| lagM p50 | 2.45 m |
| lagM p95 | 4.16 m |
| lagM min / max | −9.6 / 5.0 m |

At cruise 8 m/s, p50 lag ≈2.45 m ≈ **~300 ms** display behind newest — consistent with adaptive delay (≥160ms floor, gap×2.2 on ~200ms arrivals). Negative lag samples occur around gap/extrap catch-up, not steady cruise.

Baseline vs post-constant replay checks are identical for these packet-driven scenarios (receiver policy constants unchanged); the new scenario’s job is to lock 5Hz+jitter+gap behavior before/after the sender interval flip.

## Risk — offline replay alone does not establish 5Hz quality

- Replay feeds **already-merged** packet streams; it does **not** exercise RTDB write RTT, flight queueing, or dual RTDB+Firestore merge (`mergePeerMotionPackets` still harness TODO).
- Adaptive delay / catch-up under real two-rider load, tab backgrounding, and variable RTT are not proven here.
- Configured 5Hz may still bunch or stretch on the wire; smoothness numbers above are synthetic.
- Production confirmation still needs live one-versus-two-rider observation (or captured logs replayed as JSON), not only `--check`.

## Remaining

- Real-device / two-window validation of perceived lag at 5Hz after deploy (separate from this task).
- Optional: extend harness to publish-flight + merge dual-stream if traffic work continues.
