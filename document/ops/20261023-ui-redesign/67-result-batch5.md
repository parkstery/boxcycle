# 결과67 — 묶음5 경로 만들기 팝업 최종 감리

2026-10-25 08:23 KST · 지시65 / **LOCAL_VERIFIED / AWAITING_CHIEF_SCREEN**. Chief 묶음4 승인 후 진행. 커밋·푸시·배포 없음.

## 담당

- **Codex 직접**: 제품 화면 구현·타입 수정·실제 시험·캡처·최종 감리.
- **Cursor CLI**: 조사·실제 buildPickPopup fixture/신규 시험(66), 독립 diff 감리68·경계 보정 감리69·타입/증거 마감 감리70. 실행하지 않은 시험을 Cursor PASS로 부르지 않는다.

## 최종 변경

300px 흰 판·18px 모서리·회색32px 선 닫기·파란26px 거리 숫자·원형±·다섯 프리셋을 RoutePickPopup.css로 한정 적용했다. 실제 dock은 .map-view의 형제이므로 .map-view-shell도 적용 범위에 포함했다. 제목/토큰은 주소보다 위, 탭은 별도 segmented 행. **고정13 Start·+WP·End / Start·End와 녹색 원형 재생28px 유지**. 시안05의 글자 자동 시작 CTA·새 탐색 정책은 도입하지 않았다. 이동수단3·최대경유3·거리방향 탐색·토큰·준비조건·콜백·순차강조·드래그 로직 유지.

실제690×275 첫 floating 팝업이 위로72px 잘리는 것을 실측하여 mountPickPopupViewportClamp를 추가했다. 기존 anchor별18px offset을 기준으로 측정된 팝업을 지도 안8px로 보정하며 ResizeObserver/RAF는 close에 정리한다. MapView.tsx는 import와 addTo 직후 호출만 추가. getElement()가 없을 수 있다는 TS2345는 관찰 시작 전 요소 존재를 확인하고 좁힌 element를 observe하여 해결했다. 팝업 생성·주행 도메인 정책 변경 없음.

기존 시험 보강:
- route-media-controls: 출력폴더 env, 넓어진 팝업을 닫은 뒤 실제 canvas를 누름, **300px 폭 단언 추가**. 기존 지점·준비조건·버튼 크기/배치 단언 유지.
- route-pick-popup-title: 출력폴더 env, 위치 안내 완료, 로컬 에뮬레이터 전용 비용1/잔액8 seed, 첫 경계 단언 추가. 기존 제목/잔액·닫기 겹침0 기대값 유지. 제품 비용0 기본값은 그대로다.
- distance-direction-attention.spec.ts는 시작 SHA256과 동일. Cursor68이 기존 dirty를 이번 변경으로 귀속한 부분은 baseline 대조로 해소하고 원문 및 Supervisor 보충 기록을 보존했다.

## 검증

| 검증 | 최종 결과·증거 |
|---|---|
| 묶음1~5·고정·실제 지도 회귀 | 100 PASS / 1 SKIP, 5.6분, ui-final.log. skip은 Firebase 미배선 상태의 map-route-pick-gesture 원래 조건. 실제 지도 동작은 별도 runtime 및 실앱에서 검증 |
| CSS 실제 범위·첫 팝업 경계 보정 후 팝업/지도 집중 시험 | **36/36 PASS(1.3분)**, popup-bounds-final.log. 800×360·667×300·844×390 및 실제 첫 팝업690×275 포함 |
| 실제 지도 다섯 지점·준비 동기화·새300px 단언 | **1/1 PASS(11.3초)**, route-media-final.log |
| 실제 앱 제목/잔액/닫기·첫 팝업 전체 경계 | **2/2 PASS, exit0**, popup-live-bounds-final.log. desktop1280×900 및690×275. live-bounds/measurements-phone-landscape.json: 첫 판 x264,y8,w300,h194, 제목y20. 핀 후 판y73,h194, 닫기32×32, 겹침0 |
| 마지막 타입 가드 후 실제 지도 경계 재시험 | **1/1 PASS(28.4초)**, type-fix-runtime.log (세 크기) |
| TypeScript | **PASS exit0**, `npx tsc -b --noEmit`, type-final.log(성공 빈 출력)·type-final-exit.json(실제session12761 exit0) |
| 변경 파일 eslint | **오류0 / 기존 MapView Hook 경고9**, lint-final.log, exit0 |
| 빠른 시험 | **1360/1360 PASS, exit0, 98초**, quick-final.log |
| selector·정련·의존·문서/diff | selector19 및 tidy/dep/doc/diff PASS. 기준선 변경0 |

중간 실패는 삭제하지 않았다. popup-live.log는 위치 안내 차단/비용 fixture 누락2FAIL, 그 뒤 준비 보강 후2PASS. batch5-scope-final.log는 새 판이 다음 지정 좌표를 덮어34PASS/1FAIL, 닫기 후 canvas 확인으로 교정해 route-media-final PASS. ui-final은 실제 dock CSS scope 수정 전 회귀이므로, 수정 후 관련 전체36건을 재검증했다. 게이트나 기대값을 느슨하게 하지 않았다.

## 보호·제한

instruction65/initial-file-hashes.json 대비 허용한 HANDOFF/PROGRESS/묶음README 외 기존 dirty 변경0. 고정1~14·묶음1~4 제품·증거·preview·기존 시험 보존. .out/9008파일 전수 SHA256 대조 후 최종 수정시각 변경0도 확인. cdbox.bat 보존. 보호 JSON SHA256 `4CAFA2A22CEAC8547D7EDB44D22A09082D0710EBDD71B6BDC34D59D57378179F`. restore/clean/stash/worktree 없음.

새 fixture의 searching/failed/ready는 UI 상태·콜백 검사이며 실제 서버 탐색 성공으로 부르지 않는다. 실제 탐색 흐름·준비 동기화는 기존 runtime 시험, 실제 제목·토큰·위치는 에뮬레이터 시험으로 별도 확인했다. 비교의 이전 화면은 변경 전 실앱 캡처가 아니라 같은 DOM에서 이번 CSS만 제외한 **이전 스타일 재현**으로 명시했다.

## 실행·열람

시험 실행 폴더 `C:\20.HDev\boxcycle\apps\web`.

```powershell
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
$env:BATCH5_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\instruction65\after'
npx playwright test ui-redesign-batch5.spec.ts route-media-controls.spec.ts distance-direction-attention.spec.ts --workers=1 --retries=0
npx tsc -b --noEmit
```

실앱은 RTW_DEV_PORT=5023 / BATCH5_EVIDENCE_DIR=instruction65/live-bounds로 `node scripts/e2e/run-with-deadline.mjs --limit-sec 420 -- node scripts/e2e/run-with-functions-emulator.mjs 'node ../../node_modules/@playwright/test/cli.js test route-pick-popup-title.spec.ts --workers=1 --retries=0'`. 운영 데이터 시험쓰기 없음.

```powershell
cd C:\20.HDev\boxcycle
Start-Process "C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch5-final.html"
```

별도 접속 주소 불필요. 이미 열렸으면 새로고침. Codex가 최종 감리 후 직접 연다. 묶음6은 Chief 새 지시 때만. 다음 새 지시 번호71.

## 마감

- Cursor 최종 읽기감리70 완료, Codex가 타입 종료코드·캡처·실앱 계측·보존 증거를 직접 대조하여 LOCAL_VERIFIED 판정.
- 이번5020·5023 및 에뮬레이터 포트 모두 종료 확인. 기존3000(PID28472)·3001(42236)·5040(10096) 유지. 5017은 현재PID48028로 열림(이전62896과 다름), 5000은 닫힘. 이 작업에서 해당 기존 서버에 종료 명령을 실행하지 않았다.
- HEAD b9852157 유지. 커밋·푸시·배포 없음. 비교 HTML 자산 누락0. Chief 화면 확인 대기, 다음 새 지시71.

최종 열람: 2026-10-25 08:24 KST Codex가 comparison-batch5-final.html을 Start-Process로 직접 열기 완료(exit0). 기록용 전체 경로 C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch5-final.html.
