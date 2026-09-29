# ops — 에이전트 작업 창구

| 항목 | 내용 |
|------|------|
| 문서 유형 | **메타** — `ops/` 묶음 색인. 폴더마다 한 줄 |
| 독자 | **chief** · AI |
| 최초 작성 | 2026-09-28 |
| 상태 | **SoT** — 묶음을 열거나 닫을 때 이 표를 함께 고친다 |
| 연결 문서 | [현황판](../260928-RTW-현황판.md) · [문서 지침 §8.4](../260509-BOXCYCLE-문서-생성-및-수정-지침.md) |

> `ops/` 는 감리↔개발팀장 등 에이전트끼리 지시·보고를 주고받는 곳이다. chief 는 이 표만 보면 된다.
> 폴더 안의 지시서·보고서는 에이전트용이다.

## 규칙 (요약)

1. 새 묶음은 `YYYYMMDD-주제/` 로 열고 폴더 `README.md` 에 「지금 할 일」을 둔다. 이 표에 한 줄 추가.
2. 끝나면 이 표의 상태를 **종료**로 바꾸고, 결과 보고서는 `archive/` 에 둔다.
3. 종료된 폴더는 **코드·스킬·명령이 그 경로를 가리키지 않을 때만** `archive/ops/` 로 옮긴다. 가리키면 제자리에 둔다.

## 묶음 현황 (2026-09-29)

| 폴더 | 상태 | 무엇 | 결과·입구 | 이동 |
|------|------|------|-----------|------|
| [20260929-public-trail-traffic](20260929-public-trail-traffic/README.md) | **검토 대기** | Public Trail 동행 트래픽 절감 — listing 증폭 차단·RTDB 5Hz 후보 | [검토 결과](20260929-public-trail-traffic/21-supervisor-review.md) · 실운영 계측/배포 별도 | 가능(종료 시) |
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
