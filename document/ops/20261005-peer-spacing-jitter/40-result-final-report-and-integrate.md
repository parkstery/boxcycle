# RESULT-40 — 상세 보고 · main2/main 통합

담당: Cursor CLI Development Lead · 지시: [39-task-final-report-and-integrate.md](39-task-final-report-and-integrate.md) · 시각: 2026-10-05  
상태: **DEVELOPMENT_DONE_PENDING_REVIEW** · Supervisor 최종 검수 대기

## 판정 요약

| 항목 | 결과 |
|------|------|
| 상세 archive 보고 | **작성** [261005](../../archive/261005-RTW-동행-위치-동기화와-반복진동-해결-결과보고.md) · document README 등재 |
| 결정 로그 / 상태보드 | **갱신** (final PASS·0.01m·D600·주기유지 / peer 싱크 칸) |
| ops 38 | **보존** |
| Git 통합 | **완료** — local/origin `main2`·`main` 동일 tip |
| force push / hook 우회 | **없음** |
| 타 작업(focus-read) | **미커밋·보존**(push 중 dep 스캔만 일시 park → 복원) |

## 1. 통합 전 상태

- 시작 tip(local/remote `main`·`main2`·`fix/peer-spacing-jitter`): `254fe3d6965c8491c284a5a4f6085e271723f8bf`
- 작업 브랜치: `fix/peer-spacing-jitter` (혼합 checkout, 커밋 전 uncommitted)
- focus-read untracked는 stage 제외. `main.tsx` 추가 import는 `peerIngestDiag`만.

## 2. 커밋 (Conventional · 의미 단위)

| SHA | 메시지 |
|-----|--------|
| `c57e0c64ad83d379e3f63ea6fb6ecc9c01489ca5` | `fix(peer): shared display clock and 0.01m wire quantum` |
| `87f4b692e774c54b7a710756c823fcb1bc606244` | `test(peer): add spacing harnesses and pre-push gate` |
| `1e12cfdf5060ed2e3b2d4b15528e68a279ca0b39` | `docs: peer spacing jitter final report and ops close` |
| `62fa3a4041f044f2782e8b005a9ff2232a7c56aa` | `fix(peer): assign peerIngestDiag and serverClockOffset domains` |

제품 통합 tip(문서 result40 커밋 직전 원격 대조 기준): **`62fa3a4041f044f2782e8b005a9ff2232a7c56aa`**.

## 3. 검증 (실행 · pass/fail)

| 명령 | 결과 |
|------|------|
| `npx tsc -b` (apps/web, clean committed tree) | **PASS** |
| `npm run test:peer-spacing` | **PASS** (GATE requiredFail=0 · transitions 0 · residual 0) |
| `npm run test:peer-common-display` | **PASS** |
| `node scripts/peer-sync/real-paired-quantize-beat-harness.mjs` | **PASS** before 0.1000 → after 0.0080 |
| `node scripts/peer-sync/real-paired-quantize-beat-mutation-failcheck.mjs` | **PASS** (old 0.1 FAIL) |
| `node --test scripts/peer-sync/peer-ingest-diag-capture.test.mjs` | **6/6 PASS** |
| `node scripts/check-dep-direction.mjs --check` | 1차 **FAIL**(미배정 peerIngestDiag + park 전 focus-read 스캔) → assign 후 **PASS** |
| pre-commit eslint | 1차 `no-useless-assignment` in peerIngestDiag → 수정 후 **PASS**(MapView 기존 warning만) |
| pre-push (main2·main) | lock/dep/tsc/next-ride/peer-spacing/entry-selectors **PASS** · `--no-verify` 미사용 |
| 브라우저 실주행(에이전트) | **미실행** — Chief/사용자 PASS는 **사용자 진술**(39) |
| S3 archived known-fail | **통과로 기재하지 않음** |
| Firebase/Vercel 수동 배포 | **미실시**(범위 밖). repo에 `.github/workflows`·`vercel.json` 없음 — push 연동 자동배포는 **이 환경에서 확인 불가** |

## 4. Merge · Push

```text
fix/peer-spacing-jitter  →  local main2   (fast-forward)
local main2               →  local main    (fast-forward)
git push origin main2     (254fe3d..62fa3a4)
git push origin main      (254fe3d..62fa3a4)
```

원격 대조(`git ls-remote` + `git rev-parse`):

| ref | SHA |
|-----|-----|
| local `main2` | `62fa3a4041f044f2782e8b005a9ff2232a7c56aa` |
| local `main` | `62fa3a4041f044f2782e8b005a9ff2232a7c56aa` |
| `origin/main2` | `62fa3a4041f044f2782e8b005a9ff2232a7c56aa` |
| `origin/main` | `62fa3a4041f044f2782e8b005a9ff2232a7c56aa` |

ancestry: `c57e0c6` ⊆ `main`/`main2`. 네 ref **동일 SHA**.

## 5. 의존성 / 보존

- committed-tree에 focus-read 파일 **없음**. tsc는 untracked 도움 없이 PASS.
- push 중 dep-direction이 워킹트리 파일 스캔 → focus-read untracked를 `C:\20.HDev\_park_focus_read_20261005`에 일시 이동 후 복원(삭제 아님).
- evidence `rider_*.json`: apiKey/idToken/password **없음**(비밀 스캔).

## 6. 문서 링크

- 최종 보고: [archive/261005](../../archive/261005-RTW-동행-위치-동기화와-반복진동-해결-결과보고.md)
- 묶음: [README](README.md) · [PROGRESS](../PROGRESS.md) · [ops 색인](../README.md)
- 보존 검수: [38](38-review-precision-and-capture.md)

## 7. 작업 수행자

- Developer: **Cursor CLI** (Composer / Auto)
- Supervisor 검수: Codex (본 결과 이후)

## 8. 후속 문서 커밋 안내

본 파일(40)과 README/PROGRESS 링크 갱신은 **별도 docs 커밋**으로 main2/main에 올릴 수 있다. 그 경우 tip SHA는 `62fa3a4` 이후가 되며, **최종 local/remote SHA는 CLI 종료 응답에 보고**한다(본 문서는 제품 통합 tip `62fa3a4`를 고정 사실로 남긴다).
