2026-10-29 **경로 생성 창 축소 / Codex 재개 독립검증 PASS**: Cursor 구현완료 exit0·기존 Claude03검증/1fda2af0커밋 보존. Codex tsc·selector20·핵심Playwright8건(42초)·dep/tidy/diff PASS, 4가로228폭/50·46·30버튼/기능/실제MapView경계·새캡처 눈검수. [결과](20261029-route-popup-compact/04-review-codex.md). 첫wrapper검색명령 실패→직접실행 통과; Ego기존공간없음은Playwright전환. 실폰·실Firebase·emulator요구1건 미실행. 이세션 커밋푸시배포실행없음·5031유지. 확인 C:\20.HDev\boxcycle\apps\web → npm run dev:localhost -- --port 5031(기존서버재사용) → http://localhost:5031/ 새로고침·지도길게누름·아이콘탭/거리칩확인.

2026-10-28 **접힌 RouteDock LED 3배 / LOCAL_VERIFIED·미배포**: Cursor CSS2줄로지름8→24px, Codex독립4가로×idle/riding8상태24×24실측·내부7px보존·탭PASS, sensor-dock9PASS. [결과·감리](20261028-sensor-dock/07-result-led-size.md). 기존5031유지·커밋푸시배포없음. 확인 C:\20.HDev\boxcycle\apps\web → 서버없으면 npm run dev:localhost -- --port 5031 → http://localhost:5031/ 새로고침·접힌LED탭.

2026-10-28 **접힌 LED 24px / Cursor구현·Codex감리대기·미배포**: [결과](20261028-sensor-dock/07-result-led-size.md). `.route-dock__led` 8→24px 두 줄. 5031 HTTP200. 전수시험미실행.

2026-10-28 **센서 RouteDock 통합 / LOCAL_VERIFIED·미배포**: [최종감리](20261028-sensor-dock/03-review.md). Cursor구현·보완종료/Codex지시감리. 접힘·무경로흰/녹점멸LED→펼침기존접기캐럿+센서알약, 중앙센서제거·키보드포커스유지. 독립화면20·단위20·selector19·tsc/lint/build/dep/diffPASS. tidy기존188>186FAIL·Cursor1차계정/카메라간격FAIL범위밖·전체quick/실폰실센서미실행. baseline3179누락0/기존PNG변경0·기존dirty보존·커밋푸시배포없음·5031유지. 확인 C:\20.HDev\boxcycle\apps\web → 기존없으면 npm run dev:localhost -- --port 5031 → http://localhost:5031/ 새로고침·LED→센서설정. 초기30분예상초과(지연·감리보완). 다음Chief실폰/실센서확인·배포별도지시。

2026-10-28 [계정 버튼 오른쪽 위 정렬](20261028-edge-alignment/01-result.md): LOCAL_VERIFIED·미배포. 계정 화면/상태15·긴수치2·입력2·관련회귀5·build PASS. Chief 구현확인한 왼쪽 패널 유지, 재개 후 MapHud.css만 변경. 커밋푸시배포없음·5031재사용.

2026-10-28 [주행 거리·반달·설정·카메라](20261028-compact-controls/08-review-final.md): APPROVED/LOCAL_VERIFIED. Cursor구현·보완/Codex독립감리완료. UI90·카메라102·selector19·타입/lint/build/depPASS, tidy기존188FAIL·quick미실행. 증거11장全복구·2181보존. Chief실폰확인대기·커밋푸시배포없음.

2026-10-28 [주행 UI·인터벌·응원 구현](20261028-ui-moments/README.md): IN_PROGRESS. Codex 계획·감리/Cursor 구현·시험, v2 승인·기존 dirty 보존·미배포.

2026-10-28 [주행 UI·인터벌·응원 배포 완료](20261028-ui-moments/10-deployment.md): DEPLOYED. Hosting only·계기판20px 한행/인터벌검정25% 포함. 최신화면54 PASS·build/selector19/dep PASS. 운영 index200·로컬 바이트일치·연결JS/CSS5개 SHA256일치·제품소스544지문불변. JS index-BxrSOZ9X.js / CSS index-CHSjW9rI.css. 커밋푸시없음·기존서버유지. 기존증거10장 원본미복구/정련기존188>186/전체quick과거4실패후개별PASS는 아래인계유효. 확인 https://boxcycle-dc2df.web.app 새로고침→인터벌켜기→주행. 사용자중단기준8% 유지.

2026-10-28 [인터벌 반투명 검정 배경](20261028-ui-moments/09-result-interval-background.md): Chief 후속 지시로 검정25% 불투명도·글자 선명도 유지·안쪽6×8px/모서리8px. 관련6 PASS·고정31 갱신, 기존5031·미배포. 기존 증거10장 원본 미복구는 이전 인계 유효.

2026-10-28 [계기판 한 행 후속](20261028-ui-moments/08-result-single-row-hud.md): 왼쪽20px·6개 한 행·숫자18px·간격8px. 관련 화면5 PASS(4크기+긴수치), 기존5031·미배포. 작은 화면50% 강제제한 대체.

2026-10-28 [주행 UI·인터벌·응원 최종 감리](20261028-ui-moments/03-review.md): 제품 로컬 검증 완료·미배포. 화면54/빌드/타입/관련lint/selector19/의존 PASS. quick1430 PASS·4 FAIL→실패항목 개별 재검 PASS; 전체0FAIL 아님. 정련 exports188>186은 착수 baseline도188로 기존 문제. 검증 중 기존 PNG11장 덮어쓰기→1복구·10원본 미복구, 보존사고 미해결. 실제 제품 컴포넌트 캡처 evidence/final-screen, 지도·수치는 fixture. 실폰/실센서/음향청취 미실행. Cursor 모두 종료·기존5031 유지·커밋푸시배포 없음.

2026-10-28 [거리·방향 첫 진입 펄스5회](20261028-distance-entry-pulse/README.md): LOCAL_VERIFIED/미배포. 여기에서계속초기진입누락교정·일반거리탭같이적용. 단위146·UI4·selector19·빌드/의존PASS.

2026-10-28 [첫 지도 마지막 주행 종료점 우선](20261028-entry-last-ride/README.md): LOCAL_VERIFIED/미배포. 기록로딩후실제종료좌표우선·위치권한무관,없으면기존선택. 회귀36·셀렉터19·빌드/의존PASS.

2026-10-28 [종료 후 이어 가기 고도1,000m](20261028-terrain-fallback/02-result-end-overview.md): LOCAL_VERIFIED/미배포. 중심·정북·평면 유지, 화면높이/위도별1,000m줌 적용. 단위/effect11·실제Mapbox WebGL1·빌드/의존PASS.

2026-10-28 [지형 자동평면·종료2D](20261028-terrain-fallback/README.md): LOCAL_VERIFIED/미배포. 4Hz DEM/카메라 충돌감시·안정복귀·수동OFF존중, 종료지형/건물OFF·정북/pitch0. 단위·합성WebGL·UI개별PASS,연속브라우저묶음deadline실패는결과에분리기록.

2026-10-27 [맵 뷰 메뉴 통합](20261027-map-menu/README.md): LOCAL_VERIFIED/미배포. 계정 내 도로망·카메라6 아래3D로 통합, 고급·맵 뷰 제거. UI26·지도156·DOM1 최종PASS.

2026-10-24 10:14 KST [카드 삭제·인라인 유지 배포 완료](20261023-ui-redesign/27-result-inline-history-finalize.md): 3c3ba02c 푸시·Hosting 완료, index-BDb2hU8r.js 등 운영5자산 SHA256 일치. 단위1354/화면24/실앱8 PASS. 묶음3 지시28 Cursor 구현 중, 결과29·로컬 비교 대기.
2026-10-24 10:09 KST [인라인 유지·카드 삭제 마감](20261023-ui-redesign/27-result-inline-history-finalize.md): Chief 인라인 확정, panel 연결 제거·고정10 등록. 단위1354/화면24/실앱8/정련·구조 PASS, 커밋·푸시·승인된 호스팅 배포 단계. 다음 묶음3 지시28.
2026-10-24 08:4x KST [호스팅 배포·지시 24 착수](HANDOFF.md): 16ab066c 호스팅 배포(운영 번들 index-DmTMAA6G.js 일치). openclaw gateway 종료, firebase.route-list-qa.json 삭제(Chief). [지시 24](20261023-ui-redesign/24-task-entry-card-history.md) 카드 삭제·주행 기록 연결 Cursor 실행 중 — 끝나면 감리→커밋·푸시·배포(B 는 inline). [Codex 프롬프트](20261023-ui-redesign/23-first-prompt-codex-20261024.md) 갱신.
2026-10-24 07:55 KST [Chief 지정 조작부 되돌리기](20261023-ui-redesign/22-result-chief-revert-controls.md): PASS. 녹색 원형 시작·아이콘 일시정지 복원, 주행 중 지도 조작 유지, 순위 칩 원형 아이콘, 잠금 시험 「Chief 고정」. [고정 목록](../reference/product/261024-RTW-Chief-지정-디자인-고정.md) 신설·AGENTS/CLAUDE/플레이북 연결. 화면23·단위1354·실앱 ride-entry 7/7(재실행)·batch2-live PASS. 묶음1·2와 함께 커밋.
2026-10-23 22:35 KST [Supervisor 인계](20261023-ui-redesign/13-handoff-next-supervisor.md): 묶음1/2 LOCAL_VERIFIED·Chief화면확인대기, 미커밋/미배포. 서버/보존파일/검증증거/후속순서 정리, [첫 프롬프트](20261023-ui-redesign/14-first-prompt-next-supervisor.md) 작성.
2026-10-23 [MENU·경로 목록 묶음1](20261023-ui-redesign/05-review-batch1.md): LOCAL_VERIFIED/Chief화면확인대기. Cursor구현·Codex감리, DeepSeek/GLM 공통무료한도 후 미완 인수. [시안비교](20261023-ui-redesign/comparison-batch1.html),단위1353/서버169/실앱8 PASS,화면17 PASS·기존실패1.5020/미배포.
2026-10-23 [수퍼바이저 교대 체계](HANDOFF.md): 채택. Chief — Claude Code·Codex 가 토큰 한도에 따라 수퍼바이저 교대. 시작·끝은 [HANDOFF.md](HANDOFF.md), 절차는 [교대 플레이북](../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md). 디자인 캔버스는 리포 [mockups](20261023-ui-redesign/mockups/)가 원본.
2026-10-23 [전체 화면 디자인 변경](20261023-ui-redesign/README.md): IN_PROGRESS. 시안 16장 Chief 승인, 3장 배포·2장 부분. 묶음 1(MENU·경로 목록)부터. 결정 대기 2건.
2026-10-23 [순위 칩·순위판·결과 순위 줄](20261023-leaderboard/05-result-glance.md): DEPLOYED. 5ab00ad6. Cursor 구현·Claude 감리(수정 2). 상위20·위아래3 함수 배포. tsc/단위1353/서버169/e2e:ride 7/7 PASS.
2026-10-23 [맵 뷰 다이어트](20261023-mapview-diet/03-result.md): DEPLOYED. 649045b0. Spinatlas Dark·스타일칩·시점·줌·장소이름 제거. Cursor 구현·Claude 감리(의존방향·export 교정).
2026-10-23 [리더보드 1단계·계정 패널](20261023-leaderboard/01-plan.md): DEPLOYED. getLeaderboard(센서 주행·세계·주/달/전체)·리더보드 시트·계정 패널 재설계·km 소문자·디자인 규칙.
2026-10-23 [관리자 지표](20261023-admin-dashboard/01-plan.md): DEPLOYED·Chief 확인. getAdminDashboard·관리 시트.

2026-10-22 [코드 정련](20261022-code-tidy/README.md): APPROVED. 안쓰는 export 446→186·반복 549→18줄·CSS −1,345줄·큰파일 3개 축소, pre-push 「코드 정련 래칫」 게이트 추가(생존 4/4). tsc/lint/단위1341/e2e7 PASS. 배포.

2026-10-22 [적용수단·한행·두줄30](20261020-ui-800x360/04-review-30.md): DEPLOYED(main2 0ec14853·Hosting·운영 번들 문구 확인). 자동탐색 적용수단 파랑·두모드 수단/재생/삭제 한행·offered 두줄·팝업폭 고정. 브라우저17/거리146/selector19/타입/build/lint PASS. 기존5002·커밋/푸시/배포없음·Chief확인대기.

2026-10-22 [다섯위치·미디어버튼29](20261020-ui-800x360/04-review-29.md): LOCAL_VERIFIED/커밋푸시완료. main2 c7ee09ba. 출발/W1/W2/W3/도착 복원·하단왼쪽재생·우하단독립원형버튼. 브라우저14/거리145/selector19/타입/build/lint PASS. 배포없음·기존5002·실제폰Chief확인대기.

2026-10-22 [거리·방향 즉시출발28](20261020-ui-800x360/04-review-28.md): DEPLOYED. main2 a55fb50a·Hosting·운영4파일SHA일치. 출발미지정 긴누름 즉시지정/임시마커·출발버튼제거/요청안내반영. 단위1340·거리145·브라우저4·타입/build/lint PASS. 실제폰Chief확인대기.

2026-10-22 [연속 방향 재탐색25](20261020-ui-800x360/04-review-25.md): LOCAL_VERIFIED/Chief 재확인 대기. direction 긴 누름이 일반 위치선택으로 빠지는 회귀 교정. 실제API adapter/잔액·일반모션·연속생성 검증, 거리144/브라우저3/타입/lint/build PASS. 실제 신고 누름길이 미확정·5002 유지, 커밋·배포 없음.

2026-10-22 [거리 자동생성·재시작24](20261020-ui-800x360/04-review-24.md): LOCAL_VERIFIED. 23 방향보관대기→방향 클릭 자동생성, 삭제 후 거리 탭에서 기존 출발 버튼 재사용. 실제hook profile/늦은응답 교정·거리144/브라우저14종 분할/타입/lint/build PASS. 기존5002 유지, 검수5000만 종료. 커밋·배포 없음.

2026-10-22 [거리·방향 유도23](20261020-ui-800x360/04-review-23.md): LOCAL_VERIFIED. 거리 확정 원2펄스·거리+방향 후 기존 수단 표시/순차2사이클·수단 클릭 탐색. 거리144/브라우저13종 분할/타입/lint/build PASS. localhost5000 새로고침·실제폰 확인 대기, 커밋·배포 없음.

2026-10-22 [방사 화살표·중단 인계22](20261020-ui-800x360/04-review-22.md): LOCAL_VERIFIED. 사용량 한도 중단 후12화살표 최종검수·스타일 차분전환 복원 교정. 거리143/실제MapView3/타입/lint/build PASS. 실제폰 확인 대기·커밋/배포 없음.

2026-10-22 [지도 길게누르기·UI 릴리스18](20261020-ui-800x360/05-release-18.md): DEPLOYED. main2 e7fd5acf·Hosting·운영4파일 일치. 일반 위치선택500ms·메뉴/이동/확대 차단·계기판/주소 포함. 단위1335 PASS. 개발서버 종료·3000 유지. 실제폰 확인 대기.

2026-10-22 [계기판 외곽선13](20261020-ui-800x360/04-review-13.md): LOCAL_VERIFIED/Chief 외관 확인 대기. 박스 배경 제거·글리프 키라인·하늘색/초록. 3폭/3상태 시험 PASS·캡처 확인, 배포 없음. localhost5002.

2026-10-21 [운영 새로고침·재배포12](20261020-ui-800x360/04-review-12.md): DEPLOYED. Chief 새로고침미실행설명으로조사종료·추가UI수정0. 문서63630d67 main2병합/푸시·기존UI재배포/운영4파일일치. 이미열린운영화면새로고침필요. https://boxcycle-dc2df.web.app

2026-10-21 [경로 팝업 압축11](20261020-ui-800x360/04-review-11.md): DEPLOYED/Chief 실제폰검수대기. main2 cbe552b1·Hosting·운영4파일일치. 수단 즉시생성/삭제 하단/탭 제목오른쪽21px·드래그충돌교정. 단위1323/UI22/경로142 PASS. https://boxcycle-dc2df.web.app

2026-10-21 [경로·주행 UI09~10](20261020-ui-800x360/04-review-10.md): DEPLOYED/Chief 실제폰검수대기. main2 2c982ccc·Hosting·운영4파일일치. 경로두탭/주소전용170×54/우하단34px센서·주행바. 단위1323/UI20/실지도2 PASS. https://boxcycle-dc2df.web.app

2026-10-21 [Mapbox 툴 제거08](20261020-ui-800x360/04-review-08.md): DEPLOYED. main2 4aae5ed9·Hosting·운영4파일일치·800×360 버튼DOM0 PASS. 지구본/나침반제거, 하단지표/저작권유지. 단위1321PASS. https://boxcycle-dc2df.web.app

2026-10-21 [지도 중심 UI 릴리스07](20261020-ui-800x360/05-release-07.md): DEPLOYED/Chief실기기검수대기. main2 ae646df9·Hosting성공·운영4파일일치. 주소단일면24px/두행85px/5행157px·비노출에지·상단계기. web1319/브라우저14+최종실지도1 PASS. https://boxcycle-dc2df.web.app

2026-10-20 [UI 이전 우선 릴리스](20261020-pre-ui-release/04-review-01.md): DEPLOYED. 코드5f012a52·검수문서8706ae91 원격main2반영. Hosting/Rules/함수4성공,web1319/서버132/Rules1/운영bundle3바이트일치PASS. 새UI제외.

2026-10-20 [미니맵 좌상단 캐럿](20261020-minimap-dock-swap/04-review-03.md): LOCAL_VERIFIED/Chief화면확인대기. 24px/‹접기·›펼치기/캐럿·RouteDock위치고정,터치·키보드/폰가로3종·타입·lint PASS. localhost5000,배포없음.

2026-10-20 [신규 도로 릴리스](20261020-new-road-display/02-task-02-release.md): IN_PROGRESS. Chief커밋·푸시·병합·배포승인. 날짜형식/긴선분/새기록삭제경로보완, Functions132·Rules실제에뮬레이터PASS. 분리소스빌드·main2병합·선택배포진행.

2026-10-20 [신규 도로 표시 복구](20261020-new-road-display/04-review-01.md): LOCAL_VERIFIED/Chief 실제계정확인대기. 종료시빈서버값덮어쓰기·positive미반영·최근범위이동누락교정, 기존취득일+trace복원. Node94/React시트1(2폭)/build/lint오류0·기존40경고/diff PASS. localhost5000강력새로고침, 배포·커밋·푸시없음.

2026-10-19 [Guest·위치·Ready Ride 배포26](20261019-guest-lifecycle/04-review-26-release.md): DEPLOYED/Chief사용확인대기. main2 d22c0492원격반영·Functions12/Rules/Hosting성공. web1295/서버127/독립32 PASS,운영인트로·API204/401·Google4/문서2227보존. 매일03:15KST Guest정리활성. https://boxcycle-dc2df.web.app

2026-10-19 [위치 선택 디자인25](20261019-guest-lifecycle/04-review-25.md): LOCAL_VERIFIED/Chief디자인확인대기. 내위치·기본위치/아이콘/파랑·아웃라인/220×162카드·44px버튼. 단위26/DOM1/selector19/lint/build·12상태PASS. 주소추적중지·redirect초안제거. localhost5004확인,배포없음.

2026-10-19 [Ready Ride 복구23](20261019-guest-lifecycle/04-review-23.md): LOCAL_VERIFIED. demo5004자동경로API누락·최초거리선택만하던UI·잔액미확인0경합교정. 실제SDK/Mapbox2/3/5/10km4 PASS(16.8s),잔액1/selector19/lint/build/diff PASS. 5004강력새로고침후확인. Cursor CLI ENOMEM→Codex직접. 운영변경·배포없음.

2026-10-19 [Guest localhost5000 실패22](20261019-guest-lifecycle/04-review-22-localhost5000.md): 원인확인. 운영Firebase를사용하는5000이 미배포guestActivityHttp(OPTIONS404)를호출. 시험주소127.0.0.1:5004에서 실제SDK최초진입/새로고침동일UID1 PASS·selector19 PASS. 우회변경·운영배포없음.

2026-10-19 [Guest 재개·환경복구21](20261019-guest-lifecycle/04-review-21-resume.md): LOCAL_VERIFIED/TEST_READY 유지. 기존채팅 최종완료 확인·회귀29 PASS·diff exit0, demo localhost5004 복구/GET200·Auth/Firestore/RTDB 확인. 제품변경·운영재삭제·배포·커밋/푸시없음. Chief직접확인·운영범위검수/배포 잔여.

2026-10-19 [Guest 수명·고아 정리](20261019-guest-lifecycle/README.md): IN_PROGRESS. 수행 Cursor(web06)·GLM-5.3(서버/Rules07) 병렬, Codex감리05. 운영Google4+Guest1/개인1978·공용192보존·고아FS17/RTDB2정리완료. core7·로그아웃2 PASS, 실제Rules7 PASS/고아발견1 FAIL, hook 만료안내경합 재작업. 배포없음.

2026-10-18 [위치18](20261017-entry-location/04-review-18.md): Chief 두버튼UI복원, 별도위치사용제거. 단위·DOM36/실앱button2·한국도착/selector19/타입/lint PASS, 커밋·배포없음.

2026-10-18 [위치17](20261017-entry-location/04-review-17.md): localhost차단복구회귀+초기카메라취소교정, 로컬PASS/Chief확인대기. 단위35/브라우저/selector19/lint/build, 배포없음.

2026-10-18 [위치16](20261017-entry-location/04-review-16.md): 운영 신고 조사, 실패후 재시도복구 로컬PASS·운영반영대기. 개인기기실패원인미확정, 단위33/브라우저1/selector19/lint/build PASS. 커밋·배포없음.

2026-10-18 [위치 선택15b](20261017-entry-location/04-review-15b.md): 요청한 두 줄 버튼·중복 제거·파란 테두리 반영, 로컬 APPROVED/Chief 확인 대기. 배포 없음.

2026-10-15 진행79: 콜로세움 약간 오른쪽 프레이밍, 카메라 서쪽으로 0.0017도 이동/zoom15 유지. 지시 document/ops/20261013-face-redesign2/02-task-79.md.

2026-10-15 최신78: 실제 첫 지도 로마콜로세움주변zoom15·명시지역우선 6a1d5e6 커밋·APPROVED/Chief화면확인대기. 검수 document/ops/20261013-face-redesign2/04-review-78.md. 공개정사영상도로구도·실Mapbox엔진5경우/marker0/geo0/자유이동·회귀6·타입/lint/selector18/build PASS. 서울실데이터유지,실타일/실기기미검증,push/배포없음.

2026-10-15 최신77: 인증대기를연결실패로오표시하던UI버그교정 f20450a 커밋·APPROVED/Chief확인대기. 검수 document/ops/20261013-face-redesign2/04-review-77.md. 수정전busy/error없음실패재현, 수정후실App fixture8전환·React렌더4·selector18·타입/lint/build·수집105 PASS. 실제OAuth/실주행미검증,push/배포없음.

2026-10-15 최신: 교정76 콜로세움 수직 위성영상 dbab829 커밋·APPROVED/Chief확인대기.74지도위치방식·75조감도영상대체. 검수 document/ops/20261013-face-redesign2/04-review-76.md. 공개원본직접확인·브라우저5크기fixture/CTA/실패시서울차단·타입/lint/selector17/build PASS.5014,온라인영상,push/배포없음.

2026-10-15 교정75 진행: Chief 요구는 실제 콜로세움 지역 사진 배경. 74 지도카메라 방식은 요구 오해로 대체. 로컬 사진 고정·직접 캡처 검수, 지시 document/ops/20261013-face-redesign2/02-task-75.md.

2026-10-15 최신: 인트로74 로마 콜로세움 위성 배경 d4d7ec0 커밋·APPROVED/Chief확인대기. 검수 document/ops/20261013-face-redesign2/04-review-74.md. 5폭Mapbox투영·실앱위성/CTA/로그아웃·타입/lint/selector17/build PASS. 실지도외관·실기기미검증,5014유지,push/배포없음.

2026-10-15 최신: 지도 배경 앱 인트로72·E2E진입보정73 1f5f14d 커밋·APPROVED/Chief확인대기. 검수: document/ops/20261013-face-redesign2/04-review-73.md. 6화면·실앱9·helper10·selector17·수집105·타입/lint/build PASS. 로컬main2/5014, 실지도·실기기미검증, push/배포없음.

# ops — 에이전트 작업 창구

2026-10-20 [800×360 UI 개선](20261020-ui-800x360/README.md): IN_PROGRESS. Chief 기준크기·순차구현 승인. GLM-5.3-Flash 계기판/주행제어 → Cursor 진입/목록/설정/빈상태, Codex 감리. 기존 dirty 보존, 배포 없음.

2026-10-18 [인트로 후속03](20261018-intro-blend/04-review-03.md): APPROVED/Chief확인대기. LongCat HTTP500후 Chief승인 Cursor패치·Codex감리. 좌상단브랜드·곡선로고1회회전·인증전2버튼/인증후HUD,3화면/상태전환/build/lint/selector19 PASS. 기존106파일보존·배포없음.

2026-10-18 [인트로 두 레퍼런스 결합](20261018-intro-blend/README.md): APPROVED/Chief 디자인 확인 대기. LongCat초안·Codex마감, 실제지도6크기/키보드콜백3/selector19/build/lint PASS. 기존81파일보존, [최종감리02](20261018-intro-blend/04-review-02.md), 로컬5000·배포없음.

2026-10-18 [기존 lint16 정리](20261018-lint16/README.md): APPROVED. LongCat 시험4파일 수정·Codex [감리01](20261018-lint16/04-review-01.md). 전체lint 오류0/기존경고40·시험17·build PASS, 기존72파일 해시 보존. 커밋·push·배포 없음.

2026-10-18 [Spinatlas 브랜드·A안 인트로](20261018-spinatlas-brand/README.md): APPROVED/Chief 화면 확인 대기. OpenCode LongCat 구현·재작업, Codex [최종감리02](20261018-spinatlas-brand/04-review-02.md). build·변경소스lint·selector19·4뷰포트/콜백 PASS, 전체lint 기존16오류. 로컬5000, 배포 없음.

2026-10-17 현재위치2초비행 [검수14](20261017-entry-location/04-review-14.md) 로컬PASS,실측2008.9ms. Chief체감대기·배포없음.

2026-10-17 현재위치1초비행 [검수13](20261017-entry-location/04-review-13.md) 로컬 PASS. 초기로마 유지·실제Mapbox1006.8ms 상승/이동/하강·회귀36/selector19/build PASS. Chief체감 대기, 배포 없음.

2026-10-17 초기 콜로세움 [검수12](20261017-entry-location/04-review-12.md) 로컬 PASS. 인트로부터 기본 지역zoom15, 지구본 연출 제거. 회귀33/Edge카메라/selector19/lint오류0/build PASS. Chief 화면 확인 대기·배포 없음.

2026-10-17 직접 위치 허용 [검수11](20261017-entry-location/04-review-11.md) 로컬 PASS. 중간 확인 제거, 최초 클릭→브라우저 허용→지도 이동. 회귀32/실제Edge·Mapbox카메라/selector19/lint/build PASS. Chief 화면 확인 대기, 배포 없음.

2026-10-17 실제 위치 공유 동의: [지시10](20261017-entry-location/02-task-10.md) IN_PROGRESS. Chief가 설정 안내 alert를 거부해 지시09 승인 철회. GLM-5.3이 공유 동의·native 허용/차단 복구·현재 위치 결과 연결 구현, Codex 검수. 배포 없음.

2026-10-17 현재 위치 버튼 보조문구·클릭 안내: [검수09](20261017-entry-location/04-review-09.md) APPROVED / Chief 화면 확인 대기. GLM-5.3 구현·Codex 검수, 시험22/selector19/lint/build PASS, 배포 없음.

2026-10-17 위치 차단 두 선택지: [검수08](20261017-entry-location/04-review-08.md) APPROVED / Chief 화면 확인 대기. GLM-5.3 구현·Codex 검수, 회귀29/selector19/lint/build PASS. 차단 해제 후 재시도 지원, 로컬 반영·배포 없음.

2026-10-17 첫 진입 위치 승인 후 미이동: [검수07](20261017-entry-location/04-review-07.md) 로컬 회귀 교정 PASS. 지연 승인·카메라27/selector18/lint/build PASS, Chief 실기기 확인·운영 반영 대기. 커밋·푸시·배포 없음.

2026-10-17 첫 진입 인증·위치 호스팅 배포: main2 5cb0679, https://boxcycle-dc2df.web.app. 권한별·폰 검수는 아직.

2026-10-17 [첫 진입 인증·위치 통합](20261017-entry-location/README.md): IN_PROGRESS. Chief 승인, 인트로 게스트/로그인→지구본→위치 권한별 현재 위치/콜로세움. 이전 2초 자동 전환 대체. Cursor 구현·Codex 검수, 배포 없음.

2026-10-17 [인트로 자동 전환](20261017-intro-auto-transition/README.md): SUPERSEDED. 최신 [첫 진입 인증·위치 통합](20261017-entry-location/README.md)으로 대체. 2초 타이머는 채택하지 않고 당시 구현·검증 기록만 보존한다.

2026-10-17 [인트로 배경 선요청](20261017-intro-preload/README.md): APPROVED/Chief 확인 대기. Cursor 구현·Supervisor 검수: 빌드·원본/빌드 URL 대조·브라우저 선요청/총1건 재사용·문서검사 통과. 기본 Cursor/한국어 지침 반영. 배포 없음.

2026-10-15 최신창:41 Chief통과,결과42/43 [감리43](20261013-face-redesign2/04-review-43.md) APPROVED/Chief확인대기。CSS余白/테두리/단위대비·보조수치wrap,지도없는browser1/page1순차8상태PASS,face-redesign2/5013유지。

2026-10-15 최신창:40 Chief통과,센서41 [감리41](20261013-face-redesign2/04-review-41.md) APPROVED/Chief확인대기。체험선택표시/강조/余白정리,単一browser/page順次검수,face-redesign2/5013유지。

2026-10-15 최신창: 콤팩트캐럿40 [감리40](20261013-face-redesign2/04-review-40.md) APPROVED/Chief확인대기.왼쪽정렬·44→24px·여백0,CSS4선만·DOM48/실제15 PASS,face-redesign2/5013유지。

2026-10-14 최신창: 이중캐럿/위아래동반패널38/39 [최종감리39](20261013-face-redesign2/04-review-39.md) APPROVED/Chief확인대기.텍스트모드button제거·위치위/거리아래펼침/접기·값보존.48DOM+실제15·141테스트 PASS,face-redesign2/5013유지.

2026-10-14 최신창: 위치/거리모드別화면34~37 [최종감리37](20261013-face-redesign2/04-review-37.md) APPROVED/Chief확인대기. 두중간토글제거·거리›진입/‹위치선택복귀·공통삭제.32DOM+실제15상태·141테스트 PASS,face-redesign2/5013유지. 이전33디자인미채택.

2026-10-14 최신창: 경로 탐색 모드별접기30~33 [최종감리33](20261013-face-redesign2/04-review-33.md) APPROVED/Chief확인대기. 두패널한행토글44px·값보존·펼침후배치·내부스크롤해소. face-redesign2/5013유지.

2026-10-14 최신창: 경로생성 [감리29](20261013-face-redesign2/04-review-29.md) APPROVED·Chief확인대기.입문28 Chief통과,face-redesign2/5013유지.

2026-10-14 최신창: 입문행간추가축소 [감리28](20261013-face-redesign2/04-review-28.md) APPROVED·Chief확인대기. face-redesign2/5013유지.

2026-10-14 최신창: 입문 [감리27](20261013-face-redesign2/04-review-27.md) APPROVED·Chief확인대기.두목록26 Chief통과,face-redesign2/5013유지.

2026-10-14 최신: face-redesign2 두목록추가밀도 [감리26](20261013-face-redesign2/04-review-26.md) APPROVED·Chief확인대기.5013유지.

2026-10-14 최신창: 내경로/퍼블릭줄간격·행밀도 [감리25](20261013-face-redesign2/04-review-25.md) APPROVED·Chief확인대기. face-redesign2/5013유지.

2026-10-14 최신창: 내경로22 Chief통과,퍼블릭23/24 [감리24](20261013-face-redesign2/04-review-24.md) APPROVED·Chief확인대기. face-redesign2/5013유지.

2026-10-14 최신창: 계정20 Chief통과,내경로21/22 [감리22](20261013-face-redesign2/04-review-22.md) APPROVED·Chief확인대기。face-redesign2/5013유지。

2026-10-14 최신창: face-redesign2 계정compact2컬럼 [감리20](20261013-face-redesign2/04-review-20.md) APPROVED·Chief확인대기. 5013유지,계정19단열대체.

2026-10-14 최신창: 메뉴18 Chief승인, 계정19 [감리19](20261013-face-redesign2/04-review-19.md) APPROVED·Chief확인대기. face-redesign2/5013 유지, 다음창피드백후.

2026-10-14 메뉴 한 창 완료: face-redesign2 [감리18](20261013-face-redesign2/04-review-18.md) APPROVED, Chief 확인 대기. Muse 구현·Supervisor 독립 검수, 5013 실행 중. 다음 창은 피드백 후.

2026-10-14: face-redesign2 [UI 균형 수정안17](20261013-face-redesign2/17-proposal-ui-balance.md) 추가. Chief 검토 후보, 구현 전. 기존 묶음에 이어 기록한다.

| 항목 | 내용 |
|------|------|
| 문서 유형 | **메타** — `ops/` 묶음 색인. 폴더마다 한 줄 |
| 독자 | **chief** · AI |
| 최초 작성 | 2026-09-28 |
| 상태 | **SoT** — 묶음을 열거나 닫을 때 이 표를 함께 고친다 |
| 연결 문서 | [현황판](../260928-RTW-현황판.md) · [문서 지침 §8.4](../260509-BOXCYCLE-문서-생성-및-수정-지침.md) |

> `ops/` 는 Supervisor(Codex) ↔ Developer(Cursor AI·CLI 기본)의 공식 파일 기반 업무 창구다. OpenCode는 Chief가 명시 요청할 때만 GLM-5.3으로 사용하며 불가 시 Cursor로 돌아온다. 기존 릴레이 기록도 보존한다.
> chief 는 [전체 상태판](PROGRESS.md)과 아래 묶음 표로 현재 상황을 확인한다. 폴더 안의 지시서·보고서는 에이전트용이다.

## 역할과 handoff

1. **Chief**: 요구와 제품 방향을 전달하고 중요한 결정·최종 완료를 승인한다. AI 사이의 파일을 복사해 전달하지 않는다.
2. **Supervisor (Codex)**: 요구를 분석해 범위, 완료 조건, 검증 방법, 승인 필요 여부를 지시에 적고 상태를 `READY_FOR_DEVELOPMENT`로 둔다.
3. **Developer (기본 Cursor AI·CLI / 명시 요청 시에만 OpenCode GLM-5.3)**: 지정된 지시 파일을 읽고 그 범위만 수행한다. 실제 변경 파일, 실행한 검증과 결과, 실패·미완·범위 밖 발견을 별도 결과 파일에 적는다. 승인 대상이 발견되면 구현을 멈추고 `BLOCKED`로 보고한다.
4. **Supervisor**: 결과 문서뿐 아니라 Git diff와 검증 근거를 확인한다. 합격이면 `APPROVED`, 부족하면 이유와 완료 조건을 별도 재지시 파일에 기록해 `REWORK_REQUIRED`로 둔다. 완료 보고는 Chief에게 직접 한다.

이 역할은 **새 작업의 기본값**이다. 기존 Claude 묶음의 파일명·도메인 규율·증거는 해당 기록을 읽을 때 그대로 유효하다. 종료된 묶음에 남은 자동 대기 명령은 재가동을 뜻하지 않는다.

## 새 작업 묶음

`YYYYMMDD-주제/`를 만들고 `README.md`에 목적, 현재 상태, 최신 지시·결과·검수 링크와 다음 행동을 적는다. 규모에 맞춰 `00-brief.md`, `01-plan.md`, `02-task-01.md`, `03-result-01.md`, `04-review-01.md` 등을 **필요한 만큼만** 만든다. 기존 묶음의 이름은 바꾸지 않는다. 작업 지시는 담당자, 허용·금지 범위, 완료 조건, 검증 명령, 보고 경로, Chief 승인 조건을 명시한다. 지시와 결과와 검수는 서로 다른 파일로 남기고, 재작업은 다음 번호의 파일로 이어 이전 기록을 덮어쓰지 않는다. 일반 작업은 묶음의 최종 결과만 남긴다. 별도 완료 보고서가 필요한 작업은 [문서 지침 §8](../260509-BOXCYCLE-문서-생성-및-수정-지침.md)에 따라 `document/archive/reports/`에 한 편 작성한다. 작업 지시에 [02-rules §8](20261017-dev-byproducts/02-rules.md) 문장을 넣는다.

## 상태와 승인

`PLANNING` → `READY_FOR_DEVELOPMENT` → `IN_PROGRESS` → `DEVELOPMENT_DONE` → `UNDER_REVIEW` → `APPROVED` → `CLOSED`가 보통 흐름이다. 결정 대기는 `AWAITING_CHIEF`, 재작업은 `REWORK_REQUIRED`, 진행 불가는 `BLOCKED`를 쓴다. 모든 단계를 기계적으로 거칠 필요는 없다. [PROGRESS.md](PROGRESS.md)는 현재 작업·담당·단계·Chief 승인 여부·마지막 검수·막힘·다음 일을 보여주는 상태판이며, 상세 이력은 작업 폴더에 둔다.

Supervisor는 아키텍처, 도메인 경계, 데이터 모델, Firestore·RTDB·Firebase Rules, 외부 API, 의미 있는 비용, Public Trail 동기화 구조, 기존 공용 인터페이스, 대규모 이동, 기존 기능 의미, 요구 해석 또는 작업 범위의 큰 변경을 **구현 전에** Chief에게 올린다. 일반 작업의 사소한 판단은 Supervisor가 처리한다.

## 실행·Git

2026-10-17 Chief 변경: 기본 실행은 Cursor이다. 아래 과거 Muse·교대 표현보다 이 지시가 우선하며, 새 지시당 기본 Cursor 실행 한 번을 사용한다. OpenCode는 명시 요청 시에만 GLM-5.3으로 사용한다.

새 지시 한 건마다 기본 Cursor 실행 한 번으로 제한한다. 모델·교대·모바일 검수는 [협업·감리 계약](../reference/operations/261009-RTW-개발에이전트-협업-감리.md)을 따른다. `agent -p --workspace C:\20.HDev\boxcycle "document/ops/<묶음>/<지시파일>을 읽고 지시된 범위만 수행한 뒤 결과 파일을 작성하라"` 형태로 실행하고 종료 코드와 출력을 확인한다. 실제 옵션은 로컬 `agent --help`에서 확인한다. 무한 대기 릴레이는 기본 실행 방식이 아니다. Git 브랜치·커밋·푸시는 [개발 워크플로](../reference/operations/260719-개발-워크플로-브랜치-커밋-게이트.md)와 해당 작업 지시의 제한을 따른다. 다른 작업의 변경은 섞지 않는다.

## 규칙 (요약)

1. 새 묶음은 `YYYYMMDD-주제/` 로 열고 폴더 `README.md` 에 「지금 할 일」을 둔다. 이 표에 한 줄 추가.
2. 종료가 확정되면 현재 표와 PROGRESS에서 빼고 [종료 색인](../archive/README.md)에 결과와 위치를 남긴다. APPROVED는 CLOSED와 다르다. 종료 시 [02-rules §6](20261017-dev-byproducts/02-rules.md) 정리.
3. 종료된 폴더는 **코드·스킬·명령이 그 경로를 가리키지 않을 때만** `archive/ops/` 로 옮긴다. 가리키면 제자리에 둔다.

## 진행·대기 묶음 (2026-10-09)

| 폴더 | 상태 | 무엇 | 결과·입구 | 이동 |
|---|---|---|---|---|
| [20261018-intro-blend](20261018-intro-blend/README.md) | **IN_PROGRESS** · 후속03 LongCat | 좌상단브랜드·곡선로고·인증후컨트롤 | [지시03](20261018-intro-blend/02-task-03.md) | 기존감리02보존·배포없음 |
| [20261018-lint16](20261018-lint16/README.md) | **APPROVED** · Codex 감리 통과 | 시험4파일 lint16→0·17시험PASS·기존72파일 보존 | [감리01](20261018-lint16/04-review-01.md) | 커밋·push·배포 없음 |
| [20261018-spinatlas-brand](20261018-spinatlas-brand/README.md) | **APPROVED** · Chief 화면 확인 대기 | Spinatlas 표시·A안 인트로, LongCat 구현·Codex 감리 | [최종감리02](20261018-spinatlas-brand/04-review-02.md) | 로컬5000·배포 없음 |
| [20261013-face-redesign2](20261013-face-redesign2/README.md) | **APPROVED** · 로컬main2 통합 | 디자인수정 완료·병합83079c3·quick1066 PASS | [검수65](20261013-face-redesign2/04-review-65.md) | 실기기/실인증/실주행 검증 별도 |
| [20261009-mobile-design-collaboration](20261009-mobile-design-collaboration/README.md) | **AWAITING_CHIEF** · 확장 05 · 준비·센서 패널 | 스마트폰 우선 디자인·Muse / Cursor 협업 체계, 코드 작성 금지 | [디자인 초안](20261009-mobile-design-collaboration/17-design-preparation-sensor.md) · [인계 검수](20261009-mobile-design-collaboration/04-review-01.md) | — |
| [20261008-pacer-riders](20261008-pacer-riders/README.md) | **APPROVED** · main2 병합·배포 | 혼자 주행 시 로컬 페이서 2명(±20m 추월, 기본 켜짐) | [계획](20261008-pacer-riders/01-plan.md) · [검수 01](20261008-pacer-riders/04-review-01.md) | — |
| [20261007-lint-baseline-react-hooks](20261007-lint-baseline-react-hooks/README.md) | **APPROVED** · 커밋 완료 | 기존 lint 오류 15파일 36건 제거(의미 보존) | [검수 01](20261007-lint-baseline-react-hooks/04-review-01.md) | — |
| [20261006-account-deletion](20261006-account-deletion/README.md) | **APPROVED** · 배포 대기 | 계정 탈퇴 기능 | [계획](20261006-account-deletion/01-plan.md) · [검수 15](20261006-account-deletion/04-review-15.md) | — |
| [20261006-rider-missing](20261006-rider-missing/README.md) | **CLOSED** · 서버 중지 탓(Chief 확인) | 주행 중 3D 라이더 사라짐 | [기록](20261006-rider-missing/README.md) | — |
| [20261006-resume-finish-discard](20261006-resume-finish-discard/README.md) | **APPROVED** · 커밋 완료 | 이어 달리기 마지막 구간 완주가 짧은 주행 폐기에 막힘 | [검수 13](20261006-resume-finish-discard/04-review-13.md) | — |
| [20261006-bottom-right-stack](20261006-bottom-right-stack/README.md) | **APPROVED** · 커밋 완료 | 우하단 시계·다음 주행 카드·고도/축척 고정 | [검수 12-2](20261006-bottom-right-stack/04-review-12b.md) | — |
| [20261006-camera1-presets](20261006-camera1-presets/README.md) | **DEVELOPMENT_DONE** · Cursor · 검수 대기 | 카메라 1번 경로전체/500m/20m · 위성 기본 | [지시 11](20261006-camera1-presets/02-task-11.md) · [결과 11](20261006-camera1-presets/03-result-11.md) | — |
| [20261006-ride-end-north-up](20261006-ride-end-north-up/README.md) | **APPROVED** · 커밋 완료 | 주행 종료 시 지도 정북 복귀 | [검수 10](20261006-ride-end-north-up/04-review-10.md) | — |
| [20261006-ride-summary-layout](20261006-ride-summary-layout/README.md) | **APPROVED** · 커밋 완료 | 주행 결과 히어로 정리·✕ 닫기 | [검수 09-2](20261006-ride-summary-layout/04-review-09b.md) | — |
| [20261006-lint-baseline-saved-routes](20261006-lint-baseline-saved-routes/README.md) | **APPROVED** · 커밋 완료 | pre-commit 막는 기존 lint 오류 제거 | [검수 08](20261006-lint-baseline-saved-routes/04-review-08.md) | — |
| [20261006-minimap-dock-overlap](20261006-minimap-dock-overlap/README.md) | **APPROVED** · 커밋 완료 | PC 에서 미니맵·RouteDock 겹침 | [검수 07](20261006-minimap-dock-overlap/04-review-07.md) | — |
| [20261006-hud-clock-map-controls](20261006-hud-clock-map-controls/README.md) | **DEVELOPMENT_DONE** · Cursor · 검수 대기 | 시계 HUD 우하단·맵 상시 + Mapbox 제자리·카드 비킴(06-4) | [지시 06-4](20261006-hud-clock-map-controls/02-task-06d.md) · [결과 06d](20261006-hud-clock-map-controls/03-result-06d.md) | — |
| [20261006-saved-route-integrity](20261006-saved-route-integrity/README.md) | **APPROVED** · 커밋 완료, functions 배포 대기(Chief) | 퍼블릭 신청 지문 오거절·「내 경로로 저장」 미완주 기록·이어달리기 대상 교체 | [지시 03](20261006-saved-route-integrity/02-task-03.md) · [지시 04](20261006-saved-route-integrity/02-task-04.md) | — |
| [20261006-route-modal-public-badge](20261006-route-modal-public-badge/README.md) | **APPROVED** · 미커밋 | 경로 선택 창 — Public 배지·등록자 우측·공개 시 창 전환 | [검수 01](20261006-route-modal-public-badge/04-review-01.md) · [검수 02](20261006-route-modal-public-badge/04-review-02.md) | — |
| [20261006-calories-resume](20261006-calories-resume/README.md) | **APPROVED** · origin/main2 반영 완료 | 칼로리 계산 변경·단일 재개 대상 유지 | [18 검수](20261006-calories-resume/18-review-supervisor.md) · [24 push 완료](20261006-calories-resume/24-result-remote-push.md) | 사용 확인·종료 대기 |
| [20261006-saved-route-readability](20261006-saved-route-readability/README.md) | **APPROVED** · origin/main2 반영 완료 | Edge 내 경로 글자 가독성 | [03 검수](20261006-saved-route-readability/03-review.md) | 사용 확인·종료 대기 |
| [20261005-ride-map-controls](20261005-ride-map-controls/README.md) | **APPROVED** · origin/main2 반영 완료 | 카메라 아래 맵 제어·축척 왼쪽 고도 | [09 고도 검수](20261005-ride-map-controls/09-review-camera-altitude.md) | Chief 사용 확인·종료 대기 |
| [20261005-product-value-name-calories](20261005-product-value-name-calories/README.md) | **AWAITING_CHIEF** · 조사 문서 local 커밋 | 제품 동기·새 이름·칼로리 근거 조사와 제안 | [02 조사·제안](20261005-product-value-name-calories/02-result-and-proposal.md) | 제품 변경 미실시 |
| [20261005-document-system](20261005-document-system/README.md) | **APPROVED** · origin/main2 반영 완료 | 문서 체계 정리·상태보드 입구 유지 | [03 검수](20261005-document-system/03-review-document-system.md) | Chief 종료 승인 전 |
| [20261003-focus-read-spike](20261003-focus-read-spike/README.md) | **APPROVED** — main2 FF 완료(로컬) | 앱 foreground 복귀만으로 발생하는 Firestore read spike 조사·저감 | [21 최종 승인](20261003-focus-read-spike/21-review-final-approval.md) · [23 통합 결과](20261003-focus-read-spike/23-result-merge-main2.md) | — |
| [20261002-public-trail-traffic-followup](20261002-public-trail-traffic-followup/README.md) | **AWAITING_CHIEF** — 측정 도구 검수 완료, 운영 데이터 Ø | Public Trail 트래픽 후속 — phase-aligned 측정 준비 | [08 재작업](20261002-public-trail-traffic-followup/08-result-phase-aligned-measurement-rework.md) · [09 검수 PASS](20261002-public-trail-traffic-followup/09-review-phase-aligned-measurement-rework.md) | — |
| [sync-relay](sync-relay/INSTRUCTION.md) | **대기** | 동행 위치 동기화. 활성 지시 없음, S4-4(동행 튐) 재개 보류 | 후속 계획: [동행 지연과 경쟁 판정](20260927-peer-competition/260927-RTW-동행-지연과-경쟁-판정.md) | 불가 — `apps/web/scripts/peer-sync`·e2e·`/싱크지시` 가 경로 사용 |
| [20260923-minimap](20260923-minimap/HANDOFF.md) | **대기** | 미니맵·HUD 재배치. 지시04까지 병합 후 중단 | 보류01(배경에 실제 지도) 완료 2026-10-07. 남은 일: 보류02 | 가능(종료 시) |
| [20260927-peer-competition](20260927-peer-competition/README.md) | **대기** · PLANNING | 경쟁 판정 분리·느낌 보정의 기존 미착수 계획 | [계획](20260927-peer-competition/260927-RTW-동행-지연과-경쟁-판정.md) | 재개 시 새 지시 |

종료 작업과 옛 relay 이력은 [완료 기록 색인](../archive/README.md)에 있다. 코드·시험·스킬이 경로를 사용하는 종료 묶음은 제자리에 보존하지만 현재 작업으로 표시하지 않는다.


