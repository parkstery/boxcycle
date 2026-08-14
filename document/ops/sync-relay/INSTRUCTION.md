# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> 이전 지시(S4-M1R) 본문·결과는 §1-0 에서 `INSTRUCTION-S4M1R.md` 로 보존한 뒤 이 파일을 쓴다.
> 결과는 §8 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: S4-M2 (1 단계 WARNING 채택 문서화 → 원격 기준점 → 2 단계 브랜치)
- **발신**: 클로드감리0814 · **일시**: 2026-08-14 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`) · 기준 HEAD `a2b58ff`

---

## 0. 지금 상태 — 감리가 확인한 사실

```
HEAD            a2b58ff · git status clean · stash 2 건
원격            origin/fix/multiplayer-position-sync = cc64279
fast-forward    가능 (cc64279 는 a2b58ff 의 조상 · 8 커밋 앞섬) ← 확인함
낡은 문서       REPORT.md · 상태보드 · 결정 로그 3 개뿐. 코드·증거는 최신이다
```

**제품·시험 코드를 고치지 마라. e2e 를 다시 돌리지 마라.** 이번은 문서와 Git 작업이다.

---

## 1. 문서를 현재 사실에 맞춘다

### 1-0. 먼저 보존

```
현재 워킹트리의 INSTRUCTION.md (S4-M1R 지시 + 결과)
   → document/ops/sync-relay/INSTRUCTION-S4M1R.md 로 복사 (내용 그대로)
```

### 1-1. `REPORT.md` — 낡은 6 곳 + 부채 3 건

지금 `REPORT.md` 는 S4-M0 이전에 멈춰 있다. **감리가 대조한 어긋남 6 곳이다.**

| 줄 | 현재 기재 | 고칠 값 |
|---|---|---|
| 12 | HEAD `b6aa635` | **`a2b58ff`** |
| 13 | 활성 지시 없음 · S4-1R2-D 보고완료 | **S4-M2 진행 중** (이 지시서) |
| 14 | ahead **4** | **ahead 8** → push 뒤에는 **ahead 0** 으로 다시 고친다 (§4-2) |
| 8 | "motion 경로의 같은 수명주기 공백은 아직 손대지 않았다" | **종결** (`71669a1`) |
| 70–71 | W-1 · W-2 미증명 | **W-1 종결**(motion·route 실측 1/1) · **W-2 는 motion 만**(Δ 37 ms) |
| 82–83 | F-2 미해결 · motion 공백 남음 | **F-2 종결**(`onMotionError` 도달) · motion 공백 해소 |

제목도 바꿔라 — 지금은 route·motion **양쪽** 수명주기가 종결됐다.
UAG 표에 `S4-M0` · `S4-M1` · `S4-M1R` 행을 더하고, `S4-2` 는 「중단」이 아니라 **「대기」**다.

**부채 3 건을 반드시 새로 적어라** (S4-M1R 감리 판정에서 나왔다).

```
W-3  z15-cruise 런1 residualMax 3.534 — 단일런 꼬리 재발
     S3B-3 2.51 → S4-1 4.93 → S4-1R2 2.317 → S4-M1R 3.534
     Chief 의 3 런 중앙값 규칙상 판정은 중앙값 0.784 로 통과.
     이번 변경 탓인지 런 변동인지 미분리
W-2' W-2 는 motion 만 종결. route 는 routeW2=null 로 미종결
     (「route 제품 로직 무수정」을 지킨 결과이므로 위반이 아니다)
W-4  M4 는 수정 전 반례 미획득 — 회귀 가드로 격하.
     같은 Trail 재시작 경쟁은 after 의 deferredSkipTotal=2 로만 증명된다
```

**「멀티라이더 위치 동기화 결함 종결」로 쓰지 마라.** 종결된 것은 **발행 수명주기(route + motion)**다.
S4-2 읽기 증폭 · S4-3 · F-1 이 남아 있다. 이 경계를 문장으로 분명히 하라.

### 1-2. 상태보드 — 기호 갱신

`document/260707-RTW-기능-인벤토리-상태보드.md` 의 3 행이다.

```
38 행    peer 싱크 🔶
117 행   peer 위치·속도 싱크 🔶
           노트가 "간격 문제 미해결(사용자 보고 07-06) … 재확인 필요" 로 **사실과 다르다**
181 행   peer sync 비용·지연 튜닝 🔶
```

프로젝트 규칙은 「기호만 갱신」이다. **이번 3 행에 한해 노트도 현재 사실로 최소 교체하는 것을
허용한다** — 지금 노트는 07-06 기준이라 그대로 두면 틀린 정보가 남는다.

```
바꿀 것   기호 + 한 줄 노트(무엇이 종결됐고 무엇이 남았는지) + 근거 링크
쓰지 말 것 「종결」 단독 표기 — 남은 것(S4-2·S4-3·F-1)을 같은 줄에 적어라
건드리지 말 것 나머지 행 전부. 특히 131·159 행은 이번 작업과 무관하다
```

### 1-3. 결정 로그 — 한 줄 append

`document/260707-RTW-결정-로그.md` 표 맨 위(헤더 `|---|` 바로 아래)에 **한 줄**만 넣어라.

```
| 2026-08-14 | `[Infra]` `[Trail]` | **멀티라이더 발행 수명주기 WARNING 채택(1 단계 종결)** — … |
   이유 한 줄 · 근거 링크(REPORT.md · HANDOFF.md)
```

내용에 반드시 담을 것: route(S4-1R2) + motion(S4-M1R) 양쪽 종결 · WARNING 채택이며 PASS 가 아님 ·
남은 부채 W-2'(route) · W-3 · W-4 · **위치 동기화 전체 종결이 아님**.

### ⚠ 1-3 경고 — stash 와 같은 자리를 건드린다

`stash@{0}` 이 **같은 표의 같은 위치에 1 줄을 추가**해 둔 상태다(Orchestrator 작업선).
지금 우리가 그 자리에 줄을 넣으면 **나중에 그 stash 를 되살릴 때 충돌한다.**

```
지금 할 것    그대로 넣어라. 충돌은 나중에 사람이 두 줄을 나란히 두면 끝나는 종류다
절대 하지 말 것  stash pop · apply · drop · clear  — 어느 것도 하지 마라
보고할 것     「결정 로그 상단 충돌 예정 — stash@{0} 과 같은 자리」를 §8 에 한 줄로 남겨라
```

---

## 2. 비코드 커밋 1 개

담을 파일은 4 개다. 경로를 지정해 담아라.

```
document/ops/sync-relay/REPORT.md
document/ops/sync-relay/INSTRUCTION.md              ← 이 지시서 + §8 결과
document/ops/sync-relay/INSTRUCTION-S4M1R.md        ← §1-0 사본
document/260707-RTW-기능-인벤토리-상태보드.md
document/260707-RTW-결정-로그.md
```

```
docs(sync): 발행 수명주기 1 단계 WARNING 채택 — route·motion 종결·부채 3 건

본문에 남겨라
  - 종결 범위: route(S4-1R2) + motion(S4-M1R) 발행 수명주기 · F-2
  - 미종결: S4-2 읽기 증폭 · S4-3 · F-1 · W-2'(route) · W-3(cruise 꼬리) · W-4(M4 대조 부재)
  - 커밋 해시 71669a1 · 41c2ea2 · a2b58ff
```

**`git add -A` · `git add .` · `git commit -a` 금지.** `--no-verify` 금지.
커밋 뒤 `git status --short` 가 비어야 한다.

---

## 3. 원격 확인 → push

### 3-1. 먼저 확인만 하라

```
git fetch origin
git rev-parse origin/fix/multiplayer-position-sync
git merge-base --is-ancestor origin/fix/multiplayer-position-sync HEAD
   → 0 이 아니면 **멈추고 보고하라.** 남이 원격을 움직인 것이다
```

감리 확인 시점 원격은 `cc64279` 였다. **다르면 그 자체가 보고 대상이다.**

### 3-2. push

```
git push origin fix/multiplayer-position-sync
```

**`--force` · `--force-with-lease` 금지. rebase · reset 금지. `main2` 병합 · PR 생성 금지.**
fast-forward 가 안 되면 **아무것도 강제하지 말고 멈추고 보고하라.**

인증 프롬프트가 뜨면 자격증명을 저장하려 하지 말고 **멈추고 보고하라.**

### 3-3. push 뒤 REPORT 의 ahead 를 0 으로

§1-1 표의 14 행을 **ahead 0 (원격 반영 완료)** 으로 고치고, 이 수정은 §2 커밋에 이미 넣을 수
없으므로 **§4 브랜치 생성 전에 같은 파일에 반영해 두 번째 문서 커밋 1 개**로 담아라.

```
docs(sync): 원격 기준점 반영 — ahead 0
```

---

## 4. 2 단계 브랜치 생성

push 가 성공한 **뒤에만** 만든다.

```
git switch -c fix/multiplayer-read-amplification
   ← 기준은 방금 push 한 커밋. 아무것도 커밋하지 마라. push 하지 마라
```

만들기만 하고 **그 브랜치에서 작업을 시작하지 마라.** S4-2 착수는 별도 지시다.
브랜치를 만든 뒤 `git status` 가 clean 인지 확인하라.

---

## 5. 종료 조건

```
git status --short   →  출력 없음
git log --oneline -1 →  두 번째 문서 커밋 (ahead 0 반영)
git branch --show-current  →  fix/multiplayer-read-amplification
원격 fix/multiplayer-position-sync  →  로컬 문서 커밋과 동일 해시
git stash list       →  총 2 건 (신규·기존 그대로)
```

---

## 6. 금지

- **제품·시험 코드 수정 일체** · e2e 재실행 · S4-2 착수 · S4-3 혼입
- `--force` 계열 push · **rebase · reset** · `main2` 병합 · **PR 생성**
- **stash 조작**(`pop` · `apply` · `drop` · `clear`) — 결정 로그 충돌은 나중 일이다
- `git add -A` 계열 · `--no-verify` · Orchestrator 문서(`CLAUDE.md`) 접촉
- 상태보드에서 이번 3 행 외의 행 수정
- **「멀티라이더 위치 동기화 결함 종결」 표기** · **자동감리 완료를 사실과 다르게 표기**

---

## 7. 막히면

원격이 `cc64279` 가 아니거나, fast-forward 가 거부되거나, 인증이 막히면
**강제하지 말고 멈추고 관측치를 그대로 보고하라.** 기준점은 로컬에 이미 안전하게 있다.

---

## 8. 보고 — 이 파일 아래에 짧게

```
문서에 적는다
  - REPORT 에서 고친 6 곳 · 새로 적은 부채 3 건
  - 상태보드에서 바꾼 3 행 (전 → 후 기호)
  - 결정 로그에 넣은 한 줄 · **stash@{0} 과 충돌 예정** 한 줄
  - 원격 확인값 (fetch 뒤 origin 해시 · ancestor 판정)
  - 이견·실패 전수 — 없으면 「없음」

최종 응답에만 적는다
  - 문서 커밋 2 개 해시 · push 결과 (원격 전 → 후 해시)
  - 현재 브랜치명 · 최종 git status --short · git stash list (2 건)
```

---

## 8. 결과 — S4-M2 (2026-08-14) · 보고완료

제품·시험 코드 무수정. e2e 미재실행. S4-2 착수 없음.

### REPORT 고친 6 곳 · 부채 3 건

| 곳 | 전 | 후 |
|---|---|---|
| 제목·서문 | route만 종결 · motion 공백 | route·motion **발행 수명주기** 종결. 위치 동기화 전체 종결 아님 |
| HEAD | `b6aa635` | `a2b58ff` |
| 활성 지시 | 없음 · S4-1R2-D 보고완료 | **S4-M2 진행 중** |
| ahead | 4 | **8** (push 뒤 두 번째 커밋에서 0) |
| W-1 · W-2 | 미증명 | **W-1 종결**(motion 1 · route 1) · **W-2 motion만** Δ 37 ms |
| F-2 · motion 공백 | 미해결 | **F-2 종결**(`onMotionError`) · 공백 해소 `71669a1` |

UAG 표에 S4-M0 · S4-M1 · S4-M1R 추가. S4-2 「중단」→「대기」.

새 부채: **W-3** (cruise 런1 residualMax 3.534 꼬리) · **W-2'** (route `routeW2=null`) · **W-4** (M4 수정 전 반례 미획득).

### 상태보드 3 행

| 행 | 전 기호 | 후 기호 |
|---|---|---|
| 38 mindmap `peer 싱크` | 🔶 | 🔶 (부분/미진 유지 — 수명주기 닫힘, 읽기·F-1 남음) |
| 117 `peer 위치·속도 싱크` | 🔶 | 🔶 · 노트: 07-06 간격 미해결 → WARNING 채택 + 잔여 S4-2·S4-3·F-1 |
| 181 `peer sync 비용·지연 튜닝` | 🔶 | 🔶 · 노트: 지연·쓰기는 S4-1 유지, 남은 과제는 S4-2·S4-3 |

### 결정 로그

표 상단에 2026-08-14 `[Infra]` `[Trail]` **멀티라이더 발행 수명주기 WARNING 채택(1 단계 종결)** 한 줄.

**결정 로그 상단 충돌 예정 — stash@{0} 과 같은 자리.** pop·apply·drop·clear 하지 않음.

### 원격 확인 (fetch 뒤)

- `origin/fix/multiplayer-position-sync` = `cc64279a89ce9ed58b03a16dca16fe33a53cdb37`
- `merge-base --is-ancestor origin/... HEAD` exit **0** (조상 맞음 · FF 가능)
- 로컬은 해당 원격보다 8 커밋 앞섬 (a2b58ff … b3336ed)

### 이견·실패

없음.
