# Result 17 — Bounded default-Trail listener skip

Status: DONE
Task: [17-task-default-trail-subscription.md](17-task-default-trail-subscription.md)
Date: 2026-09-29
No commit / push / deploy. No live Firebase. Prior edits preserved.

---

## Changes (allowed source only)

### `apps/web/src/components/PublicationSharedPresence.tsx`

When `sanitizeTrailId(trailId) === DEFAULT_TRAIL_ID`:

- **Skip** `acquireTrailLivePublicationRidesSubscription`
- **Skip** `acquireTrailMotionSubscription`
- Clear `liveRideRows` / `motionRows` (+ refs) and `publishOtherLiveRiderCount(0)` so stale peers do not remain visible

Non-default Trail acquire/release unchanged. Publication session member presence, heartbeat, and ride timing/payload policy untouched. Peer interpolation / replay not modified (no peer-motion replay re-run).

### `apps/web/e2e/listener-scope-ride.spec.ts`

Post-ride assertion updated to Task 17 contract:

- Within 12s: `rtdbOnValue.open → 0`
- `motionHub` has no `default` slot
- `ridesHub` has no `default` slot
- `trailOnSnapshot.open` recorded (may be ≥1 for intentional Trailhead world spectator) — **not** required to be 0
- CG `1→0→1→0→1` and mid-ride peer-listener assertions kept

---

## Commands / results

| Command | Result |
|---|---|
| `npx eslint src/components/PublicationSharedPresence.tsx e2e/listener-scope-ride.spec.ts` (cwd `apps/web`) | PASS |
| `npm run build` (cwd `apps/web`) | PASS |
| `$env:RTW_DEV_PORT='5015'; npm run test:e2e:listener-scope` (cwd `apps/web`, workers=1) | **PASSED** — 1/1 (~29s Playwright) |

Exact launcher:

```powershell
$env:RTW_DEV_PORT='5015'; npm run test:e2e:listener-scope
```

Emulator: `127.0.0.1:8080` via `emulators:exec`. Log: `apps/web/.out/firebase-traffic/listener-scope-ride.json`.

Peer-motion replay: skipped — sync/interpolation algorithms untouched.

---

## Before / after meters (post-ride settled, 12s)

| Metric | Before (Task 15 / `16-result`) | After (this run) |
|---|---|---|
| `trailOnSnapshot.open` | **2** (`default` + prior live) | **1** (prior live only) |
| `rtdbOnValue.open` | **1** | **0** |
| `motionHub` slots | `default` | **[]** (no default) |
| `ridesHub` slots | `default` + prior | prior only (`kQFd2p8aLM26djP7y3CN`) — **no default** |
| `defaultTrailResidualCleared` | n/a (failed old total-0 assert) | **true** |
| CG after end | 1 | 1 |

Mid-ride (unchanged contract):

| State | CG | trailOnSnapshot | rtdbOnValue |
|---|---|---|---|
| trailheadIdle | 1 | 0 | 0 |
| rideMenuClosed | 0 | 1 | 1 |
| rideMenuOpen | 1 | 1 | 1 |
| rideMenuClosedAgain | 0 | 1 | 1 |
| afterEndRide (CG poll) | 1 | 1 | 1 |
| afterEndRideSettled | 1 | 1 | **0** |

---

## Remaining read paths (intentional)

1. **Collection group / active live trail ids** — Trailhead idle discovery (`collectionGroup.open=1` after end).
2. **Non-default `trailOnSnapshot`** — Trailhead world livePublication spectator for a still-listed dedicated Trail (`ridesHub` slot `kQFd2…`, refCount 1). Product behavior preserved; not a DEFAULT residual.
3. **Publication session member presence** — still subscribed via `subscribePublicationSessionMembers` when intro publication remains loaded (not a trail/RTDB peer hub).

DEFAULT_TRAIL peer live-rides + RTDB motion are no longer acquired. No product reason found to keep default subscription; skip is correct.

---

## Unrelated console warnings

Same class as prior tasks: ActivityWorld empty overlay, WebGL ReadPixels, one 404 asset. None blocked meters.
