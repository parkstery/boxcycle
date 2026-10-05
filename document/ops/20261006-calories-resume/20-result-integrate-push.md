# RESULT-20 — 로컬 선택 커밋 · main2 병합 (원격 push 보류)

담당: Cursor CLI Development Lead · 지시: [19-task-integrate-push.md](19-task-integrate-push.md) · 시각: 2026-10-06
상태: **DEVELOPMENT_DONE_PENDING_REVIEW** · Supervisor 검수 대기

## 판정 요약

| 항목 | 결과 |
|------|------|
| 선택 커밋 | **완료** — 승인 범위만 의미 단위 7커밋 (`codex/integrate-approved-20261006` / `codex/document-system`) |
| 로컬 `main2` FF | **완료** — tip = 제품·문서 통합 tip |
| 원격 push | **미실시** (지시: 별도 승인 전 금지) |
| `main` 갱신 | **미실시** (지시) |
| force push / `--no-verify` | **없음** |
| 타 작업 보존 | **focus-read·activity/debug 등 untracked 잔존** |

## 1. 통합 전·후 SHA

| ref | SHA |
|-----|-----|
| 시작 tip (`f093c15`) | `f093c15ce97782dbbbcc552a1dd9dc59c3974450` |
| 제품·증거·공백 정리 tip | `899558029a6354fc71d877ba7b55e98f60ddfe40` |
| result20 기록 후 최종 local tip | CLI 종료 시 `git rev-parse HEAD` (docs 커밋 체인; 본 문서는 제품 tip `8995580` / 코드 tip `61a8f60` 고정) |
| local `main2` | result20 docs 커밋 이후 tip과 동일 (FF) |
| local `codex/document-system` | result20 docs 커밋 이후 tip과 동일 |
| `origin/main2` | `f093c15ce97782dbbbcc552a1dd9dc59c3974450` (미push) |
| `origin/main` | `f093c15ce97782dbbbcc552a1dd9dc59c3974450` (미갱신) |

방법: 깨끗한 worktree `C:\20.HDev\boxcycle-wt-integrate-20261006`에 승인 patch만 복사·커밋 → 게이트 검증 → local `main2`/`codex/document-system` FF. 본 채팅 워킹트리의 focus-read 등 타 작업은 park 후 복원.

## 2. 커밋 (Conventional · 의미 단위)

| SHA | 메시지 |
|-----|--------|
| `03f8b1928e20d30320f476ebb1bfed0744fc1422` | `docs: reorganize RTW documents into reference/ and archive` |
| `1965d775ab583679a505fd1db3d28973ace46251` | `docs: add product value, name, and calories investigation` |
| `12e8cf647af8e0cce9fb253840c777bcd8b31814` | `feat(map): add ride HUD map controls and camera altitude` |
| `813edd6da4b6b7fa744244a7fb2b3ec856c8a093` | `fix(ui): harden saved-route list contrast on Edge` |
| `61a8f60e65df46a2c9cb71b6dbdb88a5a6e82f03` | `feat(ride): MET calorie estimate and single resume slot` |
| `5483ae2a737634209887aac0a954d1bd225b7019` | `docs(ops): track map and readability review evidence under .out` |
| `899558029a6354fc71d877ba7b55e98f60ddfe40` | `docs: strip trailing whitespace in integrate ops notes` |

제품 코드 tip(칼로리·재개·맵 배선 포함): **`61a8f60`**. 문서/증거/공백 정리 후 통합 tip: **`8995580`**.

범위 대조: `git diff --name-only f093c15..HEAD`에 focus-read / `visibilityResume` / `focusRead` / `installFocus` **없음**. GuestEntryCard·conquest·functions·storage 는 문서 경로 주석만(문서 체계). App.tsx/MapView/MapHud/dep-layers 는 승인 작업 hunk만.

## 3. 검증 (clean worktree · pass/fail)

| 명령 | 결과 |
|------|------|
| `npx tsc -b --pretty false` (apps/web) | **PASS** |
| calories+stats contract | **26 pass** |
| resume suite (result-independent + slot-policy + next-ride-target + f2 + n2) | **99 pass** |
| `npm run test:entry-selectors` | **15/15 PASS** |
| `npm run test:next-ride` (.env 링크 후) | **338 pass / 0 fail / 4 todo** |
| `npm run test:peer-spacing` | **GATE PASS** (requiredFail=0) |
| ownership eslint `--max-warnings 0` | **PASS** |
| `node scripts/check-document-system.mjs` (current) | **PASS** (brokenLinks 0; `.out` 증거 force-add 후) |
| `git -c core.safecrlf=false diff --check f093c15..HEAD` | **PASS** (trailing whitespace 정리 후) |
| `node scripts/check-dep-direction.mjs --check` | **FAIL (기존)** — `scripts/route-token/route-token-onboarding-grant.test.mjs` → `functions/lib/routeTokenCore.js` 깨진 상대경로. **f093c15에서도 동일 FAIL**. 이번 변경 원인 아님 |
| 실 Firebase / 다중 탭 / 전체 App e2e | **미실행** — [18 한계](18-review-supervisor.md) 유지 |
| hosting 배포 | **미실시** |

pre-commit: 칼로리 커밋 시 `prefer-const`·fixture export 2건을 최소 수정 후 통과(게이트 우회 없음).

## 4. Merge · Push

```text
codex/integrate-approved-20261006  →  local main2              (fast-forward)
codex/integrate-approved-20261006  →  local codex/document-system (fast-forward)
git push origin …                  (금지 · 미실행)
main                               (미갱신)
```

## 5. 잔여 dirty (본 워킹트리)

승인 커밋에 포함하지 않은 untracked만 남김:

- `apps/web/e2e/focus-read-visibility-audit.spec.ts`
- `apps/web/scripts/ride-hierarchy/visibility-resume-fetch-contract.test.ts`
- `apps/web/src/lib/activity/visibilityResumePolicy.ts`
- `apps/web/src/lib/debug/focusReadFetchMeters.ts`
- `apps/web/src/lib/debug/installFocusReadFetchDebug.ts`
- `document/ops/20261003-focus-read-spike/00-brief.md` … `05-result-focus-read-fix.md`

## 6. 후속

- 원격 push·`main` 반영·hosting 배포는 **별도 승인 지시** 대기.
- result20 docs: `6db62ba4d7b6b77c1dd1ed10280b6c2a5857c8de`. tip SHA 기록 보정: `71d04ff4149e3682682d3b037ff7dd7e8fac607b`. local `main2` / `codex/document-system` 최종 tip = **`71d04ff`**.
