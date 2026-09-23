---
name: ops-relay-auto
description: >-
  document/ops 릴레이 자동 착수. 지시 파일이 올라오면 Chief「계속」없이 즉시 수행.
  Local First Ride(20260923-first_ride)·await-next·NEXT 수신·수행결과·핸드오프 대기가
  언급되거나 개발팀장(커서) 세션이 릴레이를 돌릴 때 사용.
---

# ops-relay-auto — 지시 수신 = 즉시 착수

## 철칙

- **지시가 찍히면 그 자리에서 수행한다.** Chief·사용자「계속」을 기다리지 마라.
- 수신기는 `await-next.mjs` 다. `NEXT` 가 stdout 에 나오면 **본문을 읽고 즉시 구현**.
- `IDLE` 이면 **같은 명령으로 다시 대기**한다. 루프를 끊지 마라.
- `git commit` / `git push` 금지(묶음 README).

## 세션 시작·라운드 종료 직후 (필수)

```bash
node scripts/ops-relay/await-next.mjs document/ops/20260923-first_ride --timeout 14400 --interval 20
```

- 백그라운드로 띄우고 **`notify_on_output` pattern: `^NEXT `** 로 감시한다.
- `NEXT` 알림이 오면 → 지시 전문 정독 → 구현 → 검증 → 캡처 → `지시NN수행결과-*.md` → **다시 await-next**.

### 다른 개발팀장이 미완 지시를 들고 있을 때(핸드오프)

이미 열린 지시(예: 지시04)를 가로채지 않으려면:

```bash
node scripts/ops-relay/await-next.mjs document/ops/20260923-first_ride --ignore-open-at-start --timeout 14400 --interval 20
```

시작 시점의 미완 지시 파일명을 `.relay-handoff-ignore.json` 에 고정하고, **그 이후에 새로 생긴 지시만** `NEXT` 로 내보낸다. 새 지시 수신 시 ignore 파일은 자동 삭제된다.

## 루프

```
await-next(notify) → NEXT → 즉시 수행 → PROGRESS.md → 수행결과 → await-next …
```

1. `PROGRESS.md` 에 착수·진전·막힘 한 줄(UTF-8). 최소 10분에 한 줄.
2. 작업 중 `check-amend.mjs` 로 정정 확인. `AMENDED` 면 즉시 반영.
3. 사용자가「중지」라고 명시한 경우만 루프 종료.

## 활성 묶음

`document/ops/20260923-first_ride` — README · 착수브리핑 · `document/260923-RTW-Local-First-Ride-실행계획.md`
