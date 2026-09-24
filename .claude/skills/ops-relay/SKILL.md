---
name: ops-relay
description: document/ops 릴레이 폴더의 지시를 수신·수행한다. Local First Ride(20260923-first_ride)·ops 지시·수행결과·감리 릴레이가 언급되거나 세션이 그 폴더를 다룰 때 사용. Chief 대기 없이 지시 파일 자체가 착수 신호이며, 대기는 await-next 로 블록한다. NEXT 수신 시 즉시 착수.
user-invocable: true
---

# ops-relay — 지시 파일 = 작업 착수

## 철칙

- **지시 파일이 올라오면 즉시 수행한다.** Chief 가「계속」이라고 말할 때까지 기다리지 마라.
- Chief 에게 파일 붙여넣기·심부름을 시키지 마라. 양쪽이 `document/ops/<묶음>/` 을 직접 읽고 쓴다.
- `git commit` / `git push` 는 해당 묶음 README 가 금지하면 하지 마라.
- **자동 착수:** `await-next` 를 백그라운드로 띄운 뒤 **같은 턴에서 AwaitShell(`^NEXT `)로 블록**한다.
  `NEXT` 가 나오면 사용자「계속」없이 즉시 구현한다. 수행결과 후 채팅만 끝내지 말고 다시 대기로 들어간다.

## 착수 전 (매번)

```bash
node scripts/ops-relay/await-next.mjs document/ops/20260923-first_ride --timeout 14400 --interval 20
```

**이것이 기본 동작이다.** 새 지시가 올 때까지 블록하고, 도착하면 **본문까지 찍고** 빠져나온다.
그 자리에서 즉시 수행하라. `IDLE` 로 끝나면 **다시 실행**한다 — 루프를 끊지 마라.
수신과 동시에 `PROGRESS.md` 에 「지시NN 수신」이 자동 기록되어 감리가 수신을 확인한다.

다른 개발팀장이 미완 지시를 들고 있을 때(핸드오프):

```bash
node scripts/ops-relay/await-next.mjs document/ops/20260923-first_ride --ignore-open-at-start --timeout 14400 --interval 20
```

1회만 묻는 `poll-next.mjs` 는 감리용이다.

규칙:

1. `YYYYMMDD-지시NN-*.md` 중, 같은 번호의 `지시NN수행결과*.md` 가 **없는** 가장 높은 NN 이 할 일.
2. 지시 본문에「지시MM 으로 대체」가 있으면 대체된 번호는 건너뛴다(수행결과 없어도 NEXT 아님).
3. 재작업 요구(`수행결과02` 를 쓰라)가 새 지시에 있으면 그 버전으로 보고한다.

## 수행결과 이름

```
20260922-지시NN수행결과-<내용>.md
20260922-지시NN수행결과02-<내용>.md   ← 재작업
```

번호는 **지시에 종속**. 자기만의 일련번호를 만들지 마라.

## 감시 루프 (세션이 살아 있을 때)

대기 중이거나 한 지시를 끝낸 뒤:

```
await-next  →  지시 수행  →  PROGRESS.md 진행 로그  →  지시NN수행결과-*.md  →  await-next …
```

1. `await-next.mjs` 가 지시를 물어다 준다. Chief 호출을 기다리지 마라.
2. 착수 직후·진전마다·막히는 즉시 `PROGRESS.md` 에 한 줄(`HH:MM | 내용`). **최소 10분에 한 줄.**
3. 수행결과를 쓴 **직후 바로 await-next 로 돌아간다.** 감리 판정이 다음 지시로 떨어진다.
4. 사용자가 명시적으로 중지하라고 할 때만 루프를 끊는다.

Chief 는 `node scripts/ops-relay/watch-status.mjs <묶음>` 상황판으로 지켜본다 —
`git diff --stat` 0줄이면 아무 일도 안 한 것으로 보인다.

## 이 묶음 고정 규칙 (활성: `20260923-first_ride`)

- 상세 규약: `document/ops/20260923-first_ride/README.md` · 맥락: 같은 폴더 `20260923-Local-First-착수브리핑.md`
- 요구 기준: `document/260923-RTW-Local-First-Ride-실행계획.md`
- 이전 묶음 `20260923-minimap` · `20260922-new_camera` 는 종결됐다
- 캡처·`git diff --stat -- apps/web/src` 없는「문서만」보고는 실패로 본다.
- 주행 검증 5분·3-strike·브라우저 5분 무진전 시 경로 전환(지시·CLAUDE.md).
