# Foreground 복귀 Firestore read spike

| 항목 | 내용 |
|---|---|
| 문서 유형 | **ops 묶음** — 비활성/백그라운드 앱의 foreground 복귀만으로 발생하는 Firestore 읽기 급증 조사·저감 |
| 최초 작성 | 2026-10-03 |
| 상태 | **APPROVED** — `main2` fast-forward 통합 완료 (로컬) |
| Supervisor | Codex |
| Developer | Cursor CLI |
| 연결 | [최종 승인 21](21-review-final-approval.md) · [통합 지시 22](22-task-merge-main2.md) · [결과 23](23-result-merge-main2.md) · [전체 상태판](../PROGRESS.md) |

## 사용자 관측

- 3개 브라우저, 총 4개 앱 화면에서 foreground/background 전환과 비활성 앱 클릭 활성화만 수행했다.
- 앱 내부 주행·메뉴 조작은 없었다.
- Firebase Console 지난 60분 화면은 약 **읽기 1.2만**, **쓰기 302**, 스냅샷 리스너 최대 **41**, 활성 연결 최대 **8**을 보인다.
- 캡처는 현상 증거다. 특정 코드 경로의 원인이나 billed read 귀속은 별도 계측 없이 확정하지 않는다.

## 목적과 완료 조건

1. focus/visibility/pageshow/online 전환 때 어떤 Firestore 구독·단건 조회가 새로 열리거나 재연결되는지 경로별로 확정한다.
2. 4개 화면이 백그라운드↔foreground를 반복하는 재현 하네스 또는 결정적 계약 테스트를 만든다.
3. 제품 의미를 보존하면서 백그라운드 불필요 리스너와 복귀 재구독 fanout을 줄인다.
4. 변경 전후 리스너 open/close, snapshot delivery 또는 read proxy를 같은 시나리오로 비교한다.
5. focused tests, lint, typecheck/build와 필요한 emulator 검증을 통과한다.

## 범위 제한

- 실 Firebase production write/deploy 금지. Firebase Emulator 또는 순수 하네스만 사용한다.
- 데이터 모델, Rules, 컬렉션 경로, Public Trail 동기화 의미를 임의로 바꾸지 않는다.
- Console 합계를 특정 코드의 billed read로 승격하지 않는다.
- 원인 감사 후 Supervisor 검수 없이 넓은 구현으로 확장하지 않는다.

## 진행

초기 후보 기록(00-brief, 01~05의 focus-read-audit/fix 계열)은 대체 상태를 표시해 보존한다. 현행 지시는 아래 최종 체인이다. 초기 코드·시험은 [보관 색인](../../archive/ops/20261003-focus-read-spike-initial-candidate/README.md)으로 분리했다. 정리: [25 지시](25-task-retire-untracked.md) → [26 결과](26-result-retire-untracked.md) → [27 검수 PASS](27-review-retire-untracked.md). 본 작업의 구조 검사를 방해하던 미추적 후보를 앱 경로에서 제거했다.

1. TASK-01 read-only 원인 감사 및 재현 설계 — **APPROVED**.
2. TASK-02 visibility operation proxy 계측 — **REWORK_REQUIRED** ([06](06-review-visibility-meter.md)).
3. TASK-02R 실제 network call proxy·production no-op·N=3 근거 보강 — **APPROVED**.
4. TASK-03 catalog TTL + Activity World fresh-resume — **APPROVED**.
5. TASK-04 listener 10초 grace + presence resume throttle — **APPROVED**.
6. TASK-05 최종 감사·전용 브랜치 커밋 — 제품 `e2a49e2` 유지, docs range check로 **REWORK_REQUIRED** ([18](18-review-final-audit.md)).
7. TASK-05R ops 문서 공백·기록 정정 — **APPROVED** ([20](20-result-docs-range-fix.md)).
8. TASK-06 `main2` fast-forward 통합 — **APPROVED** ([23](23-result-merge-main2.md)). push/deploy는 미실시.
