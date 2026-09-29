# Review 04 — 5Hz candidate and integration check

Supervisor: Codex. Verdict: APPROVED for isolated branch review, not deployment.

Reviewed the sender interval diff and deterministic 5Hz replay scenario. The sender target changes from 100ms to 200ms; the 100ms compute tick, max in-flight count, receiver policy, payload, RTDB schema and Firestore heartbeat remain unchanged. The replay scenario covers jitter, stop/start and a 2s gap. Before and after replays passed all 11 scenarios; the graph was inspected. Web build, 29 focused contracts, Functions 34 tests and changed-file lint passed.

Independent integration run: `RTW_DEV_PORT=5012 npm run test:e2e:peer-s41` in `apps/web` passed 2/2 Chromium tests in 2.7 minutes with Auth, Firestore and RTDB emulators. Port 5000 was already occupied, so the dedicated development port was used. The page logged failures reaching `ensureRouteTokenOnboardingHttp` because the test launches no Functions emulator; the two tested ride flows still passed. The E2E proves lifecycle compatibility, not real-world 5Hz motion quality or billing reduction.

The configured RTDB motion publish ceiling falls from 10 to 5 per rider per second. This is a model, not a measured production reduction. Firestore listing update suppression is also unmeasured in production. Keep deployment and real one-versus-two-rider comparison as separate gates. No commit, push or deployment.
