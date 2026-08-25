# RTW (repo: boxcycle)

실내 자전거로 실제 지구의 도로를 달리는 웹앱. 핵심 판타지 **「Ride = Claim」** — 달린 도로가 영구 자산(내 도로망)으로 쌓인다. 브랜드명 RTW(Ride The World), 코드·리포·Firebase projectId는 `boxcycle` 유지.

## 용어 (필수)

용어·개념·금지어의 단일 진실: **[document/260714-RTW-Ontology.md](document/260714-RTW-Ontology.md)**. UI 문자열·문서·**신규** 코드 식별자는 이 문서를 따른다. 단, 기존 코드 식별자·Firestore 경로의 일괄 rename 근거로 쓰지 않는다 — rename·마이그레이션은 결정 로그를 거친 별도 계획으로만(스코프 규칙: Ontology §0.1).

자주 틀리는 것:

- Room·방·Lobby·로비 ❌ → **Trail**·**Trailhead**
- "비로그인 사용자" ❌ → 인증 전(기능 불가) / **Guest**(익명 인증 완료)
- z20·셀·블록·타일 UI 노출 ❌ → **내 도로망**·**새 도로 +N km**
- 신규 코드에 `course`/`courseId` ❌ → `route`/`publication` 계열

## 문서 라우팅

| 질문 | 문서 |
|---|---|
| X가 무엇인가·뭐라고 부르나 | [document/260714-RTW-Ontology.md](document/260714-RTW-Ontology.md) |
| 왜 그렇게 결정했나 | [document/260707-RTW-결정-로그.md](document/260707-RTW-결정-로그.md) |
| 어디까지 구현됐나·전체 그림 | [document/260707-RTW-기능-인벤토리-상태보드.md](document/260707-RTW-기능-인벤토리-상태보드.md) |
| 문서·용어를 바꾸는 절차 | [document/260509-BOXCYCLE-문서-생성-및-수정-지침.md](document/260509-BOXCYCLE-문서-생성-및-수정-지침.md) §6·§6.1 |
| 비전·전략·타겟 | [document/260511-RTW-마스터-비전-및-종합계획.md](document/260511-RTW-마스터-비전-및-종합계획.md) |
| 정복 메커닉·인정 규칙·수치 | [document/260703-Conquest-정복-레이어-설계.md](document/260703-Conquest-정복-레이어-설계.md) |
| Skill·Harness를 만들거나 구분하려면 | [document/260722-Skill-Harness-아키텍처.md](document/260722-Skill-Harness-아키텍처.md) |
| 실행·배포 방법 | [README.md](README.md) |

## 문서 규칙 (요약)

- 새 문서는 `YYMMDD-` 접두어 + [document/README.md](document/README.md) 색인 등재. 보고서·완료된 체크리스트는 태어날 때부터 `document/archive/`에 작성.
- 주요 결정은 [결정 로그](document/260707-RTW-결정-로그.md)에 태그 포함 한 줄 append(최신이 위). 기능 상태 변경은 [상태보드](document/260707-RTW-기능-인벤토리-상태보드.md) 기호만 갱신 — "인벤토리 갱신해"는 코드와 대조해 상태보드를 갱신하라는 뜻.

## 자율 진행 및 질문 정책

- 사소한 판단이나 통상적인 구현·검증 작업은 질문하지 말고, 현재 요구사항과 저장소 증거에 따라 합리적으로 판단해 계속 진행한다.
- 사용자에게 질문하는 경우는 다음으로 제한한다: 작업을 중단해야 할 정도의 위험한 작업, 서로 충돌하여 임의 선택이 결과를 크게 바꾸는 요구사항, 되돌리기 어려운 변경, 필요한 권한이나 필수 정보가 없어 더 진행할 수 없는 경우.
- 위 경우가 아니면 구현·시험·증거 수집까지 완료한 뒤 결과와 발견 사항을 보고한다. 질문을 피하기 위해 검증을 생략하거나 위험을 숨기지 않는다.
- 브라우저 또는 Playwright 단계가 5분 동안 유의미한 진전 없이 대기하면 같은 시도를 계속 기다리거나 반복하지 않는다. 즉시 중단하고 프로세스·서버·포트·로그를 확인한 뒤, headless·단일 worker·기존 서버 재사용·정적/단위 시험 등 다른 검증 경로로 전환한다. 전환 후에도 필수 검증이 불가능할 때만 BLOCK으로 보고한다.
