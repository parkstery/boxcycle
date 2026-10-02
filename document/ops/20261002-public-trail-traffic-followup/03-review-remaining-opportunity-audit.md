# Supervisor review — Remaining opportunity audit

| 항목 | 내용 |
|---|---|
| 검수 대상 | [TASK-01](01-task-remaining-opportunity-audit.md) · [Cursor 결과](02-result-remaining-opportunity-audit.md) |
| 판정 | **APPROVED — 읽기 전용 감사 완료** |
| 범위 | 감사 결과 검수만. 제품 변경·측정 실행·배포 승인 아님 |
| 날짜 | 2026-10-02 |

## 확인

- Cursor CLI 종료 코드 0. 감사 전 HEAD `68f0f11c9a1f8c1343c70bbeec28647bb8214663`, clean. 종료 후 `git status --short`의 변경은 결과 문서 한 파일(`?? 02-result-remaining-opportunity-audit.md`)뿐이며 제품·테스트 diff는 없다.
- 결과의 A–F 경로를 현재 tip과 대조했다. `functions/src/routeActivityOnLivePublicationRideWritten.ts:112`는 Written 트리거이고 `:172`는 heartbeat-only 조기 종료다. `:214–236`은 pulse/anchor 갱신 경로다. `apps/web/src/lib/ride/rideSyncPolicy.ts:39,42`는 FS 4초·RTDB 200ms다. `apps/web/src/lib/ride/liveLocationSnapshot.ts:137–174`는 최초·속도 변화 우회 경로가 있다. `apps/web/src/lib/trail/trailLivePolicy.ts:16`은 peer stale 15초다.
- 에뮬레이터 28D-B→31B-R의 FS writes 73.2%/72.5%, hub callback 72.3%/70.1%, production billed 미측정, 8–10초 거부, 1/2명 비교 범위를 분리해 보존했다. Chief 제공 숫자는 L 관측으로 별도 분리했다.
- A–F별 비용식, 검증·미검증, 효과·위험·필요 증거·Chief 게이트, “수정 없음” 선택지가 갖춰졌다. 테스트 미실행도 명시됐다.

## 해석 시 주의

- A의 0.25/s와 D의 5 set/s는 **정상 주기만의 근사/목표 상한**이다. 최초 발행·속도 변화·타이머/비행 상태로 실제 건수는 달라진다. 특히 31B-R의 RTDB 실측은 45초 solo 151, dual 합 290이므로 5Hz를 실측 속도로 읽지 않는다.
- C의 hub delivery는 클라이언트 callback이며 billed Firestore read가 아니다. 문서는 이를 구분했다.
- E의 종료 경로는 publish cleanup과 listener scope를 함께 다루므로, 실제 누수 수정은 재현과 해제 타이밍 추적 후 별도 판단한다.

위 주의는 결과의 방향·완료 조건을 뒤집지 않는다. 구현 채택이나 절감액 확정은 이 판정에 포함되지 않는다.

## 다음 게이트

**F(운영 구간 정렬 관측)**를 먼저 별도 지시로 설계하는 것이 타당하다. 그 결과에 따라 수정 없음/A/D 중 선택한다. A는 pulse·anchor 대체 설계, D는 liveness·fallback 품질 설계가 선행되어야 한다. Public Trail 동기화 의미, Firestore/RTDB 구조, CF 트리거 의미, 전송 주기 또는 비용↔품질을 바꾸는 구현과 배포는 **Chief 승인 전 금지**다. 현재 단계는 `AWAITING_CHIEF`로 기록한다.
