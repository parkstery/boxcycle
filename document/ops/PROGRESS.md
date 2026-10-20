2026-10-20 [신규 도로 릴리스](20261020-new-road-display/02-task-02-release.md): IN_PROGRESS. Chief커밋·푸시·병합·배포승인. 날짜형식/긴선분/새기록삭제경로보완, Functions132·Rules실제에뮬레이터PASS. 분리소스빌드·main2병합·선택배포진행.

2026-10-20 [신규 도로 표시 복구](20261020-new-road-display/04-review-01.md): LOCAL_VERIFIED/Chief 실제계정확인대기. 종료시빈서버값덮어쓰기·positive미반영·최근범위이동누락교정, 기존취득일+trace복원. Node94/React시트1(2폭)/build/lint오류0·기존40경고/diff PASS. localhost5000강력새로고침, 배포·커밋·푸시없음.

2026-10-19 [Guest·위치·Ready Ride 배포26](20261019-guest-lifecycle/04-review-26-release.md): DEPLOYED/Chief사용확인대기. main2 d22c0492원격반영·Functions12/Rules/Hosting성공. web1295/서버127/독립32 PASS,운영인트로·API204/401·Google4/문서2227보존. 매일03:15KST Guest정리활성. https://boxcycle-dc2df.web.app

2026-10-17 개발 부산물 묶음 CLOSED: T1 삭제(Muse→Supervisor), T2 패널 분리(Cursor, 기본 청크 3,731→3,692 kB), T3 dev-tools.json 등록부 59항목 + pre-push 게이트 + scripts/perf/run-real-gpu.mjs (Cursor). main2 5cc0c26 운영 배포. temporary 8건 만료 2026-11-17.

2026-10-17 정리: 10-15~16 묶음 12개 CLOSED — 11개 archive/ops 이동(링크 재작성, 새 오류 0), map-cut 은 스크립트 주석 참조로 제자리. 고아 프로세스(gpuskin vite 3·opencode serve·firebase-functions) 종료, gpuskin 폴더·tmp/stash-backup-20261015 삭제. T1 삭제 완료(Muse 한도 → Supervisor 마무리), T2 Cursor 진행 중.

2026-10-17 GPU 스키닝 G2 운영 배포: main2 ef9efad, 기본 gpu(?skin=cpu 로 끔). 운영 쿼리 없이 skin=gpu 확인, PC 70.7 fps·라이더 0.39 ms. perflab 패널 오른쪽·끌어 옮기기(5b1f3c2). 보고 archive/reports/261017-RTW-GPU-스키닝.md. 다음: 개발 부산물(측정 코드·스크립트) 관리 방안 정립.

2026-10-17 GPU 스키닝 G1 운영 배포: main2 8eaf954, hosting index-CuiDaVtD.js (Muse Spark). ?skin=gpu 스위치, 기본 cpu. PC 실측 라이더 비용 2.4–2.6→0.4 ms/프레임(3명). 폰 확인 후 G2(기본 gpu) Chief 결정 대기.

2026-10-17 문제 해결 보고 10건 작성: document/archive/reports/261017-RTW-*.md(떨림·코너·지도 글자·틱·해상도·측정 방법·흔들림·LOD2·동행 미표시·환경 함정), rider14 보고 reports/ 로 이동, 색인 document/archive/README.md. GPU 스키닝 보고는 G1 완료 후.

2026-10-16 Chief 확정: 주행 글자 기본 모드 names(이름 전부·장식 기호만 숨김). 운영 index-BciKl-xW.js 유지.

2026-10-16 글자 모드 names 운영 배포: main2 ffa68af, hosting index-BciKl-xW.js (Muse Spark). 이름 전부 유지·장식 기호만 숨김, perflab 패널 왼쪽 이동. Chief 직접 확인 대기.

2026-10-16 폰 실측(Chief): 가까운 줌 31→56.5 fps, 프레임 p50·p95 16.7 ms(60 Hz 한도). 틱 다이어트+렌더 배율 2+글자 숨김 합산 효과. PC 46→72 fps. GPU 스키닝 보류 유지.

2026-10-16 주행 가까운 카메라 글자 숨김 운영 배포: main2 1f3e683, hosting index-C6Ocm1hM.js (Muse Spark). Supervisor 실제 GPU 실측 PC 줌22 57→72 fps(지도 JS 7.8→4.9 ms). 오늘 아침 46 fps 대비 약 1.55배. 폰 확인 대기.

2026-10-16 지도 구성 측정 스위치 ?mapcut= 운영 배포: main2 079ace0, hosting index-BODeTQEZ.js (Muse Spark). 미니맵은 정지 이미지라 이중 렌더 아님. Chief 실기기 주행 중 비교 대기.

2026-10-16 성능 배포: 주행 틱 다이어트(4109f2c)·렌더 배율 상한 2(da98361), hosting index-DDOX2IOH.js. P1 은 Muse Spark + Supervisor 보정. Chief PC·폰 perflab 재측정 대기. 남은 후보: 주행 중 지도 구성 축소, 동행 모드 측정값 확인, GPU 스키닝(보류).

2026-10-16 코너 드리프트 해결 Chief 확인. 다음: 프레임 시간 분석(perflab 항목별 분해).

2026-10-16 코너 둥근 경로·속도 비례 흔들림 운영 배포: main2 59b17eb, hosting index-ChghrNj0.js. 화면 드리프트 39.9°→2.4°, 꼭짓점 안쪽 1.4 m. Chief 육안 대기.

2026-10-16 떨림 해결 Chief 확인: 운영 PC 주행에서 툭툭 진동 사라짐.

2026-10-16 떨림 수정 운영 배포: main2 2037382, hosting index-CnMiq8hs.js. 지도 rAF 가 세션 적분보다 먼저 거리를 읽던 위상 어긋남 수정, 재생 speedCv→0, pre-push jitter 게이트. Chief PC perflab 재측정 대기. 동행 미표시는 같은 계정 두 기기(자기 uid 제외) — 버그 아님.

2026-10-16 떨림 지수(J1) 운영 배포: main2 a726c3c, hosting index-C4A8_p9l.js. ?perflab=1 패널에 라이더별 역행·속도 변동. 실측: PC(GTX1660)·폰(Adreno730) 모두 약 30fps, 라이더 3ms(10%) → 병목은 라이더 밖. J2(시계 통일)는 fix/rider-jitter worktree 에 미커밋으로 중단(메모리).

2026-10-16 perflab 운영 배포: main2 99c176f, hosting index-CVgjzurr.js. 주소에 ?perflab=1 → 프레임·라이더 비용·기기 정보 패널. 다음: 동행 떨림 조사(perflab 에 동행 추적 추가).

2026-10-16 LOD2·코너 회전 운영 배포: hosting index-Dld5MVGd.js(미리보기 combo 와 동일), rider-lod2.glb 200. 미리보기 채널 4개 삭제. 로컬 ~/bin/npm(Kimi 깨진 shim) 제거 — Git Bash npm 정상.

2026-10-16 LOD2·코너 회전: main2 4a35e3f 병합·푸시(게이트 통과, test:quick 1121/0). 운영 배포는 Chief 지시 대기. 미리보기 combo https://boxcycle-dc2df--combo-h77n72cf.web.app.

2026-10-16 rider14 흔들림 배포: main2 8c9763f 푸시·운영 hosting 배포, 어깨 1.0°·자전거 0.4°·상하 2mm. 롤백=riderModelProfile rider14 supportsSway=false. 다음 LOD1·LOD2(P8).

2026-10-16 rider14 배포: main2 8c0587d 푸시·운영 hosting 배포 완료, 운영 라이더 rider14(1명당 14콜, 자산 476KB). 롤백=config.ts ACTIVE_MODEL 한 줄. 다음 묶음 흔들림(P9)→LOD(P8).

2026-10-16 rider14: 제품 라이더 s5→rider14 교체 브랜치 rider14-replace 커밋·G0~G6 APPROVED/병합·배포 Chief지시대기. 1명당 213→14콜, 자산 1.98MB→476KB, ms/rider −35~−85%, 폰 미리보기 Chief확인. 보고 document/archive/reports/261016-RTW-라이더-rider14-교체-완료보고.md.

2026-10-15 진행79: 콜로세움 약간 오른쪽 프레이밍, 카메라 서쪽으로 0.0017도 이동/zoom15 유지. 지시 document/ops/20261013-face-redesign2/02-task-79.md.

2026-10-15 최신78: 실제 첫 지도 로마콜로세움주변zoom15·명시지역우선 6a1d5e6 커밋·APPROVED/Chief화면확인대기. 검수 document/ops/20261013-face-redesign2/04-review-78.md. 공개정사영상도로구도·실Mapbox엔진5경우/marker0/geo0/자유이동·회귀6·타입/lint/selector18/build PASS. 서울실데이터유지,실타일/실기기미검증,push/배포없음.

2026-10-15 최신77: 인증대기를연결실패로오표시하던UI버그교정 f20450a 커밋·APPROVED/Chief확인대기. 검수 document/ops/20261013-face-redesign2/04-review-77.md. 수정전busy/error없음실패재현, 수정후실App fixture8전환·React렌더4·selector18·타입/lint/build·수집105 PASS. 실제OAuth/실주행미검증,push/배포없음.

2026-10-15 최신: 교정76 콜로세움 수직 위성영상 dbab829 커밋·APPROVED/Chief확인대기.74지도위치방식·75조감도영상대체. 검수 document/ops/20261013-face-redesign2/04-review-76.md. 공개원본직접확인·브라우저5크기fixture/CTA/실패시서울차단·타입/lint/selector17/build PASS.5014,온라인영상,push/배포없음.

2026-10-15 교정75 진행: Chief 요구는 실제 콜로세움 지역 사진 배경. 74 지도카메라 방식은 요구 오해로 대체. 로컬 사진 고정·직접 캡처 검수, 지시 document/ops/20261013-face-redesign2/02-task-75.md.

2026-10-15 최신: 인트로74 로마 콜로세움 위성 배경 d4d7ec0 커밋·APPROVED/Chief확인대기. 검수 document/ops/20261013-face-redesign2/04-review-74.md. 5폭Mapbox투영·실앱위성/CTA/로그아웃·타입/lint/selector17/build PASS. 실지도외관·실기기미검증,5014유지,push/배포없음.

2026-10-15 최신: 지도 배경 앱 인트로72·E2E진입보정73 1f5f14d 커밋·APPROVED/Chief확인대기. 검수: document/ops/20261013-face-redesign2/04-review-73.md. 6화면·실앱9·helper10·selector17·수집105·타입/lint/build PASS. 로컬main2/5014, 실지도·실기기미검증, push/배포없음.

2026-10-15 최신: main2 Hosting배포71 완료 boxcycle-dc2df.web.app. [검수71](20261013-face-redesign2/04-review-71.md). build/deploy/HTTP200·asset해시일치PASS.

2026-10-15 최신: main2상단버튼확대/줌+− 66~70 8f341a0. [검수66](20261013-face-redesign2/04-review-66.md),48상태·타입/lint/selector PASS. 원본main2 5014확인,실기기미검증.

2026-10-15 최신 완료: face-redesign2 디자인수정 로컬 원본main2 병합83079c3. [검수65](20261013-face-redesign2/04-review-65.md). build/quick1066/selector15/의존검사PASS. push/배포없음,실기기검증별도.

2026-10-15 최신: 계기판63/64 f623d8d 검수/커밋. 폰크기동일·전체최대폭+3.53%/높이0%,50상태·조합36 PASS. [검수63](20261013-face-redesign2/04-review-63.md),실기기미검증.

2026-10-15 최신: 추천1 단일캐럿62 d9071d7 커밋/검수완료. 행16.8유지·48상태/tsc/lint PASS. [검수62](20261013-face-redesign2/04-review-62.md),실기기미검증.

2026-10-15 최신: face-redesign2 펄스59/61 d51676c·캐럿행70%60 1cff026 커밋/검수완료. hook5+펄스21+캐럿48+selector15/tsc/lint오류0 PASS,실기기미검증. [검수59](20261013-face-redesign2/04-review-59.md)·[검수60](20261013-face-redesign2/04-review-60.md).

2026-10-15 최신 완료: [검수57](20261013-face-redesign2/04-review-57.md) Google중복제거147e83c / [전체검수58](20261013-face-redesign2/04-review-58.md) 438상태+펄스PASS·결과가로넘침보정80fb6a6. 실기기/실지도/실인증미검증,5013사용확인·통합/푸시미실시.

2026-10-15 최신 완료: 최우선닉네임56 [검수56](20261013-face-redesign2/04-review-56.md) APPROVED/AWAITING_CHIEF. b31de2a·25상태/validation/콜백/selector15 PASS. 잔여Google상태/통합점검/실기기/병합푸시. 실가입미검증.

2026-10-15 최신 완료: 시작인증55 [검수55](20261013-face-redesign2/04-review-55.md) APPROVED/AWAITING_CHIEF. 주행설정54승인·시작카드205→176px,25상태/selector15 PASS,9c8a761. 실인증/실기기미검증,다음Google/닉네임카드.

2026-10-15 최신 완료: 주행 설정54 [검수54](20261013-face-redesign2/04-review-54.md) APPROVED/AWAITING_CHIEF. 다섯요청반영·폭351→267px,20상태/tsc/lint PASS,93d9284. 5013사용확인·실기기미검증.

2026-10-15 최신 완료: HUD 중앙안내53 [검수53](20261013-face-redesign2/04-review-53.md) APPROVED/AWAITING_CHIEF. 폰높이72→63px,버튼/계기/코칭보존,16상태/콜백/selector15 PASS. face-redesign2 9bcc219커밋·5013확인,실기기미검증. 다음가입·인증창.

2026-10-15 최신 완료: 검색51 Chief승인. 주행설정52 [검수52](20261013-face-redesign2/04-review-52.md) APPROVED/AWAITING_CHIEF. 체중/강도22px·면적36%축소,20상태/콜백/공유CSS PASS. face-redesign2 CSS1파일6e89efa,5013확인·실기기미검증.

2026-10-15 최신 완료: 펄스50 Chief승인. 지명 검색51 [검수51](20261013-face-redesign2/04-review-51.md) APPROVED/AWAITING_CHIEF,일반2→7/긴1→4개·단일목록스크롤·32상태PASS. face-redesign2 CSS두파일ca56e9b,기본main2문서기록. 5013사용확인·실API/실기기미검증,다음HUD·안내팝업.

2026-10-15 최신 완료: 시작 안내를 펄스50으로 변경 [검수50](20261013-face-redesign2/04-review-50.md). 900ms×2·색 고정·확대/광륜, 네 viewport 겹침 없음/기존 동작/selector15 PASS. CSS81dcce6 커밋, 실기기 미검증. 지도 설정49 확인 대기 유지·디자인 후속 지명 검색.

2026-10-15 최신완료: 지도설정48/49 [감리49](20261013-face-redesign2/04-review-49.md) APPROVED/AWAITING_CHIEF. 주행설정47 Chief통과,폰227→144px·PC가로overflow0. 24상태/37콜백PASS,CSS1파일8b2f6a2커밋. 5013맵버튼사용확인,다음지명검색. 실기기미검증·Cursor교대.

2026-10-15 최신완료: 미니맵/주행설정46·47 [감리47](20261013-face-redesign2/04-review-47.md) APPROVED/AWAITING_CHIEF. 미니맵16상태현상유지·주행설정16상태PASS,CSS1파일 c6b230e커밋. 폰194→173px,다음주행카드/시작안내보존. Muse한도유지→Cursor,남은UI코드전달승인済. 5013주행설정사용확인·후속지도설정/지명검색,실기기미검증.

2026-10-15 최신완료: 주행시작 안내44/45 [감리45](20261013-face-redesign2/04-review-45.md) APPROVED/AWAITING_CHIEF. 코드51866a5·선행UI b4239b5 커밋, 다음주행카드유지. 경로완료600ms×2·접힌패널표시·접기종료,4viewport/14확인/selector15/tsc/lint PASS. 외부코드전달승인으로권한대기해소. 5013확인·실기기/실주행미검증.

2026-10-15 주행시작 안내44: 기존 UI 코드 b4239b5 커밋, 다음 주행 카드 유지. 셀렉터15/tsc PASS. Muse429·Cursor 외부 코드 전달 자동 승인 거부로 사용자 응답 대기. [검수44](20261013-face-redesign2/04-review-44.md), 점멸 미구현.

# ops 전체 상태판

2026-10-20 [UI 이전 수정 릴리스](20261020-pre-ui-release/README.md): IN_PROGRESS. fix/pre-ui-release-20261020→main2. 분리소스 build/서버132/웹관련17/selector19 PASS. 새UI 제외·운영 삭제 수동실행 없음.

2026-10-17 첫 진입 인증·위치 호스팅 배포: main2 5cb0679, https://boxcycle-dc2df.web.app (index-CzaDkCRY.js). 인트로에서 게스트·로그인 후 지구본, 권한에 따라 현재 위치 또는 콜로세움. 권한별·폰 화면 검수는 아직.

2026-10-17 [첫 진입 인증·위치 통합](20261017-entry-location/README.md): IN_PROGRESS. 담당 Codex/Cursor. Chief 진행 승인, 두 인증 선택과 위치 안내·지구본 연결. 다음 구현·권한별 회귀·모바일 검수. 이전 2초 전환은 대체, 배포 없음.

2026-10-17 [인트로 자동 전환](20261017-intro-auto-transition/README.md): SUPERSEDED. Chief의 [첫 진입 인증·위치 통합](20261017-entry-location/README.md)으로 대체. 당시 CTA 제거·2초 타이머 구현·검증은 보존, 2초 자동 전환은 최종 채택하지 않는다.

2026-10-17 [인트로 배경 선요청](20261017-intro-preload/README.md): APPROVED/Chief 확인 대기. Cursor 구현·Codex [검수02](20261017-intro-preload/04-review-02.md), 빌드·원본/빌드 주소 일치·브라우저 선요청/총1건 재사용·문서검사 통과. 기본 Cursor·OpenCode는 명시 요청 때만·한국어 안내 지침 반영. 다음 Chief 확인, 배포·실기기 속도 측정 없음.

2026-10-15 최신완료:41 Chief통과.결과42/43 [감리43](20261013-face-redesign2/04-review-43.md) APPROVED/AWAITING_CHIEF.CSS8속성만·지도없는단일browser/page8상태PASS,기본높이91→82/Guest166→155,保存중·失敗안내完整표시。5013확인대기·실기기/실주행미검증·미커밋。

2026-10-15 최신완료:40 Chief통과.센서41 [감리41](20261013-face-redesign2/04-review-41.md) APPROVED/AWAITING_CHIEF.체험선택표시/강조·余白정리,740높이105→96,버튼/기능보존。단일browser/page10상태+실제1·selector15/tsc PASS,5013확인대기。실기기BLE미검증/미커밋。

2026-10-15 최신완료: 캐럿左정렬/24px행40 [감리40](20261013-face-redesign2/04-review-40.md) APPROVED/AWAITING_CHIEF.48고유DOM+실제15상태,CSS4선외변경0.대표패널높이약21px감소,다른버튼/값/기능보존。5013확인대기,실기기미검증/미커밋。

2026-10-14 최신완료: 텍스트전환→이중캐럿38/계약39 [최종감리39](20261013-face-redesign2/04-review-39.md) APPROVED/AWAITING_CHIEF. 위치위/거리아래동반펼침·접기·재활성/값보존.48DOM+실제15상태·141거리테스트·tsc/lint/diff PASS,5013확인대기.실기기/전체주행e2e미검증,미커밋.

2026-10-14 최신완료: 위치/거리別화면34·마감35/37 [최종감리37](20261013-face-redesign2/04-review-37.md) APPROVED/AWAITING_CHIEF. 중간토글제거·거리›/‹위치선택전환·공통삭제/값보존.32DOM+실제15상태·141거리테스트·tsc/lint/diff PASS.5013확인대기.이전33디자인미채택,실기기/전체주행e2e미검증,미커밋.

2026-10-14 최신진행: Chief30~33 디자인미채택. 명확한 위치/거리 별도화면컨셉승인 → [지시34](20261013-face-redesign2/02-task-34.md) Muse IN_PROGRESS,5013유지. 이전33 기술검수보존,최종디자인합격아님.

2026-10-14 최신: 경로 탐색 모드별 접기30/31·펼침배치32·내부높이33 완료. [최종감리33](20261013-face-redesign2/04-review-33.md) APPROVED/AWAITING_CHIEF. 44px 한행토글·입력보존·상호접기/양쪽펼침,4viewport20상태+실제3viewport18상태 PASS.5013확인대기,실기기/실제주행未검증,커밋/배포없음.

2026-10-14 최신: 입문28 Chief통과. 경로생성 [감리29](20261013-face-redesign2/04-review-29.md) APPROVED/AWAITING_CHIEF. 거리그룹·여백/테두리정리,높이209→201,35mock+2live PASS.5013지도클릭→Start확인대기.

2026-10-14 최신: 입문도퍼블릭밀도 [감리28](20261013-face-redesign2/04-review-28.md) APPROVED/AWAITING_CHIEF. 선택행44→32,실제창높이241→193·4개모두표시.21mock+live PASS,5013확인대기.

2026-10-14 최신: 두목록26 Chief통과. 입문 [감리27](20261013-face-redesign2/04-review-27.md) APPROVED/AWAITING_CHIEF,실제7403→4개모두표시·35mock+live PASS.5013입문확인후다음.

2026-10-14 최신: [감리26](20261013-face-redesign2/04-review-26.md) 두목록추가축소 APPROVED/AWAITING_CHIEF.1024내경로7→10·퍼블릭실제8→11,두목록선택행min32특정예외.60mock+2live PASS,5013확인대기.

2026-10-14 최신: 두목록밀도 [감리25](20261013-face-redesign2/04-review-25.md) APPROVED/AWAITING_CHIEF. 내경로meta/progress둘째줄統合·복합행74→44·폰완전행+1,퍼블릭長행/PC행수증가·phone短행수유지.5013확인대기.

2026-10-14 최신: 내경로22 Chief통과. 퍼블릭23/24 [감리24](20261013-face-redesign2/04-review-24.md) APPROVED/AWAITING_CHIEF.실제7403→5행、검색/정렬한행、55mock+2live PASS.5013 RTW→퍼블릭확인후다음.

2026-10-14 최신: 계정20 Chief통과. 내경로21/22 [최종감리22](20261013-face-redesign2/04-review-22.md) APPROVED/AWAITING_CHIEF,740혼합목록1→3행·예외안내재작업PASS。5013 RTW→내경로확인후다음。

2026-10-14 최신: 계정2컬럼再지시20 [감리20](20261013-face-redesign2/04-review-20.md) APPROVED/AWAITING_CHIEF. 폭460px·좌계정자산/우통계,40mock+2live·tsc/diff PASS. 5013계정창확인후다음. 계정19단열대체,메뉴18승인보존.

2026-10-14 최신: 메뉴18 Chief채택. 계정19 Muse완료 → [감리19](20261013-face-redesign2/04-review-19.md) APPROVED / AWAITING_CHIEF. 28mock·2실제viewport·tsc/diff PASS. 실기기·실제등록계정미검증. 5013 오른쪽계정창확인후다음.

2026-10-14 메뉴 구현 완료: Muse [결과18](20261013-face-redesign2/03-result-18.md) → Supervisor [감리18](20261013-face-redesign2/04-review-18.md) APPROVED / AWAITING_CHIEF. 4화면 크기·12상태 및 닫기/내 경로 진입 PASS, 실기기 미검증. 5013에서 확인·피드백 후 다음 창 진행.

2026-10-14 디자인 검토 추가: face-redesign2 [수정안17](20261013-face-redesign2/17-proposal-ui-balance.md) 제시. 첨부 11장·소스 검토, 실행/실기기 검증 미실시. 구현·채택 전이며 기존 추가15/16 상태는 유지.

마지막 갱신: 2026-10-09. 상세 기록은 각 묶음에, 목표·기능별 진도는 [상태보드](../260707-RTW-기능-인벤토리-상태보드.md), 제품 전체 방향은 [RTW 현황판](../260928-RTW-현황판.md)에 있다.

| 현재 작업 | 단계 | Supervisor | Developer | Chief 승인 | 마지막 검수 | 막힘 | 다음 작업 |
|---|---|---|---|---|---|---|---|
| [face-redesign2 UI](20261013-face-redesign2/README.md) | AWAITING_CHIEF · Google57/점검58 | Codex | Cursor(Muse한도 유지) | 중복제거·전체화면점검 요청 | [검수58](20261013-face-redesign2/04-review-58.md) 438상태/대표조합 PASS | 실기기·실지도·실인증 미검증 | Chief5013확인·실기기·최종통합 |
| [모바일 디자인·협업](20261009-mobile-design-collaboration/README.md) | DESIGN_ACCEPTED · 패널 채택·주행 토글·워크트리 분리 | Codex | OpenCode Muse Spark 1.3 / Cursor 교대 | 스마트폰 우선·협업 체계 승인, 코드 작성 금지 유지 | [인계 검수 PASS](20261009-mobile-design-collaboration/04-review-01.md) · 요약 오류 1건 정정 | 실제 UI·실기기 미검증 | [최신 Chief 결정](20261009-mobile-design-collaboration/19-chief-control-worktree.md) 기준 워크트리에서 토글 시안·상태 명세 정리(코드 금지) |
| [페이서](20261008-pacer-riders/README.md) | APPROVED · main2 병합·배포 | Claude | Cursor CLI(구현)·Claude(검증) | 이름·기본 켜짐·2명 승인(10-08) | [검수 01](20261008-pacer-riders/04-review-01.md) 자동 전부 pass | 없음 | 사용 확인·종료 |
| [칼로리·이어달리기](20261006-calories-resume/README.md) | APPROVED · origin/main2 반영 완료 | Codex | Cursor CLI | 칼로리 변경·재개1개유지 요청 | [18 검수](20261006-calories-resume/18-review-supervisor.md) · [24 push 완료](20261006-calories-resume/24-result-remote-push.md) | 실 Firebase·다중 탭/e2e 미실행 · 원격 반영 완료 | Chief 사용 확인·최종 종료 |
| [내 경로 가독성](20261006-saved-route-readability/README.md) | APPROVED · origin/main2 반영 완료 | Codex | Cursor CLI | Edge 글자 수정 요청 | [03 검수](20261006-saved-route-readability/03-review.md) | Edge 사용자 창 직접 검증 미실시 · 원격 반영 완료 | 사용 확인·종료 대기 |
| [주행 맵 제어](20261005-ride-map-controls/README.md) | APPROVED · 고도 포함 · origin/main2 반영 완료 | Codex | Cursor CLI | 맵 제어·축척 왼쪽 고도 요청 | [09 고도 검수](20261005-ride-map-controls/09-review-camera-altitude.md) | 원격 반영 완료 | Chief 사용 확인·최종 종료 |
| [제품 가치·이름·칼로리](20261005-product-value-name-calories/README.md) | AWAITING_CHIEF · 조사 문서 local 커밋 | Codex | Cursor CLI (ask 조사 exit 0) | 새 경험·명칭·계산 변경은 미채택 | [02 근거·제안](20261005-product-value-name-calories/02-result-and-proposal.md) · 핵심 소스 대조 | 없음 | 경험 검증·새 이름·칼로리 정책 선택 후 별도 작업 |
| [문서 체계 정리](20261005-document-system/README.md) | APPROVED · origin/main2 반영 완료 | Codex | Codex (Cursor CLI 실행 오류 후 직접 수행) | 문서 정리 요청으로 범위 승인 | [03 PASS](20261005-document-system/03-review-document-system.md) · 현재 링크 0오류·이동 0회귀 | 과거 누락 23건 별도 기록 · 원격 반영 완료 | Chief 최종 종료 승인 전 |
| [Foreground read spike](20261003-focus-read-spike/README.md) | APPROVED · main2 FF 완료(로컬) | Codex | Cursor CLI | 행동 보존형 read/write 저감 승인됨 | [21 final PASS](20261003-focus-read-spike/21-review-final-approval.md) · [23 merge](20261003-focus-read-spike/23-result-merge-main2.md) | billed/SDK reconnect 미계측 · push 미실시 | Supervisor/Chief: push·배포 여부 결정 |
| [Public Trail traffic followup](20261002-public-trail-traffic-followup/README.md) | AWAITING_CHIEF (TASK-02R APPROVED) | Codex | Cursor CLI | 배포·트리거/전송 주기·A/B/D 구현 전 필요 | [09 PASS](20261002-public-trail-traffic-followup/09-review-phase-aligned-measurement-rework.md) | 배포 후 정렬된 운영 1/2명 데이터 Ø | Chief: quiet/solo/dual ISO 구간과 분당 read/write 제공 또는 후속 범위 결정 |
| [동행 싱크](sync-relay/INSTRUCTION.md) | PLANNING (기존 대기) | 미지정 | 미지정 | 후속 범위 결정 시 확인 | 기존 S4 기록 | S4-4 재개 보류 | [후속 계획](20260927-peer-competition/260927-RTW-동행-지연과-경쟁-판정.md) 검토 |
| [미니맵](20260923-minimap/HANDOFF.md) | PLANNING (기존 대기) | 미지정 | 미지정 | 미확인 | 지시04까지 병합 | 보류01·02 | 재개 시 새 지시 |

| [동행 경쟁 판정 계획](20260927-peer-competition/README.md) | PLANNING (기존 미착수) | 미지정 | 미지정 | 재개 시 범위 결정 | 기존 09-27 계획, 최신 표시 보고 분리 | 활성 지시 없음 | 재개 시 새 지시 |

종료된 묶음과 이동 가능 여부는 [완료 기록 색인](../archive/README.md)에 보존한다. 이 표의 상태는 각 작업 폴더의 최신 지시·결과·검수와 함께 갱신한다.






