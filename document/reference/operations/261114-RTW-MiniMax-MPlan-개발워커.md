# RTW MiniMax M Plan 개발 워커 — 폐기 기록

| 항목 | 내용 |
|---|---|
| 문서 유형 | operations — 구현 위임 실행자(MiniMax M Plan) 규칙 |
| 최초 작성 | 2026-11-14 |
| 상태 | 폐기 — 2026-11-22 Chief: 개발 환경 도구에서 MiniMax 제외. 아래는 과거 기록이며 실행 지침이 아니다. |
| 독자 | 수퍼바이저 agent(Claude Code · Codex) · chief |
| 연결 문서 | [수퍼바이저 교대 플레이북](261023-RTW-수퍼바이저-교대-플레이북.md) · [지금 상태 한 장](../../ops/HANDOFF.md) · [에이전트 상세 작업 규칙](261027-RTW-에이전트-상세-작업-규칙.md) |

> 2026-11-22: 워커·병렬 워커·모델 라우팅 복구 스크립트와 도구 등록을 제거했다. setup-dev-tools는 Obsidian·문서 확인만 담당한다. 외부 사용자 설정은 변경하지 않았다.

## 0. 결정 — 왜 dsh 를 뺐나

- DeepSeek(`dsh`) API 는 **종량제**라 Chief 가 비용 부담을 이유로 기본 실행자에서 뺐다(2026-11-14).
- 대신 MiniMax **M Plan(정액제)** API 로 하위 개발 에이전트를 돌린다. MiniMax 는 Anthropic 호환 엔드포인트를 낸다(`https://api.minimax.io/anthropic`) — Anthropic SDK 계통 클라이언트는 주소만 바꿔 붙는다.
- **2026-11-15 Chief 정정: MiniMax 는 '도구'다, 환경이 아니다.** 수퍼바이저 세션은 **Claude 모델**(Anthropic 기본값)로 돈다. MiniMax 는 위임받은 구현을 처리할 때만, 자식 프로세스로 잠깐 불려 나간다. 11-14 에 `C:\Users\kdrea\.claude\settings.json` 의 `env` 를 MiniMax 로 물려 놓은 것은 잘못이었다 — 세션 모델 고정·`/model` 에서 Claude 항목 소실·auto mode 안전 검사 미실행으로 **셸 명령이 전부 거부**됐다.
- 분리 원칙: MiniMax 라우팅은 **워커 스크립트가 자식 프로세스에만** 심는다(`ANTHROPIC_BASE_URL`·`ANTHROPIC_AUTH_TOKEN`·`ANTHROPIC_MODEL` 을 그때만 설정). 전역 `settings.json` 에는 MiniMax 키를 `env.MINIMAX_API_KEY` 로만 둔다(Claude Code 는 이 이름을 해석하지 않는다). 되돌리는 방법: `node C:\20.HDev\boxcycle\scripts\fix-model-routing.mjs` → Claude Code 재시작.
- `dsh` 는 삭제하지 않는다. 필요할 때(Chief 가 명시 승인할 때) 대체 경로로만 쓴다.

## 1. 설치 · 인증 (chief 가 실행)

| 단계 | PowerShell 명령 | 기대 결과 |
|---|---|---|
| MiniMax Code CLI 설치 | `npm install -g @minimax-ai/code` | `mcode --version` 가 버전 출력 |
| 인증 | `mcode` 를 그냥 실행 → 로그인 안내 따라 M Plan 키 입력 | 키를 넘기지 말고 터미널에서 직접 로그인(공식 권장) |
| 설치 확인 | `Get-Command mcode` | 경로 출력 |

- Git Bash 에서는 먼저 `export PATH="/c/Program Files/nodejs:$PATH"`(bash 의 `~/bin/npm` 래퍼가 깨져 있다).
- **2026-11-14 확인: 이 PC 에 `mcode` 는 없다**(`C:\Users\kdrea\AppData\Roaming\npm` 에 `mcode` 명령·`@minimax-ai/code` 패키지 없음). 그래서 지금 실행 경로는 **claude 백엔드**다 — `C:\Users\kdrea\.local\bin\claude.exe` 를 쓰되, **워커 스크립트가 MiniMax env 를 그 자식에만 심기 때문에** 설치·인증이 필요 없다. `mcode` 를 나중에 설치하면 스크립트가 자동으로 그것을 우선 사용한다.
- API 키는 저장소에도 스크립트에도 넣지 않는다. 기본 위치는 `C:\Users\kdrea\.claude\settings.json` 의 `env.MINIMAX_API_KEY`(MiniMax M Plan 키 `sk-cp-…`). 그보다 앞선 곳은 프로세스 환경변수 `MINIMAX_API_KEY` 다.

## 1-1. 환경 분리 — 수퍼바이저는 Claude, MiniMax 는 자식 프로세스만 (2026-11-15)

| 층 | 모델 | 설정 위치 |
|---|---|---|
| 수퍼바이저 세션(지금 대화하는 것) | **Claude** (`claude-opus-5-5` 기본) | `C:\Users\kdrea\.claude\settings.json` 의 `"model"` + Anthropic 기본 엔드포인트 |
| 위임 워커(구현 담당) | **MiniMax M Plan** | 워커 스크립트가 **자식 프로세스에만** 심는 `ANTHROPIC_BASE_URL`·`ANTHROPIC_AUTH_TOKEN`·`ANTHROPIC_MODEL` |

- MiniMax 키는 `env.MINIMAX_API_KEY` 에만 둔다. Claude Code 는 이 이름을 해석하지 않으므로 수퍼바이저 세션은 Claude 로 돈다.
- 전역 `env` 에 MiniMax 라우팅이 남아 있으면(11-14 상태) 되돌린다 — 백업·수정·요약 출력까지 자동:

```
node C:\20.HDev\boxcycle\scripts\fix-model-routing.mjs
```

  → `ANTHROPIC_*` 제거 · `MINIMAX_API_KEY`·`MINIMAX_BASE_URL` 보존 · `"model"`=Claude · `modelPicker` 제거(내장 Claude 목록 복원) → **Claude Code 완전 종료 후 재시작**.
- 되돌린 뒤 확인 2가지: ① `/model` 목록에 Default·Opus·Sonnet·Haiku 가 보인다 ② 셸 명령(Bash)이 거부되지 않는다.
- MiniMax 라우팅 상태에서 MiniMax 모델로 세션을 돌리면 auto mode 안전 검사가 분류기를 못 써 **셸이 전부 거부**된다(11-14 에 실제로 겪었다). 그래서 세션은 반드시 Claude 다.

## 2. 호출 — 수퍼바이저가 쓰는 명령

```
powershell -NoProfile -ExecutionPolicy Bypass -File C:\20.HDev\boxcycle\scripts\minimax-worker.ps1 -TaskFile "<지시서.md>" -WorkDir "<작업 폴더>"
```

- Git Bash 에서는 `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\20.HDev\boxcycle\scripts\minimax-worker.ps1" -TaskFile "..." -WorkDir "..."`.
- stdout = 워커의 JSON 이벤트 스트림(NDJSON) · stderr = 진단 · **종료 코드 = 워커의 종료 코드**.
- 실행 폴더가 쓰기 범위다. `apps/web` 안에서 돌리면 그 안으로 제한된다.

| 파라미터 | 기본 | 뜻 |
|---|---|---|
| `-TaskFile` | (필수) | 지시서 파일(UTF-8). 지시 그대로 전달 |
| `-WorkDir` | 현재 폴더 | 실행 폴더(쓰기 범위) |
| `-Backend` | `auto` | `mcode` 있으면 mcode, 없으면 claude |
| `-Model` | `MiniMax-M3.1-Flash[1m]` | M Plan 모델. 판단·설계·구현은 `MiniMax-M3[1m]`, 기계적 작업은 `MiniMax-M3.1-Flash[1m]` (§3) |
| `-MaxTurns` | 40 | claude 백엔드 최대 턴 |
| `-PermissionMode` | `acceptEdits` | claude 백엔드 권한 모드 |
| `-AllowedTools` | `Edit,Read,Write,Glob,Grep,Bash` | claude 백엔드 허용 도구(쉼표 구분 한 값) |
| `-McodePermission` | `smart` | mcode 권한 모드. 빈 값이면 플래그를 붙이지 않는다 |
| `-AddDir` | 없음 | 추가로 열어 줄 폴더(여러 개) |
| `-ExtraArgs` | 없음 | 백엔드 추가 인자 |
| `-ApiKey` | 없음 | MiniMax 키(비우면 환경변수 → settings.json 순으로 찾는다) |
| `-BaseUrl` | MiniMax 기본 주소 | MiniMax Anthropic 호환 엔드포인트(비우면 환경변수 → settings.json → 기본값) |
| `-DryRun` | off | 실행 없이 호출 계획만 출력(키 가림) |

- `-DryRun` 으로 먼저 확인한다(키는 `<KEY>` 로 가려진다).
- 첫 `mcode` 실행은 플래그 이름을 눈으로 확인한다: `mcode exec --help`.

## 2-1. 첫 실행 확인 순서 (PowerShell, 어느 폴더에서나)

```
npm install -g @minimax-ai/code
Get-Command mcode
mcode exec --help
powershell -NoProfile -ExecutionPolicy Bypass -File C:\20.HDev\boxcycle\scripts\minimax-worker.ps1 -TaskFile "<작은 시험 지시서.md>" -WorkDir C:\20.HDev\boxcycle\apps\web -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File C:\20.HDev\boxcycle\scripts\minimax-worker.ps1 -TaskFile "<작은 시험 지시서.md>" -WorkDir C:\20.HDev\boxcycle\apps\web
```

- 마지막 두 줄의 차이는 `-DryRun` 뿐이다. DryRun 은 호출 계획만(키 가림) 보여 주고 exit 0.
- 진짜로 돌린 뒤 `stdout` 에 JSON 이벤트 스트림이 나오고 종료 코드가 워커의 코드인지 확인한다.
- `mcode` 가 없으면 두 번째·세 번째 명령이 claude 백엔드로 자동 대체된다(stderr 에 대체 메시지가 찍힌다).

## 3. 모델 선택 — 수퍼바이저 권한

**2026-11-14 Chief: 하위 모델 선택 권한은 수퍼바이저(Claude Code)에게 있다.** 작업 내용에 따라 골라 지시서마다 명시한다.

| 모델 | 고를 때 | 비고 |
|---|---|---|
| `MiniMax-M3[1m]` | 판단·설계·화면·여러 파일을 엮는 구현 · 실패 원인 분석 · 감리 보조 | M Plan 안에서 기본값으로 쓸 쪽 |
| `MiniMax-M3.1-Flash[1m]` | 기계적·반복 작업 · 일괄 치환 · 파일 이동 · 포맷 · 시험 세팅 · 조사 | 빠르고 저렴 |

- 둘 다 정액제 안이라 **비용 차이는 없다**. 기준은 품질과 소요 시간뿐이다.
- 한 작업 = 한 모델. 갈라지면 **3 으로 나누어 병렬**로 돌린다(§4).
- 애매하면 M3. 판단이 없으면 Flash.
- 서로 다른 모델을 동시에 붙잡고 **같은 파일을 건드리게 하지 않는다**(나중 쓰기가 앞 것을 지운다).

## 4. 병렬 실행 — 배치 스크립트

`C:\20.HDev\boxcycle\scripts\minimax-worker-batch.ps1` 가 여러 작업을 동시에 돌리고, 작업마다 로그·요약을 따로 남긴다.

```
powershell -NoProfile -ExecutionPolicy Bypass -File C:\20.HDev\boxcycle\scripts\minimax-worker-batch.ps1 -Manifest C:\20.HDev\boxcycle\document\ops\<묶음>\worker-jobs.json
```

작업 목록 JSON 형식:

```
{
  "jobs": [
    { "id": "a", "taskFile": "C:\\20.HDev\\boxcycle\\document\\ops\\<묶음>\\01-task-a.md", "workDir": "C:\\20.HDev\\boxcycle\\apps\\web", "model": "MiniMax-M3[1m]" },
    { "id": "b", "taskFile": "C:\\20.HDev\\boxcycle\\document\\ops\\<묶음>\\02-task-b.md", "workDir": "C:\\20.HDev\\boxcycle\\apps\\web", "model": "MiniMax-M3.1-Flash[1m]" }
  ]
}
```

- `-MaxParallel N` 으로 동시 개수를 제한한다(기본 제한 없음). `-DryRun` 으로 계획만 확인.
- 예시 파일이 필요하면: `powershell -NoProfile -ExecutionPolicy Bypass -File C:\20.HDev\boxcycle\scripts\minimax-worker-batch.ps1 -WriteTemplate C:\20.HDev\boxcycle\document\ops\<묶음>\worker-jobs.json`
- 결과: `C:\20.HDev\boxcycle\.out\worker-runs\<시각>\<id>.ndjson`(이벤트) · `<id>.err.log`(진단) · `summary.json`(종료 코드·모델·경로).
- **병렬 조건**: (1) 작업이 서로 다른 파일 범위를 만진다 (2) 한쪽 산출물을 다른 쪽이 읽어야 하면 순차다 (3) 공용 설정 파일(`apps\web\package.json`·`apps\web\dev-tools.json`·`settings.json`)을 건드리는 작업은 병렬에서 빼고 마지막에 순차로 한다 (4) 동시 개수는 2~4 로 두고 M Plan 동시 요청 한도와 PC 메모리를 넘기지 않는다.
- 어떤 작업이 실패(종료 코드 ≠ 0)하면 배치는 exit 1 을 낸다. **그 작업만** 지시서를 고쳐 다시 돌린다.

## 5. 지시서 구성

지시서에는 늘 넣는다: 목표·배경 · 완료 조건 · **검증 명령(경로 포함)** · 결과 파일 경로 · 금지(아래) · 보고 형식 · **쓸 모델**.

금지(기본 고정): `git worktree`·`git restore`·`git clean`·`git stash`·브랜치 전환·커밋·푸시 · `functions/` 등 경계 밖 수정 · 공개 자산 변경 · 시안 임의 변경.

## 6. 감리 — 워커의 「통과」는 증거가 아니다

- 수퍼바이저가 **직접** 게이트를 다시 돌린다: `npx tsc -b --noEmit` · `npx eslint <바뀐 파일>` · `npm run test:quick` · `node scripts/check-code-tidy.mjs` · `node scripts/check-dep-direction.mjs --check` (플레이북 §4).
- 종료 코드 0 만으로 성공을 말하지 않는다. 워커가 실제로 고친 파일과 git diff 를 대조한다.
- 병렬로 돌렸으면 **작업별로** 파일을 나눠 대조한다(어느 워커가 무엇을 고쳤는지).
- 워커가 도중에 죽어도 편집은 대부분 끝나 있다. `git status` 와 결과 파일의 마지막 `DONE` 줄부터 이어 간다.

## 7. 실패·대체

| 상황 | 처리 |
|---|---|
| `mcode` 설치 실패 | claude 백엔드로 자동 대체(동일 스크립트) |
| M Plan 모델 401/429 | 키·플랜 확인 → `-Model` 을 다른 모델로 바꿔 재시도 |
| 워커가 멈춤 | 같은 지시서로 재실행, `-Model MiniMax-M3[1m]` 로 교체 |
| dsh 가 필요 | Chief 명시 승인일 때만 `dsh --profile headless …` (종량제) |

## 8. 비용 원칙

- M Plan 은 정액제다. 횟수를 아끼기보다 **판단이 큰 작업을 한 번에** 넘기고, 재작업은 감리가 지시서를 고쳐 한 번에 다시 넘긴다.
- 병렬 실행은 비용을 늘리지 않는다(정액제). 대신 **겹침 사고만 늘린다** → 파일 범위를 나눠서 건넨다.
- 종량제 DeepSeek API 는 예산 승인 없이 쓰지 않는다.
