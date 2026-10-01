# Task 03 — Review measured Firestore traffic and listener paths

Owner: Cursor CLI Developer. You are not alone in the codebase; preserve all existing edits. This is read-only code inspection. Write only `document/ops/20260929-public-trail-traffic/07-result-measurement-review.md`. No source changes, tests, commit, push or deployment.

Inputs: user-provided report at `C:/20.HDev/boxcycle/document/archive/260929-주행-Firebase-트래픽-1인vs2인-분석보고.md`, its source script `C:/20.HDev/boxcycle/apps/web/e2e/firebase-traffic-compare.spec.ts`, and phase logs under `C:/20.HDev/boxcycle/apps/web/.out/firebase-traffic/`. The isolated branch has optimization changes not present in that live measurement; treat the report as pre-deployment baseline.

Check report claims against test timeline, especially that both clients call `ensureRiding` and `setSpeedKmh` BEFORE `*_ready_quiet` and 90-second wait. Thus quiet is UI inactivity, not Firebase quiet. Also each 60-second ride window crosses minute bins; confirm that the quoted 363 vs 1200 values are not aligned 60-second totals. Verify whether 08:23–08:24 can be called a join event when `dual_ready_quiet` was 08:22:58. Assess the 60-minute read/write ratio and listener peak as mixed workload.

Map Firestore onSnapshot calls that can be active for 1 vs 2 Trail riders. Identify actual collection paths, whether subscriptions are already refcounted, where fanout occurs, and concrete candidates for listener/read reductions. Cite file and line references. Do not infer specific cost attribution from console totals without operation-level evidence. Distinguish report measurements, code-supported conclusions, hypotheses and next measurements. Keep concise.
