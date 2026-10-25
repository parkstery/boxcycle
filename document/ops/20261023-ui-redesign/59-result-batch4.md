# 결과59 — 묶음4 구현·감리

2026-10-25 KST · 지시58 / Chief 묶음3 승인·묶음4 진행 승인 근거. **LOCAL_VERIFIED / AWAITING_CHIEF_SCREEN — 미커밋·미배포**. 최종 갱신 06:59 KST.

## 담당

- 제품 구현·실행·캡처·최종 감리: **Codex 직접**.
- fixture·신규 화면 시험: **Cursor CLI**, 결과60.
- 칼로리 동기화 시험·fixture 이식: **Cursor CLI**, 결과61. Codex가 실제 diff 확인 후 정확한 강도 셀렉터 및 메뉴 포커스 동작 교정.
- 독립 diff 감리: **Cursor CLI**, 결과62(DIFF_OK / 화면은 Supervisor 확인 조건).

## 구현

| 화면 | 최종 동작 |
|---|---|
| 센서 | 가운데 두 칸 판, 실제 RPM·연결 상태, 수동 속도·연결/단절. 센서 선택 완료는 입력 선택·닫기만 하며 자동 주행을 시작하지 않는다. 주행 중 최초 BLE 연결 제한 유지 |
| 주행 설정 | 코칭·음성·배경 음악·페이서 스위치. 칼로리는 체중·강도 요약과 프로필 수정 진입만 |
| 맵 뷰 | 우상단 320px 판, 도로망 선택·3D·접힌 고급 설정. 기존 드래그·거리 조정 유지. 고정9의 지도 스타일·시점·줌을 추가하지 않음 |
| 프로필 | 닉네임 행·체중 ±/숫자/슬라이더·운동 강도·취소/저장·닫기. Guest 닉네임 불가·30일 잠금·탈퇴 확인·서버 저장 정책 유지 |

공유 SettingsSurface/SettingsCloseIcon은 해당 네 판에만 적용. App 변경은 주행설정→프로필 및 결과 칼로리 설정→프로필 결선. 결과 시트 자체와 다음 주행 카드 제품은 변경하지 않았다.

## 검증

- 셀렉터 계약19 PASS.
- TypeScript PASS / 변경 TSX·시험 eslint 오류0, 기존 App Hook 경고7.
- 정련·의존 방향·문서 시스템·diff 공백 PASS(게이트 기준선 불변).
- 기존 고정·묶음1~3와 묶음4 최초20건 포함 **64/64 PASS**, ui-regression.log (4.5분).
- 실제 진입7 + 주행 중 주소 카드1 = **8/8 PASS**. 같은 실행의 칼로리2는 첫 화면 대기 실패, emulator-5021.log에 8PASS/2FAIL 보존.
- 이후 칼로리 별도 실행에서 프로필1 PASS, 다른1은 '강함'이 '매우 강함'도 잡는 strict 실패. exact 셀렉터로 교정한 최종 재시험2/2 PASS. 테스트 기준 완화 없음.
- 빠른 시험 최초1356PASS/4FAIL(안내 timeout1·Windows 프로세스 종료권한3). 정상 권한에서는1358PASS/0FAIL이나 DOM2건 취소(exit1). 성공으로 판정하지 않았다. DOM 단독 초기 실행의 loader 누락도 기록 보존. 서버·시험 경합을 제거한 동일 명령 최종 실행은 아래처럼 전부 PASS.
- 최종 묶음4 **21/21 PASS(46.7초·exit0)**, batch4-complete.log. 세 크기 경계·글자, 네 switch 콜백, 센서 자동 시작 없음, Guest/잠금/저장 및 맵 거리 실제 증가 단언. 중간 batch4-final은 서버 종료와 겹쳐19PASS/연결거부2FAIL이므로 증거 보존 후 독립 서버로 전체 재시험했다.
- 최종 칼로리 **2/2 PASS(1.0분·exit0)**, calorie-verified.log. 실제 서버 저장·새 기기 복원·타 기기 변경·사용자 정보 경유 및 취소 유지. 메뉴는 기존 포커스 진입 계약, 강도는 exact 셀렉터로 좁혔다.
- 강화한 카메라 거리 시험은 fixture가 기존 최대값60으로 시작해 증가하지 않는 것을 발견. 기대값을 유지하고 fixture만 유효 범위 가운데40으로 변경. 센서 선택 후 준비 상태 유지도 별도 신규 단언.

## 보호·감리

initial-file-hashes.json과 대조: 기존 dirty 제품·잠금 시험·묶음3 카드/결과/증거·보존JSON·고정 목록 그대로. preview는 허용된 묶음4 fixture만 추가했다. 보존 JSON SHA256 `4CAFA2A22CEAC8547D7EDB44D22A09082D0710EBDD71B6BDC34D59D57378179F`. .out/·cdbox.bat 수정 없음. 커밋·푸시·배포·restore/clean/stash/worktree 없음.

기존5017(PID62896, 전날23:07 시작)이 열려 처음 실앱 시험이 실행 전 거절됐다. 해당 서버를 보존하고5021/5023 사용. 기존5000은 작업 중 관측에서 닫혀 있었으며 이 작업은 종료 명령을 실행하지 않았다. 3000/3001/5040 보존.

## Chief 열람

실행 폴더 `C:\20.HDev\boxcycle`.

```powershell
cd C:\20.HDev\boxcycle
Start-Process "C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch4-final.html"
```

로컬 비교 HTML을 Codex가 직접 연다. 서버 주소 입력 불필요. 이미 열려 있으면 새로고침. 각 화면의 변경 전·승인 시안·실제 캡처, 접으면 좁은667×300 캡처를 비교한다. 프로필 변경 전 캡처는 없어 시안과 구현을 비교한다. 스크린샷은 하네스이며 실도로 지도 대신 시험 배경을 사용한다.

## 실행 명령 기록

작업 폴더 `C:\20.HDev\boxcycle\apps\web`.

```powershell
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
$env:BATCH4_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\instruction58\after'
npx playwright test ui-redesign-batch4.spec.ts --workers=1 --retries=0
```

64건 회귀는 위 폴더에서 `npx playwright test ui-redesign-batch4.spec.ts ui-redesign-batch3 ui-800x360.spec.ts address-minimap-width.spec.ts ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0`. BATCH3_EVIDENCE_DIR·BATCH2_EVIDENCE_DIR·UI_REVALIDATION_EVIDENCE_DIR·ENTRY_CARD_HISTORY_EVIDENCE도 새 after 폴더로 지정하여 기존 캡처를 보존했다.

실앱8건은 RTW_DEV_PORT=5021로 `node scripts/e2e/run-with-deadline.mjs --limit-sec 540 -- node scripts/e2e/run-with-functions-emulator.mjs 'node ../../node_modules/@playwright/test/cli.js test ride-entry.spec.ts route-dock-riding-content.spec.ts calorie-profile-sync.spec.ts --workers=1 --retries=0'`. 최종 칼로리2건은 RTW_DEV_PORT=5023, CALORIE_PROFILE_EVIDENCE_DIR=instruction58/calorie-sync, 같은 runner 360초 및 `test calorie-profile-sync.spec.ts --workers=1 --retries=0`.

## 최종 마감 — 2026-10-25 06:59 KST

- `npm run test:quick` **1360 PASS / 0 FAIL / exit0 / 80.5초**, quick-final.log. 앞선 실패·취소 로그는 그대로 보존. 기대값·시간 한도·게이트 기준선 변경 없음.
- TypeScript·변경 파일 eslint(오류0·기존 App경고7), selector19, tidy/dep/doc/diff PASS. 마지막 코드 변경 이후 추가 문서만 갱신.
- 800×360·667×300·844×390 실제 캡처를 Codex가 확인: 프로필 전체 조작은300px 높이 안, 맵 내 도로망 한 줄·기본 높이210 이하, 설정520px, 센서560px 판. 렌더링 후 포커스 표시를 제거한 비교용 캡처이며 접근성 포커스 동작은 유지.
- 보호 해시 전부 일치. 시작 baseline 중 허용된 preview 및 상태 문서 외 변경0. 비교 HTML 자산 누락0.
- HEAD `b985215745bd41f21e2c7507fde6f93a53479de0` = origin/main2. 커밋·푸시·배포 없음.
- 이번5020/5021/5023 및 auth/firestore/database/functions 에뮬레이터 포트 모두 종료. 기존3000(PID28472)·3001(42236)·5040(10096)·5017(62896) 보존. 기존5000은 닫힌 상태로 관측, 이 작업에서 종료하지 않았음.
- 비교 파일 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch4-final.html` 직접 열기. Chief 화면 확인 대기. 다음 묶음5·6은 새 지시가 있을 때만. 다음 지시서 번호63.

- 열람 실행: Codex가 위 비교 HTML을 PowerShell Start-Process로 직접 열었고 exit0 확인(07:00 KST). 별도 서버·접속 주소 불필요, 이미 열린 탭이면 새로고침.
