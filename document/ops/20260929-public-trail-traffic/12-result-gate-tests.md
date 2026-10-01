# Result 11 — Executable listener gate tests

Status: DONE
Task: [11-task-gate-tests.md](11-task-gate-tests.md)
Date: 2026-09-29
No commit / push / deploy (per task). Prior listing/5Hz/measurement/listener-scope edits preserved.

---

## Changes

### New `apps/web/src/features/map-overlays/listenerScopePolicy.ts`

Moved the three pure gates + option types out of the React hook module (no React/Firebase imports):

- `resolveOpenTrailsListenerEnabled` / `OpenTrailsListenerEnabledOpts`
- `resolveActiveLiveRideTrailIdsListenerEnabled` / `ActiveLiveRideTrailIdsListenerEnabledOpts`
- `resolveWorldLivePublicationRideOverlayEnabled` / `WorldLivePublicationRideOverlayEnabledOpts`

Logic unchanged from Task 09.

### Wiring

- `App.tsx` imports `resolveOpenTrailsListenerEnabled` from `listenerScopePolicy` (was `useAppMapOverlays`).
- `useAppMapOverlays.ts` imports the CG + world overlay gates from `listenerScopePolicy`; product call sites unchanged.

### `apps/web/scripts/ride-hierarchy/listener-scope-gate-contract.test.ts`

Replaced source-regex body extraction with direct runtime assertions across:

| State | openTrails | activeLiveRideTrailIds | world live overlay |
|---|---|---|---|
| idle Trailhead | true | true | true |
| active ride / menu closed | false | false | false |
| active ride / menu open | true | false | false |
| paused / menu closed | false | false | false |
| ride ended | true | true | true |
| not configured / not auth / page hidden (where relevant) | false | false | false |

Plus one small wiring check that App/overlay import `listenerScopePolicy`. Prefer behavioral tests over implementation text.

---

## Behavior changes

**None** for product gating. Refactor + test quality only; gate boolean outcomes match Task 09.

---

## Commands / results

| Command | Result |
|---|---|
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-hierarchy/listener-scope-gate-contract.test.ts` (cwd `apps/web`) | PASSED — 17/17 |
| `npx eslint src/App.tsx src/features/map-overlays/useAppMapOverlays.ts src/features/map-overlays/listenerScopePolicy.ts scripts/ride-hierarchy/listener-scope-gate-contract.test.ts` | PASSED — exit 0 (pre-existing hook-deps warnings only; 0 errors) |
| `npm run build` (cwd `apps/web`) | PASSED — `tsc -b && vite build` |
| Live Firebase / emulator integration | **SKIPPED** — task: supervisor runs emulator; no live Firebase here |

---

## Risks

- None new beyond Task 09 (mid-ride menu resubscribe lag, world discovery off while riding). Pure-module move does not change subscribe timing.
