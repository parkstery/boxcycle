# Result 19 — S4-1R T5 verification audit

Supervisor: Codex. Status: UNRESOLVED TEST GATE; no product source change.

After the listener and default-Trail fixes, `RTW_DEV_PORT=5016 npm run test:e2e:peer-s41` on local emulators produced S4-1 PASS and S4-1R T1–T4 PASS, T5 FAIL. T5 retained its live-ride row (`newSessionRowKept=true`) but `deferredRunTotal=0` and `deferredSkipTotal=0`; the required deferred cleanup guard was not exercised. This does not prove a lost row or a route-flight product regression.

Cursor CLI investigated a test race: the original latch could catch a write started before delay injection. A test-only experiment waited for a new delayed in-flight write and deferred cleanup queue, then ran T5 alone. The queue armed but `deferredSkipTotal` still did not reach 1 within 18 seconds. The full T1–T5 rerun had earlier exceeded five minutes without completion and was stopped under AGENTS.md. The experimental test changes were restored; `peer-sync-s41r.spec.ts` remains unchanged in the branch.

Next gate if route-flight behavior becomes part of this release: capture epoch and deferred run/skip debug state across hide/resume, ensure a new live epoch exists before the old flight drains, then run T5 alone. Do not label the current T5 as passed. The optimization branch changes no route-flight source code. No live Firebase, commit, push or deployment was performed during this audit.
