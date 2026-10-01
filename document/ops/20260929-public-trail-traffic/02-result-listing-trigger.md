# Result 02 — listing trigger create/delete gate

> **Superseded (2026-09-29 TASK-26):** members·livePublicationRides 는 더 이상 `onDocumentWritten` + exists gate 가 아니라 **Created/Deleted 전용 트리거**다. See [26-result-listing-created-deleted.md](26-result-listing-created-deleted.md).

Status: DONE (historical — pre-TASK-26)
Task: [01-task-listing-trigger.md](01-task-listing-trigger.md)
Date: 2026-09-29

## Changes

### `functions/src/openTrailListingProjection.ts`

- Exported existing `isSubcollectionCreateOrDelete` (members already used it; single policy source).
- `openTrailListingOnLiveCourseRideWritten` now returns early on update-only writes (`before.exists === after.exists`).
- Create (`!before → after`) and delete (`before → !after`) still call `recomputeOpenTrailListing` immediately.
- Unchanged: `openTrailListingOnTrailWritten`, member create/delete gate, sweeper import path, schema, other Functions.

### `functions/src/openTrailListingProjection.test.ts` (new)

- Predicate cases: create/delete → recompute; exists→exists heartbeat → skip; missing→missing → skip.
- Source routing check: live handler must call `isSubcollectionCreateOrDelete` and must not inline a second `exists` policy.

## Commands

| Command | Result |
|---|---|
| `npm run build` (cwd `functions`) | PASSED |
| `node --test lib/openTrailListingProjection.test.js` | PASSED (4 tests) |
| `npx eslint src/openTrailListingProjection.ts src/openTrailListingProjection.test.ts` | PASSED (exit 0) |
| `npm test` (package script) | SKIPPED — script does not yet list the new test file; allowed-files scope excluded `package.json` edit. Focused run above covers the new contract. |

No commit / push / deploy (per task).

## Expected traffic reduction

Before: each `livePublicationRides/{uid}` write (~1 Hz per active rider) invoked `recomputeOpenTrailListing` → trail read + 2 count aggregates + old listing read + listing write.

After (model):

- Live-ride **update** heartbeats: **0** listing recomputes from this trigger.
- Live-ride **create/delete**: still 1 recompute each (immediate rider-count freshness).
- Listing freshness for in-progress rides still arrives via throttled `trails/{id}.lastActivityAt` (~30s/sender) → `openTrailListingOnTrailWritten`, plus member create/delete, plus server sweeper / client refresh paths.

Order-of-magnitude: for `R` concurrent live riders on a trail writing ~1 Hz for `T` seconds, listing recomputes from this trigger drop from ~`R·T` to ~`2R` (start+end) ignoring overlaps — roughly **~30×–T×** fewer when rides last minutes, not counting the remaining ~30s trail-write path.

## Remaining risks

- Listing `liveRiderCount` / activity fields may lag up to the trail `lastActivityAt` throttle (~30s) while a ride is in progress; create still refreshes immediately when the live doc appears.
- Field-only “soft” presence without doc create/delete still relies on trail write / sweeper / client — same as member update policy.
- New test is not wired into `functions` `npm test` script until a later housekeeping change includes `lib/openTrailListingProjection.test.js`.
- No emulator/integration proof that Cloud Functions runtime delivers `before`/`after.exists` as assumed (standard `onDocumentWritten` contract).
