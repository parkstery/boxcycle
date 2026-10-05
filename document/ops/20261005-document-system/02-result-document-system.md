# 문서 체계 정리 실행 결과

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — 지정 범위 결과 |
| 최초 작성 | 2026-10-05 |
| 독자 | AI |
| 상태 | DEVELOPMENT_DONE |
| 수행자 | Codex — Cursor CLI 실행 오류 후 직접 수행 |

## 실제 변경

문서 16편 reference 분류, 미착수 계획 1편 ops 이동, 종료 AI 개발체계 묶음 6파일 archive 이동. 총 이동 23파일은 [moves.json](moves.json)에 기록했다. [123파일 참조 수정 목록](migration-changed-files.json)은 이동 시점의 기존 추적 파일 목록이며 이후 색인·검증 파일 추가는 별도다.

상태보드의 목표·기능표·상태 기호·코드 대조 날짜를 보존하고 독자·입구 안내를 고쳤다. 현황판은 읽는 법만 정리했다. document README, 문서 지침, ops README/PROGRESS, archive README, AGENTS/CLAUDE 라우팅을 갱신했다. 제품 정책을 채택·폐기하거나 기능 상태를 바꾸지 않았다. 운영 시드 JSON과 다른 기능의 기존 untracked 11파일은 건드리지 않았다.

현재 문서의 기존 누락 링크 3건: bleAutoReconnect·firestoreSavedRoutes는 현재 실제 파일로 연결, 존재하지 않는 08-12 Claude 인수인계는 원본 없음과 당시 파일명을 명시하고 보존된 상세 로그 링크를 유지했다.

## 실행과 대체 경로

- `agent --help`: PASS — 지원 옵션 확인.
- `agent -p --auto-review --workspace C:\20.HDev\boxcycle "…01-task…"`: FAIL, exit 1, `uv_os_get_passwd returned ENOMEM`. 구현 파일 없음 확인 후 Codex 직접 수행.
- `python document/ops/20261005-document-system/migrate-documents.py`: 최초 sandbox 스킬 폴더 쓰기 거부, escalation 실행 PASS. 이동 경로 전부 document 내부 확인, 23파일 이동·123 tracked 파일 참조 갱신.
- `python document/ops/20261005-document-system/update-indices.py`: PASS — 수명별 색인·규칙·사용법 정리.
- 이동 전 `node scripts/check-document-system.mjs --all --write-baseline document/ops/20261005-document-system/link-baseline.json`: PASS(기준선 저장), 기존 누락 26건. 검사의 초기 구문 오류·괄호 파일명 파싱을 고친 뒤 캡처한 기준선이다.

앱 build·e2e는 문서 경로와 주석만 수정하므로 미실행. 별도 fixture 이전·DB/API/주행 로직 변경 없음. 커밋·push·merge 없음.

## 최종 검증

| 명령 | 종료 코드·결과 |
|---|---|
| `node scripts/check-document-system.mjs` | 0 · 현재 누락 링크 0·색인 오류 0·종료 작업 잔류 0 |
| `node scripts/check-document-system.mjs --all --baseline document/ops/20261005-document-system/link-baseline.json --moves document/ops/20261005-document-system/moves.json` | 1 · 기존 누락 23·새 오류 0·구조 오류 0. 전체 성공으로 보고하지 않음 |
| `python document/ops/20261005-document-system/verify-migration.py` | 0 · 이동 23·상태보드 116행·한눈 지도·시드·이동 문서 본문 보존. source 11파일 동작 보존, routing 19파일 누락 0·옛 직접 경로 0 |
| `node document/ops/20261005-document-system/checker-failcheck.mjs` | 0 · 누락 링크·정본 색인 누락·CLOSED 잔류를 각각 exit 1로 검출. 복원 후 exit 0 |
| `git -c core.safecrlf=false diff --check` | 0 · PASS. 초기에 발견한 신규 trailing whitespace 정정 후 통과 |

루트 README·peer-sync 스킬의 기존 링크 3건도 실제 파일에 연결했다. 스킬 링크 수정은 문서 경로에만 한정했다. baseline 26건 중 현재 기준 3건을 정정해 과거 누락 23건이 남는다. 전수 검사 출력은 [전수 검사 결과](link-check-all.txt)에 보관한다.

현재 task 결과·검수 파일을 입구에 연결한 뒤 같은 검증을 다시 실행했다. 검사 제외 범위는 URL·anchor·동적 경로·코드블록·순번 기록 중 현재 입구에서 연결하지 않은 옛 파일이며, 과거 순번 기록은 --all로 별도 검사한다.

누락 검출 재실행 중 Windows 파일 열기 `UNKNOWN`으로 원본 복원에 실패한 1회가 있었다. 즉시 README의 Ontology 링크를 원래대로 복구했다. 검출 확인을 임시 폴더의 독립 문서 fixture로 바꿔 실제 문서를 수정하지 않게 했고, 세 검출·임시 파일 정리·현재 검사 재실행이 모두 통과했다. 검사 도구의 `--root`는 이 독립 검증용 루트 지정 옵션이다.
