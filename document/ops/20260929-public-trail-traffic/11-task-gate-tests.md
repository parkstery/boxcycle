# Task 05 — Make listener gate behavior executable

Owner: Cursor CLI Developer. You are not alone in the codebase; preserve all existing edits. Allowed source: `apps/web/src/App.tsx`, `apps/web/src/features/map-overlays/useAppMapOverlays.ts`, new `apps/web/src/features/map-overlays/listenerScopePolicy.ts`, and replace `apps/web/scripts/ride-hierarchy/listener-scope-gate-contract.test.ts`. Result: `document/ops/20260929-public-trail-traffic/12-result-gate-tests.md`. No commit, push, deploy.

Review of prior task: The three gates are currently exported from the large `useAppMapOverlays.ts` React hook module, and the new test checks source strings via regex. This is weak because it does not execute state transitions. Move the three pure gate functions and their types to `listenerScopePolicy.ts` with no React/Firebase imports. Import them from App and overlay hook. Keep the exact intended behavior and existing product code wiring; do not expand scope.

Replace the source-regex test with direct runtime tests of the pure gates across representative states: idle Trailhead, active ride/menu closed, active ride/menu open, paused/menu closed, ride ended, not configured/not authenticated/page hidden where relevant. Assert expected true/false for each gate. Do not just assert implementation text. You may retain one small wiring assertion if needed, but prefer behavioral tests and typecheck. Ensure the test runs in the existing TypeScript test harness.

Run focused test, changed-file lint, web build. Report exact results and any behavior changes. Do not run live Firebase; supervisor will run emulator integration. Do not modify earlier listing/5Hz work.
