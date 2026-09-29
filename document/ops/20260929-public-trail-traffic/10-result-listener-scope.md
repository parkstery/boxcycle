# Result 09 — Bounded listener gating during active Trail ride

Status: DONE
Task: [09-task-listener-scope.md](09-task-listener-scope.md)
Date: 2026-09-29
No commit / push / deploy (per task). Prior listing/5Hz/measurement edits preserved.

---

## Product-dependency check (pre-edit)

| Behavior | Dependency? | Verdict |
|---|---|---|
| Current Trail peers while riding | `useTrailLivePublicationRideSpectatorOverlay` when `running`/`paused` — **not** world overlay | Keep; no conflict |
| Trail display number / meta while riding | `currentTrailMeta` → seed → `useTrailInstanceMeta` (enabled on `menuOpen \|\| isRideSessionActive`) → cache; listing is only a soft fallback | Keep; gating listing off is OK |
| Mid-ride Trail menu | Needs listing + CG when open | Gate re-enables `useOpenTrails` on `menuOpen` |
| Idle Trailhead world discovery | World overlay + project-wide CG + open listings | Remain on when `!isRideSessionActive` |

No contradicting product dependency found; gates applied as specified.

---

## Changes

### `apps/web/src/App.tsx`

- `useOpenTrails({ enabled })` now uses `resolveOpenTrailsListenerEnabled`:
  - on: Trailhead session + (not riding **or** menu open)
  - off: active ride + menu closed → releases `openTrailListings` + CG consumers inside the hook
- Reacquires when menu opens mid-ride or ride ends.

### `apps/web/src/features/map-overlays/useAppMapOverlays.ts`

Exported pure gates (single policy source):

- `resolveOpenTrailsListenerEnabled`
- `resolveActiveLiveRideTrailIdsListenerEnabled` — project-wide CG consumer **off** while riding
- `resolveWorldLivePublicationRideOverlayEnabled` — multi-Trail `livePublicationRides` world overlay **off** while riding

Wiring:

- `useActiveLiveRideTrailIds` → ride-gated
- `useWorldLivePublicationRideMapOverlay` → ride-gated
- `trailSpectatorOverlayEnabled` unchanged (current Trail peers preserved)

### `apps/web/scripts/ride-hierarchy/listener-scope-gate-contract.test.ts` (new)

Source-contract tests for gate bodies + App/overlay wiring + spectator keep-alive. Does not import the React hook module.

---

## Expected underlying listener open counts (model)

Assumes logged-in Trailhead, page visible, refcount hubs collapse duplicate consumers. **Not** live Firebase proof.

| Path | Before (ride, menu closed) | After (ride, menu closed) | After (ride, menu open) |
|---|---|---|---|
| `openTrailListings` (limit 40) | 1 | **0** | 1 |
| CG `livePublicationRides` (active-trail-ids hub) | 1 (OpenTrails ± ActiveLiveRide ids, refcount) | **0** | 1 (OpenTrails only) |
| `trails/{id}/livePublicationRides` via **world** overlay (per trailId in listing∪CG∪current) | **N** hubs (N = live trail set size) | **0** from world | **0** from world |
| `trails/{current}/livePublicationRides` via **spectator** | 1 (refcount with world if same id) | **1** | **1** |
| `trails/{id}/members`, publication session, etc. | unchanged | unchanged | unchanged |

Order-of-magnitude: during solo/dual ride with menu closed, drop **listing + CG + (N−1) extra trail hubs**; keep the current-Trail peer hub required for companions.

Do not quote console-bin ×3.3 as causal for this change.

---

## Commands / results

| Command | Result |
|---|---|
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-hierarchy/listener-scope-gate-contract.test.ts` (cwd `apps/web`) | PASSED — 6/6 |
| `npx eslint src/App.tsx src/features/map-overlays/useAppMapOverlays.ts scripts/ride-hierarchy/listener-scope-gate-contract.test.ts` | PASSED — exit 0 (pre-existing hook-deps warnings only) |
| `npm run build` (cwd `apps/web`) | PASSED — `tsc -b && vite build` |
| Ride Playwright e2e / live Firebase listener meters | **SKIPPED** — task forbids live Firebase without a separate plan; gating is covered by contract + typecheck |

Contract test is not yet wired into `npm run test:next-ride` (package.json out of allowed source scope); focused run above is the verification.

---

## Risks

- Mid-ride menu: brief empty/loading listing until snapshots return after re-subscribe.
- While riding with menu closed, Activity World catalog loses other open-Trail `publicationId`s from `openTrails` (basic hubs + published courses + current-trail live pubs remain). Intentional with world-discovery gate.
- World map no longer shows other Trails’ live riders during an active ride (idle Trailhead discovery unchanged).
- No runtime open-count meter in this task; model above should be confirmed with DEV `trackUnderlyingReadSubscription` / hub debug on a later measurement plan.
