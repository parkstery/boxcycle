# 결과·감리53 — RC1 하네스 교정·전체 연속 주행

2026-10-24 KST · 지시52 · **구현·감리·캡처 Codex 직접**. 커밋·푸시·배포 금지 유지.

## 상태

**PASS / LOCAL_VERIFIED.** 최종 전체 연속 주행7/7 PASS, 6.7분, watchdog exit0(439886ms). 첫 실패 실행은 그대로 보존. 제품 UI·고정 목록·묶음3 미커밋분 유지. 커밋·푸시·배포 없음.

## 교정

- `ride-continuation.spec.ts`: 첫 진입 및 모든 reload 뒤 위치 안내를 완료하고, 안내가 닫힌 것을 확인한 다음 다음 동작으로 진행한다. 기존 RC13에서 쓰던 `chooseColosseumIfNeeded`를 재사용했다.
- 결과판 닫기는 `.ride-summary__close`로 특정하고 닫힘을 확인한다. 같은 이름의 배경 `.ride-summary__scrim`을 `.first()`로 고르지 않는다.
- RC2의 「처음부터」 선택 전에 현재 제품의 「이어 달리기 선택」 팝오버를 연다. 진행률 기준43%와 서버 단조성 단언은 그대로다.
- 전체 첫 실행에서 RC2가 진행률 있는 경로에도 「열기」를 찾던 오류가 드러났다. 경로 모달·선택 작업 툴바로 범위를 좁히고 RC2는 정확한 「이어 달리기」 버튼을 요구한다. 시작 전 경로는 기존 「열기」를 계속 요구한다.
- RC3은 완주 거리 검증 뒤 새 경로 연결에서 「주행 시작」0개를 요구해 실패했다. Chief 지시29(10-22, `02-task-29.md`·커밋 `c7ee09ba`)의 팝업 재생 버튼은 경로 전 비활성 상태로 남는다. 주행바 Go 없음·팝업 재생 비활성·거리·방향 선택 탭을 각각 정확히 검사한다. 숨겨진 내부 동기화 checkbox는 DOM으로 기존 checked 단언을 보존하고, 보이는 탭 selected 단언을 추가했다.
- RC4는 「저장 안 함」이 이미 판을 닫은 뒤 두 번째 닫기를 시도했다. 제품의 2026-09-27 계약에 맞춰 한 번 클릭 후 hidden을 확인한다. 다음 출발점 보존·reload 이후 연장 동작은 그대로 검사한다.
- 클릭 기본 제한은 15초로 좁혀 낡은 셀렉터 하나가 시험300초를 쓰지 않게 했다. 개별 주행·서버 폴링·전체 시간 한도는 늘리지 않았다.
- 증거3장의 기존 archive 기본 경로 대신 지정된 새 폴더를 사용할 수 있게 했다. 기존 캡처를 덮어쓰지 않는다.
- `entry-contract.mjs`: 기존 결과 단계에 내부 닫기 앵커를 추가. 제품 소스·Chief 고정 목록·잠금 단언 변경 없음.

## 검증

| 항목 | 결과 |
|---|---|
| selector 계약 | 19/19 PASS(내부 닫기 앵커 포함) |
| 변경 ESLint | 오류0 PASS |
| 타입 `tsc -b --noEmit` | PASS |
| 첫 전체 실행 `continuation-all.log` | **4 PASS / 3 FAIL**, 7.0분, watchdog exit1. RC1·RC5·RC13·CF-LIVE PASS, RC2/3/4의 위 하네스 오류 발견 |
| 교정 후 전체 `continuation-final.log` | **7/7 PASS**, 6.7분·exit0. retries0·worker1·개별300초·global560초·watchdog600초 유지 |

첫 CF-LIVE는 실제 클라이언트 저장 Ride의 conquest 페이로드와 Functions 결과를 확인했다. `newMeters=299`, `creditedMeters=299`, `tier=t0`. 시험에서 conquestResult를 심거나 함수 응답을 성공으로 위조하지 않았다.

시작 해시와의 중간 대조에서 제품 코드·보존 JSON·기존 dirty 인라인 캡처·고정 목록·cdbox.bat 등 보호 대상13개 모두 일치했다. 최초 RC1의 재개 준비 캡처를 Codex가 직접 열어 다음 주행 카드에서 21% 재개 지점으로 돌아온 실제 렌더를 확인했다.

실제 실행 폴더 `C:\20.HDev\boxcycle\apps\web`, 명령:

```powershell
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5017'
$env:RIDE_CONTINUATION_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\instruction52'
node scripts/e2e/run-with-deadline.mjs --limit-sec 600 -- node scripts/e2e/run-with-functions-emulator.mjs 'node ../../node_modules/@playwright/test/cli.js test ride-continuation --workers=1 --retries=0 --reporter=line --output=../../document/ops/20261023-ui-redesign/evidence/instruction52/playwright-results'
```

로그 `evidence/instruction52/continuation-all.log`. Firebase auth/firestore/database/functions는 로컬 에뮬레이터만 사용한다. 5000 운영 연결 서버에 시험 쓰기 금지.

## 최종 확인 — 22:32 KST

보호13파일 및 기존 제품·preview·캡처·보존JSON 해시 일치. 기준선 대비 변경은 ride-continuation 시험과 ops 기록뿐이며 별도로 entry-contract 닫기 앵커1개를 추가했다. 기존 3000/3001/5000/5040 유지, 이번 5017/5020 및 에뮬레이터 포트 모두 종료 확인. 타입·변경ESLint·selector19·문서검사·diff검사 PASS. 제품 변경이 없어 전체 단위 재실행은 하지 않았다(지시50 기록 참조).

Chief 직접 화면 확인은 이번 시험 교정에서 필요하지 않다. 시험은 위 명령으로 자동 서버를 시작하고 종료하며, 수동 접속·새로고침 불필요. 새 증거는 instruction52/final/에 있다. Codex가 RC1 재개 준비 캡처를 직접 확인했다.


## Cursor 독립감리54

Chief의 토큰 절약 지시에 따라 Cursor CLI에 읽기 전용 검토를 위임했다. 첫 일반권한 호출은 uv_os_get_passwd ENOMEM으로 종료했으며 권한 있는 재호출은 exit0. 54-review-cursor-continuation.md 판정 PASS: 기대값 완화 없음, RC2~4 교정 근거 및 계약 강화 일치. Cursor는 시험·해시·포트를 재실행하지 않았고 이 부분은 Codex가 직접 검증했다. 역할: 구현·시험·캡처·최종감리 Codex 직접 / 독립 diff·근거 감리 Cursor CLI. Cursor가 허용한 감리파일 외 기존 기준선 파일을 변경하지 않았음을 확인했다.

