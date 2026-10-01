# Result 26 — listing triggers Created/Deleted

Status: DONE
Task: [26-task-listing-created-deleted.md](26-task-listing-created-deleted.md)
Date: 2026-09-29

## Changes

### `functions/src/openTrailListingProjection.ts`

- Removed `openTrailListingOnMemberWritten`, `openTrailListingOnLiveCourseRideWritten` (`onDocumentWritten` + exists gate).
- Added `openTrailListingOnMemberCreated` / `openTrailListingOnMemberDeleted`, `openTrailListingOnLiveCourseRideCreated` / `openTrailListingOnLiveCourseRideDeleted`.
- Unchanged: `openTrailListingOnTrailWritten`, `runRecompute` (`default` / empty skip, warn on failure), shared `recomputeListingForTrailParams`.

### `functions/src/index.ts`

- Exports four new functions; legacy Written names removed.

### `functions/src/openTrailListingProjection.test.ts`

- Replaced predicate/source-gate tests with `__endpoint.eventTrigger.eventType` + document path registration checks.
- Source contract: no Written on members/live paths.
- Handler `.run({ params: { trailId: "default" } })` guard smoke (no Firestore).
- Index export name contract.

### Prior docs (expectations)

- [02-result-listing-trigger.md](02-result-listing-trigger.md) — superseded for members/live by this task (Written+early-return → Created/Deleted).
- [03-review-listing-trigger.md](03-review-listing-trigger.md) — review note appended for TASK-26.

## Commands (evidence)

| Command | Result |
|---|---|
| `npm run build` (cwd `functions`) | PASSED (`tsc`) |
| `npm test` (cwd `functions`) | PASSED — **36/36** (listing suite **6** cases: 3 registration + 1 source + 1 default guard + 1 index) |
| `npx eslint src/openTrailListingProjection.ts src/openTrailListingProjection.test.ts src/index.ts` | PASSED (exit 0) |
| Firebase emulator (listing CF E2E) | SKIPPED — no focused harness; trigger type verified via `__endpoint.eventTrigger.eventType` on compiled exports |

## Traffic / invocation model

| Event | Before (TASK-01) | After (TASK-26) |
|---|---|---|
| `livePublicationRides` update ~1 Hz | CF invoked; handler early-return | **CF not invoked** |
| `livePublicationRides` create/delete | CF invoked; recompute | CF invoked; recompute |
| `members` update | CF invoked; gate skip | **CF not invoked** |
| `members` create/delete | CF invoked | CF invoked |
| `trails/{id}` write (incl. throttled activity) | CF invoked | unchanged |

## Migration hazard (deploy gate)

Approved deployment must:

1. Deploy new functions: `openTrailListingOnMemberCreated`, `openTrailListingOnMemberDeleted`, `openTrailListingOnLiveCourseRideCreated`, `openTrailListingOnLiveCourseRideDeleted`.
2. **Delete** orphaned v2 functions: `openTrailListingOnMemberWritten`, `openTrailListingOnLiveCourseRideWritten`. Leaving them deployed continues `document.written` subscriptions on every subcollection update.

No commit / push / deploy in this task.
