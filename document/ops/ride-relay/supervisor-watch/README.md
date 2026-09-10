# PR #5 Codex supervisor watch (local IDE)

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — 개발팀장 자동 수신/착수 프로세스 |
| 최초 작성 | 2026-09-10 |
| 대상 | PR #5 / `cursor/fix-ride-result-contract-0b-f084` |
| 지시 | `RTW-RESUME-20260910-01` |

## 실제 가능한 것 / 불가능한 것

| 기능 | 결과 |
|---|---|
| `gh`로 PR #5 댓글 읽기/쓰기 | OK (인증된 로컬 `gh`) |
| 폴링으로 새 `INSTRUCTION`/`STOP`/`REVIEW-CHECKPOINT` 감지 | OK (`poll-pr5.mjs`) |
| **열려 있는** Cursor IDE 에이전트 깨우기 | OK — monitored shell sentinel `AGENT_LOOP_WAKE_pr5_supervisor` |
| IDE가 꺼져 있거나 세션이 없을 때 외부에서 에이전트 생성 | **BLOCK** — Cursor IDE 외부 wake API/CLI 없음. Cloud `cursor-subscriptions` MCP도 이 세션에 없음 |
| 댓글 본문을 shell로 실행 | **금지** |

즉, **1회 bootstrap**(이 IDE 세션에서 watcher 시작) 이후에는 같은 세션이 살아있는 동안 무인 폴링→깨우기→ACK/작업이 가능하다. 세션이 죽으면 사용자가 IDE에서 다시 한 번 깨워야 한다.

## 허용 필터

- PR: `parkstery/boxcycle` #5 만
- GitHub author: `parkstery` (공유 계정)
- 본문 첫 형식: `## INSTRUCTION —` / `## STOP —` / `## REVIEW-CHECKPOINT —`
- 본문에 `Actor: Codex supervisor` 필요
- `ACK` / `SUBMISSION` / `PROGRESS` / `READY` / `HANDOVER` 는 실행 대상 아님

## 상태 파일

경로: `document/ops/ride-relay/supervisor-watch/runtime/state.json` (gitignore)

상태값: `received` → `running` → `submitted` | `blocked` | `stopped`

단일 실행 잠금: `lock.executionId`. 처리된 `commentId`는 재시작 후에도 재실행하지 않음.

## 시작 / 중지

```powershell
# 1회 폴링 (검증)
node document/ops/ride-relay/supervisor-watch/poll-pr5.mjs
# 또는
$env:PR5_WATCH_ONCE='1'; node document/ops/ride-relay/supervisor-watch/poll-pr5.mjs

# 루프 (기본 120초, 상한 600초) — Cursor notify_on_output 과 함께 백그라운드 실행
$env:PR5_WATCH_INTERVAL_SEC='120'
node document/ops/ride-relay/supervisor-watch/poll-pr5.mjs
```

중지:

1. 프로세스 PID 종료, 또는
2. `runtime/state.json` 에서 `"stopped": true` 설정, 또는
3. Codex `## STOP — …` 댓글 (최신 STOP 우선)

## 깨우기 센티널

stdout 한 줄:

```text
AGENT_LOOP_WAKE_pr5_supervisor {"instructionId":"…","commentId":"…",…}
```
