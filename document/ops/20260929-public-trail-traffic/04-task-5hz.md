# Task 02 — Controlled RTDB 5Hz candidate and replay evidence

Owner: Cursor CLI Developer. You are not alone in the codebase; preserve all prior edits. Read `.agents/skills/peer-sync/SKILL.md` and `apps/web/scripts/peer-sync/HARNESS.md` before touching peer policy. No commit/push/deploy.

Scope: `apps/web/src/lib/ride/rideSyncPolicy.ts`, `apps/web/scripts/peer-sync/scenarios.mjs`, a focused test under `apps/web/scripts/peer-sync/` if necessary, `functions/package.json` only to include existing `openTrailListingProjection.test.js` in standard `npm test`, and this task result file. Do not change interpolation or extrapolation constants, RTDB schema/payload, Firestore heartbeat, security rules, or dependencies.

A. Replay scenario first: add a 200ms transmission candidate with deterministic jitter and a stop/start or 2s gap. Run replay `--check` (and graph) before changing the publish constant; report baseline. Existing 200ms S2 cases are present, but add a candidate scenario that specifically protects the proposed 5Hz switch. If the new scenario fails, report and stop rather than weakening checks.

B. Set `PEER_MOTION_PUBLISH_INTERVAL_MS` from 100 to 200 (5Hz target). Update only comments in the touched policy file that would otherwise falsely state the current frequency. Keep the 100ms compute tick for responsiveness to speed events. Keep `MOTION_MAX_IN_FLIGHT=2`.

C. Run replay `--check --graph` again and inspect the graph, plus `interp-smoothness-contract.test.ts`, `motion-flight-pipeline-contract.test.ts`, `sync-policy-constants-contract.test.ts`, web build, changed-file lint. Add `lib/openTrailListingProjection.test.js` to Functions `npm test` script and run `npm test` there.

D. Report exact test commands/results, expected maximum RTDB event-rate change, meaningful measured replay smoothness/lag observations, and risk that 5Hz quality is not established by offline replay alone. Write `document/ops/20260929-public-trail-traffic/04-result-5hz.md`.
