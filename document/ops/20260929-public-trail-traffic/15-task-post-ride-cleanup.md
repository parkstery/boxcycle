# Task 07 — Verify peer listeners close after ride end

Owner: Cursor CLI Developer. You are not alone in the codebase; preserve all prior edits. Allowed source: `apps/web/e2e/listener-scope-ride.spec.ts` only. Result: `document/ops/20260929-public-trail-traffic/16-result-post-ride-cleanup.md`. No product source changes unless supervisor requests a second task; no commit/push/deploy.

Observation: emulator proof `14-result-emulator-listeners.md` recorded `trailOnSnapshot.open=1` and `rtdbOnValue.open=1` in the immediate `afterEndRide` sample. This may be normal effect cleanup timing, or a leak. The spectator overlay is gated to running/paused in `useAppMapOverlays.ts`; the motion listener may have its own lifecycle. Do not infer a leak from one immediate sample.

Extend the E2E to poll both underlying `trailOnSnapshot.open` and `rtdbOnValue.open` for closure after ride end, with a bounded timeout 10–15 seconds. Record immediate and settled values plus any relevant hub refcounts in the ignored JSON output. If they stay open, let the test fail or mark a clear diagnostic, then inspect call sites and explain whether this is intentional Trailhead spectator behavior or a leak. Do not silently weaken the assertion. Keep the existing 1→0→1→0→1 CG assertions.

Run emulator-only focused script with `RTW_DEV_PORT=5015` or another free port, single worker. Respect AGENTS.md five-minute browser timeout rule. Report evidence and next code fix if needed. No live Firebase.
