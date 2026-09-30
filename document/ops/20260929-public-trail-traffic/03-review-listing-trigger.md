# Review 02 — listing trigger

Supervisor: Codex. Verdict: APPROVED for isolated branch, not deployment.

Reviewed `openTrailListingProjection.ts` and its focused test. Live ride updates now skip `recomputeOpenTrailListing`, while create/delete use the existing transition predicate. The Trail document write trigger remains active; the route publisher's `touchActivity` is locally throttled to 30 seconds. Developer reports Functions build, focused test (4 cases), and changed-file lint passed. Diff check has no whitespace errors. Runtime traffic reduction remains a model until emulator/production measurements; listing freshness and function deployment still require gates.

Follow-up: include the new test in the standard Functions test script before merge. No commit, push, or deployment.

---

**TASK-26 update (2026-09-29):** Implementation upgraded from Written+early-return to **Created/Deleted** triggers for members and livePublicationRides (zero CF invocations on subcollection updates). Re-review before deploy; legacy Written function names must be deleted on approved deployment. See [26-result-listing-created-deleted.md](26-result-listing-created-deleted.md).
