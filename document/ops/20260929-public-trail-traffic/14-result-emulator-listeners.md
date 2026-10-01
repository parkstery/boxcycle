# Result 13 — Emulator proof of listener release/reacquire

Status: DONE
Task: [13-task-emulator-listeners.md](13-task-emulator-listeners.md)
Date: 2026-09-29
No commit / push / deploy (per task). No live Firebase. Prior listing/5Hz/measurement/listener-scope/gate-test edits preserved.

---

## Changes (allowed source only)

### New `apps/web/e2e/listener-scope-ride.spec.ts`

Chromium E2E using `open-meteo-stub` + `rideEntryHelpers`:

1. Guest Trailhead → wait `collectionGroup.open === 1`
2. Intro route ride, menu closed → `collectionGroup.open === 0`, `trailOnSnapshot.open >= 1`, RTDB noted if open
3. Mid-ride Trail menu open → `collectionGroup.open === 1` + menu UI (`입문`)
4. Menu close → `collectionGroup.open === 0`
5. End ride → idle discovery `collectionGroup.open === 1` (applicable here)

Hard guard: requires `FIRESTORE_EMULATOR_HOST` local (`127.0.0.1` / `localhost` / `[::1]`); throws if missing or non-local so `RIDE_VERIFY_LIVE=1` alone cannot hit live project.

Uses `expect.poll` for CG open gauges (no arbitrary sleeps on meter waits). Writes concise state JSON to `apps/web/.out/firebase-traffic/listener-scope-ride.json` (gitignored via `/.out/`).

Menu open/close asserts `.menu-panel-root.is-open` (panel uses `transform`, so Playwright `isVisible` on `.menu-panel` is unreliable).

### `apps/web/package.json`

Added focused script:

```text
test:e2e:listener-scope
→ firebase emulators:exec --only auth,firestore,database
   --project boxcycle-dc2df --config ../../firebase.json
   "playwright test listener-scope-ride --workers=1 --retries=0"
```

No product source changes in this task.

---

## Commands / results

| Command | Result |
|---|---|
| `$env:RTW_DEV_PORT='5015'; npm run test:e2e:listener-scope` (cwd `apps/web`, headless, workers=1) | **PASSED** — 1/1 (22.2s Playwright; ~47s wall with emulator) |

Exact launcher:

```powershell
$env:RTW_DEV_PORT='5015'; npm run test:e2e:listener-scope
```

Emulator host injected by `emulators:exec`: `127.0.0.1:8080`.
First attempt failed on menu close (`Escape` + `.menu-panel` visibility); fixed to close-button + `is-open` class, then re-ran PASS.

---

## State meter values (`underlying.*.open`)

From `apps/web/.out/firebase-traffic/listener-scope-ride.json`:

| State | CG.open | trailOnSnapshot.open | rtdbOnValue.open |
|---|---|---|---|
| trailheadIdle | **1** | 0 | 0 |
| rideMenuClosed | **0** | 1 | 1 |
| rideMenuOpen | **1** | 1 | 1 |
| rideMenuClosedAgain | **0** | 1 | 1 |
| afterEndRide | **1** | 1 | 1 |

- `endStepApplicable: true` — all five steps asserted.
- Notes: `rtdbOnValue.open=1 (available)` during ride.
- No assertions on billable reads or exact total Firestore listener counts.

---

## Unrelated console warnings (sample)

- `[ActivityWorld] raw overlay still zero after minimum-dot guard` (emulator empty world)
- WebGL `GPU stall due to ReadPixels`
- One `Failed to load resource: 404` (unrelated asset)

None blocked the meter assertions.

---

## Risks

- Solo ride still leaves `trailOnSnapshot` / RTDB open after end (Trailhead/session teardown timing); CG restore to 1 is the discovery gate under test.
- Port 5015 avoids conflict with an occupied 5000; script itself does not hardcode the port — set `RTW_DEV_PORT` when launching.
