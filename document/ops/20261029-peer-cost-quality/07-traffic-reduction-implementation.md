# 트래픽 저감 1단계 — 같은 5Hz에서 변경 필드 전송

작성:2026-10-29 · 독자:Chief/AI · 상태:**구현·로컬 실측 완료 / 원격 푸시 자동승인 차단·미배포** · [입구](README.md)

## 수행자와 범위

**구현·설계·시험·검수: Codex 직접 수행.** Cursor CLI, OpenCode, 하위 에이전트에 위임하지 않았다. Chief의「트래픽 저감 즉시 진행」과「계속해」에 따라05의저위험후보를구현했다. 제품커밋은 `78f0dd19` (`perf(peer): send acknowledged motion deltas without lowering cadence`)다.

화면·모델·카메라·보간함수·전송주기·정밀도·거리표본시각은바꾸지않는다. 위치샘플을생략하지않고같은표본에서바뀐필드만보낸다. **이번변경은RTDB전송량저감이며Firestore문서읽기·쓰기건수나Functions호출수를줄이지않는다.** 전체문제/전체청구해결로표시하지않는다.

## 제품 변경

`apps/web/src/lib/peerMotion/repo/motionDeltaWriter.ts`를추가하고`rtdbTrailMotion.ts`에연결했다.

- 처음은전체`set`,직전전송이성공해확정된상태와idle일때만변경필드`update`를쓴다. 변경내용이전체보다작지않으면전체전송을유지한다.
- 정속표본은보통`d,t,tSrv`만전송한다. 속도·phase·publication변경도같은표본에포함한다. 선택필드가사라지면null로삭제해기존전체set과같은결과를복원한다.
- 동시전송중새표본은전체상태를보내앞선실패/phase전환에의존하지않는다. ACK도착순서가달라도낡은상태로기준을되돌리지않는다.
- RTDB `.info/connected` 변화를관측하면기준캐시와onDisconnect등록캐시를무효화한다. 삭제/cleanup시해당기준을지우고마지막송신종료시연결상태리스너를해제한다.
- 예상치못한서버노드삭제등으로delta가실패하면최신표본에한해전체상태복구를한번시도한다. 더최신전송·다른세션이이미있으면오래된상태를재전송하지않는다.
- 기존미터는실제로요청한delta/full본문을세며,복구재시도도별도요청으로센다.

DB경로·wire최종스키마·Rules·Functions를변경하지않았다. RTDB200ms·FS4초·공통600ms·0.01m정밀도·외삽상한1.2초는유지한다.

## 실제 에뮬레이터 전송량

기존`database.rules.json`을그대로사용한 `demo-peer-traffic` 로컬RTDB,송신/수신SDK2개,소켓프록시로WebSocket을포함한TCP바이트를측정했다. 정상정속표본20개를200ms대기+응답확인방식으로전송했다. 네트워크왕복과시험폴링시간은추가되므로실운영정확5Hz부하벤치마크는아니다. 요청표본수와설정간격은같다. 초기연결·인증·구독준비/오류시험은계수초기화전에실행했다.

| 측정 | 전체set | delta포함 | 차이 |
|---|---:|---:|---:|
| 위치표본수 | 20 | 20 | 동일 |
| 제출JSON본문 | 2,016B | 1,066B | **−47.1%** |
| 로컬상향TCP | 3,771B | 2,841B | **−24.7%** |
| 로컬하향TCP | 4,451B | 3,483B | **−21.7%** |

하향은프록시를통과한송신SDK의ACK/echo와관찰SDK수신을합친값이며순수타인수신량만은아니다. TLS·운영경로·실제청구·다인fanout전후측정은포함하지않는다. 따라서「Firebase청구21.7%감소」라고쓰지않는다. 결과[JSON](evidence/motion-delta-wire.json).

20개각표본에서원격수신의완전한row와기존전체전송목표를deepEqual로비교했고전부같았다. decode된거리도같았다. 수신표본을덜보내서절감한것이아니다.

## 안전성과 실패 검증

일반단위6시험:정속100개상태복원/본문감소,정지·속도·publication·optional삭제,disconnect후부재노드복원,동시전송/ACK역순,실패한delta전체복구/세션전환,오래된실패가최신표본을덮지않음.

실제RTDB추가검증:다른UID쓰기는거부,필수필드없는행은거부,정지/완주/경로전환과선택tSrv제거,예상치못한노드삭제→delta검증실패→전체상태복구,onDisconnect삭제→재연결→전체복원. 로그의permission_denied5건은고의거부검사4건+노드삭제후delta실패복구1건이며성공실행중예상한결과다.

첫로컬회귀는전체set기준에서본문감소1FAIL·기능4PASS,구현후6PASS였다. 최초에뮬레이터는Vite루트가앱루트가아닌오류로실패해수정했다. 실패한해당시험프로세스만식별종료했고기존개발서버는종료하지않았다. 자동승인검토사용량한도로1회에뮬레이터실행자체가막혔으나사용자재개후정상실행했다.

## 검증과 남은 단계

- 제품타입 `npx tsc -b --noEmit`,변경eslint,빌드:PASS.
- `node scripts/test-quick.mjs peer`:**81PASS/0FAIL**,9파일. 에뮬레이터/전체하네스4파일은빠른묶음에서제외되며이번에별도로실행했다.
- `npm run test:peer-spacing`:기본11셀·소스전환7셀·residual10셀PASS. 이전거리/시각짝수정의1.2cm재생값보존.
- 실제RTDB에뮬레이터:1개통합시험PASS·정상표본40개상태동일/Rules/복구포함.
- 루트의의존방향·정련·개발부산물검사PASS.
- 전체pre-push동일게이트는원격접속없이로컬실행해 **exit0·전체1,449PASS/0FAIL**를확인했다. 진입selector20·타입·의존·정련·개발부산물·동행재생도PASS다.
- 최초전체실행은옛「항상set」계측계약1건과sandbox의프로세스종료권한때문인watchdog3건실패(1,445PASS/4FAIL)했다. 계측계약을실제full/update요청/재시도계측으로갱신후관련58PASS,종료권한을갖춘로컬게이트재실행에서1,449PASS/0FAIL이다. 기준완화나훅우회없음.
- 실폰/실운영두창·운영TLS전송량·청구전후·Firestore저감은미실행이다.

Firestore의반복위치구독/함수호출은다음과제로남는다. 현재FS4초를무작정늘리거나정상FS구독을끊으면기존stale/명단/장애fallback이깨진다. 품질을유지하려면안정명단과동적위치소비자를분리하고장애전환행렬을먼저고정해야한다. 이번저감효과와혼합하거나미구현을완료로표시하지않는다.

## 배포 준비·자동승인 차단

`78f0dd19`만`git archive`로추출한폴더 `C:\20.HDev\boxcycle\.out\peer-release-78f0dd19`를준비했다. 다른작업UI dirty는포함하지않는다. 로컬의기존의존성junction과`.env`를복사해격리빌드하며환경값은문서/커밋에포함하지않는다. Hosting설정은 `.out/peer-hosting-deploy-78f0dd19.json`에준비했다.

격리빌드PASS,배포대기main번들은 `index-BZ3jLtJM.js`(2,045,862B)다. [로컬자산manifest](evidence/motion-delta-release-manifest.json)에index+참조자산5개의hash를기록했다. **운영해시대조가아니며이새번들은아직운영에없다.** 계측계약·보고서후속커밋은`7483402a`이며제품차이는없다. 전체게이트로그 `.out/motion-delta-local-gates-authorized.log`,격리빌드로그 `.out/motion-delta-clean-build.log`.

원격푸시명령은자동승인검토에서실행전차단됐다. 사유는이번새저감구현을사설저장소 `https://github.com/parkstery/boxcycle.git`의`origin/main2`로푸시하는명시적승인이없다는것이다. 우회/간접실행하지않았고원격푸시·운영배포는보류했다. 이전시각짝수정8101ead2배포는이미완료된별개릴리스다. 새커밋의푸시와Hosting배포에대한Chief명시승인후재개한다.

## 재실행

로컬단위·기본간격(브라우저주소불필요):

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node --test scripts/peer-sync/motion-delta-writer.test.mjs
npm run test:peer-spacing
```

에뮬레이터명령(로컬demo전용,설정파일은이번작업에서생성):

```powershell
Set-Location C:\20.HDev\boxcycle
$env:PEER_DELTA_EVIDENCE = 'C:\20.HDev\boxcycle\document\ops\20261029-peer-cost-quality\evidence\motion-delta-wire.json'
firebase emulators:exec --only database --project demo-peer-traffic --config .out/motion-delta-emulator.json "node --test apps/web/scripts/peer-sync/motion-delta-wire.emulator.test.mjs"
```

실행위치는반드시루트이며RTDB127.0.0.1:9019를사용한다. 운영주소는현재이저감수정이미배포이므로새효과확인용이아니다. 로그는루트`.out/motion-delta-{before,after,tsc,peer-final,spacing,build,eslint,dep,tidy,emulator-final,local-gates,clean-build}.log`。
