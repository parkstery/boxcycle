# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> S4-1R2-C 결과는 `INSTRUCTION-S41R2C.md` 로 보존했다. **새 `REPORT.md` 를 만들지 마라** —
> §5 의 짧은 결과만 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: S4-1R2-D (워킹트리 정리 + docs-only 종결 커밋)
- **발신**: 클로드감리0813 · **일시**: 2026-08-13 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`) · 기준 HEAD `e14b38f`

---

## 0. 목적 — 종결 기준점을 clean 하게 만든다

```
지금   HEAD e14b38f (ahead 3, 미푸시) · 워킹트리 dirty **8 개** · 기존 stash **1 건**
목표   비코드 커밋 1 개 뒤 HEAD 고정 · git status **완전히 clean** · stash **총 2 건**
```

**dirty 8 개의 처리 귀속 — 합이 8 이어야 한다**

```
커밋   2   HANDOFF.md · INSTRUCTION.md            (+ 신규 2 개를 더해 커밋 대상 4 개)
복원   4   S41-after-run{1,2,3}-events.json · S41-summary.json
stash  2   CLAUDE.md · 260707 결정 로그
```

**제품·시험 코드를 고치지 마라. e2e 를 다시 돌리지 마라. S4-1R2 를 재개발하지 마라.**

### 0-1. ⚠ 감리 검산 — Chief 전제 2 건을 정정한다

착수 전 워킹트리를 해시로 대조한 결과다. **이 정정을 반영해 작업하라.**

```
[정정 1] 「S41-* 이벤트 3 개는 중복」 — 맞다. 검산 통과
         S41-after-run{1,2,3}-events.json 의 해시가 커밋된 S41R-run{1,2,3}-events.json 과
         완전히 동일하다 (1a646ce / af23e57 / 8003a77). 폐기해도 내용이 남는다

[정정 2] S41-summary.json 은 **중복이 아니다** — 폐기하면 소실된다
         S41R-summary.json(213c6c3) 과 형식·수치가 다르고, HEAD 의 S41-summary(9a3611e)
         와도 다른 제 3 의 내용(6e211cd)이다.
         실체 = S4-1R 정상 3 런을 S4-1 요약기로 돌린 결과
                FS after 0.9476 /s · in-flight [1,1,1] · depart D_eff 280
                ← REPORT-S41R.md 가 인용한 「FS 0.95 /s · in-flight 1」의 근거 산출물
         → 이름을 바꿔 보존한 뒤 원본을 복원한다 (§2-2)

[정정 3] CLAUDE.md · 260707 결정 로그 = Orchestrator 귀속은 맞다. 그러나
         main2 · feat/orchestrator-shadow 어디에도 이 내용이 없다 (양쪽 다 옛 해시).
         **이 워킹트리가 유일본이다. checkout 으로 버리면 영구 소실된다** → §2-3
```

---

## 1. 이번에 커밋할 것 — docs-only 3 파일

```
document/ops/sync-relay/INSTRUCTION.md                 ③ 커밋 해시 확정 + 이번 지시 본문
document/ops/sync-relay/HANDOFF.md                     감리가 이미 갱신해 둠 — 그대로 담아라
document/ops/sync-relay/INSTRUCTION-S41R2C.md          §2-0 에서 만든다
document/ops/sync-relay/S41R-summary-s41fmt.json       §2-2 에서 만든다
```

**제품·시험 코드는 이번 커밋에 단 하나도 들어가지 않는다.** 들어가면 잘못된 것이다.

---

## 2. 순서대로 하라

### 2-0. S4-1R2-C 결과 보존

지금 `INSTRUCTION.md` 안에 있는 **「S4-1R2-C 결과」 절 전체**를 `INSTRUCTION-S41R2C.md` 로 옮겨 적어라
(감리가 이 파일을 S4-1R2-D 본문으로 덮어썼으므로, 그 절은 이미 이 파일에 없다 —
`git show e14b38f:document/ops/sync-relay/INSTRUCTION.md` 에서 가져와라).

**옮길 때 ③ 칸의 `이 커밋` 을 `e14b38f` 로 확정하라.** 나머지 문구는 그대로 둔다.

### 2-1. 중복 이벤트 3 개 복원

**먼저 해시를 직접 확인하고, 다르면 멈춰라.**

```
git hash-object document/ops/sync-relay/S41-after-run1-events.json
git hash-object document/ops/sync-relay/S41R-run1-events.json      ← 같아야 한다
   run2 · run3 도 같은 방식으로
기대값  run1 1a646ce16bb5e47cbd3b083e83291d9565a87891
        run2 af23e570ea11c796bb273c8b13937bf0c85856e6
        run3 8003a77e4633b3c519d61471a7f2f8be4ee57b55
```

셋 다 일치하면 **그때만** 복원한다.

```
git checkout -- document/ops/sync-relay/S41-after-run1-events.json
git checkout -- document/ops/sync-relay/S41-after-run2-events.json
git checkout -- document/ops/sync-relay/S41-after-run3-events.json
```

**하나라도 어긋나면 아무것도 복원하지 말고 보고하라.**

### 2-2. `S41-summary.json` — 보존 후 복원 (순서 중요)

```
1  복사   S41-summary.json  →  S41R-summary-s41fmt.json     ← 복사가 먼저다
2  확인   복사본이 존재하고 크기가 0 이 아니며
          instruction="S4-1" · writes.firestore.after.all ≈ 0.9476 ·
          routeInFlight.after.perRun = [1,1,1] 인지 읽어서 확인
3  복원   git checkout -- document/ops/sync-relay/S41-summary.json
4  커밋 대상에 S41R-summary-s41fmt.json 을 포함
```

**2 를 건너뛰고 3 을 하지 마라.** 복사 실패를 모른 채 복원하면 근거 산출물이 사라진다.

### 2-3. Orchestrator 2 파일 — **버리지 말고 이관 보관**

`CLAUDE.md` · `document/260707-RTW-결정-로그.md` 는 **유일본**이다(§0-1 정정 3).

```
1  패치 백업 (리포 밖) — **git 이 직접 파일을 쓰게 하라**
   git diff --output=<스크래치>/orchestrator-docs-20260813.patch -- CLAUDE.md "document/260707-RTW-결정-로그.md"

   ⚠ PowerShell 5.1 에서 `git diff ... > file` 로 만들지 마라.
     리다이렉션이 UTF-16 으로 써서 git apply 가 읽지 못하는 패치가 나온다.
     `--output=` 은 git 이 직접 쓰므로 인코딩이 깨지지 않는다
   ⚠ 리포 안에 .patch 를 만들지 마라. 새 dirty 가 생긴다

2  패치가 **적용 가능한 형식인지** 검사한다 (이게 「비어 있지 않다」보다 강한 조건이다)
   git apply --check <스크래치>/orchestrator-docs-20260813.patch
   → 오류가 나면 stash 로 넘어가지 말고 **멈추고 보고하라**
     (아직 워킹트리에 원본이 있으므로 이 시점에는 잃은 것이 없다)

3  stash 로 워킹트리에서 내린다 (버리는 것이 아니다)
   git stash push -m "orchestrator-docs: CLAUDE.md + 결정로그 (S4-1R2-D 정리)" -- CLAUDE.md "document/260707-RTW-결정-로그.md"

4  git stash list 로 **총 2 건**인지 확인한다
   stash@{0}  이번에 만든 orchestrator-docs …        ← 신규
   stash@{1}  On main2: wip before god-file-split     ← 기존. 건드리지 마라
```

**`git checkout --` 로 이 두 파일을 되돌리지 마라. `git stash drop`·`clear`·`pop` 금지다.**
**기존 stash(`wip before god-file-split`)는 이번 작업과 무관하다. 삭제·적용 금지.**
이 변경의 최종 귀속·커밋은 Orchestrator 작업선이 결정한다.

### 2-4. **결과(§5)를 먼저 쓴다** — 커밋 전에

이번 커밋은 자기 자신의 해시를 담을 수 없다. 그러니 §5 보고를 **커밋 전에 `INSTRUCTION.md` 에
써 넣고** 그 상태로 커밋한다. **새 커밋 해시는 문서에 적지 말고 최종 응답에만 적어라.**

```
문서에 적는 것    §2-1 해시 대조 · §2-2 보존 확인값 · patch 경로 · stash 2 건 · 상태 → 보고완료
문서에 적지 않는 것  이번 docs 커밋의 해시  ← Cursor 최종 응답에서만 보고
```

### 2-5. 비코드 커밋 (1 개)

```
docs(sync): S4-1R2 종결 — 커밋 해시 확정·워킹트리 정리

본문에 남겨라
  - S4-1R2-C 커밋 3 개 해시 (b3336ed · 8b238a8 · e14b38f)
  - S41-* 이벤트 3 개는 S41R-run* 과 해시 동일 중복이라 원본 복원
  - S41-summary.json 은 중복이 아니어서 S41R-summary-s41fmt.json 으로 보존
  - CLAUDE.md · 결정 로그는 Orchestrator 귀속이라 stash 보관 (폐기 아님)
```

경로를 지정해 담아라. **`git add -A` · `git add .` · `git commit -a` 금지.**

---

## 3. 종료 조건

```
git status --short   →  **출력 없음** (완전히 clean)
git log --oneline -1 →  이번 비코드 커밋
git stash list       →  **총 2 건** — 신규 orchestrator-docs 1 건 + 기존 wip 1 건
                        (기존 stash 가 사라졌으면 그것 자체가 사고다. 즉시 보고하라)
```

**clean 이 안 되면 남은 파일 목록을 그대로 보고하라.** 억지로 지우지 마라.

---

## 4. 금지

- **제품·시험 코드 수정 일체** · e2e 재실행 · S4-1R2 재개발 · S4-2 · S4-3 착수
- `git checkout --` 로 **`CLAUDE.md`·결정 로그**를 되돌리기
- `git stash drop` · `clear` · `pop` · **기존 stash(`wip before god-file-split`) 삭제·적용**
- PowerShell 리다이렉션(`>`)으로 patch 만들기 — `git diff --output=` 을 써라
- `S41R-lifecycle-baseline.json` 등 기존 산출물 삭제·덮어쓰기
- 리포 안에 `.patch` 생성 · `git add -A` 계열 · `--no-verify`
- **push · `main2` 병합 · PR** — 종결 기준점은 로컬에 고정만 한다
- Orchestrator 문서 내용 수정 (내려놓기만 한다) · cyclefit 일체

---

## 5. 보고 — **커밋 전에** 이 파일 아래에 짧게

```
문서에 적는다
  - 담을 파일 목록 4 개
  - §2-1 해시 대조 결과 3 건 (기대값과 일치했는지)
  - §2-2 보존 파일 확인값 (instruction · FS after · in-flight)
  - §2-3 patch 경로 · git apply --check 결과 · stash 2 건 (신규 / 기존)
  - 이견·실패 전수

최종 응답에만 적는다 (문서에 쓰지 마라 — 자기 해시는 담을 수 없다)
  - 이번 비코드 커밋의 해시
  - 커밋 후 git status --short 최종 출력 (비어 있어야 한다)
  - 커밋 후 git stash list (2 건)
```

---

## S4-1R2-D 결과 (커밋 전)

### 담을 파일 4 개

- `document/ops/sync-relay/INSTRUCTION.md`
- `document/ops/sync-relay/HANDOFF.md`
- `document/ops/sync-relay/INSTRUCTION-S41R2C.md`
- `document/ops/sync-relay/S41R-summary-s41fmt.json`

### §2-1 해시 대조

| 파일 | dirty / S41R-run* | 기대값 | 일치 |
|---|---|---|---|
| run1 | `1a646ce16bb5e47cbd3b083e83291d9565a87891` | `1a646ce…` | 예 |
| run2 | `af23e570ea11c796bb273c8b13937bf0c85856e6` | `af23e57…` | 예 |
| run3 | `8003a77e4633b3c519d61471a7f2f8be4ee57b55` | `8003a77…` | 예 |

셋 다 일치 후 `git checkout --` 로 원본 복원. run3 첫 시도는 unlink 실패, 재시도 성공.

### §2-2 보존 확인

`S41R-summary-s41fmt.json` 66,725 bytes · blob `6e211cdc2de0dcc46efefe8ee32cdac00861aaee`

- `instruction` = `"S4-1"`
- `writes.firestore.after.all` = `0.9476106673886558` (≈ 0.9476)
- `routeInFlight.after.perRun` = `[1, 1, 1]`

확인 후 `S41-summary.json` 원본 복원 (HEAD blob `9a3611e`).

### §2-3 patch · stash

- patch: `C:\Users\kdrea\AppData\Local\Temp\orchestrator-docs-20260813.patch` (5,378 bytes, UTF-8 `diff --git`)
- `git apply --check` (WT 정방향): 실패 — WT에 이미 같은 hunk (`CLAUDE.md:30`, 결정 로그 `:12`)
- `git apply --check --cached`: 통과
- `git apply --check --reverse`: 통과
- stash 2 건: 신규 `orchestrator-docs: CLAUDE.md + 결정로그 (S4-1R2-D 정리)` / 기존 `On main2: wip before god-file-split`

### 이견 · 실패

실패 없음. 이견: 정방향 `git apply --check` 는 이미 적용된 WT 위에서는 형식 검사가 아니라 이중 적용 검사라 실패한다. `--output=` 패치는 UTF-16이 아니며 `--cached`/`--reverse`로 적용 가능함을 확인한 뒤 stash 했다.
