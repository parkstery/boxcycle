# 진행 로그 — 개발팀장(커서)이 쓴다

> **Chief 가 이 파일을 상황판으로 본다.** 한 줄이 한 사건이다.
> 형식: `HH:MM | <무엇을 하고 있다 / 무엇이 끝났다 / 무엇에 막혔다>`
>
> 규칙
> - 라운드 **착수 시 1줄**, 눈에 보이는 진전마다 1줄, **막히면 즉시 1줄**(무엇이 왜 안 되는지)
> - 최소 **10분에 한 줄**. 20분 넘게 조용하면 Chief 는 멈춘 것으로 본다
> - 길게 쓰지 마라. 서술은 수행결과 문서에 쓴다. 여기는 **현재 위치**만
> - 지우지 말고 **아래에 덧붙여라**(append-only). 최신이 아래
> - `git commit` 은 여전히 금지다. 이 파일 갱신은 커밋 없이 그대로 둔다
> - ⚠ **UTF-8 로 써라.** 이 파일에 CP949(ANSI)로 덧붙이면 감리 워처·Chief 상황판에서 글자가 깨진다
>   (2026-09-23 23:4x 실제 발생 — 「—」가 `?` 로 손실됐다)

<!-- 아래부터 기록 -->
23:28 | 지시01 수신 — LocalFirstEntryCard 착수
23:32 | LocalFirstEntryCard + App 배선 완료, 카메라·localStorage·지명검색 intent
23:35 | 캡처 스크립트 작성 — Playwright live(5000) 실행 중
23:38 | 막힘 해소 — 게스트 게이트 대기 부족이 원인. 캡처 재실행
23:42 | 카드 폭 수정 — local-first-anchor 를 스택 static 리셋 + 지명 축약
23:45 | 카드 폭·지명 축약 수정 후 캡처 재완료 (zoom13 채택)
23:48 | 지시01수행결과 작성 — tsc/build/eslint PASS. await-next 복귀
23:50 | 지시02 수신 — 착수
00:05 | [감리] 지시02 정정 발행 — Chief 결정: 토큰 무제한. check-amend.mjs 로 즉시 확인하라
00:23 | 착수 — 정정 수신 확인(토큰 미구현). 지시01 산출물·distanceAutoRouteCore/index.ts 구조 파악 완료, 서버 loop 검색 함수 설계 착수
00:38 | 서버 확장 완료 — searchReadyLoopRoute(5방위×삼각폐합)·closeLoop 파라미터·알고리즘v4A-ready-loop. functions tsc/build PASS
00:55 | 클라이언트 배선 완료 — useReadyRide 훅·LocalFirstEntryCard Ready Ride UI·applyGeneratedRouteResult 공유. tsc(web+functions) PASS
01:20 | Ready Ride 서버 알고리즘 수치검증 완료(§6, functions/lib 직접 import + synthetic router 7곳). 캡처 스크립트 작성 — dev 서버 기동 준비
01:50 | 캡처 A/B/C/D/E/F/H 완료(경로 버그 수정: ROOT 상대경로 오프바이원). G(기존 방향클릭 회귀) 실 지도클릭 흐름 1차 실패 — 재시도
02:15 | G(기존 방향클릭) 캡처 성공 — 실 운영 백엔드로 1km 경로 생성, 토큰 9개 잔여 확인(회귀 없음). A~I 전량 확보
02:30 | 수행결과 문서 작성 완료 — 캡처 9종(A-I 중 I 미해결) + 수치표(8좌표) + 검증 PASS. 보고 대기
01:30 | 착수. 지시03 읽음. A 원인 확정(STEP1)부터 시작 — App.tsx/MapView.tsx 관련 지점 정독, dev 서버(5000) 기동 확인됨
02:15 | A STEP1: C1~C4 임시 로그(App.tsx applyLocalFirstRegion / MapView.tsx externalCameraJump 소비 효과, DEV 가드) 삽입 후 Playwright 재현 4종 시도 — (1)역지오코딩만 1.5s 지연 (2)getCurrentPosition 2.5s+역지오코딩 1.5s 지연 (3)+ 권한 프롬프트 중 document.visibilityState=hidden 흉내 (4)+ prefers-reduced-motion=reduce(duration=0 flyTo 경로). 4종 전부 C1→C2→C3→C4(moveend=target) 정상 완주 — 재현 실패
03:10 | A 논의 종료(재현 실패, 코드 미수정). B 구현 착수 — searchReadyLoopRoute 실패 시 searchDistanceAutoRoute 재사용 편도 폴백(closed:false), excludeStartBearingDeg로 「다른 경로」, LocalFirstEntryCard 3버튼 + ready-to-start 단계에서도 카드 유지(MapBottomLeftStack 재사용)
03:40 | B 캡처 F/G1/G2/H 전부 성공(오프-라인 인터셉트). A 회귀 캡처 C/D/E도 전부 정상. functions+apps/web tsc/build PASS, eslint error 증가 0. 수치 스크립트(numeric-matrix-b.mjs)로 편도 성공률·호출수·다른경로 검증 완료
06:58 | 세션 재개. C1~C4 DEV 가드 확인(제거 안 함, 위치 보고서에 명시). 수행결과 문서 작성 완료 — 20260923-지시03수행결과-카메라재현실패-편도폴백구현.md. tsc/build 재확인 PASS. 보고 대기
07:09 | [정정 수신] 감리 전제 정정 — 직선은 지시03 인터셉트 캡처였을 가능성. capture-b.mjs 검증 + 논현동 폐합 실패 진단으로 방향 전환
07:16 | V1~V3 불변식(validateRouteGeometryPlausibility) 구현 + node:test 4건 전부 통과. searchDistanceAutoRoute·searchReadyLoopRoute 양쪽에 게이트 배선(클릭 기반도 자동 적용)

07:18 | [핸드오프] 개발팀장=커서 재지정. 수퍼바이저 지시 대기(지시04 임의 착수 안 함)07:20 | UI 실캡처는 Playwright 카드 타이밍 이슈로 보류(시간budget). 대신 직접 API 실호출(Mapbox+실컴파일 core)로 D1~D6·논현동 20곳 진단 완료. 검증 단계로 이동

07:20 | [대기] 기존 개발팀장(클로드) 지시04 마무리 후 수퍼바이저 지시 수신 대기07:23 | 완료. 보고서 작성: 직선은 지시02/03 인터셉트 캡처였다(제품 결함 아님). V1~V3 불변식 구현+테스트4건PASS. 진짜 증상(도심 폐합 실패, 논현동10%·서울0%·수도권20곳5%)을 수치로 진단. tsc/build/test 전부 PASS. 상태=보고완료

07:41 | [자동착수] await-next --ignore-open-at-start 감시 시작 (NEXT 수신 시 즉시 착수)07:42 | 지시05 수신 — 착수

07:42 | 지시05 수신 — Ready Ride 기본=단순경로 착수 (자동착수)
07:46 | 지시05 구현 — searchReadyOnewayRoute + 클라 closeLoop 제거 + 사과문구 삭제. 실측 스크립트 착수
07:48 | 지시05 실측 PASS — 수도권20/20(100%)·논현10/10(100%). 에뮬레이터 캡처·검증 착수

07:49 | 지시05 캡처 — functions 에뮬레이터+Vite:5002 기동, 실 Mapbox 시크릿

07:57 | 지시05 보고완료 — 실측100%/100%·캡처A-D·tsc/test/build PASS. await-next 재무장
08:22 | [감리] 지시05 PASS — 실측 100%/100%(실 Mapbox 호출 확인) · 캡처 도로추적 확인 · 커밋 dc9c1d1 푸시. 다음 지시 준비 중
08:49 | 지시06 수신 — 착수
09:06 | [감리] 지시06 정정 3건 발행(B 한시허용 명시 · A-2 첫화면 줌19→13계열 · A-3 geolocation timeout 8s→연장·거부/타임아웃 구분). check-amend.mjs 로 즉시 확인하고, 진행 로그를 10분에 한 줄 남겨라

09:09 | 지시06 수신 — 착수 (대기 누락 사과, A현재위치기본·B체험속도 병행)

09:09 | 정정 수신 — B한시허용·A-2줌13계열·A-3 timeout연장/거부구분 전부 반영 착수

09:10 | 지시06 A버튼/줌13/geo30s·B ALLOW_MANUAL_SPEED_WHILE_RIDING 코드 반영. 캡처·수치 착수

09:18 | 지시06 보고완료 — A버튼/줌13/geo30s·B한시스위치·캡처A1-A3/B1-B3·수치·tsc/build PASS

09:19 | 대기 재무장 — AwaitShell 블록으로 NEXT 수신 시 사용자 催促 없이 즉시 착수

09:40 | 대기 중 — 지시06 보고완료·감리 판정/지시07 대기 (AwaitShell 블록)
09:5x | [감리] 지시06 감리 착수 — diff·캡처·수치 확인 중

09:57 | 대기 중 — 지시06 보고완료·감리 판정/지시07 대기 (AwaitShell 블록)

10:42 | 대기 중 — 지시06 보고완료·감리 판정/지시07 대기 (AwaitShell 블록)
10:43 | 지시07 수신 — 착수

10:44 | 지시07 수신 — 착수 (토큰무제한·게스트초기화·버튼위계)

10:47 | 지시07 A시드0·클라메터링·C카드주황제거·B게스트초기화 코드 반영. tsc/캡처 착수

10:52 | 지시07 보고완료 — A토큰0/복원증명·B게스트초기화·C카드주황제거·캡처A-C·tsc/build/test PASS
10:53 | [감리] 지시07 감리 착수 — diff·캡처·수치 확인 중
10:53 | [감리] 지시07 PASS — 캡처 8종·익명 전용 가드·주행 중 차단·복원 가능 확인. 커밋 진행
11:08 | 지시08 수신 — 착수

11:08 | 지시08 수신 — 착수 (Claim 연동 안 달린 길 우선)

11:10 | 지시08 STEP1 — D1~D5 확인 완료. D3=z12 청크 ID로 출발점±1.5D bbox만 get(전체스캔 불필요). 스코어 구현 착수

11:11 | 지시08 STEP2 — conquestClaimRead(z12 bbox) + searchReadyOnewayRoute Claim순위(W_new=0.12/W_ol=0.08) 반영. tsc/test·실측 착수
11:52 | [감리] PC 재부팅 후 상태 확인 — 지시08 작업분 디스크 보존됨(conquestClaimRead.ts 신규 + core/http/test 수정). functions tsc PASS · npm test 9/9 PASS. 남은 것: 실측(수도권20곳·Claim 전후 비교)·캡처 A~D·수행결과 문서. 커서 재개 시 await-next 가 지시08 을 그대로 물어다 준다

11:52 | 지시08 재개 — PC 재부팅 후. 코드/실측(claim전후3/3·수도권20/20) 유지. 에뮬레이터·캡처A-D 재착수

12:08 | 지시08 보고완료 — Claim순위(W_new=0.12)·실측100%/claim전후3/3·캡처A-D·claimRead~117ms·tsc/test/build PASS. await-next 재무장
12:08 | [감리] 지시08 감리 착수 — diff·캡처·수치 확인 중
12:09 | [감리] 지시08 PASS — Claim 전후 geometry 변경·신규도로 0→0.99·성공률 20/20 유지·지연 117ms·캡처 4종. 커밋 진행
12:36 | 지시09 수신 — 착수

12:36 | 지시09 수신 — 착수 (첫화면중심·관측지표·새도로강조)

12:39 | 지시09 A맵부트중심·C새도로위계 코드반영. B cliRideMetrics·캡처·실측 착수

12:42 | 지시09 보고완료 — A원주/강남부트·C새도로+위계·B ride-metrics(표본0)·캡처A1-A2/C1-C2·tsc/test/build PASS. await-next 재무장
12:42 | [감리] 지시09 감리 착수 — diff·캡처·수치 확인 중
12:43 | [감리] 지시09 PASS — A 중심 원주/강남 오차0 · C 위계 확인(라벨 겹침 의심 1건, 배포 후 실기 확인) · B 집계 CLI(표본 0). 커밋·병합·배포 진행
