# Result 05 — 최종 감사·전용 브랜치 커밋

| 항목 | 내용 |
|---|---|
| 상태 | DEVELOPMENT_DONE |
| 지시 | [16-task-final-audit-commit.md](16-task-final-audit-commit.md) · [15 검수](15-review-listener-grace.md) |
| 날짜 | 2026-10-03 |
| Owner | Cursor CLI Developer |
| 브랜치 | `codex/focus-read-spike` |
| 제약 | push · `main2` merge · deploy · production Firebase 접속 없음 |

---

## 결론 요약

TASK-01~04 누적 제품 diff는 계측 · catalog TTL/in-flight · Activity World fresh-resume · listener 10s grace · presence resume throttle 범위에 한정된다. 생성된 `.out`/비밀값은 stage에 넣지 않았다. 지정 검증을 통과한 뒤 전용 브랜치에 제품 커밋과 docs 커밋을 남겼다.

---

## 범위 감사

| 범주 | 판정 |
|---|---|
| visibility/read proxy 계측 (TASK-02/02R) | 포함 — meters · override · repo note 배선 |
| catalog TTL + in-flight (TASK-03) | 포함 — `publishedCatalogRefreshPolicy` · hub |
| Activity World fresh-resume (TASK-03) | 포함 — `activityWorldResumePolicy` · poll/sync |
| listener grace + presence throttle (TASK-04) | 포함 — grace policy/hook · Trail members · world rides · presence write |
| Rules / schema / Functions / RTDB / 경로 의미 | 변경 없음 |
| generated `.out` · emulator data · 로그 · 비밀값 | stage 미포함 (워킹트리에도 `.out/focus-read-spike` 없음) |

제품 외 잔여: ops 묶음·상태판은 아래 docs 커밋으로 분리.

### 브랜치 포인터 · stale WIP 복구 지점

- 작업 직전 `codex/focus-read-spike` = `main2` = `ae498b7` (동일).
- 다른 worktree가 같은 브랜치를 점유하고 있어, 그 WIP를 stash한 뒤 브랜치를 옮긴 다음 본 워크스페이스에서 `codex/focus-read-spike`로 전환했다. 본 TASK-01~04 제품 작업과 무관한 stale WIP이며 본 커밋에 섞이지 않았다.
- **보존된 복구 지점 (드롭·apply·pop·내용 수정 금지):**
  - worktree branch: `codex/focus-read-spike-stale-wip` (base `ae498b7`, worktree `C:/Users/kdrea/.codex/worktrees/focus-read-spike/boxcycle`)
  - stash: `stash@{0}` 이름 `wip-stale-focus-read-spike-before-TASK05` (10 files: `apps/web` 8 + `document/ops/PROGRESS.md` · `document/ops/README.md`)

---

## 검증

| 명령 | 결과 |
|---|---|
| `apps/web`: `npm run test:focus-read-spike` | **PASS** 37/37 |
| `apps/web`: `npm run test:s42-meters` | **PASS** 15/15 |
| `apps/web`: `npm run test:listener-scope` | **PASS** 17/17 |
| `apps/web`: `npm run build` (`tsc -b && vite build`) | **PASS** (기존 riderRig undefined import warning만) |
| repo root: `npm run check:dep` | **PASS** |
| `git diff --check` (working tree only) | **PASS** — 단, range check 근거로는 부족 ([18](18-review-final-audit.md)) |
| `git diff --check main2..HEAD` (TASK-05 직후) | **FAIL** — ops 문서 trailing whitespace · EOF blank-line → [19](19-task-docs-range-fix.md) / [20](20-result-docs-range-fix.md)에서 정정 |
| changed-file `npx eslint` | **PASS** (0 errors · 기존 exhaustive-deps warning 11) |
| E2E `test:e2e:focus-read-spike` | **생략** — [14 결과](14-result-listener-grace.md)에서 포트 5015로 2/2 PASS. TASK-05에서 제품 코드 추가 변경 없음(동일 누적 diff 커밋만). |

---

## 커밋

### 1) 제품

| 항목 | 값 |
|---|---|
| SHA | `e2a49e2c13ed4c5c5065a740ad3508d8c71002f0` |
| 메시지 | `fix(firestore): reduce foreground resume read spikes` |
| 파일 | 38 (`apps/web` only) · +2211 / −229 |
| hooks | pre-commit eslint 통과 (`--no-verify` / amend / force 미사용) |

주요 경로: meters·override · catalog/Activity World resume 정책 · listener grace · presence resume · wiring · `scripts/focus-read-spike/*` · `e2e/focus-read-spike.spec.ts` · `dep-layers.json` · `package.json` scripts.

### 2) docs (기록 체인)

| 항목 | 값 |
|---|---|
| 최초 docs 기록 | `f820c0dde631d779ff414109bce80363b8ffcae8` — `docs(ops): record focus-read-spike final audit commit` |
| SHA 주석 | `5111bf96b69bfda6ac3f76a0051278223d3cb983` — `docs(ops): annotate focus-read-spike docs commit SHA` |
| 최종 docs (range 정정) | TASK-05R 커밋 — [20-result-docs-range-fix.md](20-result-docs-range-fix.md)에 SHA·`git diff --check main2..HEAD` PASS 기록 |

---

## 잔여·금지 준수

- push / `main2` merge / deploy / production 접속: **하지 않음**.
- stash / `codex/focus-read-spike-stale-wip` worktree 내용: **변경·drop·apply·pop 없음**.
- Firebase SDK WebChannel reconnect billed read는 여전히 local proxy로 미계측 — production 재관측은 Chief/배포 후 별도.
- Supervisor 재검수 대기 (TASK-05R 후).
