# 감리10 — 경로/센서/주행 역할 분리

2026-10-21 Codex Supervisor. LOCAL_VERIFIED. 실제diff·브라우저캡처·정적/DOM계약으로 검수. [결과09](03-result-09.md), [결과10](03-result-10.md)참조. 모든개발자세션은종료/중단,Supervisor단일writer.

로컬: selector19·관련39·경로/센서65·UI20 PASS,tsc/build/lint오류0·37기존경고·devtools/diffPASS. 면적이전5.172%→분리후5.113%(800×360준비fixture). 실제Mapbox+Firebase에뮬레이터2/2 PASS(13:27KST,exit0). 800×360·667×300·844×390 준비/주행,마우스/터치에지,중앙pan,일시정지/재개/종료/결과닫기까지확인. 실제ready/riding캡처직접검수: 계기판최상단·좌하단주소·우하단34px주행바·시계/축척겹침없음. 실제Galaxy/BLE미검증. 정상권한전체게이트·배포는아래후속기록.

## 재현 명령

실행폴더 `C:\20.HDev\boxcycle\apps\web`. UI는별도기존로컬Vite서버5025재사용으로Windows서버종료대기회피.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node scripts/ride-verify/verify-selectors.mjs
$env:RTW_DEV_PORT='5025'
node scripts/e2e/run-with-deadline.mjs --limit-sec 120 -- node ../../node_modules/@playwright/test/cli.js test route-ride-controls ui-800x360 --workers=1 --retries=0 --timeout=30000
$env:RTW_DEV_PORT='5016'
node scripts/e2e/run-with-deadline.mjs --limit-sec 240 -- node scripts/e2e/run-with-functions-emulator.mjs 'node ../../node_modules/@playwright/test/cli.js test ui-edge-live ride-entry.spec.ts:70 --workers=1 --retries=0 --timeout=60000 --global-timeout=150000'
Set-Location C:\20.HDev\boxcycle
npm run build
```

실지도시험은운영인증/Firestore요청차단·로컬에뮬레이터만쓰기. 네트워크지도/API사용은테스트기존경로범위. 단계별로그의기존Mapbox스타일재로딩/ActivityWorld경고를무경고성공으로보고하지않음.

## Chief 직접 확인

```powershell
Set-Location C:\20.HDev\boxcycle
npm run dev:localhost
```

http://localhost:5000 → 800×360 → 경로생성두탭/단일방식→출발도착+경유지→생성→우하단센서/시작.주소패널접어도주행버튼노출·일시정지재개1벌·종료결과에서주행바숨김·결과닫으면센서만유지.공식경로에도동일동작.
