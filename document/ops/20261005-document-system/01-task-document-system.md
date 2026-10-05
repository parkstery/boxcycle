# 문서 체계 정리 지시

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — Codex Supervisor → Cursor CLI Developer |
| 최초 작성 | 2026-10-05 |
| 독자 | AI |
| 상태 | READY_FOR_DEVELOPMENT |

## 목적과 완료 조건

현재 기준·진행 작업·완료 기록의 수명을 기준으로 문서 체계를 정리한다. 상태보드를 Chief의 첫 번째 입구로 유지한다. 내용·기능 상태를 재해석하거나 축약하지 않는다. 기존 경로 변경에 따른 링크·명령 참조를 함께 수정한다.

## 확정된 범위

1. 최상위 README, 상태보드, 현황판, 결정 로그, 문서 생성 지침은 경로 유지. 출시 전 확인사항과 정책 시드 JSON도 경로 유지(운영 입력). 상태보드의 기능표·기호·한눈 지도는 보존. 메타 독자와 사용법만 정리하며 코드 재검증 날짜를 갱신하지 않는다.
2. `reference/product/`로 마스터 비전, Ontology, 제품-용어-Trailhead-Trail, Route-Token-경제-설계, 사용자-tier-및-진입-정책, tier-quota-정책, tier-subscription-정책, 퍼블릭-경로-자동등록-정책, UI-공간밀도-원칙을 기존 파일명 그대로 이동(9편).
3. `reference/architecture/`로 Conquest-정복-레이어-설계, World-Activity-Presence-설계, lib-도메인-경계와-의존-방향 이동(3편).
4. `reference/operations/`로 Firebase-비용-운영-체크리스트, 개발-워크플로-브랜치-커밋-게이트, Skill-Harness-아키텍처, 구조-게이트-운용-지침 이동(4편).
5. 진행 중 동행-지연과-경쟁-판정(260927)은 새 `ops/20260927-peer-competition/` 묶음으로 이동. README에 기존 대기 상태·잔여 경쟁 판정·최신 표시 진동 해결 보고 링크와 재개 시 새 지시 필요를 명시. 이를 구현 착수나 종료로 간주하지 않는다.
6. 문서 README를 상태보드 첫 입구, 현황판 요약, reference 3종 분류, ops 진행·대기, archive 기록으로 정리. reference 파일 전부 등재하되 Route Token은 검토중·tier 부록은 부록임을 보존. 인덱스에서 SoT라는 이유로 초안을 채택됨으로 승격 금지.
7. 지침 §8을 수명 우선 체계로 개정하고 §3/4/6의 충돌 문구도 정리. Chief는 상태보드·현황판을 직접 활용한다. 상태보드=목표·기능 진도, 현황판=다음 목표·결정 대기, PROGRESS=현재 에이전트 작업. 새 계획·지시·결과·검수는 ops, 종료 묶음은 archive/ops, 새 최종 보고는 archive/reports, 대체 정본은 archive/superseded. 기존 archive 최상위 자료는 경로를 보존하며 archive/README에 과거 기록임을 표시. README/PROGRESS와 ops 번호 파일의 날짜 접두어 예외를 명시. 설계 채택 전/후와 반복 절차/일회 체크리스트 구분. 종료 시 정본 지식 반영·최종 결과·참조 검사·색인 갱신 절차를 규정. 기능/제품 의미 변화는 승인 대상.
8. ops README·PROGRESS에서 CLOSED/종료 항목을 현재 작업 표에서 빼고 `archive/README.md` 종료 이력 표로 옮긴다. APPROVED·AWAITING_CHIEF·대기는 현재 목록에 유지. 종료 묶음 자체는 코드·스킬·명령 경로 참조가 없음을 입증한 경우에만 archive/ops로 이동. 참조가 있으면 제자리 보관이라고 종료 색인에 명시한다. 옛 기록을 삭제하거나 완료 승인 없는 묶음을 종료로 바꾸지 않는다. 기존 archive/ops 묶음도 종료 색인에 포함.
9. Markdown 상대 링크는 이동 전 source/target 기준으로 재계산하고 루트 README·AGENTS.md·CLAUDE.md·.agents/.claude/.cursor의 링크·라우팅·scripts의 문서 경로 문자열도 갱신. 기존 ops/archive의 실제 상대 링크는 수정 가능, 과거 지시의 의미·당시 실행 증거는 보존. 경로 갱신 외 앱·functions·e2e 실행 동작 변경 금지. 시드 JSON 이동 금지. 다른 작업의 untracked 파일 수정/커밋 금지.
10. `scripts/check-document-system.mjs` 순정 Node 도구를 추가: 기본 실행은 현재 문서(document 최상위/reference/활성 ops README와 최신 문서)의 로컬 Markdown 링크 존재, reference 색인 누락, 종료 항목 PROGRESS 잔류를 검사. `--all`은 과거 archive/ops 포함 링크를 별도 보고. 기존 깨진 링크와 이번 회귀를 구분할 baseline(이동 전 JSON)을 이 묶음에 저장하고 결과 비교. 동적 placeholder·외부 URL·anchor는 제외. 전수 기존 오류를 숨기고 PASS로 쓰지 말 것. 새 경로의 옛 직접 참조가 남았는지도 rg로 점검. 자동 CI/hook 확장은 하지 않는다.
11. 결정 로그 최신에 [Docs] 한 줄: 상태보드 첫 입구·수명별 보관·reference 분류와 사용자 요청 근거를 기록. 결과는 이 묶음 02-result-document-system.md, 최종 보고는 archive/reports/261005-RTW-문서체계-정리-완료보고.md 하나만 작성하고 색인 등재. 03 Supervisor 검수는 Codex가 작성.

## 실행·검증·권한

- 현재 브랜치는 codex/document-system. 다른 기능의 untracked 파일이 있으므로 커밋·push·merge 금지. 다른 에이전트 변경을 되돌리지 않는다.
- 파일 이동은 절대 경로가 C:/20.HDev/boxcycle/document 안에 있는지 확인 후 PowerShell Move-Item -LiteralPath 또는 Node fs.rename 사용. 삭제는 하지 않는다.
- node scripts/check-document-system.mjs 및 --all의 명령/exit code/실패/기존 오류 수를 결과에 기록. git diff --check 및 이동 목록·old-reference 검사도 기록. 문서 작업이므로 앱 build/e2e는 불필요.
- 문서 한정 정리 및 참조 수정은 Chief 요청으로 승인됨. 도메인/API/DB/시험 fixture 분리는 별도 후속이며 이번에 변경하지 않는다. 코드 의존으로 못 옮긴 종료 묶음은 경로·이유를 기록한다.
- 진행 상황은 이 묶음 README와 PROGRESS에 갱신한다. 02 결과 상태는 DEVELOPMENT_DONE까지만. Chief 최종 완료 승인을 대신하지 않는다.
