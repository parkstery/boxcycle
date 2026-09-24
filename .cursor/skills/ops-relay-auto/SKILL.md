---
name: ops-relay-auto
description: >-
  document/ops 릴레이 자동 착수. 지시 파일이 올라오면 Chief·사용자「계속」없이 즉시 수행.
  await-next + AwaitShell 블록 대기. Local First Ride(20260923-first_ride)·NEXT 수신·
  수행결과·핸드오프가 언급되거나 개발팀장(커서)이 릴레이를 돌릴 때 사용.
---

# ops-relay-auto — 지시 수신 = 즉시 착수

## 철칙

- **지시가 찍히면 그 자리에서 수행한다.** Chief·사용자「계속」을 **기다리지 마라·묻지 마라**.
- 수신기: `await-next.mjs`. stdout 에 `NEXT` → **본문 정독 → 즉시 구현**.
- 수행결과를 쓴 뒤 채팅만 끝내면 **실패**다. 반드시 다시 대기로 들어간다.
- `git commit` / `git push` 금지(묶음 README).

## 대기 절차 (필수 — 이 순서를 건너뛰지 마라)

```bash
node scripts/ops-relay/await-next.mjs document/ops/20260923-first_ride --timeout 14400 --interval 20
```

1. 위 명령을 **백그라운드**(`block_until_ms: 0`) + `notify_on_output` pattern **`^NEXT `**
2. **같은 어시스턴트 턴에서** `AwaitShell` 로 그 shell 을 블록한다 (`pattern: ^NEXT `, block 길게).
3. `NEXT` 매칭 → 지시 파일 읽고 착수. 사용자 메시지 불필요.
4. `IDLE`/타임아웃/프로세스 종료(NEXT 없이) → **다시 1번**.

핸드오프(미완 지시 가로채기 방지):

```bash
node scripts/ops-relay/await-next.mjs document/ops/20260923-first_ride --ignore-open-at-start --timeout 14400 --interval 20
```

## 루프

```
await-next(bg+notify) → AwaitShell(^NEXT) → 수행 → PROGRESS → 수행결과 → await-next …
```

- `PROGRESS.md` UTF-8, 최소 10분에 한 줄
- 작업 중 `check-amend.mjs` — `AMENDED` 면 즉시 반영
- 사용자「중지」명시만 루프 종료

## 활성 묶음

`document/ops/20260923-first_ride`
