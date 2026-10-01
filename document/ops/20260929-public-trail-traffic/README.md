# Public Trail traffic reduction

- Traffic branch / worktree: `codex/public-trail-traffic` @ `C:\Users\kdrea\.codex\worktrees\public-trail-traffic\boxcycle` (`beb22b1`)
- Integration / deploy worktree: `C:\Users\kdrea\.codex\worktrees\public-trail-traffic-integration\boxcycle` on **`main`** @ `803f6ff` (+ R2 docs commit)
- Status: **최종 보고 검수 완료 · 묶음 종료**. R1 merge/`origin/main` DONE · R2 production deploy DONE (listing Created/Deleted×4; Written×2 deleted; Hosting released). Production billed 1v2 관측은 **별도 미실시**.
- Supervisor: Codex (no coding)
- Developer: Cursor CLI
- Chief approval: R1+R2 explicitly approved 2026-10-01.
- Final report: [261001-Public-Trail-동행-트래픽-개선-결과보고.md](../../archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md)
- Current result: [37-result-r2-deploy.md](37-result-r2-deploy.md) · [36-result-r1-merge-main.md](36-result-r1-merge-main.md) · queue [22-task-queue.md](22-task-queue.md)

Comparison scope: one rider and two riders only. Larger groups require a separate instruction.

Harness evidence hygiene: committed `task30b/30c/31a *.summary.json` keep scenario metrics/pass counts; full raw dumps remain **local-only**. Class **C** MapHud/theme/relay-ignore may remain dirty on the original traffic worktree (untouched by R2).

Next: optional production billed 1v2 observation (separate). R2 does **not** assert billed cost reduction.

Scope: reduce Firestore amplification first, then evaluate RTDB rate and adaptive publication with replay evidence.
