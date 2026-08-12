# RTW AI 오케스트레이션 — Claude 인수인계

| 항목 | 내용 |
|------|------|
| 문서 유형 | **실행** — 1단계 자동 감리 개발 현황·실패 진단·후속 인수인계 |
| 최초 작성 | 2026-08-12 |
| 상태 | **검토됨** (2026-08-12 실행 주체 방침 개정 — §2-1) |
| 연결 문서 | [Claude 구축 가이드](260812-AI-오케스트레이션-Claude-구축-가이드.md), [자문역 프로토콜](../260810-BOXCYCLE_ADVISOR_PROTOCOL.md), [개발 워크플로](260719-개발-워크플로-브랜치-커밋-게이트.md), [sync-relay 지시서](ops/sync-relay/INSTRUCTION.md), [sync-relay 보고서](ops/sync-relay/REPORT.md) |

---

## 1. 이 문서의 목적

오케스트레이션 1단계에서 만들어진 코드를 Claude가 이어받을 수 있도록, 현재 산출물과 실제 동작 상태, 자동 감리가 이어지지 않은 직접 원인, 아직 구현되지 않은 범위를 한곳에 고정한다.

이 문서는 새 구현 지시서가 아니다. Claude가 먼저 사실관계를 복원하고 다음 작업계획·구현 범위·감리 기준을 확정하기 위한 인수인계 기준점이다.

## 2. 2026-08-12 Chief 결정

1. Codex는 오케스트레이션을 포함해 코드를 직접 작성·수정하지 않는다.
2. 오케스트레이터 후속 개발의 책임자는 Claude다. **설계·구현·시험을 Claude가 직접 수행한다**(§2-1).
3. Codex는 Chief의 자문·독립 검토 역할만 수행한다. 저장소 확인은 판단 근거 수집을 위한 읽기 전용 활동으로 한정한다.
4. 자동 Codex 검토 게이트가 장기 목표에 남더라도, 그 게이트의 설계·구현은 Claude 책임 아래 진행하고 자동 호출되는 Codex는 읽기 전용이어야 한다.

## 2-1. 실행 주체 방침 (2026-08-12 개정 — 이 문서의 나머지보다 우선한다)

**오케스트레이터는 Claude가 직접 설계·구현·시험한다.** §2 결정 2항에 있던 “기존 역할 분담을 유지한다면 Cursor가 구현한다”는 단서는 **폐기됐고**, 오케스트레이터 구현을 넘기기 위한 수신용 지시서는 작성하지 않는다.

- 구현·단위 시험·실제 CLI E2E·증거 보존의 실행자는 모두 Claude다.
- 오케스트레이터는 어떤 후속 actor(Cursor 포함)도 자동 실행하지 않는다. 그 배선은 Chief 승인 없이는 열지 않는다.
- 이 개정은 **오케스트레이터 개발**에만 적용된다. `sync-relay` 등 **제품 작업선의 역할 분담은 그대로**이며, 본문의 「개발 담당·개발 구현」은 특정 도구를 지정하지 않는 일반 명사다.
- 상세 방침은 [구축 가이드 §0](260812-AI-오케스트레이션-Claude-구축-가이드.md)과 같다.

## 3. 원래 목표와 1단계 실제 범위

### 3.1 장기 목표

장기 목표는 다음 전체 흐름을 결정론적 프로그램으로 연결하는 것이다.

```text
Claude 계획·지시
→ Codex 읽기 전용 검토
→ Chief 승인·결정
→ 개발 구현·REPORT 작성
→ 기계 검증
→ Claude 자동 감리
→ Codex 읽기 전용 재검토
→ Chief 최종 검토
```

Orchestrator 자체는 판단하는 AI가 아니라 상태·hash·lock·actor 실행·결과 검증을 담당하는 프로그램이어야 한다.

### 3.2 현재 만들어진 1단계

현재 구현은 전체 Orchestrator가 아니다. `sync-relay` 한 작업선에서 아래 한 구간만 시험한 좁은 수직 절편이다.

```text
개발 담당이 REPORT.md 작성
+ INSTRUCTION.md 상태를 보고완료로 변경
→ 별도 감시 프로세스가 파일을 주기적으로 확인
→ Claude CLI를 읽기 전용으로 호출
→ AUDIT.md 생성
```

Claude 지시 작성 자동화, 후속 actor 실행, Chief 승인 상태, 기계 검증, Codex 자동 검토, task별 worktree, 전체 상태 머신은 구현되지 않았다.

## 4. 현재 산출물

> **갱신(2026-08-12)**: 아래 표는 인수인계 작성 시점의 PoC(`scripts/claude-report-audit.mjs`·`.rtw-audit/`·`claude-audit:*`) 상태다.
> 이 PoC는 `feat/orchestrator-shadow` 브랜치에서 `scripts/orchestrator/audit.mjs`·`.orchestrator/`·`orchestrator:*` 로 **대체됐다**.
> 새 러너의 재현 명령은 §11 을 보라.

| 파일 | 역할 | 현재 Git 상태(인수인계 작성 시점) |
|------|------|------|
| `scripts/claude-report-audit.mjs` | 감리 조건 판정, Claude CLI 호출, 결과·상태 기록, `once/watch/doctor` CLI | 미추적 |
| `scripts/claude-report-audit.test.mjs` | 상태 파싱·미완료 대기·중복 방지·REPORT 변경 재감리 단위 테스트 4건 | 미추적 |
| `package.json` | `claude-audit:doctor/once/watch`, `test:claude-audit` 명령 등록 | 수정됨 |
| `.gitignore` | 로컬 런타임 상태 `.rtw-audit/` 제외 | 수정됨 |
| `CLAUDE.md` | 자동 감리 Claude가 사용할 읽기 전용 Git 명령 규칙 | 수정됨 |
| `document/ops/sync-relay/AUDIT.md` | 2026-08-11 S3A에 대해 생성된 이전 Claude 감리 결과 | 미추적 |
| `.rtw-audit/state/sync-relay.json` | 마지막 처리 hash·판정·시각을 담는 로컬 상태 | ignored |
| `.rtw-audit/runs/*.json` | Claude 원본 출력과 실행 기준점 기록 | ignored |

오케스트레이션 산출물은 아직 한 번도 커밋되지 않았다. 현재 브랜치는 `fix/multiplayer-position-sync`이며, 같은 작업트리에 오케스트레이션과 무관한 `document/ops/sync-relay/S3-fixture-gate.json` 변경도 존재한다. Claude는 후속 작업을 시작할 때 이 변경을 오케스트레이션 커밋에 섞지 말아야 한다.

## 5. 구현된 동작 계약

`scripts/claude-report-audit.mjs`가 현재 제공하는 기능은 다음과 같다.

1. relay 이름을 `<name>-relay` 형식으로 제한하고 `document/ops/<relay>/` 아래만 읽는다.
2. `INSTRUCTION.md`의 `**상태**`에 `보고완료`가 있고 `REPORT.md`가 비어 있지 않을 때만 감리를 시작한다.
3. INSTRUCTION·REPORT SHA-256 조합으로 같은 보고서의 중복 감리를 막는다.
4. lock 파일로 같은 relay의 동시 실행을 막고, 실패한 같은 입력은 60초 cooldown 후 다시 시도한다.
5. 실행 시점의 branch·HEAD·`git status`·최근 log를 기준점으로 저장한다.
6. `claude -p`를 비대화식으로 호출하고 Read/Grep/Glob 및 읽기 전용 `git status/diff/show/log`만 허용한다. Edit·Write·웹 조회는 금지한다.
7. Claude 출력은 `BLOCK | PASS | WARNING` 구조화 스키마로 검증한다.
8. 결과를 relay의 `AUDIT.md`, `.rtw-audit/runs/*.json`, `.rtw-audit/state/*.json`에 기록한다.
9. `doctor`는 Claude CLI·입력 파일·trigger 준비 상태를 확인한다.
10. `once`는 한 번 확인하고, `watch`는 실행 중인 터미널에서 2초 간격으로 계속 확인한다.

## 6. 확인된 검증 결과

2026-08-12 인수인계 조사에서 직접 확인한 결과다.

| 확인 | 결과 |
|------|------|
| `npm.cmd run test:claude-audit` | **4/4 PASS** |
| `npm.cmd run claude-audit:doctor -- sync-relay` | Claude Code `2.1.227`, INSTRUCTION 있음, REPORT 있음, 상태 `보고완료`, trigger **준비됨** |
| 현재 INSTRUCTION | `S3A-V`, 2026-08-12 01:18:47 수정, 상태 `보고완료` |
| 현재 REPORT | `S3A-V`, 2026-08-12 01:18:47 수정 |
| 현재 AUDIT | 이전 `S3A`, 2026-08-11 23:18:53 생성 |
| 현재 runtime state | 이전 `S3A` 입력 hash, `WARNING`, 2026-08-11 23:18:53 완료에 머묾 |

따라서 현재 S3A-V 입력은 감리 가능한 상태지만 처리되지 않았다. `AUDIT.md`를 현재 S3A-V의 감리 결과로 오인하면 안 된다.

## 7. 자동 감리가 이루어지지 않은 직접 원인

### 판정

현재 증거로 확인되는 직접 원인은 **감리 함수가 trigger를 인식하지 못한 것**이 아니라 **감리 함수를 계속 실행시킬 운영 수명주기가 연결되지 않은 것**이다.

- 단위 테스트는 통과한다.
- doctor는 현재 입력을 `준비됨`으로 판정한다.
- 하지만 새 REPORT가 완성된 뒤 state와 AUDIT가 갱신되지 않았다.
- 저장소에는 자동 시작, Windows 작업 스케줄러, 서비스, daemon, 개발 완료 hook, 프로세스 supervisor 연결이 없다.
- `watch`는 도움말에도 명시돼 있듯 해당 터미널이 살아 있는 동안만 동작한다.

즉 현재 기능은 “자동 감리 프로그램”이 아니라 **사람이 미리 foreground watcher를 켜 두었을 때만 자동 반응하는 감리 스크립트**다. Chief가 기대한 “개발 담당이 보고서를 끝내면 별도 조작 없이 Claude 감리가 시작되는 상태”에는 도달하지 못했다.

### 아직 단정하지 말아야 할 것

- 실제 Claude 호출·JSON 스키마·권한 제한이 모든 실사용 입력에서 안정적이라는 E2E 증거는 1회 이전 실행뿐이다.
- 현재 watcher가 왜 종료됐는지에 대한 프로세스 이력은 남아 있지 않다.
- 따라서 “watcher 프로세스가 시작된 적이 없다”와 “시작됐지만 터미널·재부팅·오류로 종료됐다” 중 어느 쪽인지는 확정할 수 없다.

## 8. 1단계의 구조적 미완성 항목

### 8.1 실행·복구

- 자동 시작과 재시작 정책이 없다.
- watcher 생존 여부를 확인하는 heartbeat·health 상태가 없다.
- watcher가 죽어도 Chief에게 알리지 않는다.
- 프로세스가 강제 종료되면 lock 파일이 남아 이후 실행을 계속 `busy`로 막을 수 있다. lock에는 PID·시각은 기록되지만 lease 만료·stale lock 회수가 없다.

### 8.2 workflow 연결

- 개발 완료 이벤트와 직접 연결되지 않고 Markdown 문구 `보고완료`에만 의존한다.
- `AUDIT.md`가 생성돼도 다음 상태 전이, 재작업, Chief 알림으로 이어지지 않는다.
- 기본값은 `sync-relay` 하나다. relay 인수는 받을 수 있지만 작업 자동 발견·다중 task 조정은 없다.
- task ID·run ID·attempt·expected state를 포함한 정식 상태 머신이 없다.

### 8.3 검증·보안

- 단위 테스트의 Claude 호출은 fake 함수다. 실제 Claude CLI 종료·스키마 오류·권한 거부·긴 실행·중단 복구를 시험하지 않는다.
- 감리 전후 Git 무변경 gate가 없다. prompt와 tool allowlist만으로 읽기 전용을 기대한다.
- `.rtw-audit`가 ignored라 실행 이력은 로컬에만 있고 다른 worktree·PC로 이어지지 않는다.
- 준비된 REPORT가 일정 시간 미처리돼도 이를 실패로 판정하는 staleness gate가 없다.

### 8.4 장기 목표 대비 빠진 부분

- Claude 제안·지시서에 대한 Codex 자동 검토
- Chief 결정 카드와 승인 대기 상태
- 구현 actor 자동 실행
- 기계 검증 단계
- Claude↔Codex 수정 왕복 제한
- task별 branch/worktree와 artifact hash 계약
- 전체 workflow event log·중복 event 방지·crash recovery

## 9. Claude가 이어받을 때의 우선 판단

Claude는 곧바로 전체 Orchestrator를 확대하기 전에 다음 순서로 계획을 세우는 것이 안전하다.

1. **현재 증거 보존** — 기존 S3A `AUDIT.md`와 `.rtw-audit` run/state를 보존하고, 현재 S3A-V가 미감리 상태였음을 기준선으로 남긴다.
2. **변경 격리** — 오케스트레이션 변경과 peer-sync 제품·fixture 변경을 분리한다. 현재 사용자 작업을 원복하거나 함께 커밋하지 않는다.
3. **1단계 수용 기준 재정의** — “watch 명령이 동작한다”가 아니라 “개발 담당이 보고완료를 만들면 Chief의 추가 명령 없이 bounded time 안에 새 AUDIT가 생긴다”를 수용 기준으로 삼는다.
4. **runner 수명주기 결정** — Windows에서 누가 watcher를 시작·감시·재시작할지 결정한다. 작업 스케줄러, 명시적 supervisor, 개발 완료 hook 등 구현 선택은 Claude가 조사해 직접 확정한다.
5. **실제 E2E 고정** — 새 fixture task에서 보고완료 생성 → Claude 실제 호출 → AUDIT 생성 → 중복 방지 → 재시작 후 누락 처리 → 강제 종료 뒤 stale lock 회복까지 검증한다.
6. **관측 가능성 추가** — `ready but unaudited`, watcher down, Claude 실패, schema 실패를 Chief가 한눈에 구분할 수 있어야 한다.
7. **그 뒤에만 확장** — 1단계가 안정된 후 Codex 검토·Chief 승인·구현 actor·전체 상태 머신을 Chief 승인 아래 별도 단계로 확장한다.

## 10. Claude가 먼저 답해야 할 질문

1. v1의 “자동”은 로그인 중 상주 watcher인가, Windows 재부팅 후 자동 복구까지인가?
2. 개발 담당이 `보고완료`를 쓰는 순간과 REPORT flush 완료를 어떻게 원자적으로 구분할 것인가?
3. watcher down 상태를 누가 어떤 시간 한도로 탐지하고 Chief에게 알릴 것인가?
4. stale lock·Claude timeout·부분 생성된 AUDIT·프로세스 강제 종료를 어떻게 복구할 것인가?
5. runtime state를 로컬 ignored 파일로 유지할지, task artifact와 분리해 휴대 가능한 기록을 남길지?
6. 여러 relay를 하나의 runner가 발견할지, relay별 runner를 명시적으로 운영할지?
7. 자동 Claude 감리 전후에 Git 무변경을 어떤 기계 gate로 증명할지?
8. 좁은 1단계를 언제 “완료”로 판정하고 전체 Orchestrator로 넘어갈지?

## 11. 재현 명령

아래 명령은 현재 구현의 진단 진입점이다.

현행(`feat/orchestrator-shadow`, shadow mode) — `--target` 은 필수이며 cwd 폴백이 없다.

```powershell
npm.cmd run test:orchestrator
npm.cmd run orchestrator:doctor -- --target C:/20.HDev/boxcycle
npm.cmd run orchestrator:once   -- --target C:/20.HDev/boxcycle --relay sync-relay
npm.cmd run orchestrator:watch  -- --target C:/20.HDev/boxcycle --interval-ms 5000
```

`once`·`watch` 는 런타임 루트(`.orchestrator/`)에만 쓰고 **대상 저장소는 건드리지 않는다**. 무변경은 감리 전후 지문 대조로 기계 확인하며, 어긋나면 실행이 실패로 남는다.

폐기된 PoC 명령(대조용, 더는 존재하지 않는다):

```powershell
npm.cmd run test:claude-audit
npm.cmd run claude-audit:doctor -- sync-relay
```

## 12. 인수인계 완료 조건

Claude가 이 문서를 읽은 뒤 다음 산출물을 만들면 인수인계가 끝난다.

- 사실관계와 실패 원인에 대한 동의·정정
- 1단계의 명확한 수용 기준
- runner 수명주기와 복구 모델을 포함한 작업계획
- Claude가 직접 수행할 구현 범위와 커밋 계획
- 실제 E2E 감리 계획
- 1단계 완료 전 장기 Orchestrator 확장을 금지하는 범위선
