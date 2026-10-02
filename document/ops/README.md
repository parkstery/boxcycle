# ops — 에이전트 작업 창구

| 항목 | 내용 |
|------|------|
| 문서 유형 | **메타** — `ops/` 묶음 색인. 폴더마다 한 줄 |
| 독자 | **chief** · AI |
| 최초 작성 | 2026-09-28 |
| 상태 | **SoT** — 묶음을 열거나 닫을 때 이 표를 함께 고친다 |
| 연결 문서 | [현황판](../260928-RTW-현황판.md) · [문서 지침 §8.4](../260509-BOXCYCLE-문서-생성-및-수정-지침.md) |

> `ops/` 는 Supervisor(Codex) ↔ Developer(Cursor CLI)의 공식 파일 기반 업무 창구다. 기존 Claude 릴레이 기록도 보존한다.
> chief 는 [전체 상태판](PROGRESS.md)과 아래 묶음 표로 현재 상황을 확인한다. 폴더 안의 지시서·보고서는 에이전트용이다.

## 역할과 handoff

1. **Chief**: 요구와 제품 방향을 전달하고 중요한 결정·최종 완료를 승인한다. AI 사이의 파일을 복사해 전달하지 않는다.
2. **Supervisor (Codex)**: 요구를 분석해 범위, 완료 조건, 검증 방법, 승인 필요 여부를 지시에 적고 상태를 `READY_FOR_DEVELOPMENT`로 둔다.
3. **Developer (Cursor CLI)**: 지정된 지시 파일을 읽고 그 범위만 수행한다. 실제 변경 파일, 실행한 검증과 결과, 실패·미완·범위 밖 발견을 별도 결과 파일에 적는다. 승인 대상이 발견되면 구현을 멈추고 `BLOCKED`로 보고한다.
4. **Supervisor**: 결과 문서뿐 아니라 Git diff와 검증 근거를 확인한다. 합격이면 `APPROVED`, 부족하면 이유와 완료 조건을 별도 재지시 파일에 기록해 `REWORK_REQUIRED`로 둔다. 완료 보고는 Chief에게 직접 한다.

이 역할은 **새 작업의 기본값**이다. 기존 Claude 묶음의 파일명·도메인 규율·증거는 해당 기록을 읽을 때 그대로 유효하다. 종료된 묶음에 남은 자동 대기 명령은 재가동을 뜻하지 않는다.

## 새 작업 묶음

`YYYYMMDD-주제/`를 만들고 `README.md`에 목적, 현재 상태, 최신 지시·결과·검수 링크와 다음 행동을 적는다. 규모에 맞춰 `00-brief.md`, `01-plan.md`, `02-task-01.md`, `03-result-01.md`, `04-review-01.md` 등을 **필요한 만큼만** 만든다. 기존 묶음의 이름은 바꾸지 않는다. 작업 지시는 담당자, 허용·금지 범위, 완료 조건, 검증 명령, 보고 경로, Chief 승인 조건을 명시한다. 지시와 결과와 검수는 서로 다른 파일로 남기고, 재작업은 다음 번호의 파일로 이어 이전 기록을 덮어쓰지 않는다. 완료 보고서는 [문서 지침 §8](../260509-BOXCYCLE-문서-생성-및-수정-지침.md)에 따라 `document/archive/`에 작성한다.

## 상태와 승인

`PLANNING` → `READY_FOR_DEVELOPMENT` → `IN_PROGRESS` → `DEVELOPMENT_DONE` → `UNDER_REVIEW` → `APPROVED` → `CLOSED`가 보통 흐름이다. 결정 대기는 `AWAITING_CHIEF`, 재작업은 `REWORK_REQUIRED`, 진행 불가는 `BLOCKED`를 쓴다. 모든 단계를 기계적으로 거칠 필요는 없다. [PROGRESS.md](PROGRESS.md)는 현재 작업·담당·단계·Chief 승인 여부·마지막 검수·막힘·다음 일을 보여주는 상태판이며, 상세 이력은 작업 폴더에 둔다.

Supervisor는 아키텍처, 도메인 경계, 데이터 모델, Firestore·RTDB·Firebase Rules, 외부 API, 의미 있는 비용, Public Trail 동기화 구조, 기존 공용 인터페이스, 대규모 이동, 기존 기능 의미, 요구 해석 또는 작업 범위의 큰 변경을 **구현 전에** Chief에게 올린다. 일반 작업의 사소한 판단은 Supervisor가 처리한다.

## 실행·Git

새 지시 한 건마다 Cursor CLI 프로세스 한 번을 기본으로 한다. `agent -p --workspace C:\20.HDev\boxcycle "document/ops/<묶음>/<지시파일>을 읽고 지시된 범위만 수행한 뒤 결과 파일을 작성하라"` 형태로 실행하고 종료 코드와 출력을 확인한다. 실제 옵션은 로컬 `agent --help`에서 확인한다. 무한 대기 릴레이는 기본 실행 방식이 아니다. Git 브랜치·커밋·푸시는 [개발 워크플로](../260719-개발-워크플로-브랜치-커밋-게이트.md)와 해당 작업 지시의 제한을 따른다. 다른 작업의 변경은 섞지 않는다.

## 규칙 (요약)

1. 새 묶음은 `YYYYMMDD-주제/` 로 열고 폴더 `README.md` 에 「지금 할 일」을 둔다. 이 표에 한 줄 추가.
2. 끝나면 이 표의 상태를 **종료**로 바꾸고, 결과 보고서는 `archive/` 에 둔다.
3. 종료된 폴더는 **코드·스킬·명령이 그 경로를 가리키지 않을 때만** `archive/ops/` 로 옮긴다. 가리키면 제자리에 둔다.

## 묶음 현황 (2026-10-03)

| 폴더 | 상태 | 무엇 | 결과·입구 | 이동 |
|------|------|------|-----------|------|
| [20261003-focus-read-spike](20261003-focus-read-spike/README.md) | **DEVELOPMENT_DONE** — TASK-05 커밋, 검수 대기 | 앱 foreground 복귀만으로 발생하는 Firestore read spike 조사·저감 | [17 최종 결과](20261003-focus-read-spike/17-result-final-audit-commit.md) | — |
| [20261002-public-trail-traffic-followup](20261002-public-trail-traffic-followup/README.md) | **AWAITING_CHIEF** — 측정 도구 검수 완료, 운영 데이터 Ø | Public Trail 트래픽 후속 — phase-aligned 측정 준비 | [08 재작업](20261002-public-trail-traffic-followup/08-result-phase-aligned-measurement-rework.md) · [09 검수 PASS](20261002-public-trail-traffic-followup/09-review-phase-aligned-measurement-rework.md) | — |
| [20260929-public-trail-traffic](20260929-public-trail-traffic/README.md) | **CLOSED** · 최종 보고 검수 완료 (production billed 1v2 관측 별도 미실시) | Public Trail 동행 트래픽 절감 — listing Created/Deleted + Hosting 배포 | [최종 보고](../archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md) · [R2](20260929-public-trail-traffic/37-result-r2-deploy.md) | 가능 |
| [20260929-ai-development-system](20260929-ai-development-system/README.md) | 종료 | Codex Supervisor ↔ Cursor CLI 파일 기반 개발 프로토콜 | [완료 보고](../archive/260929-RTW-AI-개발체계-구축-완료보고.md) · [검수 PASS](20260929-ai-development-system/04-review-01.md) | 불가 — 공통 규칙·상태판이 경로 사용 |
| [sync-relay](sync-relay/INSTRUCTION.md) | **대기** | 동행 위치 동기화. 활성 지시 없음, S4-4(동행 튐) 재개 보류 | 후속 계획: [동행 지연과 경쟁 판정](../260927-RTW-동행-지연과-경쟁-판정.md) | 불가 — `apps/web/scripts/peer-sync`·e2e·`/싱크지시` 가 경로 사용 |
| [20260923-minimap](20260923-minimap/HANDOFF.md) | **대기** | 미니맵·HUD 재배치. 지시04까지 병합 후 중단 | 남은 일: 보류01(배경에 실제 지도)·보류02 | 가능(종료 시) |
| [cyclefit-relay](cyclefit-relay/HANDOFF.md) | 종료 | 라이더-자전거 피팅(V2.4). 08-08 F36 이후 멈춤 → 09-28 종료(chief) | 라이더는 09-22 다른 경로로 교체 완료 → [완료 보고](../archive/260922-RTW-라이더-신구모델-교체-완료보고.md) | 불가 — `/지시확인`·`/order` 명령이 경로 사용 |
| [route-relay](route-relay/) | 종료 | Route Token · 거리·방향 자동 Route(3F-C-R1 병합) · 화면 정리 6A. 09-05 이후 멈춤 → 09-28 종료(chief) | 후속은 [Local First Ride](../archive/260923-RTW-Local-First-Ride-실행계획.md) 로 흡수 | 불가 — e2e 가 경로 사용 |
| [20260924-camera-qc](20260924-camera-qc/README.md) | 종료 | Quick Camera 후속 — QC1 4단·라이더 조명·센서칩 최소화 | 지시04 PASS·배포 | 불가 — 코드 주석이 경로 사용 |
| [20260923-first_ride](20260923-first_ride/README.md) | 종료 | Local First Ride 1차(지시01~11) | [완료 보고](../archive/260924-Local-First-Ride-1차-완료보고.md) | 불가 — 스킬·functions 가 경로 사용 |
| [20260922-new_camera](20260922-new_camera/HANDOFF.md) | 종료 | Quick Camera 1~6 | [완료 보고](../archive/260923-RTW-Quick-Camera-작업-완료보고서.md) | 불가 — e2e 가 경로 사용 |
| [giant-relay](giant-relay/INSTRUCTION.md) | 종료 | 라이더 20배 확대 실험 — 미채택 | [실험 종결](../archive/260827-라이더-자이언트-스케일-실험-종결.md) | 불가 — 코드 주석이 경로 사용 |

「정지」(종료 선언 없이 멈춘 묶음)였던 셋은 2026-09-28 chief 결정으로 종료했다. 새로 멈추는 묶음이 생기면 이 상태를 다시 쓴다.

## archive 로 옮긴 묶음

| 폴더 | 무엇 | 옮긴 날 |
|------|------|---------|
| [ride-relay](../archive/ops/ride-relay/) | 이어 달리기 · 도로망 성취 결과 0~3단계(4·5단계 폐기) | 2026-09-28 |
| [sensor-relay](../archive/ops/sensor-relay/) | BLE 케이던스 직결 · HUD 센서 칩(실센서 검증 통과) | 2026-09-28 |
| [rider-replace](../archive/ops/rider-replace/) | 라이더 GLB 교체 사전 점검(P·P2·B) | 2026-09-28 |
| [20260924-structure-audit](../archive/ops/20260924-structure-audit/) | 구조 감사 갈래별 원본(A·B·C) | 2026-09-28 |
| [map-relay](../archive/ops/map-relay/) | 줌 LOD 복구 · 지도 현재 위치 표시(방향 보정 시도 3/3에서 멈춤) — 09-28 종료(chief) | 2026-09-28 |
