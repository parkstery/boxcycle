# 감리10 — 경로/센서/주행 역할 분리

2026-10-21 Codex Supervisor. DEPLOYED / Chief 실제폰검수대기. 실제diff·브라우저캡처·정적/DOM계약으로 검수. [결과09](03-result-09.md), [결과10](03-result-10.md)참조. 모든개발자세션은종료/중단,Supervisor단일writer.

로컬: selector19·관련39·경로/센서65·UI20 PASS,tsc/build/lint오류0·37기존경고·devtools/diffPASS. 면적이전5.172%→분리후5.113%(800×360준비fixture). 실제Mapbox+Firebase에뮬레이터2/2 PASS(13:27KST,exit0). 800×360·667×300·844×390 준비/주행,마우스/터치에지,중앙pan,일시정지/재개/종료/결과닫기까지확인. 실제ready/riding캡처직접검수: 계기판최상단·좌하단주소·우하단34px주행바·시계/축척겹침없음. 실제Galaxy/BLE미검증. 정상권한전체게이트·배포는아래후속기록.

## Git 게이트

코드 `2c982ccc`를기능브랜치에서커밋(pre-commit:16파일eslint오류0·기존App경고7)→main2 fast-forward→원격main2푸시 exit0. main미변경. pre-push정상권한실행: 의존방향/순환0·dev-tools0경고·tsc·동행간격/전환/잔차·selector19·test:quick **1,323 PASS/0FAIL**(84.5초; 에뮬레이터/별도하네스3파일제외). 앞선sandbox도구3실패는이권한정상실행에서해소확인. .out/evidence/cdbox/기존ops혼합변경은제품커밋에서제외.

## Hosting 배포 증거

`C:\20.HDev\boxcycle`에서 `firebase deploy --project boxcycle-dc2df --only hosting --non-interactive` exit0. 46파일업로드/버전확정/릴리스성공. Functions·Rules·운영데이터수정없음. https://boxcycle-dc2df.web.app

운영4파일 HTTP200·로컬빌드SHA-256일치:

- index.html 632B: `1f32d9f3b212d54cdff2717259c5d374fec1b8e0ce7d5c1ec06ef2c5de890525`
- assets/index-7A29VczA.js 3,733,062B: `7fa702be760fc1cd78be1b4e83d074640bffa72ee8c1a1c12ad6f52329839c38`
- assets/jsx-runtime-1YrJdh_0.js 8,446B: `0d12fda61ef6df75717ab89d9cb62feb5711275aa1279dcfe6ce18b3bd764522`
- assets/index-Cj3WzBDE.css 226,428B: `b230ddd2ce9755111f33dce53bff2a80e2a5b8a3f83b2271a11b46339f3c87a7`

독립새브라우저800×360: canvas1·지구본/나침반0·인트로게스트버튼노출·주행시작0·새JS경로확인 PASS(exit0). 인증버튼클릭0,Firestore/인증/함수/RTDB통신차단. Firestore POST3은차단되었으며운영쓰기없음. 첫검사에서버튼textContent(보조문구포함)를정확문자열과비교해실패했으나접근성이름검사로교정,제품변경없음. 캡처 `.out/ui-route-ride-20261021/production-intro-800.png`, 검증스크립트 `.out/ui-route-ride-20261021/verify-hosting.mjs`. 운영주행은시도하지않았고실제Galaxy/BLE최종검수는Chief가수행한다.

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

http://localhost:5000 또는 https://boxcycle-dc2df.web.app → 새로고침·폰가로800×360 → 경로생성두탭/단일방식→출발도착+경유지→생성→우하단센서/시작.주소패널접어도주행버튼노출·일시정지재개1벌·종료결과에서주행바숨김·결과닫으면센서만유지.공식경로에도동일동작. 웹마우스는좌우가장자리20px띠에서화면안쪽으로드래그,터치도동일방향. 센서없음은센서창에서수동입력선택후시작가능.
