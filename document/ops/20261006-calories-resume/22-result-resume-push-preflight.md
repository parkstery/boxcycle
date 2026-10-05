# RESULT-22 — 원격 push 재개 preflight (검증만 · push 미실시)

담당: Cursor CLI Development Lead · 지시: [21-task-resume-push.md](21-task-resume-push.md) · 시각: 2026-10-06  
상태: **DEVELOPMENT_DONE_PENDING_REVIEW** · push·commit 금지 준수 · Supervisor 검수 대기

## 판정 요약

| 항목 | 결과 |
|------|------|
| `main2` ≡ HEAD · upstream `origin/main2` | **확인** — tip `442d488`, base `f093c15`, ahead 11 |
| 실제 pre-push 해당 게이트 (focus-read park 후) | **PASS** (아래 §3) |
| 현재 dirty 워킹트리에서 dep-direction | **FAIL exit 2** — 타 작업 untracked lib 3개 미지정 |
| `functions/lib` | **생성 대상** (`tsc` emit · `functions/.gitignore`의 `lib/`) — `npm run build` **PASS**, `routeTokenCore.js` 존재 |
| `check-document-system` | **PASS** (brokenLinks 0) |
| `git diff --check origin/main2..main2` | **FAIL exit 2** — `20-result-integrate-push.md:3` trailing whitespace |
| 원격 push / commit / force / `--no-verify` | **미실시** (지시) |
| 타 작업 보존 | **확인** — focus-read untracked 11 + 지시21 파일 잔존 |

**원격 push 직전 조건:** focus-read untracked를 디스크에서 치운 뒤(또는 별도 worktree)에 push하면 pre-push 본문은 통과 가능. 다만 범위 `diff --check`는 result20 L3 공백을 먼저 정리해야 통과한다(훅 밖 추가 검사).

## 1. ref · 범위

| ref | SHA |
|-----|-----|
| local `main2` / HEAD | `442d4882205dcb7d95d60e12e680ff3a9eddd1cd` |
| upstream | `origin/main2` |
| `origin/main2` (base) | `f093c15ce97782dbbbcc552a1dd9dc59c3974450` |
| `origin/main` | `f093c15ce97782dbbbcc552a1dd9dc59c3974450` (미갱신) |
| range | `origin/main2..main2` = 11 commits · 파일 243 |

커밋 목록(최신→base): `442d488` … `03f8b19` (결과20 승인 체인과 동일 tip).  
변경 touch: web `.ts/.tsx` 40 · `dep-layers.json` · `functions/src/*.ts` 3 · `conquestTiles.ts` 포함. `package*.json`·`firebase*.json` **없음** → lock/harness는 실제 훅에서 skip.

시작 브랜치 `codex/document-system` tip도 `442d488`로 main2와 동일했음 → `git switch main2` 후 검증.

## 2. 타 작업 보존 (untracked)

검증 종료 시 porcelain (tracked 변경 없음):

- `apps/web/e2e/focus-read-visibility-audit.spec.ts`
- `apps/web/scripts/ride-hierarchy/visibility-resume-fetch-contract.test.ts`
- `apps/web/src/lib/activity/visibilityResumePolicy.ts`
- `apps/web/src/lib/debug/focusReadFetchMeters.ts`
- `apps/web/src/lib/debug/installFocusReadFetchDebug.ts`
- `document/ops/20261003-focus-read-spike/00-brief.md` … `05-result-focus-read-fix.md` (6)
- `document/ops/20261006-calories-resume/21-task-resume-push.md`

focus-read 쪽 11개는 결과20과 동일하게 보존. 게이트 실행 중 잠시 park → 복원 완료. `peer-spacing`이 쓴 `residual-peer-jitter-metrics.json`은 `git checkout --`로 되돌림.

## 3. 게이트 결과 (로그: `.out/gate-*.log`)

환경: 루트 `npm install` 필요했음 — `apps/web/node_modules`가 사실상 비어 `npx tsc`가 stub로 실패. 의존 복구 후 재실행. `functions`도 `npm install` + `npm run build`.

| # | 게이트 | 이번 range 훅 동작 | exit | 비고 |
|---|--------|-------------------|------|------|
| 1 | lock 동기 | skip (명시 실행) | **0** | |
| 2 | harness 동기 | skip (명시 실행) | **0** | |
| 3 | dep-direction `--check` | run | **0** (park 후) / **2** (dirty) | dirty: 미지정 `visibilityResumePolicy`·`focusReadFetchMeters`·`installFocusReadFetchDebug`. park 후 깨진 상대경로 0 · baseline 통과 |
| 4 | web `tsc -b --noEmit` | run | **0** | |
| 5 | `test:next-ride` | run | **0** | 338 pass / 0 fail / 4 todo |
| 6 | `test:peer-spacing` | run | **0** | GATE PASS · requiredFail=0 |
| 7 | `test:entry-selectors` | run | **0** | 15/15 |
| 8 | functions `npm test` | run | **0** | build+계약 36 pass |
| + | Claim `test:conquest-cells` | run (`conquestTiles` touch) | **0** | 4 pass |
| + | `check-document-system.mjs` | 지시 추가 | **0** | brokenLinks 0 |
| + | `diff --check origin/main2..main2` | 지시 추가 | **2** | 아래 §4 |

`githooks/pre-push`를 Git bash로 한 번에 돌리면 PATH/`npx` stub로 tsc가 깨짐(`.out/gate-pre-push-full.log`). PowerShell에서 훅과 동일 명령을 개별 실행한 결과가 위 표.

결과20의 `functions/lib/routeTokenCore.js` 미해석은 **빌드 산출물 부재** 유형. `functions/package.json`의 `"build": "tsc"` / `"main": "lib/index.js"` · `.gitignore` `lib/` 확인. 정상 빌드 수행 후 파일 존재 · M0「깨진 상대경로」0.

## 4. 실패·최소 수정안 (코드 미수정)

### A. dirty 워킹트리 dep-direction FAIL (exit 2)

- **원인:** 타 작업 untracked lib 3개가 `dep-layers.json` 미등록. 커밋 범위 문제가 아님.
- **최소 조치(push 시):** focus-read 파일을 임시 이동하거나 깨끗한 worktree에서 `git push`. dep-layers에 focus-read를 넣는 것은 **타 작업 범위**라 이번 승인 체인에서 하지 말 것.

### B. `diff --check` FAIL (exit 2)

- **원인:** `document/ops/20261006-calories-resume/20-result-integrate-push.md` 3행 끝 trailing space(마크다운 강제 줄바꿈용 2칸).
- **최소 수정:** 해당 행 trailing whitespace 제거 후 docs 전용 커밋(또는 amend 금지라면 새 docs 커밋). **pre-push 훅에는 없음** — 원격 거부 사유는 아님.

### C. 환경

- 워크스페이스 `node_modules` 링크 붕괴 시 `npx tsc`가 가짜 성공/실패. push 전 루트 `npm install` 확인.

## 5. 한계 (유지)

실 Firebase · 다중 탭 · 전체 App e2e · hosting 배포 · `main` 갱신 — 미실시([18](18-review-supervisor.md)·결과20과 동일).

## 6. 후속 (Supervisor)

1. focus-read untracked를 치운 상태(또는 clean worktree)에서 `git push origin main2` (hooksPath=`githooks`, `--no-verify` 금지).
2. 선택: result20 L3 trailing whitespace 정리 커밋.
3. 이번 Cursor 실행은 push·commit 하지 않음.
