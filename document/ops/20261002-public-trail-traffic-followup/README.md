# Public Trail traffic followup — 잔여 저감 여지 감사

| 항목 | 내용 |
|------|------|
| 문서 유형 | **ops 묶음** — Public Trail 동행 트래픽 후속(증거 기반 잔여 여지 검토) |
| 독자 | **AI** (Chief는 [PROGRESS](../PROGRESS.md) · 본 README 요약만) |
| 최초 작성 | 2026-10-02 |
| 상태 | **AWAITING_CHIEF** — TASK-02R 검수 APPROVED, 배포 후 운영 1/2명 입력 대기 |
| 연결 문서 | [이전 묶음(종료)](../20260929-public-trail-traffic/README.md) · [최종 보고](../../archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md) · [ops 색인](../README.md) |

## 목적

배포 완료된 Public Trail 동행 트래픽 개선 **이후**, 사용자/Chief 관측상 트래픽은 많이 줄었으나 **아직 독립 계측으로 검증하지 않은 추가 저감 여지**를 이전 묶음과 같은 방식(지시 → 결과 → Supervisor 검수 → 필요 시 Chief 게이트)으로 이어 간다.

첫 TASK는 **read-only audit**다. 코드·테스트·배포·production write 없음.

## 환경 (공식 후속)

| 항목 | 값 |
|---|---|
| Worktree | `C:\Users\kdrea\.codex\worktrees\public-trail-traffic-followup\boxcycle` |
| Branch | `codex/public-trail-traffic-followup` |
| Base | `origin/main` @ `2cdaea6b7ca6468254e239a2fd2b2ab719c27c62` |
| 역할 | Chief 결정 · Codex Supervisor 설계·검수 · Cursor CLI 조사·구현·검증 |
| 이전 traffic worktree | 정리됨 — **이 worktree가 공식 후속 환경** |

이전 묶음·stash·로컬 백업 경로는 이 후속 작업에 **필요 없다**. Developer는 건드리지 말 것(비밀·환경값 문서화 금지).

## 확정 baseline (혼동 금지)

이전 개선은 **배포 완료**. 권위 숫자는 [최종 보고](../../archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md)를 따른다.

| 층 | 상태 | 쓸 수 있는 것 |
|---|---|---|
| Emulator 28D-B(1s) → 31B-R(4s) | **확정 (E)** | FS writes solo **73.2%** · dual **72.5%**; hub callback solo **72.3%** · dual **70.1%**. 약칭 ~73%는 **FS writes만**. 달러·production 배수·묶음 총효과로 승격 금지 |
| Production billed 1v2 | **미측정 (Ø)** | 절감률 주장 금지 |
| Listing Created/Deleted + Hosting | **배포 DONE** | [37](../20260929-public-trail-traffic/37-result-r2-deploy.md) · code SHA `803f6ff` 시점 |

### Chief 제공 후속 관측 (독립 계측 검수 전)

아래는 Chief가 새로 공유한 **실제 관측**이다. 사용자 만족·방향성에는 강한 증거이나, **정식 귀속/비용 검증·독립 계측 검수 전**이다. 「대성공 / 근본 해결 / 완벽 통제 / 누수 완전 해소」를 기술적 확정으로 쓰지 말 것.

| 구간 | peak read/write | run read/write |
|---|---:|---:|
| pre-change 2 riders | 1400 / 280 | 4239 / 855 |
| post-change 2 riders | 471 / 166 | 1366 / 365 |
| post-change 3 riders | 584 / 189 | 1509 / 414 |

계산값 (post 2 vs pre 2): peak read **−66.4%** · peak write **−40.7%** · run read **−67.8%** · run write **−57.3%**.

3 rider 수치는 **참고 관측**이다. 기존 승인 비교 범위는 **1/2 riders only**이므로 첫 audit의 성능 검증 범위를 3명 이상으로 **자동 확대하지 말 것**.

## 지금 할 일

1. Developer: [TASK-01](01-task-remaining-opportunity-audit.md) 읽기 전용 감사 완료 → [결과](02-result-remaining-opportunity-audit.md).
2. Supervisor: [03 검수](03-review-remaining-opportunity-audit.md) **APPROVED**.
3. Chief: 테스트·코드 변경 승인(2026-10-02) → [TASK-02](04-task-phase-aligned-measurement.md) 측정 도구 범위 개방.
4. Developer: TASK-02 완료 → [결과](05-result-phase-aligned-measurement.md). production billed 1v2는 **Ø**.
5. Supervisor: [06 검수](06-review-phase-aligned-measurement.md) **REWORK_REQUIRED** (누락/중복 분·metric·fixture).
6. Developer: [TASK-02R](07-task-phase-aligned-measurement-rework.md) → [08 결과](08-result-phase-aligned-measurement-rework.md).
7. Supervisor: [09 재검수](09-review-phase-aligned-measurement-rework.md) **APPROVED** — 도구·테스트 완료. 운영 P/billed 1v2는 입력 없어 **Ø**. 배포·트리거/전송 주기·A/B/D는 별도 Chief 게이트.

인수인계·새 창 시작 순서: [00-handoff.md](00-handoff.md).

## 파일

| 파일 | 역할 |
|---|---|
| [00-handoff.md](00-handoff.md) | 공식 handoff · 새 창 시작 프롬프트 |
| [01-task-remaining-opportunity-audit.md](01-task-remaining-opportunity-audit.md) | 첫 Developer 지시 (read-only) |
| [02-result-remaining-opportunity-audit.md](02-result-remaining-opportunity-audit.md) | Cursor CLI 감사 결과 |
| [03-review-remaining-opportunity-audit.md](03-review-remaining-opportunity-audit.md) | Supervisor 검수 APPROVED · Chief 게이트 |
| [04-task-phase-aligned-measurement.md](04-task-phase-aligned-measurement.md) | TASK-02 — phase-aligned 측정 도구 |
| [05-result-phase-aligned-measurement.md](05-result-phase-aligned-measurement.md) | TASK-02 Cursor CLI 결과 (초판 · 일부 주장 정정) |
| [06-review-phase-aligned-measurement.md](06-review-phase-aligned-measurement.md) | Supervisor 검수 REWORK_REQUIRED |
| [07-task-phase-aligned-measurement-rework.md](07-task-phase-aligned-measurement-rework.md) | TASK-02R 재작업 지시 |
| [08-result-phase-aligned-measurement-rework.md](08-result-phase-aligned-measurement-rework.md) | TASK-02R Cursor CLI 결과 |
| [09-review-phase-aligned-measurement-rework.md](09-review-phase-aligned-measurement-rework.md) | Supervisor 재검수 APPROVED |

## 명시적 비목표 (이 묶음 첫 단계)

즉시 throttle 변경 · trigger 삭제 · RTDB rate 변경 · schema/rules/data migration · production deploy · 3명 이상 최적화 구현.

## Chief 결정 게이트

Public Trail 동기화 의미, Firestore/RTDB 구조, Cloud Function 트리거 의미, 비용과 fallback 품질을 바꾸는 **구현**은 audit 결과를 Supervisor가 검수한 뒤 **Chief 승인 전 금지**.
