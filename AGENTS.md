# RTW (repo: boxcycle)

실내 자전거로 실제 지구의 도로를 달리는 웹앱. 핵심 판타지 **「Ride = Claim」** — 달린 도로가 영구 자산(내 도로망)으로 쌓인다. 브랜드명 RTW(Ride The World), 코드·리포·Firebase projectId는 `boxcycle` 유지.

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
| 다음 목표·chief 결정 대기 요약 | [document/260928-RTW-현황판.md](document/260928-RTW-현황판.md) |
| 에이전트 작업 창구(ops) 현황·새 묶음 열기 | [document/ops/README.md](document/ops/README.md) |
| X가 무엇인가·뭐라고 부르나 | [document/reference/product/260714-RTW-Ontology.md](document/reference/product/260714-RTW-Ontology.md) |
| 왜 그렇게 결정했나 | [document/260707-RTW-결정-로그.md](document/260707-RTW-결정-로그.md) |
| 목표·기능별 진도·전체 그림 — Chief 핵심 입구 | [document/260707-RTW-기능-인벤토리-상태보드.md](document/260707-RTW-기능-인벤토리-상태보드.md) |
| 문서·용어를 바꾸는 절차 | [document/260509-BOXCYCLE-문서-생성-및-수정-지침.md](document/260509-BOXCYCLE-문서-생성-및-수정-지침.md) §6·§6.1·§8 |
| 비전·전략·타겟 | [document/reference/product/260511-RTW-마스터-비전-및-종합계획.md](document/reference/product/260511-RTW-마스터-비전-및-종합계획.md) |
| 정복 메커닉·인정 규칙·수치 | [document/reference/architecture/260703-Conquest-정복-레이어-설계.md](document/reference/architecture/260703-Conquest-정복-레이어-설계.md) |
| Skill·Harness를 만들거나 구분하려면 | [document/reference/operations/260722-Skill-Harness-아키텍처.md](document/reference/operations/260722-Skill-Harness-아키텍처.md) |
| 실행·배포 방법 | [README.md](README.md) |

## Mermaid (필수 · Cursor 채팅)

- **`%%{init: ...}%%` · themeVariables 금지.** Cursor 채팅에서 Syntax Error가 난다.
- **순수 Mermaid만** (`flowchart` / `sequenceDiagram` …). 펜스 안에 설명 문장 금지. 옛 `document/*.md` 다이어그램의 init을 베끼지 말 것.
- SoT: `.cursor/rules/mermaid-cursor-safe.mdc` · 스킬 `.cursor/skills/mermaid-safe/SKILL.md`

## 문서 규칙 (요약)

- 현재 기준은 `document/reference/`에 `YYMMDD-` 접두어로 작성하고 [문서 색인](document/README.md)에 등재. 작업 문서는 ops 묶음에, 새 최종 보고서는 `document/archive/reports/`에 보관. 날짜 예외·종료 절차는 문서 지침 §8을 따른다.
- 주요 결정은 [결정 로그](document/260707-RTW-결정-로그.md)에 태그 포함 한 줄 append(최신이 위). 기능 상태 변경은 [상태보드](document/260707-RTW-기능-인벤토리-상태보드.md) 기호만 갱신 — "인벤토리 갱신해"는 코드와 대조해 상태보드를 갱신하라는 뜻.

## 자율 진행 및 질문 정책

- 사소한 판단이나 통상적인 구현·검증 작업은 질문하지 말고, 현재 요구사항과 저장소 증거에 따라 합리적으로 판단해 계속 진행한다.
- 사용자에게 질문하는 경우는 다음으로 제한한다: 작업을 중단해야 할 정도의 위험한 작업, 서로 충돌하여 임의 선택이 결과를 크게 바꾸는 요구사항, 되돌리기 어려운 변경, 필요한 권한이나 필수 정보가 없어 더 진행할 수 없는 경우.
- 위 경우가 아니면 구현·시험·증거 수집까지 완료한 뒤 결과와 발견 사항을 보고한다. 질문을 피하기 위해 검증을 생략하거나 위험을 숨기지 않는다.
- 브라우저 또는 Playwright 단계가 5분 동안 유의미한 진전 없이 대기하면 같은 시도를 계속 기다리거나 반복하지 않는다. 즉시 중단하고 프로세스·서버·포트·로그를 확인한 뒤, headless·단일 worker·기존 서버 재사용·정적/단위 시험 등 다른 검증 경로로 전환한다. 전환 후에도 필수 검증이 불가능할 때만 BLOCK으로 보고한다.

## AI 개발 역할과 공용 작업 창구

- **Chief**는 제품 방향, 중요한 기술·범위 결정과 최종 완료를 승인한다. 일상적인 구현의 중간 전달을 맡기지 않는다.
- **Codex = Engineering Supervisor**: 요구를 분석하고 작업 범위·완료 조건·검증 방법을 정해 `document/ops/`에 지시한다. 구현 결과와 실제 diff·검증 증거를 검수하고 재작업 또는 완료를 판정한다.
- **Cursor CLI = Development Lead**: 지정된 작업을 조사·구현·검증하고 같은 묶음에 사실에 근거한 결과를 남긴다. 범위 밖 문제는 보고하고, 독단적으로 확장하지 않는다. Cursor IDE는 사람이 확인·디버깅할 때 쓰는 보조 도구다.
- 공식 handoff는 [document/ops/README.md](document/ops/README.md)에 따른 파일 기록이다. 새 작업은 현재 묶음의 `README.md`와 최신 지시를 읽고 시작한다. 이전 릴레이의 상시 대기 지침을 새 작업에 적용하지 않는다.
- 지시 → 결과 → 검수 → 필요하면 새 재지시를 별도 파일로 남긴다. 상태 요약은 [document/ops/PROGRESS.md](document/ops/PROGRESS.md)에 기록한다. 기존 ops 기록은 보존한다.
- 아키텍처·도메인 경계·데이터 모델·Firestore/RTDB/Rules·외부 API·의미 있는 비용·Public Trail 동기화·공용 인터페이스·대규모 이동·기능 의미·요구 해석 또는 큰 범위 변경은 구현 전에 Chief 결정이 필요한지 Supervisor가 판정한다.
- 테스트 결과는 실행 명령, 통과·실패, 미실행 이유를 구분해 기록한다. 실패를 성공으로 보고하지 않는다. 작업 지시와 [개발 워크플로](document/reference/operations/260719-개발-워크플로-브랜치-커밋-게이트.md)의 Git 원칙을 함께 따른다. 다른 작업의 변경을 임의로 커밋·푸시하지 않는다.
