---
name: ops-relay
description: document/ops 릴레이 폴더의 지시 파일을 폴링·수행한다. 카메라 작업(20260922-new_camera)·ops 지시·수행결과·감리 릴레이가 언급되거나 세션이 그 폴더를 다룰 때 사용. Chief 대기 없이 지시 파일 자체가 착수 신호다.
user-invocable: true
---

# ops-relay — 지시 파일 = 작업 착수

## 철칙

- **지시 파일이 올라오면 즉시 수행한다.** Chief 가「계속」이라고 말할 때까지 기다리지 마라.
- Chief 에게 파일 붙여넣기·심부름을 시키지 마라. 양쪽이 `document/ops/<묶음>/` 을 직접 읽고 쓴다.
- `git commit` / `git push` 는 해당 묶음 README 가 금지하면 하지 마라.

## 착수 전 (매번)

```bash
node scripts/ops-relay/poll-next.mjs document/ops/20260922-new_camera
```

출력이 `IDLE` 이면 새 지시 없음. `NEXT <path>` 이면 그 지시 파일을 **읽고 바로 수행**한다.

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

1. `poll-next.mjs` 를 돌린다.
2. `NEXT` 면 즉시 착수.
3. `IDLE` 이면 60~120초 후 다시 폴링(Shell `block_until_ms` 또는 AwaitShell). Chief 호출을 기다리지 마라.
4. 사용자가 명시적으로 중지하라고 할 때만 루프를 끊는다.

## 이 묶음 고정 규칙 (`20260922-new_camera`)

- 상세 규약: `document/ops/20260922-new_camera/README.md`
- 캡처·`git diff --stat -- apps/web/src` 없는「문서만」보고는 실패로 본다.
- 주행 검증 5분·3-strike·브라우저 5분 무진전 시 경로 전환(지시·CLAUDE.md).
