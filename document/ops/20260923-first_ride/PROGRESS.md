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
