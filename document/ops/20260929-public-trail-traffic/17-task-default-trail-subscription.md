# Task 08 — Remove residual default Trail peer subscriptions after ride

Owner: Cursor CLI Developer. You are not alone in the codebase; preserve all prior edits. Allowed source: `apps/web/src/components/PublicationSharedPresence.tsx`, `apps/web/e2e/listener-scope-ride.spec.ts`, and a focused test only if needed. Result: `document/ops/20260929-public-trail-traffic/18-result-default-trail-subscription.md`. No commit, push, deploy or live Firebase.

Evidence: `16-result-post-ride-cleanup.md` and ignored JSON show that 12s after ride end, `PublicationSharedPresence` is subscribed to `DEFAULT_TRAIL_ID` on both `livePublicationRides` Firestore and RTDB motion. `trailOnSnapshot.open=2` contains `default` plus a prior live Trail. The prior live Trail is intentionally re-acquired by idle Trailhead world spectator; do not remove that product behavior. The original E2E post-ride requirement of total trailOnSnapshot.open=0 was too broad.

Before source edit, use the current failing emulator trace as regression evidence. In `PublicationSharedPresence`, skip both `acquireTrailLivePublicationRidesSubscription` and `acquireTrailMotionSubscription` whenever `sanitizeTrailId(trailId) === DEFAULT_TRAIL_ID`. Also clear their local/ref state and companion count as appropriate so stale peers do not remain visible. Preserve non-default Trail behavior, publication session member presence, and all ride timing/payload policy. Do not touch peer interpolation or replay algorithms.

Update the E2E's post-ride assertion to the exact intended contract: within 12s, RTDB motion open returns to 0; motionHub has no `default` slot; ridesHub has no `default` slot. A non-default trailOnSnapshot listener may remain for intentional Trailhead world spectator, so record total and slots without requiring total 0. Keep CG `1→0→1→0→1` and active ride peer-listener assertions.

Run focused emulator E2E, web build, changed-file lint and relevant peer-motion replay check if code touches sync logic. Report before/after meters and remaining read paths. If default subscription is needed for a product feature, stop and explain rather than bypassing.
