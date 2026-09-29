# Supervisor review — Public Trail traffic branch

Comparison scope: one rider versus two riders only; no larger-group comparison is part of this branch.

Status: READY_FOR_REVIEW on isolated branch `codex/public-trail-traffic`. No deploy or merge.

Implemented: live ride update-only events no longer recompute `openTrailListings`; RTDB motion publish target 100ms→200ms; broad listing/collection-group/world-live subscriptions release during active ride while menu is closed and reacquire when needed; `PublicationSharedPresence` no longer subscribes to Firestore/RTDB peer nodes for Trailhead `default` after ride end.

Evidence: Functions test 34/34 and build; web build; 5Hz packet replay 11/11 plus 29 motion/sync contracts; listener-policy runtime tests 17/17; focused emulator listener E2E 1/1. Emulator meter: CG 1→0→1→0→1 across idle/ride/menu/end; active-ride current Trail Firestore and RTDB remain 1 each; after end RTDB 0 and no `default` hub, with one intentional prior-Trail world spectator Firestore listener. Earlier S4-1/S4-1R run before listener-scope changes passed 2/2. Latest full peer-s41 rerun: S4-1 passed, S4-1R T1–T4 passed and T5 did not exercise its deferred guard. See `20-result-s41r-t5.md`; do not report full suite green.

The user's single/two-rider live ride observations found no visible issue. The attached Firestore report is a pre-deployment directional baseline; its clock-minute bins do not justify an exact 3.3x ride read multiplier. See `08-review-measurement.md`. Actual production read/write reduction and 5Hz perceived quality remain unmeasured because this branch has not been deployed. No adaptive rate or 1Hz Firestore heartbeat change was made without quality evidence.

Release boundary: review this branch, resolve or explicitly accept the independent T5 test gate, then separately plan deployment and an aligned live A/B measurement. Do not infer billed savings from emulator listener counts.
