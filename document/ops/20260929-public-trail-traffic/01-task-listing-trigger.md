# Task 01 — Stop public Trail listing recompute on every progress heartbeat

Owner: Cursor CLI Developer. Allowed files: `functions/src/openTrailListingProjection.ts` and a focused contract test under `functions/src/` or existing suitable test location; this task's result file `document/ops/20260929-public-trail-traffic/02-result-listing-trigger.md`. You are not alone in the codebase: do not revert others' edits; inspect the current diff before editing.

Problem: `trails/{trailId}/livePublicationRides/{uid}` is written about once per second per rider. `openTrailListingOnLiveCourseRideWritten` currently calls `recomputeOpenTrailListing` on every update, even a heartbeat. `recomputeOpenTrailListing` reads trail, two count aggregates, old listing, then writes listing. `openTrailListingOnTrailWritten` already responds to the throttled `trails/{id}.lastActivityAt` update (about 30s per sender). Member create/delete and live ride create/delete need immediate refresh.

Required change: Gate the live ride trigger to create/delete transitions only; skip updates. Preserve immediate create/delete, Trail write refresh, server sweeper, and current client refresh paths. Do not change Firestore schema, RTDB, ride behavior, other Functions, dependencies, Git, or deployment. Add a meaningful test of the transition predicate or trigger routing without duplicating implementation text. Avoid introducing a second policy source or broad refactor.

Verify: run focused test, Functions build and lint for changed files as possible. In the result file record exact changes, passed/failed/skipped commands, expected traffic reduction model, remaining risks. No commit/push. If an unexpected design dependency appears, stop and report it rather than expanding scope.
