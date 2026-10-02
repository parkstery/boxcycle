# TASK-06 — main2 fast-forward 통합

Owner: Cursor CLI Developer. [21 최종 승인](21-review-final-approval.md)을 읽고 수행하라.

1. 현재 branch와 working tree clean, `main2`가 `ae498b7`, `codex/focus-read-spike`가 그 직계 후손인지 확인한다.
2. 본 승인·지시·상태판을 docs-only commit으로 `codex/focus-read-spike`에 남긴다.
3. `main2`로 전환해 `git merge --ff-only codex/focus-read-spike` 한다. 충돌·비 fast-forward면 중단한다.
4. `git diff --check origin/main2..HEAD`, `git status`, commit 범위와 제품 `e2a49e2` 포함 여부를 확인한다.
5. 결과를 `23-result-merge-main2.md`에 쓰고 상태판을 `APPROVED`로 갱신한 뒤 docs commit을 `main2`에 남긴다.

push, deploy, production Firebase 접속, stash/worktree 변경, amend/rebase/force 금지.
