# PROGRESS — public-trail-traffic

- 2026-09-29 ~09:14 KST — Task 09 listener-scope: gated useOpenTrails (ride+menu), ActiveLiveRideTrailIds + world overlay off during ride; contract test 6/6; web build PASS; result → 10-result-listener-scope.md. No commit/push/deploy.
- 2026-09-29 ~09:25 KST — Task 11 gate-tests: moved 3 pure gates → listenerScopePolicy.ts; runtime state-matrix tests 17/17; lint+web build PASS; result → 12-result-gate-tests.md. No commit/push/deploy.
- 2026-09-29 ~09:26 KST — Task 13 emulator-listeners: writing listener-scope-ride.spec.ts + npm script; starting emulators:exec on RTW_DEV_PORT=5015. No commit/push/deploy.
- 2026-09-29 ~09:30 KST — Task 13 DONE: emulator E2E PASS 1/1 (CG 1→0→1→0→1; trailOnSnapshot≥1 mid-ride; RTDB open=1). Log → apps/web/.out/firebase-traffic/listener-scope-ride.json. Result → 14-result-emulator-listeners.md. No commit/push/deploy.
- 2026-09-29 ~09:32 KST — Task 15 post-ride-cleanup: extending listener-scope-ride.spec.ts (immediate+settled peer close poll 12s); launching emulator E2E RTW_DEV_PORT=5015. No commit/push/deploy.
- 2026-09-29 ~09:36 KST — Task 15 DONE: E2E FAIL peer close (settled trail=2 rtdb=1; PSP on default + world overlay on prior trail). Result → 16-result-post-ride-cleanup.md. No product fix / commit / push / deploy.
- 2026-09-29 ~09:37 KST — Task 17 default-Trail subscription: 착수. PublicationSharedPresence DEFAULT_TRAIL skip + E2E 계약 수정. No commit/push/deploy.
- 2026-09-29 ~09:38 KST — Task 17: PublicationSharedPresence DEFAULT_TRAIL skip 적용 중; E2E 계약 갱신.
- 2026-09-29 ~09:40 KST — Task 17: lint/build PASS; emulator E2E (RTW_DEV_PORT=5015) 실행 중.
- 2026-09-29 ~09:41 KST — Task 17 DONE: PSP DEFAULT_TRAIL skip; E2E PASS (rtdb=0, no default hub slots; trailOnSnapshot=1 spectator). Result → 18-result-default-trail-subscription.md. No commit/push/deploy.
- 2026-09-29 ~09:46 KST — Task 19 S4-1R T5: 진단 착수 (newSessionRowKept=true, deferred*=0, guardFired=false). No commit/push/deploy.
- 2026-09-29 ~09:50 KST — Task 19: test race 확정 — arm 전 in-flight latch → drain settled=true → requestRouteRowCleanup 미등록. T5 test-only 안정화 후 emulator 검증 시작 (RTW_DEV_PORT=5016).
- 2026-09-29 ~09:56 KST — Task 19 cont: full S4-1R >5min no-progress stop. Adding S41R_ONLY_T5=1 (skip T1–T4); running T5-only on RTW_DEV_PORT=5017.
- 2026-09-29 ~10:00 KST — T5-only first run: armed OK but deferredSkipTotal stayed 0 (delay kept → slot chain never drained). Fixing test: clear delay after new epoch, then poll skip. Re-running 5017.

- 2026-09-29 ~10:03 KST — T5-only attempt still did not fire skip guard; full test-only experiment restored. T5 remains an unresolved verification gate, not a proven product regression. See 20-result-s41r-t5.md.
