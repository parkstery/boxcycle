# HANDOFF — 지금 상태 한 장

> 수퍼바이저는 교대된다(Claude Code ↔ Codex, 토큰 한도에 따라). **시작하면 이 파일부터 읽고, 작업 단위가 끝날 때마다·끊기기 전에 이 파일을 고친다.** 규칙: [수퍼바이저 교대 플레이북](../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md)

| 항목 | 값 |
|---|---|
| 담당 | **인계 중: Claude Code → Codex** (Codex 가 인수하면 이 줄을 `Codex (YYYY-MM-DD HH:MM KST 인수)`로) |
| 갱신 | 2026-10-24 08:3x KST — 호스팅 배포 완료, 지시 24(카드 삭제·주행 기록 연결) Cursor 실행 중 |
| 브랜치 | `main2` |
| 마지막 커밋 | `c533dd5d` feat(ui): menu, route lists, ride controls redesign with Chief-pinned controls (+ 이 파일 기록 커밋) |
| 푸시 | **완료** — origin/main2 = `f0a735e5` (2026-10-24, pre-push 게이트 PASS: selector 19·tidy·단위 1354) |
| 마지막 배포 | **2026-10-24 호스팅** `16ab066c` 빌드(`index-DmTMAA6G.js`, 운영 번들 해시 일치 확인) — 묶음 1·2·경로 목록·Chief 지정 조작부. 함수는 10-23 그대로(이번 변경 없음) |

## 먼저 읽을 것 (순서)

1. **[Chief 지정 디자인 고정 목록](../reference/product/261024-RTW-Chief-지정-디자인-고정.md)** — 2026-10-24 신설. Chief 가 직접 정한 화면 9가지. **시안·디자인 규칙·수퍼바이저 판단보다 우선.** 지시서 「금지」에 옮기고, 감리에서 건드렸으면 FAIL. 잠금 시험 `apps/web/e2e/ui-800x360.spec.ts` 「Chief 고정 — 261024 목록 1~4」.
2. [전체 화면 디자인 변경 README](20261023-ui-redesign/README.md) — 시안 16장 상태·묶음 계획.
3. 최근 결과·감리: [16 흰 박스](20261023-ui-redesign/16-result-route-list-surface.md) · [20 한 줄 행](20261023-ui-redesign/20-result-saved-routes-compact.md) · [22 Chief 지정 조작부](20261023-ui-redesign/22-result-chief-revert-controls.md).

## 지금 상태

- **커밋·푸시·배포됨(`c533dd5d`, 호스팅 10-24):**
  - 묶음 1 MENU·경로 목록 / 묶음 2 지도 대기·주행·일시정지(카메라 메뉴 하나·한국어 코칭·출발 전 거리·고도) / 로그인 환경 복구(harness 루트 안내).
  - 경로 목록(입문·퍼블릭·내 경로): 흰 불투명 박스, 경로당 한 줄 + 경로 찾기 팝업과 같은 이동수단 아이콘(`lib/route/routeProfileIcons.ts`), 내 경로 조작부 한 줄.
  - Chief 지정 되돌리기: 녹색 원형 시작(글자 없음), 아이콘 일시정지(재개·정지·⋯), 주행 중에도 야외/위성·줌 표시, 순위 칩 글자 없는 원형 아이콘.
- **검증(마지막 상태 기준):** tsc·eslint 오류0·단위 1354·selector 19·화면 23(`ui-800x360`+batch1+batch2)·실앱 에뮬레이터 `ride-entry` 7/7·`ui-redesign-batch2-live` 1/1·tidy·dep-direction PASS. 증거 `20261023-ui-redesign/evidence/chief-revert/`.
- **Chief 확인:** 경로 목록 흰 박스·한 줄 행과 조작부 되돌리기는 Chief 직접 지시의 결과다. 묶음 1·2 나머지 화면에 대한 Chief 피드백은 아직 없다(커밋 지시는 받음).
- **실행 중 하위 작업 없음.**

## 다음 한 걸음

1. **진행 중 — [지시 24](20261023-ui-redesign/24-task-entry-card-history.md)** (Cursor CLI, 로그는 Claude scratchpad `cursor24.log`, 결과 파일 `25-result-entry-card-history.md`):
   - A. 「어디에서 첫 라이딩을 할까요?」 카드(`LocalFirstEntryCard`) 삭제 — **Chief 결정(10-24)**. 카드에서만 쓰던 코드도 삭제, 사라지는 기능(Ready Ride 자동 생성 등) 목록을 결과에 적게 했다.
   - B. 주행 기록 화면(`RideHistoryPanel`)을 계정 패널 「마지막 주행 ›」에 연결. **Chief 가 지금 화면(패널 안 펼침 목록)과 비교한 뒤 유지/제거를 정한다.** 플래그 `ACCOUNT_HISTORY_MODE = "panel" | "inline"`로 되돌리기 쉽게.
   - 끝나면: 결과 25 감리(before/after 캡처 직접 확인, 고정 목록 1~9 안 건드렸는지) → 실앱 에뮬레이터 `ride-entry`(기본 runner, 5001 비어 있음) → **커밋·푸시·호스팅 배포 (Chief 10-24 승인: 「카드 삭제하면 푸시 배포도 다시」)** → 운영 번들 해시 확인 → Chief 에게 before/after 비교 보고.
   - **배포할 때 B 는 `ACCOUNT_HISTORY_MODE = "inline"`(지금 운영 화면 그대로)로 둔다.** Chief 가 B 를 아직 결정하지 않았기 때문. Chief 는 로컬(5000 또는 프리뷰)에서 `"panel"`을 보고 정한다. 「유지」면 `"panel"`로 바꿔 다시 배포, 「제거」면 panel 경로 코드를 지운다.
   - 끊기면 `git status`·`git diff --stat`과 25번 파일 존재부터 본다. Cursor 가 before 캡처를 먼저 찍게 했다(`evidence/entry-card-history/before-*`).
2. 그 밖에는 Chief 지시를 기다린다. 묶음 3(주행 결과·다음 주행, 시안 10·11)은 Chief 가 시작하라고 할 때, 지시서 번호 26 이후.

## chief 결정 대기

- 주행 기록 화면 연결(지시 24 B) **유지 또는 제거** — 결과 25 의 before/after 비교를 Chief 가 본 뒤.
- (10-24 해결) `LocalFirstEntryCard` → 삭제 결정. `firebase.route-list-qa.json` → 삭제됨.

## 작업 트리 (커밋 안 된 것)

- `document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json`: 오래된 dirty 증거. SHA256 `4CAFA2A22CEAC8547D7EDB44D22A09082D0710EBDD71B6BDC34D59D57378179F`. 손대지 않는다.
- `.out/`, `cdbox.bat`: 비추적. 손대지 않는다.

## 서버 (2026-10-24 08:3x)

- 이 앱 개발 서버는 모두 꺼져 있다(Chief 지시로 정리). 지시 24 실행 중 Cursor 가 프리뷰 5020 을 잠깐 띄우고 끄게 했다.
- 3000(PID 28472) = Chief 다른 프로젝트 imgman. 절대 끄지 않는다.
- `openclaw gateway`(18789) = Chief 지시로 10-24 종료. Windows 예약 작업으로 등록돼 있어 **다음 로그인 때 다시 켜질 수 있다**(예약 작업은 건드리지 않음). 트레이 앱 `OpenClaw.Tray.WinUI.exe`는 게이트웨이가 아니라 그대로.
- 필요할 때 다시 띄운다(실행 폴더 `C:\20.HDev\boxcycle\apps\web`): 정상 앱 `$env:RTW_DEV_PORT='5000'; npm run dev -- --host 0.0.0.0 --strictPort`, harness `$env:RTW_DEV_PORT='5020'; npm run dev:localhost -- --mode harness --strictPort`. 시험이 끝나면 띄운 서버는 끈다.

## 최근 주의

- **실앱 에뮬레이터 시험:** 임시 설정 `firebase.route-list-qa.json`은 Chief 지시로 삭제했다(10-24). 기본 runner 를 쓴다(실행 폴더 `C:\20.HDev\boxcycle\apps\web`, PowerShell): `$env:RTW_DEV_PORT='5017'; node scripts/e2e/run-with-deadline.mjs --limit-sec 540 -- node scripts/e2e/run-with-functions-emulator.mjs 'node ../../node_modules/@playwright/test/cli.js test ride-entry --workers=1 --retries=0'`. functions 에뮬레이터는 5001 을 쓴다 — 5001 이 막혀 있으면 그 프로세스가 무엇인지 먼저 확인하고, 이 앱 것이면 끈다.
- `ride-entry.spec.ts:70` 첫 시험이 「어디에서 시작할까요?」 위치 창이 늦게 떠 한 번 실패했다(재실행 7/7). 다시 보이면 조사 거리.
- `test:quick` 동시 실행 부하로 `entry-location-dom.test.mjs`가 60초 시간 초과할 때가 있다. 같은 플래그 단독 실행은 27초 PASS.
- Cursor CLI 는 PowerShell 에서 `agent -p --force --trust --workspace C:\20.HDev\boxcycle "<지시>"`, 백그라운드로 돌리고 결과 파일로 받는다. 이번 세션 3회 모두 정상 종료.
- 리더보드 순위는 서버가 5분 캐시. 주행 직후 칩이 늦게 바뀌는 것은 정상.
- Windows 전역 `playwright`는 다른 CLI. 에뮬레이터 안쪽 명령은 `node ../../node_modules/@playwright/test/cli.js`.
