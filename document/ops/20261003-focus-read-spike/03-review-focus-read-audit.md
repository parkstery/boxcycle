> 보관 기록 — 초기 후보 작업. 아래 상태·정책·실행 명령은 당시 기록이며 현재 작업 지시가 아니다. 최종 구현은 [21 승인](21-review-final-approval.md)·[23 통합](23-result-merge-main2.md), 초기 코드 보관은 [보관 색인](../../archive/ops/20261003-focus-read-spike-initial-candidate/README.md)을 따른다.

# Supervisor review — TASK-01 포커스 read 감사

| 항목 | 내용 |
|---|---|
| 대상 | [01 지시](01-task-focus-read-audit.md) · [02 결과](02-result-focus-read-audit.md) · 진단 e2e diff |
| 판정 | **APPROVED — 원인 감사·범위 제한 재현 완료** |
| 날짜 | 2026-10-03 |

## 검수

- 제품 런타임 diff는 없고, 진단용 Playwright spec·npm script·ops 문서만 추가됐다. `test:e2e:focus-read-audit`의 emulator-only guard와 한 창의 focus-only / hidden→visible / 반복 분리 코드를 확인했다. Cursor 결과 1/1 PASS를 기록한다.
- `useDocumentVisibility`는 visibilitychange만 소비한다. `App.tsx:947–951`은 visible 복귀마다 공개 Route 카탈로그를 재조회하고, Activity World enabled 복귀는 즉시 full sync를 수행한다. 이는 코드상 확정 경로다.
- Trailhead에서 active live-ride CG underlying은 `useOpenTrails` 소비자가 유지해, 진단 조건의 hidden→visible에서 `openTotal` 증가가 없었다. 반복 3회의 tracked underlying 누수도 없었다.
- **제한:** test의 visibility 상태는 합성 이벤트이고, 빈 emulator의 Guest Trailhead 한 창뿐이다. 운영 약 600 reads, 세션/목록 등 미터 밖 리스너, live Trail overlay 규모는 재현되지 않았다. 프로젝트 전체 Console 그래프만으로 한 창의 billed read나 중복을 확정하지 않는다.

## 후속 판단

코드로 확인된 카탈로그·Activity World 복귀 재조회에 한정해, 짧은 숨김 뒤 **최근 성공한 데이터의 재사용** 후보를 구현·검증한다. 초기 로드, 명시적 새로고침, 오래 숨겼다가 돌아온 경우와 실패 재시도는 유지해야 한다. 현재 Trail peer/RTDB 동기화는 제외한다. 신선도↔읽기 비용 변경이므로 후보를 별도 branch에서 검수하고 Chief가 병합 여부를 결정한다.
