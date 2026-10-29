# HANDOFF — 지금 상태 한 장

> **8KB 이내로 유지한다.** `node scripts/handoff-check.mjs`가 크기·최신성을 점검한다(`--check`는 12KB 초과·낡음이면 exit 1).
> 날짜별 장문 기록은 여기에 쌓지 않는다 — 한 줄 요약은 [PROGRESS](PROGRESS.md), 상세는 묶음 결과 파일에 둔다.
> 2026-10-29 슬림화 이전의 전체 기록(96KB): [archive](../archive/261029-HANDOFF-슬림화-이전-전체기록.md)

| 항목 | 값 |
|---|---|
| 담당 | **Claude Code Supervisor(Opus 5.5)** — 2026-10-29 Chief 「코덱스 작업을 이어받아서 처리」로 Codex에서 인수. 구현 Cursor CLI(막히면 impl-standard) |
| 갱신 | 2026-10-29 — 미커밋 묶음 전부 커밋(Chief 지시), 간편 인터벌 01 착수 |
| 브랜치 | `main2` |
| 마지막 배포 | 2026-10-29 Hosting: Firestore 자기 문서 서버 제외(제품36d6d728·타인 상시 백업 유지). [09결과](20261029-peer-cost-quality/09-firestore-read-reduction.md) |

## 진행 중 (체크포인트 — 큰 단계 시작 직전에 먼저 적는다)

간편 인터벌 01 구현 — Cursor CLI(agent -p --force --trust)에 [01지시](20261029-quick-interval-ride/01-task.md) 위임, 결과 `20261029-quick-interval-ride/02-result-cursor.md`(STARTED/DONE/NEXT 줄). 끝나면 Claude Code 감리(tsc/eslint/selector/build/quick-interval spec·캡처) → Chief 그림 보고.
재개: 결과 파일 마지막 DONE/NEXT와 git status부터. 3000·5031·5041 보존, 커밋·푸시·배포 없음.

## 다음 한 걸음 (직전 기록 기준 — 인수자가 확인)

1. Firestore 타인 위치fanout 구조 저감과 운영원가귀속. 자기 문서 제외는 배포됨. 상시 백업을 끊는 안은 복구 지연 때문에 채택 안 함. ([09](20261029-peer-cost-quality/09-firestore-read-reduction.md))
2. [인터벌 경로 계획](20261029-quick-interval-ride/00-plan.md)(Chief 순서 변경): 간편 01(진행 중) → [거리 부족 안내](20261029-interval-route-hint/01-task.md) → [01-B](20261029-quick-interval-ride/01b-task-end-and-cut.md). 인터벌 기준 모두 25km/h(`resolveIntervalBasisKmh` 한 곳), 간편=25×1.3.
3. 미푸시·미배포 커밋: 4b4f5427 지도아이콘 · 2264047e 미니맵접기 · f2b1b882 왼쪽메뉴 · 7d2831d9 B안 가독성 + 문서 커밋. 푸시·배포는 Chief 지시 대기. HEAD에서도 실패하는 고정14·30·목록11 등 UI 9건 조사 필요([03감리](20261029-left-menu/03-audit-claude.md)).
4. 커밋 제외: compact-controls evidence zip 2개(각 182MB), `.out/`(배포 빌드 복사본), 빈 `claude-headless.err`.

## Chief 결정 대기

커밋들의 푸시·배포 여부.

## 잊지 말 것

- 순위 센서 조건 임시 완화는 **출시 전 서버 상수 true 복구** 필요([묶음](20261029-leaderboard-sensor-test/README.md), 체크리스트 §6).
- Firestore 백업이 꺼져 있다(2026-10-08 기준). 운영 데이터 삭제·이동은 Chief 승인 + 사전 스냅샷.

## 최근 기록 (최신 10건 제목 — 원문은 archive·PROGRESS)

- 2026-10-29 트래픽저감1단계 DEPLOYED / Codex직접
- 2026-10-29 트래픽저감1단계 구현완료/미배포·푸시자동승인차단
- 2026-10-29 트래픽저감 구현·실측검증중 / Codex직접
- 2026-10-29 동행 표본시각 수정 DEPLOYED·트래픽검토완료
- 2026-10-29 동행 표본시각 수정 릴리스 승인·진행
- 2026-10-29 Chief휴식중·송신표본시각 결함 로컬수정/미배포
- 2026-10-29 수신공백→동속상대후퇴/복귀 합성재현
- 2026-10-29 5km/h 동속 프레임 재발가설 점검
- 2026-10-29 동행 간격·보간 이력 대조
- 2026-10-29 동행 보고서 재확인·증상 정정

## 지킬 것

- 타인의 변경 보존: `git restore`·`checkout -- .`·`clean`·`stash`·worktree·일괄 되돌리기 금지. 비추적 `.out/`·`cdbox.bat`은 손대지 않는다.
- 다른 프로젝트(imgman) 개발 서버(포트 3000·3001)는 종료하지 않는다.
- Chief에게 링크를 주지 않는다(터미널에서 안 열림). 보여줄 파일은 `Start-Process "<전체 경로>"`로 직접 연다.
- 보고마다 구현·감리·캡처를 한 agent를 명시한다.
- 실행자 호출·게이트 명령·배포·환경 사실: [수퍼바이저 교대 플레이북](../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md) §3~§7. 화면 고정 항목: [Chief 지정 디자인 고정](../reference/product/261024-RTW-Chief-지정-디자인-고정.md).
- 옛 구역(10-24~25 묶음3~5 완료 기록, 배포 방법 복제본 절차, 포트 PID 기록)은 archive에 있다.

## 인수·인계 (요약 — 규칙 정본은 플레이북 §1~§2)

- 인수: `node scripts/handoff-check.mjs` → 「담당」 교체 → 변경 파일·최신 결과 파일과 대조 → Chief에게 한 줄 보고.
- 인계: 작업 단위가 끝날 때마다 이 문서의 「진행 중」·「다음 한 걸음」·「결정 대기」·「갱신」만 고친다(로그를 덧붙이지 않는다).
