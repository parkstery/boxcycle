# RTW 문서 입구

| 항목 | 내용 |
|---|---|
| 문서 유형 | 메타 — 현재 기준·작업·기록의 색인 |
| 최초 작성 | 2026-05-23 |
| 독자 | chief · AI |
| 상태 | SoT — 2026-10-05 수명별 체계 정리 |
| 연결 문서 | [문서 운영 지침](260509-BOXCYCLE-문서-생성-및-수정-지침.md#8-문서-운영--수명별-체계-2026-10-05) |

**목표와 기능별 진도는 [상태보드](260707-RTW-기능-인벤토리-상태보드.md)에서 확인한다.** Chief가 계속 직접 활용하는 핵심 문서다. 다음 목표·결정 대기 요약은 [현황판](260928-RTW-현황판.md), 에이전트 실행 상황은 [ops 상태판](ops/PROGRESS.md)이다.

## 자주 보는 문서

| 확인할 것 | 문서 | 유지 방식 |
|---|---|---|
| 목표·전 기능 진도·다음 액션 | [상태보드](260707-RTW-기능-인벤토리-상태보드.md) | 기존 파일·한눈 지도·기능표 유지. 코드 대조 후 상태 갱신 |
| 지금 위치·다음 목표·Chief 결정 대기 | [현황판](260928-RTW-현황판.md) | 짧은 요약, 상세는 상태보드·정본 링크 |
| 왜 그렇게 결정했나 | [결정 로그](260707-RTW-결정-로그.md) | 결정 한 줄, 최신이 위 |
| 에이전트 진행·대기·막힘 | [ops 상태판](ops/PROGRESS.md) · [작업 입구](ops/README.md) | 종료 작업은 목록에서 제외 |
| 출시 전 복원할 값 | [출시 전 확인사항](출시%20전%20확인사항.md) | 반복 점검하는 현재 목록 |
| 문서 생성·종료·이동 절차 | [문서 지침](260509-BOXCYCLE-문서-생성-및-수정-지침.md) | 수명과 보관 위치의 단일 기준 |

## 현재 기준과 검토 중인 문서

`reference/`는 주제별 탐색 공간이다. **위치만으로 채택된 기준이 되지는 않는다.** 검토 중인 경제 설계와 부록은 아래 상태를 확인한다. 상태보드의 구현 기호와 문서의 채택 상태도 서로 다르다.

### 제품·용어·정책 — reference/product

| 문서 | 역할 | 문서 상태 |
|---|---|---|
| [마스터 비전](reference/product/260511-RTW-마스터-비전-및-종합계획.md) | 정체성·제품 원칙·로드맵 | SoT |
| [Ontology](reference/product/260714-RTW-Ontology.md) | 개념·용어·금지어 | 채택·SoT |
| [Trail·Trailhead 상세](reference/product/260517-제품-용어-Trailhead-Trail.md) | 도메인 동작·매핑. 용어 정의는 Ontology | 채택·범위 축소 |
| [tier·진입 정책](reference/product/260519-사용자-tier-및-진입-정책.md) | identity·tier·진입의 기준. 구현 진도는 상태보드 | SoT·부분 구현 |
| [tier quota](reference/product/260519-tier-quota-정책.md) | 생성·저장 한도 | 채택(1차)·tier 정책 부록 |
| [tier subscription](reference/product/260519-tier-subscription-정책.md) | Stripe 구독 | 채택(1차)·tier 정책 부록 |
| [Route Token 경제](reference/product/260518-Route-Token-경제-설계.md) | 경제 루프·소비처·저장 한도와의 관계 | 검토 중·미결 있음, 한시 무제한 |
| [퍼블릭 경로 자동등록](reference/product/260717-퍼블릭-경로-자동등록-정책.md) | 등록·자동 심사 조건 | SoT |
| [UI 공간밀도 원칙](reference/product/260924-RTW-UI-공간밀도-원칙.md) | 화면 공간 규칙 D1~D7 | SoT |
| [주행 스토리 원칙](reference/product/261007-RTW-주행-스토리-원칙.md) | 주행 기록을 사람의 말로 건네는 규칙 N1~N10·순간별 문장 | 채택·SoT |

### 현재 설계 — reference/architecture

| 문서 | 역할 | 문서 상태 |
|---|---|---|
| [Conquest 설계](reference/architecture/260703-Conquest-정복-레이어-설계.md) | Ride = Claim 메커닉·데이터·단계별 구상 | SoT·미구현 단계 구분 |
| [World Activity Presence](reference/architecture/260523-World-Activity-Presence-설계.md) | 월드 맵 activity·presence 경계 | SoT |
| [lib 도메인 경계](reference/architecture/260925-RTW-lib-도메인-경계와-의존-방향.md) | 모듈 책임·허용 의존 | SoT |

### 반복 절차·개발 운영 — reference/operations

| 문서 | 역할 | 문서 상태 |
|---|---|---|
| [Firebase 비용 체크리스트](reference/operations/260523-Firebase-비용-운영-체크리스트.md) | 반복 비용 관측·대응 절차 | 검토됨·운영 문서 |
| [개발 워크플로](reference/operations/260719-개발-워크플로-브랜치-커밋-게이트.md) | 브랜치·커밋·검증 게이트 | SoT |
| [Skill·Harness 아키텍처](reference/operations/260722-Skill-Harness-아키텍처.md) | 규율·도구·실행코드 3계층 | SoT |
| [구조 게이트 운용](reference/operations/260926-RTW-구조-게이트-운용-지침.md) | 구조 도구·게이트 규율 | SoT |

## 작업과 기록

| 수명 | 위치 | 입구 |
|---|---|---|
| 진행·대기 계획, 지시·결과·검수 | `ops/YYYYMMDD-주제/` | [진행·대기 작업](ops/README.md) |
| 미착수 경쟁 판정 계획 | `ops/20260927-peer-competition/` | [계획 입구](ops/20260927-peer-competition/README.md), 현재 구현 기준과 구분 |
| 종료 묶음·최종 보고·대체된 기준 | `archive/` | [완료 기록 색인](archive/README.md). 경로 의존으로 제자리 보관한 종료 묶음도 여기서 찾는다 |

새 보고서는 `archive/reports/`, 대체 정본은 `archive/superseded/`, 종료 묶음은 `archive/ops/`에 보관한다. 기존 archive 최상위 기록은 경로를 유지한다. 매 작업마다 별도 보고서를 추가하지 않고, 일반 작업은 묶음의 최종 결과로 충분하다.

## 정책 시드 — 경로 유지

| 파일 | 용도 |
|---|---|
| [config-tierQuotas.seed.json](config-tierQuotas.seed.json) | tier 한도 시드 |
| [config-subscription.seed.json](config-subscription.seed.json) | 구독 시드 |
| [config-routeTokenEconomy.seed.json](config-routeTokenEconomy.seed.json) | Route Token 시드 |

시드는 문서 본문이 아닌 운영 입력이다. 폴더 미관을 이유로 이동하지 않는다.

## 정리 검증

`node scripts/check-document-system.mjs`는 현재 문서 링크·reference 색인 누락·종료 작업의 PROGRESS 잔류를 확인한다. `--all`은 과거 기록까지 검사하며 기존 오류도 실패로 보고한다. anchor·동적 경로·코드블록 예시는 검사 대상이 아니다.

[2026-10-05 정리 결과](archive/reports/261005-RTW-문서체계-정리-완료보고.md) · [실제 이동 목록·검수](ops/20261005-document-system/README.md)
