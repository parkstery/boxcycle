# HANDOFF — 지금 상태 한 장

> 수퍼바이저는 교대된다(Claude Code ↔ Codex, 토큰 한도에 따라). **시작하면 이 파일부터 읽고, 작업 단위가 끝날 때마다·끊기기 전에 이 파일을 고친다.** 규칙: [수퍼바이저 교대 플레이북](../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md)

| 항목 | 값 |
|---|---|
| 담당 | Claude Code (23:40 KST Codex 토큰 한도 중단분 인수) |
| 갱신 | 2026-10-24 00:4x KST — 지시 21(Chief 지정 조작부 되돌리기) Cursor 실행 중 |
| 브랜치 | `main2` |
| 마지막 커밋 | `5671a014` docs(ops): record handoff commit |
| 마지막 배포 | 2026-10-23 함수(`getLeaderboard` 상위 20) + 화면(순위 칩·순위판·결과 순위 줄·맵 뷰 정리·km 소문자) |

## 지금 하던 일

**전체 화면 디자인 변경** — [ops/20261023-ui-redesign/README.md](20261023-ui-redesign/README.md)
- chief 가 시안 16장을 승인했다. 3장은 배포됐고 2장은 일부만 배포됐다. 나머지는 6개 묶음으로 진행한다.

## 다음 한 걸음

- **진행 중 (10-24 00:4x~):** [지시 21 Chief 지정 조작부 되돌리기](20261023-ui-redesign/21-task-chief-revert-controls.md) — 녹색 시작·아이콘 일시정지 버튼 복원, 주행 중 지도 조작 유지, 순위 칩 원형 아이콘, 잠금 시험. Cursor 실행 중(scratchpad `cursor21.log`). 끝나면 결과 22 감리 → 실앱 에뮬레이터 `ride-entry`(5001 vite 피해 functions 5019 설정) → 고정 목록 1~4 잠금 확인. **새 규칙:** [Chief 지정 디자인 고정 목록](../reference/product/261024-RTW-Chief-지정-디자인-고정.md)이 시안보다 우선.
- **직전 (10-24 00:25):** [지시 17](20261023-ui-redesign/17-task-route-list-one-line.md)·[재지시 19](20261023-ui-redesign/19-task-saved-routes-compact.md) 경로 목록 한 줄 행·이동수단 아이콘 **완료·LOCAL_VERIFIED** — [결과·감리 20](20261023-ui-redesign/20-result-saved-routes-compact.md), [비교](20261023-ui-redesign/comparison-route-list-one-line.html). Chief 화면 확인 대기, 미커밋. 실행 중 하위 작업 없음.
- 포트 5001에 인계 목록 밖 vite(PID 33656, 10-23 23:05 시작)가 떠 있다. 소유 불명이라 끄지 않음 — 에뮬레이터 시험은 `firebase.route-list-qa.json`(functions 5019)+`VITE_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5019`로 우회.
- **최신 Chief 지시:** [경로 목록 배경 보완](20261023-ui-redesign/15-task-route-list-surface.md). 입문/퍼블릭/내 경로는 불투명 흰 박스, 주행 순위 투명 유지. 이전 투명 목록 시안보다 이 지시 우선. **완료·LOCAL_VERIFIED** — [결과·감리 16](20261023-ui-redesign/16-result-route-list-surface.md), [비교](20261023-ui-redesign/comparison-route-list-surface.html). 화면18·실앱1·단위1354·정적 검사 PASS. Chief 화면 확인 대기, 미커밋.
- 루트 비추적 `firebase.route-list-qa.json` = 실앱 캡처용 임시 에뮬레이터 설정(functions 5019). 커밋 금지, Chief 확인 후 삭제.

0. **22:43 Claude Code 인수 대조 결과:** HEAD `5671a014` 일치. `git status --short -uall`이 [스냅샷](20261023-ui-redesign/handoff-worktree-20261023.txt)과 같고, 추가분은 인계 파일 3개(13·14·스냅샷)뿐. 스냅샷 이후 바뀐 파일은 ops 문서 6개뿐(제품 코드 변경 없음). 보존 JSON SHA256 `4CAFA2A2…378179F` 일치. 포트 3000/28472·5000/61304·5020/33076·5021/62692 청취, 5017·9099 없음 — 인계표와 같다. 검증 재실행 없음(새 변경 없음).
   - 다음 담당도 같은 순서로 인수한다. [상세 인계](20261023-ui-redesign/13-handoff-next-supervisor.md)·[첫 프롬프트](20261023-ui-redesign/14-first-prompt-next-supervisor.md)를 읽고 담당/시각·실제 작업 트리·포트를 대조한다. 실행 중인 하위 작업 없음.

1. 정상 앱/로그인 주소는 `http://localhost:5000/`. harness 5020/5021 루트는 로그인용이 아니다. 9099 없는 harness 인증 연결거부를 복구했고 Google provider 계정선택까지 확인. [로그인 복구](20261023-ui-redesign/11-login-environment-fix.md).
2. 묶음2 Cursor 구현·Codex 감리 완료. [감리](20261023-ui-redesign/10-review-batch2.md). 화면17 PASS, 기본단위1347 PASS + 보존계약/코칭추가시험 PASS. 실앱 주행7 PASS, 최종 화면17+실앱캡처1 총18 PASS. 지도/표고 로딩 후 최종캡처1 추가 PASS.
3. [묶음1 비교](20261023-ui-redesign/comparison-batch1.html), [묶음2 비교](20261023-ui-redesign/comparison-batch2.html). 화면 확인 후 이번 작업 파일만 커밋/푸시, 배포는 별도 승인. 묶음3 미착수.
4. 정상 앱5000·프리뷰5020 유지. 기존3000 및 Chief의5021 서버 보존.

## chief 결정 대기

- `LocalFirstEntryCard`(「어디에서 첫 라이딩을 할까요?」) 삭제 여부. 권장: 삭제.
- `RideHistoryPanel` 연결(계정 패널 「마지막 주행 ›」) 또는 삭제.
- 묶음 순서는 위 계획대로 진행 중(이의 없으면 유지).

## 진행 중인 하위 작업

- Chief 「로그인 복구 후 다음 작업」 지시에 따라 [로그인환경복구](20261023-ui-redesign/11-login-environment-fix.md). 정상앱 localhost5000 복구·Guest복원/Google provider연결 확인, harness 루트에는 프리뷰 안내 추가. 실제 Google로그인 완료는 Chief가 선택.
- [묶음2 지시](20261023-ui-redesign/08-task-batch2.md) Cursor CLI 구현 완료; 결과09. Codex 감리/보완/검증/캡처 완료. OpenCode MiMo도 공통무료한도 종료. ego bootstrap 두 실행 모두 실패→Playwright 사용.

## 작업 트리 (커밋 안 된 것)

- `document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json`: 세션 시작 전부터 수정돼 있던 증거 파일이다. 손대지 않는다.
- `.out/`, `cdbox.bat`: 비추적이다. 손대지 않는다.
- 묶음1/2 제품·App 최소 배선·시험·프리뷰·harness 로그인 안내·dep-layers 신규 파일 도메인 등재·ops 기록은 이번 미커밋 작업. [인계 시 작업 트리](20261023-ui-redesign/handoff-worktree-20261023.txt)와 실제 `git status --short`를 대조한다. 스냅샷은 자동 stage 목록이 아니다.
- 위치DOM 시험 출력이 과거 증거에 쓰이던 것을 `test-results/entry-location-dom`으로 교정. 추적 PNG 복원, 기존 dirty JSON 해시 `4CAFA2A22CEAC8547D7EDB44D22A09082D0710EBDD71B6BDC34D59D57378179F` 보존.

## 최근 주의

- 실행자(Cursor)가 PC 메모리 부족으로 강제 종료된 적이 있다(2026-10-23). 끊긴 뒤에는 `git status`와 결과 파일을 보고 남은 검증만 하면 된다.
- 리더보드 순위는 서버가 5분 동안 저장해 두고 보여 준다. 주행 직후 지도 칩이 몇 분 늦게 바뀌는 것은 정상이다.
- Windows 직접 실행에서 전역 playwright는 다른 CLI. 에뮬레이터 inner 명령은 web 기준 `node ../../node_modules/@playwright/test/cli.js test …` 사용. 단위 watchdog은 프로세스 종료 권한 필요.

- 플레이북의 ui-800x360:84 기존실패 허용 설명은 현재 트리에서 해소됨. 최종 화면17+실앱1 모두 PASS이므로 새 실패를 허용하지 않는다. 인계 요청은 화면 승인/묶음3 착수/커밋/배포 승인이 아니다.
