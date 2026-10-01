# Public Trail traffic reduction

- Traffic branch / worktree: `codex/public-trail-traffic` @ `C:\Users\kdrea\.codex\worktrees\public-trail-traffic\boxcycle` (`beb22b1`)
- Integration branch / worktree: `codex/public-trail-traffic-integration` @ `C:\Users\kdrea\.codex\worktrees\public-trail-traffic-integration\boxcycle` (merge `fd27d06` = traffic + main `4492753`)
- Status: **TASK-35** integration merge DONE locally. **No push / merge-to-main / deploy.** R1/R2 still NEEDS_APPROVAL.
- Supervisor: Codex (no coding)
- Developer: Cursor CLI
- Chief approval: This work was explicitly approved on 2026-09-29. Deployment and merge remain separate actions.
- Current result: [35-result-integration-merge.md](35-result-integration-merge.md) · [34-result-postcommit-verify.md](34-result-postcommit-verify.md) · [33-result-commit.md](33-result-commit.md) · queue [22-task-queue.md](22-task-queue.md)

Comparison scope: one rider and two riders only. Larger groups require a separate instruction.

Harness evidence hygiene: committed `task30b/30c/31a *.summary.json` keep scenario metrics/pass counts; full raw dumps (`task30*.json` / `task31a-fallback-4s.json` without `.summary`) remain **local-only**. Class **C** MapHud/theme/relay-ignore left dirty uncommitted.

Next: optional TASK-29 / **R1** merge / **R2** deploy (legacy Written delete). **No push from Developer.**

Scope: reduce Firestore amplification first, then evaluate RTDB rate and adaptive publication with replay evidence. Preserve previous relay history and do not deploy.
