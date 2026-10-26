# Spinatlas (repo: boxcycle)

실내 자전거로 실제 지구의 도로를 달리는 웹앱. 핵심 판타지 **「Ride = Claim」** — 달린 도로가 영구 자산(내 도로망)으로 쌓인다. 브랜드명 **Spinatlas**(스핀아틀라스; 과거 브랜드 RTW·Ride the World), 코드·리포·Firebase projectId는 `boxcycle` 유지.

## 용어 (필수)

용어·개념·금지어의 단일 진실: **[document/reference/product/260714-RTW-Ontology.md](document/reference/product/260714-RTW-Ontology.md)**. UI 문자열·문서·**신규** 코드 식별자는 이 문서를 따른다. 단, 기존 코드 식별자·Firestore 경로의 일괄 rename 근거로 쓰지 않는다 — rename·마이그레이션은 결정 로그를 거친 별도 계획으로만(스코프 규칙: Ontology §0.1).

자주 틀리는 것:

- Room·방·Lobby·로비 ❌ → **Trail**·**Trailhead**
- "비로그인 사용자" ❌ → 인증 전(기능 불가) / **Guest**(익명 인증 완료)
- z20·셀·블록·타일 UI 노출 ❌ → **내 도로망**·**새 도로 +N km**
- 신규 코드에 `course`/`courseId` ❌ → `route`/`publication` 계열

## 문서 라우팅

| 질문 | 문서 |
|---|---|
| **수퍼바이저가 이어받을 지금 상태** | [document/ops/HANDOFF.md](document/ops/HANDOFF.md) |
| **Chief 가 직접 정한 화면 — 바꾸지 말 것** | [document/reference/product/261024-RTW-Chief-지정-디자인-고정.md](document/reference/product/261024-RTW-Chief-지정-디자인-고정.md) |
| 다음 목표·chief 결정 대기 요약 | [document/260928-RTW-현황판.md](document/260928-RTW-현황판.md) |
| 에이전트 작업 창구(ops) 현황·새 묶음 열기 | [document/ops/README.md](document/ops/README.md) |
| X가 무엇인가·뭐라고 부르나 | [document/reference/product/260714-RTW-Ontology.md](document/reference/product/260714-RTW-Ontology.md) |
| 왜 그렇게 결정했나 | [document/260707-RTW-결정-로그.md](document/260707-RTW-결정-로그.md) |
| 목표·기능별 진도·전체 그림 — Chief 핵심 입구 | [document/260707-RTW-기능-인벤토리-상태보드.md](document/260707-RTW-기능-인벤토리-상태보드.md) |
| 문서·용어를 바꾸는 절차 | [document/260509-BOXCYCLE-문서-생성-및-수정-지침.md](document/260509-BOXCYCLE-문서-생성-및-수정-지침.md) §6·§6.1·§8 |
| 비전·전략·타겟 | [document/reference/product/260511-RTW-마스터-비전-및-종합계획.md](document/reference/product/260511-RTW-마스터-비전-및-종합계획.md) |
| 정복 메커닉·인정 규칙·수치 | [document/reference/architecture/260703-Conquest-정복-레이어-설계.md](document/reference/architecture/260703-Conquest-정복-레이어-설계.md) |
| Skill·Harness를 만들거나 구분하려면 | [document/reference/operations/260722-Skill-Harness-아키텍처.md](document/reference/operations/260722-Skill-Harness-아키텍처.md) |
| 화면 공간을 어떻게 쓰나(버튼·칩·카드 크기) | [document/reference/product/260924-RTW-UI-공간밀도-원칙.md](document/reference/product/260924-RTW-UI-공간밀도-원칙.md) |
| 이 모듈이 어느 도메인인가·무엇을 import 해도 되나 | [document/reference/architecture/260925-RTW-lib-도메인-경계와-의존-방향.md](document/reference/architecture/260925-RTW-lib-도메인-경계와-의존-방향.md) |
| 구조를 바꾸거나 게이트를 세우려면(도구·절차) | [document/reference/operations/260926-RTW-구조-게이트-운용-지침.md](document/reference/operations/260926-RTW-구조-게이트-운용-지침.md) |
| 실행·배포 방법 | [README.md](README.md) |

## Mermaid (필수 · Cursor 채팅)

- **`%%{init: ...}%%` · themeVariables 금지.** Cursor 채팅에서 Syntax Error가 난다.
- **순수 Mermaid만** (`flowchart` / `sequenceDiagram` …). 펜스 안에 설명 문장 금지. 옛 `document/*.md` 다이어그램의 init을 베끼지 말 것.
- SoT: `.cursor/rules/mermaid-cursor-safe.mdc` · 스킬 `.cursor/skills/mermaid-safe/SKILL.md`

## 문서 규칙 (요약)

- 현재 기준은 `document/reference/`에 `YYMMDD-` 접두어로 작성하고 [문서 색인](document/README.md)에 등재. 작업 문서는 ops 묶음에, 새 최종 보고서는 `document/archive/reports/`에 보관. 날짜 예외·종료 절차는 문서 지침 §8을 따른다.
- 주요 결정은 [결정 로그](document/260707-RTW-결정-로그.md)에 태그 포함 한 줄 append(최신이 위). 기능 상태 변경은 [상태보드](document/260707-RTW-기능-인벤토리-상태보드.md) 기호만 갱신 — "인벤토리 갱신해"는 코드와 대조해 상태보드를 갱신하라는 뜻.

## 자율 진행 및 질문 정책

- **최상위 중단 규칙:** 현재 작업 세션의 잔여 토큰이 **5% 이하**가 되면 새 구현·시험을 즉시 중단한다. 그 시점까지의 변경, 통과·실패·미실행 검증, 남은 작업과 재개 지점을 `document/ops/HANDOFF.md`에 기록하고 Chief에게 보고한다. 완료를 가장하거나 5% 아래에서 작업을 밀어붙이지 않는다.
- 사소한 판단이나 통상적인 구현·검증 작업은 질문하지 말고, 현재 요구사항과 저장소 증거에 따라 합리적으로 판단해 계속 진행한다.
- 사용자에게 질문하는 경우는 다음으로 제한한다: 작업을 중단해야 할 정도의 위험한 작업, 서로 충돌하여 임의 선택이 결과를 크게 바꾸는 요구사항, 되돌리기 어려운 변경, 필요한 권한이나 필수 정보가 없어 더 진행할 수 없는 경우.
- 위 경우가 아니면 구현·시험·증거 수집까지 완료한 뒤 결과와 발견 사항을 보고한다. 질문을 피하기 위해 검증을 생략하거나 위험을 숨기지 않는다.
- 브라우저 또는 Playwright 단계가 5분 동안 유의미한 진전 없이 대기하면 같은 시도를 계속 기다리거나 반복하지 않는다. 즉시 중단하고 프로세스·서버·포트·로그를 확인한 뒤, headless·단일 worker·기존 서버 재사용·정적/단위 시험 등 다른 검증 경로로 전환한다. 전환 후에도 필수 검증이 불가능할 때만 BLOCK으로 보고한다.

<!-- 아래 절은 AGENTS.md 와 CLAUDE.md 에서 같은 본문을 유지한다(Codex 는 AGENTS.md, Claude Code 는 CLAUDE.md 를 읽는다). 한쪽을 고치면 다른 쪽도 고친다. -->
## AI 개발 역할과 공용 작업 창구

- **Chief**는 제품 방향, 중요한 기술·범위 결정과 최종 완료를 승인한다. 일상적인 구현의 중간 전달을 맡기지 않는다.
- **Supervisor = 그때의 담당 agent (Claude Code 또는 Codex, 토큰 한도에 따라 교대)**: 요구를 분석하고 작업 범위·완료 조건·검증 방법을 정해 `document/ops/`에 지시한다. 구현 결과와 실제 diff·검증 증거를 검수하고 재작업 또는 완료를 판정한다. **시작하면 [document/ops/HANDOFF.md](document/ops/HANDOFF.md)부터 읽고, 작업 단위가 끝날 때마다·끊기기 전에 그 파일을 고친다.** 절차·실행자 호출·감리 명령·배포·환경 함정은 [수퍼바이저 교대 플레이북](document/reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md).
- **Chief 지정 디자인은 고정이다.** Chief 가 직접 지시로 바꾼 화면(버튼 모양·색·표시 여부 등)은 [Chief 지정 디자인 고정 목록](document/reference/product/261024-RTW-Chief-지정-디자인-고정.md)에 있다. 수퍼바이저·실행자는 시안·디자인 규칙·자기 판단으로 이 항목을 바꾸지 않는다. 지시서 「금지」에 해당 항목을 옮겨 적고, 감리에서 건드렸으면 FAIL. Chief 가 새로 화면을 지시하면 끝낼 때 목록에 한 줄 더한다(2026-10-24 Chief).
- **Developer = Cursor AI·CLI(기본)**: OpenCode 무료 모델은 조사·기계적 작업에 쓰고(2026-10-22 Chief), 화면·판단 작업에 못 미치면 Cursor로 돌아온다. 지정된 작업을 조사·구현·검증하고 같은 묶음에 사실에 근거한 결과를 남긴다. 범위 밖 문제는 보고하고, 독단적으로 확장하지 않는다. IDE·CLI 어느 환경이든 같은 파일 인계·검수 계약을 따른다. 안내·질의·권한 요청은 한국어로 작성한다.
- 최종 사용 기기는 **스마트폰**이다. PC는 개발·반복 테스트 환경이며, 현행 폰 가로 방향·공간밀도 기준을 우선한다. [협업·감리 계약](document/reference/operations/261009-RTW-개발에이전트-협업-감리.md)에 따라 도구가 교대해도 동일 지시·결과·검수 기록을 이어간다.
- 공식 handoff는 [document/ops/README.md](document/ops/README.md)에 따른 파일 기록이다. 새 작업은 현재 묶음의 `README.md`와 최신 지시를 읽고 시작한다. 이전 릴레이의 상시 대기 지침을 새 작업에 적용하지 않는다.
- 지시 → 결과 → 검수 → 필요하면 새 재지시를 별도 파일로 남긴다. 상태 요약은 [document/ops/PROGRESS.md](document/ops/PROGRESS.md)에 기록한다. 기존 ops 기록은 보존한다.
- 아키텍처·도메인 경계·데이터 모델·Firestore/RTDB/Rules·외부 API·의미 있는 비용·Public Trail 동기화·공용 인터페이스·대규모 이동·기능 의미·요구 해석 또는 큰 범위 변경은 구현 전에 Chief 결정이 필요한지 Supervisor가 판정한다.
- 테스트 결과는 실행 명령, 통과·실패, 미실행 이유를 구분해 기록한다. 실패를 성공으로 보고하지 않는다. 작업 지시와 [개발 워크플로](document/reference/operations/260719-개발-워크플로-브랜치-커밋-게이트.md)의 Git 원칙을 함께 따른다. 다른 작업의 변경을 임의로 커밋·푸시하지 않는다.
- 작업 완료 보고에는 Chief가 직접 테스트할 수 있도록 **실행 폴더의 전체 절대 경로**, **복사해 실행 가능한 명령어**, 필요한 **접속 주소와 확인 순서**를 항상 함께 적는다. 상대 경로나 "프로젝트 폴더에서 실행"만으로 안내하지 않는다. 실행 위치로 이동하는 명령도 포함한다.
