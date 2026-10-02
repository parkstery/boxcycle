# TASK-05R — docs range diff 정정

Owner: Cursor CLI Developer. [18 검수](18-review-final-audit.md)의 범위만 수행하라.

- `document/ops/20261003-focus-read-spike/**`의 `git diff --check main2..HEAD` 경고를 제거한다. 내용 의미는 바꾸지 않는다.
- `17-result-final-audit-commit.md`에 최종 docs commit, range check 결과, 보존된 stale WIP 복구 지점(`codex/focus-read-spike-stale-wip`, `stash@{0}`의 이름)을 정정한다.
- README/PROGRESS/ops index를 재검수 대기로 갱신한다.
- `git diff --check main2..HEAD`, `git status`, `git log main2..HEAD`, 제품 commit 파일 범위를 재확인한다.
- docs-only 새 commit을 남긴다. amend/rebase/push/merge/deploy 금지. stash/worktree 내용 변경 금지.
- 결과는 `20-result-docs-range-fix.md`에 작성하고 함께 커밋한다.
