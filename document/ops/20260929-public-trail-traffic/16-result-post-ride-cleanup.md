# Result 15 — Post-ride peer listener cleanup

Status: DONE (E2E **FAILED** on peer close — assertion kept; diagnosis below)
Task: [15-task-post-ride-cleanup.md](15-task-post-ride-cleanup.md)
Date: 2026-09-29
No product source changes. No commit / push / deploy. No live Firebase. Prior edits preserved.

---

## Changes (allowed source only)

### `apps/web/e2e/listener-scope-ride.spec.ts`

Extended Task 06 flow; kept CG `1→0→1→0→1` assertions.

After `endRide`:

1. **Immediate** meter sample (`afterEndRideImmediate`) — no wait
2. Existing CG poll → `afterEndRide` (`collectionGroup.open === 1`)
3. **Bounded poll 12s** for `trailOnSnapshot.open === 0` **and** `rtdbOnValue.open === 0` (`afterEndRideSettled`)
4. JSON now includes hub refcounts (`motionHub` / `ridesHub` / `activeLiveRideTrailIdsHub`) + `underlyingDetail` per state
5. Hard assert peer settle closed — **not** weakened; timeout → fail with diagnostic message pointing at JSON

---

## Commands / results

| Command | Result |
|---|---|
| `$env:RTW_DEV_PORT='5015'; npm run test:e2e:listener-scope` (cwd `apps/web`, workers=1) | **FAILED** — CG path OK; peer close assert failed after 12s |

Exact launcher:

```powershell
$env:RTW_DEV_PORT='5015'; npm run test:e2e:listener-scope
```

Emulator: `127.0.0.1:8080` via `emulators:exec`. Playwright wall ~35s + poll; no 5-minute browser stall.

Log: `apps/web/.out/firebase-traffic/listener-scope-ride.json`

---

## Meter evidence (`underlying.*.open`)

| State | CG | trailOnSnapshot | rtdbOnValue | notes |
|---|---|---|---|---|
| trailheadIdle | **1** | 0 | 0 | hubs empty for trail/RTDB |
| rideMenuClosed | **0** | 1 | 1 | ridesHub trail `fHp26…` refCount=2 (PSP+spectator); motionHub=1 |
| rideMenuOpen | **1** | 1 | 1 | CG reacquire |
| rideMenuClosedAgain | **0** | 1 | 1 | |
| afterEndRideImmediate | **1** | 1 | 1 | same trail slot; not yet retargeted |
| afterEndRide (CG poll) | **1** | 1 | 1 | |
| afterEndRideSettled (12s) | **1** | **2** | **1** | **open rose**; not cleanup lag |

Settled hubs:

- `ridesHub.slotCount=2`: `fHp26HH79zM51uwisqIK` (refCount 1) + **`default`** (refCount 1)
- `motionHub.slotCount=1`: trailId **`default`** (refCount 1)
- `peerListenersSettledClosed: false`

CG release/reacquire contract still holds.

---

## Diagnosis — leak vs intentional

**Not** React effect cleanup timing: after 12s, `trailOnSnapshot.open` went **1 → 2**.

### A. `PublicationSharedPresence` on `DEFAULT_TRAIL_ID` — unwanted hold (primary RTDB + one trail snap)

Call sites:

- `App.tsx`: mounts `<PublicationSharedPresence>` while `sharedPresenceCourseId` (intro hub / publication) remains set after end; `trailId={menuTrailSanitizedId}`.
- After end, `returnToTrailhead()` sets trail → `DEFAULT_TRAIL_ID`; `menuTrailSanitizedId` follows.
- `PublicationSharedPresence.tsx`: `acquireTrailLivePublicationRidesSubscription` / `acquireTrailMotionSubscription` gate on `pageVisible` only — **not** on `rideSessionActive`, and **do not** skip `DEFAULT_TRAIL_ID`.

Idle Trailhead before any course (`trailheadIdle`) had **zero** trail/RTDB underlying. Post-ride, intro course stays loaded → PSP remounts listeners on **`default`**. That matches settled `motionHub`/`ridesHub` slot `default`. **This is not intentional Trailhead spectator** — it is residual course-presence wiring after Trailhead return.

### B. World livePublication overlay on prior dedicated Trail — intentional Trailhead spectator (secondary trail snap)

Call sites:

- `useAppMapOverlays.ts`: `trailSpectatorOverlayEnabled` only for `running|paused` → ride-scoped spectator correctly drops.
- Same file: `resolveWorldLivePublicationRideOverlayEnabled` turns **on** when `!isRideSessionActive` → `useWorldLivePublicationRideMapOverlay` re-acquires per `liveRideTrailIds`.
- Emulator CG/`openTrails` can still list the just-ended dedicated Trail while own `livePublicationRides` row is fresh → one `trailOnSnapshot` on `fHp26…` remains.

That path is **by-design Trailhead spectator** for trails with live rides, not a forgotten ride-spectator unsub. It alone would leave `trailOnSnapshot.open≥1`, not the RTDB-on-`default` slot.

### Verdict

| Meter after settle | Cause | Kind |
|---|---|---|
| `rtdbOnValue.open=1` | PSP → `default` | **Unwanted** (fix candidate) |
| `trailOnSnapshot` slot `default` | PSP live rides on DEFAULT | **Unwanted** |
| `trailOnSnapshot` slot `fHp26…` | World overlay + live trail ids | **Intentional** Trailhead spectator (stale self-row may prolong) |

---

## Next code fix (supervisor task — not done here)

1. **Preferred:** In `PublicationSharedPresence`, skip trail `livePublicationRides` + RTDB motion acquire when `sanitizeTrailId(trailId) === DEFAULT_TRAIL_ID` (and/or when `!rideSessionActive` if idle Trailhead should not hold peer motion).
2. Optional follow-up: after end, clear or delay world-overlay trail ids driven only by self’s not-yet-stale `livePublicationRides` if product wants empty emulator to return to idle meters (`trail=0,rtdb=0`) immediately.
3. Keep this E2E peer-close assert; re-run after fix.

---

## Unrelated console warnings

Same class as Task 13: ActivityWorld empty overlay, WebGL ReadPixels, one 404 asset. None blocked CG/peer meters.
