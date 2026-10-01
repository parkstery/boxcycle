# Task 04 — Reduce nonessential Firestore listeners during active Trail ride

Owner: Cursor CLI Developer. You are not alone in the codebase; preserve all prior edits. Allowed source files: `apps/web/src/App.tsx`, `apps/web/src/features/map-overlays/useAppMapOverlays.ts`, and a focused test if needed. Write result to `document/ops/20260929-public-trail-traffic/10-result-listener-scope.md`. No commit, push, deploy.

Evidence: user live Firestore report at `C:/20.HDev/boxcycle/document/archive/260929-주행-Firebase-트래픽-1인vs2인-분석보고.md`; qualified analysis in `07-result-measurement-review.md` and `08-review-measurement.md`. Do not quote 3.3x as causal. Existing listing/CG hooks and world overlay remain active during ride, causing broad subscriptions. `livePublicationRides` per current Trail is required for peers; keep it. Refcount hubs already exist; do not duplicate.

Implement these narrow gates:

1. `App.tsx`: `useOpenTrails` should subscribe when logged into Trailhead and either not actively riding or Trail menu is open. It should release listing and CG listeners while active ride + menu closed, and reacquire when menu opens or ride ends. Verify `menuOpen` availability and ensure Trail display metadata still comes from current/seed/fetch during ride. Preserve menu functionality when opened mid-ride.
2. `useAppMapOverlays.ts`: project-wide `useActiveLiveRideTrailIds` CG consumer should be disabled during active ride. This hook is for world map discovery; menu hook handles menu discovery when open. World `useWorldLivePublicationRideMapOverlay` should not subscribe to all Trails while actively riding; gate it off during ride. Preserve current Trail peer/spectator subscriptions outside this world overlay and idle Trailhead discovery.

Before editing, inspect call sites and note any product behavior dependency that contradicts these gates. If such a dependency exists, stop and report rather than silently removing behavior. Do not change Firestore schema, frequencies, RTDB, route progress, security rules or other modules.

Verification: web typecheck/build, changed-file lint, existing focused tests and a ride E2E where feasible. Add a meaningful automated check for ride/menu state listener gating if practical. Report exact commands and outcome, before/after expected underlying listener open counts by path (a model), and risks. Do not run live Firebase tests without explicit separate plan. Keep scope small.
