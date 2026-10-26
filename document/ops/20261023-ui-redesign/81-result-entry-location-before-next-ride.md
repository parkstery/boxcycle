# 결과 81 — 위치 선택 전 다음 주행·후속 카드 게이트 (지시80 후속)

| 항목 | 값 |
|---|---|
| 지시 | [80-task-entry-location-before-next-ride.md](80-task-entry-location-before-next-ride.md) |
| Supervisor | Codex (지시80 구현·재검증) |
| Developer | Cursor CLI (지시80 `App.tsx` 게이트·회귀 시험 신설; 후속은 eslint만) |
| 완료 | 2026-10-26 KST (Supervisor 반려 → 재작업 → 최종 감리 **PASS**) |
| 감리 | **LOCAL_VERIFIED** — 기능 커밋 `4549356d`(`fix(entry): sequence location before follow-up cards`)·로고 커밋 `f39f6ee2` 완료(`main2` 로컬, 미푸시·미배포) |

## Supervisor 감리 (최종)

| 항목 | 사실 |
|---|---|
| 1차 구현 | `idleFollowUpCardsEligible`이 `!entryLocationPrompt`만 사용 → `entryLocation.phase === "idle"`(인증 직후 한 프레임)에서 후속 카드 노출 가능. 지시80 §2·§4 미충족 → **FAIL·재작업** |
| 최종 구현 | 공통 게이트 **`entryLocation.phase === "ready"`만** 허용(idle/checking/choice/locating 차단). `entryLocationPrompt`·edgePanel 등 다른 게이트 무변경 → **PASS** |
| Codex 최종 재검증 | 계약시험 **5/5 PASS** · eslint **error 0**(`App.tsx` 기존 warning 7) · `npm run build` **exit 0** · code-tidy **PASS** · dep-direction 위반 **0** · document-system 오류 **0** |
| `test:quick` | 합계 통과 **1365**·기능 실패 **0** — 병렬 실행 중 기존 **entry-location-dom** 1건 **60초 timeout/cancel** → 명령 **exit 1**. quick과 **동일 인자**로 해당 시험 **단독 재실행 1/1 PASS exit 0** |
| Chief 화면 | Work 설정 **Local browser use disabled** — Supervisor 브라우저 현재 탭 직접 검증 불가. **`http://localhost:5000`** HMR 유지 → Chief 직접 확인 가능 |

## Supervisor 반려 → 재작업 (지시81)

- **반려 사유**: `idleFollowUpCardsEligible`이 `!entryLocationPrompt`만 쓰면 `entryLocation.phase === "idle"`(인증 직후 한 프레임)에서 후속 카드가 노출될 수 있어 Chief 지시80 §2·§4를 완전히 만족하지 못함.
- **재작업 조건**: 공통 게이트는 `entryLocation.phase === "ready"`만 허용. idle/checking/choice/locating 전부 차단. `entryLocationPrompt` 변수·다른 게이트(edgePanel 등)는 변경 없음.

## 변경 요약 (지시80·81)

- `apps/web/src/App.tsx`: `idleFollowUpCardsEligible`에서 `!entryLocationPrompt` → `entryLocation.phase === "ready"`.

- `apps/web/scripts/identity/entry-location-idle-followup-contract.test.ts`: ready 직접 요구·`!entryLocationPrompt` 비의존·non-ready 차단 구조 검사(5건, 최초 no-resume·동시 노출 검사 유지).

## 검증·재검증 (사실 기록)

실행 위치: `C:\20.HDev\boxcycle\apps\web`

| 단계 | 명령·내용 | 결과 |
|---|---|---|
| Cursor Developer (지시80) | `npx tsc -b --noEmit` (전체) | **Supervisor가 대기 중 중단** — 완료·exit 코드 미기록 |
| Codex 재검증 | `node --import tsx --test scripts/identity/entry-location-idle-followup-contract.test.ts` | **5/5 PASS** |
| Codex 재검증 | `npx tsc -b --noEmit` | **exit 0** |
| Codex 재검증 (최초) | `npx eslint` 변경 파일 (`App.tsx` + 신규 시험) | 신규 시험 **1 error** (`no-regex-spaces`, 26행) + `App.tsx` **기존 warning 7** (react-hooks/exhaustive-deps) |
| Cursor 후속 (본 결과) | `npx eslint scripts/identity/entry-location-idle-followup-contract.test.ts src/App.tsx` | **error 0**, `App.tsx` warning 7 (변경 없음), exit 0 |
| Cursor 재작업 (지시81) | `node --experimental-strip-types --test scripts/identity/entry-location-idle-followup-contract.test.ts` (`C:\20.HDev\boxcycle\apps\web`) | **5/5 PASS**, exit 0 |
| Cursor 재작업 (지시81) | `npx eslint scripts/identity/entry-location-idle-followup-contract.test.ts src/App.tsx` | **error 0**, `App.tsx` warning 7 (기존, 변경 없음), exit 0 |
| Codex 최종 | `npm run build` | **exit 0** |
| Codex 최종 | code-tidy · dep-direction · document-system | **PASS** · 위반 **0** · 오류 **0** |
| Codex 최종 | `npm run test:quick` | 통과 **1365**·기능 실패 **0**; 병렬 **entry-location-dom** 1건 timeout/cancel → **exit 1** |
| Codex 최종 | entry-location-dom (quick 동일 인자·단독) | **1/1 PASS**, exit 0 |

## 후속 수정 (eslint만)

- `entry-location-idle-followup-contract.test.ts` 26행: `/\n  const [a-zA-Z]/` → `/\n {2}const [a-zA-Z]/` (`no-regex-spaces` 해소, 의미 동일 — 줄바꿈 후 공백 2개 + `const`).

## 미수행

- 푸시·배포·restore·clean·stash·worktree(본 문서 최종 갱신 시점). 로컬 커밋만 완료(기능 `4549356d`·로고 `f39f6ee2`).

## 보존

- 기존 dirty·`document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json` 등 지시80 금지 목록 — **미변경**.

## 다음

- Chief: `http://localhost:5000` 로컬 화면 확인. 푸시·배포는 Chief 별도 지시 대기.
