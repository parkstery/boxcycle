# 통합 감리16 — 로컬 검증 승인 / 운영 배포 미실행

2026-10-19 Supervisor Codex. 수행자별 결과와 실제diff/독립시험 대조. Chief 최종완료 CLOSED와 구분한다.

| Task | 수행자 | 결과 |
|---|---|---|
| 07/09/12 서버 수명·Admin 쓰기·HTTP·Rules | OpenCode GLM-5.3 | 구현 및 재작업 완료. 단위127 PASS·실제HTTP/Rules14 PASS에 통합 |
| 06/08/10 클라이언트 | Cursor AI Auto | logout삭제철회·복원검증·offline재시도·Googlecache보호·자동Guest생성제거. JS산출물371개제거 |
| 11/13/14 실제SDK E2E | Cursor 작성·Codex 실행/감리 | SDK+IndexedDB 지속성/로그아웃보존/삭제후재접속 3/3 PASS |
| 15 경로캐시 | Cursor AI Auto | userId기준개인삭제·집계·동일tx tombstone guard, 자체4시험PASS |
| 최종 후보 연결 | Codex | GLM실행중append된cache-only 후보3곳연결누락을인수보완. build/test127/lint·실제fixture재검증PASS |
| 최초고아정리·추가캐시정리 | Codex | FS213(17+196)·RTDB2 정리. Auth삭제없음 |

## 최종 검증

- functions `npm run build`, `npm test`(127/127), `npm run lint`: Codex 독립실행 exit0.
- 실제 demo Auth/Firestore/RTDB + HTTP Express 등록부: `guest-rules-supervisor.test.mjs` 14/14 PASS(부모포함). HTTP인증/lease/metadata실패중단/numeric503, Rules5상태,옛token차단,Admin지연trigger/cache재생성차단,고아rides/traces/ledger/cache/openlisting/RTDB실제정리,Google4fixture·disabled상태·자료보존.
- actual useAppAuth+React+Edge 8동작(부모포함9PASS). 새UID덮어쓰기·logout취소·SDKnull경합·offline재시도·Googlecache보존.
- 실제앱ride-entry1 PASS, 실제FirebaseSDK재접속3 PASS. emulator demo강제, 단일worker,운영Guest생성시험없음.
- web 클라이언트20/20·selector19·viewport667x300/844x390 PASS. web build Codex 독립exit0. lint Cursor error0/warning40(기존). 기존riderRig SADDLE/PELVIS export·큰bundle build경고는잔존하며이번Guest범위밖.
- root 보호·정리·logout14/14 PASS. dev-tools registry PASS/WARN0. git diff --check exit0.

## 운영 보존 확인

- 현재 Google4Auth UID집합·provider·disabled원래상태동일. 원래Auth5명전원보존,추가Guest3명은보존하여현재Auth8명. 추가생성주체미확정. 운영백엔드/Hosting코드아직미배포.
- Google소유1976문서삭제0. 값변경4(주행누적/도로망/cells/lastSeenAt)·최상위필드삭제0. 사용자활동값을스냅샷으로덮어쓰지않음.
- 최초정리후2176문서의최신검사는**exit1**: 현재Guest의trails/members문서1개부재. Google소유아님/우리정리manifest대상아님. 일시접속자료이며발생원인확정안됨. 보존검사전체PASS로오보고하지않음. evidence/preservation-latest.json.
- 추가고아cache196삭제/잔여0. 보호cache248해시동일/삭제0,Google4동일. evidence/cache-cleanup-verification.json. motion2동일.
- private스냅샷·UID·자격증명은외부모델전송없음. raw자료는ignore된.out/private-guest-lifecycle에만보관.

## Chief 직접 테스트 — 현재 실행중

폴더 `C:\20.HDev\boxcycle`, demo앱 **http://127.0.0.1:5004**. GET200/title Spinatlas확인. exec34725에서실행중. 운영앱5000과분리했다. 환경변수와함수URL은demo/localhost로고정되며운영자료에쓰기없음. 지도타일은기존Mapbox설정을사용. Google실기기팝업·BLE·성능은미검증.

앱이종료된뒤다시켜려면:

```powershell
Set-Location C:\20.HDev\boxcycle
node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,database --project demo-boxcycle-guest "node scripts/guest-integration-supervisor.mjs --serve"
```

확인순서: Guest명시시작→입문경로선택→주행시작→새로고침동일Guest→사용자정보로그아웃→새로고침자동계정생성없음. 삭제후재접속은자동시험으로검증됐으며운영Firebase에서삭제시험하지않는다.

통합회귀 재실행(수동demo서버종료후,같은port충돌금지):

```powershell
Set-Location C:\20.HDev\boxcycle
npm --prefix functions run build
node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,database --project demo-boxcycle-guest "node scripts/guest-integration-supervisor.mjs"
```

## 운영 반영 잔여

검증승인은로컬대상이다. Hosting/Firestore Rules/RTDB Rules/Functions/일일03:15 KST스케줄**미배포**,커밋/푸시없음. 따라서운영사이트는아직새30일정리정책이아니다. 운영배포는Google보호config확인및기존dirty변경의배포범위를분리검수한뒤별도운영반영단계에서실행한다. 특히Hosting은이번변경밖의기존미커밋변경도포함하므로무조건전체deploy하지않는다.

예상관련Functions: guestActivityHttp/guestLinkHttp/guestLifecycleSweep/getMapboxDirections/getDistanceAutoRoute/ensureRouteTokenOnboardingHttp/assertTierQuotaHttp/mileageOnRideCreated/conquestOnRideCreated/routeTokenOnRideCreated 및 개인cache삭제가공유되는deleteAccountHttp/resetGuestHttp. 새자동정리의회당상한20/관찰100,이전활동필드없는기존Guest는최초관찰30일유예,실패재시도·Google/admin/보호UID제외. Auth/Firestore/RTDB간단일원자성은없고lease·재확인·tombstone으로방어한다.
