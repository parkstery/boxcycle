> 보관 기록 — 초기 후보 작업. 아래 상태·정책·실행 명령은 당시 기록이며 현재 작업 지시가 아니다. 최종 구현은 [21 승인](21-review-final-approval.md)·[23 통합](23-result-merge-main2.md), 초기 코드 보관은 [보관 색인](../../archive/ops/20261003-focus-read-spike-initial-candidate/README.md)을 따른다.

# TASK-01 — 포커스 복귀 read 급증 원인 감사·재현

| 항목 | 내용 |
|---|---|
| 담당 | Cursor CLI Developer |
| Supervisor | Codex |
| 상태 | DEVELOPMENT_DONE |
| 결과 | [02-result-focus-read-audit.md](02-result-focus-read-audit.md) |

## 목표

[Brief](00-brief.md)의 네 후보를 현재 main2 계열 코드와 **재현 증거**로 구분한다. 포커스만 얻는 경우와 `document.visibilityState` hidden→visible을 분리한다. 결과가 나오기 전 임의로 백그라운드 구독 정책을 바꾸지 않는다.

## 범위

1. 시작 `git status`, HEAD 기록. 이 묶음 README/brief, 이전 traffic [audit](../20261002-public-trail-traffic-followup/02-result-remaining-opportunity-audit.md)·[병합 검수](../20261002-public-trail-traffic-followup/12-review-merge-main2.md), `listener-scope-ride.spec.ts`·`readSubscriptionMeters`를 읽는다.
2. `useDocumentVisibility`와 그 소비자, `window.focus`/`pageshow` 경로, `onSnapshot`/`getDoc(s)`·catalog refresh를 현재 path:line으로 지도화한다. 숨김/복귀 시 실제 subscribe/unsubscribe 및 조회 발행 지점을 구분한다.
3. 가능하면 **로컬 emulator만** 사용하는 headless 단일 worker 재현으로 무주행 Guest/Trailhead에서 (a) 가시성은 계속 visible인 focus 전환, (b) hidden→visible, (c) 반복 전환을 분리 측정한다. 기존 DEV `__rtwReadSubs()`의 underlying open/openTotal/closeTotal, hub refcount, 필요한 경우 한시적 DEV 진단을 사용한다. 화면의 프로젝트 전체 지표를 클라이언트별 원인으로 대체하지 않는다.
4. 한 창의 리스너 중복이면 실제 underlying count와 해제 누락을 증명한다. 의도된 재구독이면 어느 쿼리·몇 문서 규모인지, 단발 조회이면 호출 횟수/결과 건수를 따로 보고한다. emulator callback·client meter·production billed read를 구분한다.
5. 명백한 원인이 드러나도 이 TASK에서는 **제품 런타임 수정 없이**, 최소 수정안·기능 위험·회귀 게이트·Chief 결정 필요 여부를 제안한다. 진단용 스크립트/테스트가 필요하면 이 묶음 범위로만 추가하고 명령·결과를 적는다.

## 금지·대기 전환

- production 실주행·write, deploy, push, Firestore/RTDB/Rules/schema/CF trigger 변경.
- 현재 Trail peer liveness/fallback 구독과 주행 전송 주기 변경.
- 원인 미확정 상태에서 `onSnapshot`을 일괄 `getDocs`/cache로 대체하거나 숨김 구독 전체 해제.
- 브라우저/Playwright가 5분간 유의미한 진전 없이 대기하면 중단 후 프로세스·서버·포트·로그를 확인하고 headless·단일 worker·정적/단위 경로로 전환.
- commit은 Supervisor 검수 전 하지 않는다.

## 결과 필수

재현 조건·명령·성공/실패·미실행, 상태별 query/read/underlying listener 증거, 후보별 확정/반박/미측정, source path:line, 프로젝트 전체 그래프의 한계, 최소 수정 우선순위와 안전 게이트, Chief 결정 필요 여부, 범위 밖 발견. 막히면 원인과 이미 완료한 정적 감사까지 결과에 남긴다.
