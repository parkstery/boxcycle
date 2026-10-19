# 결과26 — 커밋·푸시·main2 병합·운영 배포

2026-10-19 / 수행·감리 Codex. Chief 명시지시로 배포. 완료된 맥락을 재사용해 CLI 실행·로그요약 중심으로 진행했으며 GLM/Cursor 재조사를 하지 않았다. 토큰 사용량은 별도로 계측하지 않아 절감 수치를 추정하지 않는다.

## Git·범위

- 시작 main2/origin/main2 b6c99179. 릴리스 브랜치 codex/guest-entry-release-20261019.
- 제품커밋92699891: Guest 유지·만료·서버/Rules·위치선택·Ready Ride·검수된 진입화면. 이전 검수완료 Spinatlas 진입화면도 포함한다고 Chief에게 알렸다.
- 0ca6f3de: 새모듈 도메인/개발도구등록. Firebase 인프라가 identity를 참조하지 않도록 persistence 모듈을 firebase로 이동(동작동일), 시험 import동기화. 기준의 허용규칙·위반허용 baseline은 넓히지 않았다.
- 83142762: Google link가 lease/callback 경유로 변경된 현행코드에 맞춰 닉네임 정적계약교정. 실제hook성공/취소회귀는 별도32검증에포함.
- 249d07e0: 운영배포전보존요약. 병합커밋 **d22c0492**, main2 및 원격origin/main2 반영. main은건드리지않음.
- AGENTS/CLAUDE·기존다른작업ride-result시험4개·cdbox·개인스냅샷·.out원본은커밋/배포제외,로컬보존. 반복생성된과거PNG/대형계측은Git추가제외. 자격증명패턴검사229파일/적발0. 공개지도토큰 외 비밀값/개인원본을추가하지않음.
- 배포소스는커밋tree를 `.out/release26`에추출. 의존성만기존설치연결,로컬.env는빌드설정용으로만사용·Git/Hosting원본미포함. product/config의HEAD대비diff없음확인. 빌드환경은 boxcycle-dc2df/emulator off/Functions emulator없음.

## 게이트·실패교정

- Functions test127 PASS/lint exit0. 실제demo HTTP·Rules/React인증종료/잔액경합회귀32 PASS.
- 초기prepush FAIL: identity 신규파일8개의도메인등록/실행설정등록누락, 신규분리사본의Functions lib사전빌드부재. 모두등록·빌드보완. 위반0/순환0·dev-tools WARN0.
- Git Bash가 사용자 bin의Kimi npm wrapper를우선해서 `KIMI_DESKTOP_RUNTIME_NODE` 부재로시험시작실패. wrapper나시스템설정을변경하지않고, Git Bash `--noprofile --norc` 안에서 `PATH="/c/Program Files/nodejs:$PATH"` 지정. 게이트우회없음.
- 전체web초회1294 PASS/1 FAIL: nickname-gate-contract가옛 `await linkWithPopup` 소스문자열만인정. 검증된link성공의authLinkRev계약으로교정. 최종 **1295 PASS/0 FAIL**,75.2초(기존명시제외2개). lock동기·타입·도메인·개발도구·동행간격·selector19·Functions127 포함prepush exit0. 두원격ref실제조회로확인.
- 커밋사본web build exit0. 기존SADDLE/PELVIS·bundle크기경고유지. 최초공백검사FAIL도서버주석·과거작업지시EOF정리/불필요과거patch제외후diff --check exit0.

## 실제 운영 배포

프로젝트 **boxcycle-dc2df**, 실행폴더 **C:\20.HDev\boxcycle\.out\release26**. 로그는 C:\20.HDev\boxcycle\.out\release-deploy-{functions,rules,hosting}.log.

```powershell
Set-Location C:\20.HDev\boxcycle\.out\release26
node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js deploy --project boxcycle-dc2df --only 'functions:getMapboxDirections,functions:getDistanceAutoRoute,functions:ensureRouteTokenOnboardingHttp,functions:assertTierQuotaHttp,functions:deleteAccountHttp,functions:resetGuestHttp,functions:guestActivityHttp,functions:guestLinkHttp,functions:guestLifecycleSweep,functions:routeTokenOnRideCreated,functions:conquestOnRideCreated,functions:mileageOnRideCreated' --non-interactive
node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js deploy --project boxcycle-dc2df --only 'firestore:rules,database' --non-interactive
node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js deploy --project boxcycle-dc2df --only hosting --non-interactive
```

3단계모두exit0. 함수12종성공→Rulescompile/release성공→Hostingrelease성공 순서. 무관함수배포/삭제없음. 새guestLifecycleSweep는CloudScheduler API읽기확인 HTTP200/ENABLED/`15 3 * * *`/Asia/Seoul. 즉시수동정리는실행하지않음. 30일정책에따라다음예약부터동작한다.

Hosting https://boxcycle-dc2df.web.app / bundle `/assets/index-BgLXKz1W.js`, CSS index-Ceak9fmh.css. 23:27KST 배포완료.

## 운영 확인

- 실제Hosting HTTP200·커밋사본bundlepath일치.
- guestActivityHttp/guestLinkHttp/getDistanceAutoRoute: 실제preflight204·미인증POST401,각3개확인. 기존guestActivity404해결.
- 실제브라우저844×390: Spinatlas타이틀·앱소개·게스트로시작/로그인두버튼확인,accounts:signUp요청0. 스모크는운영Guest를만들지않았다.
- 배포전23:10/후23:27 `node scripts/guest-test-reset-supervisor.mjs --verify` 읽기전용exit0. 두시점Google4상태동일·보호문서2227누락0/값변경0. Auth6/Guest2동일,과거삭제Guest재생성0/개인문서재생성0/motion0. 새삭제없음. 근거 evidence/test-reset-verification.json.
- 증거 evidence/release-smoke-summary.json·release-scheduler-summary.json. 실기기BLE·실제Google계정popup·운영Guest새생성/실주행은미실행. 동일기능은demo실제SDK/Mapbox시험의이전검증기록유지.
