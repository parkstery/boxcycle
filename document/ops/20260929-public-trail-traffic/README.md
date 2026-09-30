# Public Trail traffic reduction

- Branch: `codex/public-trail-traffic`
- Worktree: `C:\Users\kdrea\.codex\worktrees\public-trail-traffic\boxcycle`
- Status: **TASK-33** local isolated-branch commit (Supervisor-approved A/B). **No push / merge / deploy.**
- Supervisor: Codex (no coding)
- Developer: Cursor CLI
- Chief approval: This work was explicitly approved on 2026-09-29. Deployment and merge remain separate actions.
- Current result: [33-result-commit.md](33-result-commit.md) · [32-precommit-audit.md](32-precommit-audit.md) · [31c-result-functional-4s.md](31c-result-functional-4s.md) · meters [31b-result-meter-4s.md](31b-result-meter-4s.md) · queue [22-task-queue.md](22-task-queue.md)

Comparison scope: one rider and two riders only. Larger groups require a separate instruction.

Harness evidence hygiene: committed `task30b/30c/31a *.summary.json` keep scenario metrics/pass counts; full raw dumps (`task30*.json` / `task31a-fallback-4s.json` without `.summary`) remain **local-only**. Class **C** MapHud/theme/relay-ignore left dirty uncommitted.

Next: optional TASK-29 / **R1** merge / **R2** deploy (legacy Written delete). **No push from Developer.**

Scope: reduce Firestore amplification first, then evaluate RTDB rate and adaptive publication with replay evidence. Preserve previous relay history and do not deploy.
