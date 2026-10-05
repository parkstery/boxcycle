# 완료 기록·종료 작업 색인

| 항목 | 내용 |
|---|---|
| 문서 유형 | 메타 — 과거 기록의 입구 |
| 최초 작성 | 2026-10-05 |
| 독자 | chief · AI |
| 상태 | SoT — 기록 위치 색인, 제품 현재 기준은 아님 |
| 연결 문서 | [문서 입구](../README.md) · [현재 작업](../ops/README.md) |

기록은 당시 판단·증거를 보존한다. 현재 규칙은 [reference](../README.md#현재-기준과-검토-중인-문서)와 [상태보드](../260707-RTW-기능-인벤토리-상태보드.md)에서 찾는다.

## 보관 위치

| 위치 | 내용 |
|---|---|
| `reports/` | 새 최종 결과 보고서. 일반 작업은 묶음의 최종 결과만으로 충분하며 별도 보고서를 의무적으로 복제하지 않는다 |
| `ops/` | 경로 의존이 없는 종료 작업 묶음 전체 |
| `superseded/` | 새로 대체·폐기되는 정본. 대체 문서·이유를 상단에 표시 |
| 이 폴더 최상위의 기존 날짜 파일·증거 폴더 | 이전 계획·보고·스냅샷·증거. 기존 경로 유지, 현재 기준과 구분 |

기존 기록은 날짜·주제로 `rg --files document/archive` 또는 `rg '<키워드>' document/archive`로 찾는다. 전수 과거 링크 검사: `node scripts/check-document-system.mjs --all`. 기존 누락 링크도 실패로 보고한다.

## 종료 묶음 — 제자리 보관

아래 묶음은 종료됐다. 현재 작업이 아니며 자동 재개하지 않는다. 코드·시험·스킬·명령·주석이 기존 경로에 의존해 이동을 보류했다. 재개는 별도 새 지시로 한다.

| 묶음 | 종료 결과 | 이동을 막는 참조 |
|---|---|---|
| [20261005-peer-spacing-jitter](../ops/20261005-peer-spacing-jitter/README.md) | Chief PASS · main2/main 통합 · [최종 보고](261005-RTW-동행-위치-동기화와-반복진동-해결-결과보고.md) | `apps/web/scripts/peer-sync/*harness*`·mutation 도구의 입력/출력 경로 |
| [20260929-public-trail-traffic](../ops/20260929-public-trail-traffic/README.md) | CLOSED · [최종 보고](261001-Public-Trail-동행-트래픽-개선-결과보고.md) · 운영 billed 관측은 별도 미실시 | `apps/web/scripts/e2e/run-public-trail-traffic-meter.mjs`가 실행 결과를 이 묶음에 복사 |
| [cyclefit-relay](../ops/cyclefit-relay/HANDOFF.md) | 09-28 Chief 종료 · [라이더 교체 완료](260922-RTW-라이더-신구모델-교체-완료보고.md) | `.claude/commands/지시확인.md`·`.cursor/commands/order.md` 등 |
| [route-relay](../ops/route-relay/) | 09-28 Chief 종료 · 후속은 [Local First Ride](260923-RTW-Local-First-Ride-실행계획.md)로 흡수 | `apps/web/e2e` 증거·계약 참조 |
| [20260924-camera-qc](../ops/20260924-camera-qc/README.md) | 지시04 PASS·배포 | `apps/web` 코드 주석 |
| [20260923-first_ride](../ops/20260923-first_ride/README.md) | [Local First Ride 1차 완료](260924-Local-First-Ride-1차-완료보고.md) | 스킬·functions·ops-relay 명령 |
| [20260922-new_camera](../ops/20260922-new_camera/HANDOFF.md) | [Quick Camera 완료](260923-RTW-Quick-Camera-작업-완료보고서.md) | `apps/web/e2e`·ops-relay 명령 |
| [giant-relay](../ops/giant-relay/INSTRUCTION.md) | 미채택 · [실험 종결](260827-라이더-자이언트-스케일-실험-종결.md) | `apps/web` 코드 주석 |

등속 동행 종료 기록의 stall/clock·billed·수동배포 잔여는 최종 보고에 보존한다. 제품 잔여 목표는 상태보드에서 추적하며, 종료 묶음을 다시 활성 목록에 넣지 않는다.

## 이동한 종료 묶음

초기 후보 코드 보관: [20261003-focus-read-spike-initial-candidate](ops/20261003-focus-read-spike-initial-candidate/README.md). 최종 구현과 분리해 소스·시험 5개를 내용 그대로 보존하며 앱 검사에서 제외한다. 전체 작업의 CLOSED 선언은 아니다.

| 묶음 | 무엇 | 이동일 |
|---|---|---|
| [20260929-ai-development-system](ops/20260929-ai-development-system/README.md) | Codex ↔ Cursor CLI 프로토콜 검수 PASS · [완료 보고](260929-RTW-AI-개발체계-구축-완료보고.md) | 2026-10-05 |
| [ride-relay](ops/ride-relay/) | 이어 달리기·도로망 성취 0~3단계(4·5 폐기) | 2026-09-28 |
| [sensor-relay](ops/sensor-relay/) | BLE 케이던스 직결·HUD 센서 칩 | 2026-09-28 |
| [rider-replace](ops/rider-replace/) | 라이더 GLB 교체 사전 점검 | 2026-09-28 |
| [20260924-structure-audit](ops/20260924-structure-audit/) | 구조 감사 원본 | 2026-09-28 |
| [map-relay](ops/map-relay/) | 줌 LOD·현재 위치 표시, 09-28 Chief 종료 | 2026-09-28 |

## 최근 완료 보고

| 보고 | 내용 |
|---|---|
| [문서 체계 정리](reports/261005-RTW-문서체계-정리-완료보고.md) | 상태보드 입구 유지·reference 분류·현재/종료 작업 분리·링크 검사 |
| [동행 위치 동기화](261005-RTW-동행-위치-동기화와-반복진동-해결-결과보고.md) | tSrv/D600·거리 양자·Chief 실주행 PASS |
| [Public Trail 트래픽](261001-Public-Trail-동행-트래픽-개선-결과보고.md) | 전송·구독 개선과 미측정 한계 |
