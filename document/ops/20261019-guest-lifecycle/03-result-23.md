# 결과23 — 첫 Ready Ride 거리 탐색 복구

2026-10-19 / Codex 직접 보완. Cursor CLI에 Task23을 전달했으나 시작 단계 `uv_os_get_passwd returned ENOMEM` / exit1로 구현 미착수. 결과를 Cursor 수행으로 표시하지 않는다. 기존 dirty·타인 변경 보존, 커밋·푸시·배포 없음.

## 변경

- `scripts/guest-integration-supervisor.mjs`: 기존 demo 서버에 누락된 실제 `getDistanceAutoRoute`, `getMapboxDirections`, `assertTierQuotaHttp` handler 등록. index의 기본 Admin 초기화를 demo 프로젝트·demo RTDB로 고정하고 중복 initialize 제거. serve 모드에서 기존 공개 Mapbox 토큰을 서버 Directions에 공급, 토큰 출력 없음. 운영 함수·Rules는 변경하지 않았다.
- `apps/web/src/components/ride/LocalFirstEntryCard.tsx`: 모든 거리 칩 클릭이 즉시 해당 km 탐색 1회. 초기/실패/같은 거리도 재탐색, 생성중 disabled 유지.
- `apps/web/src/lib/account/repo/firestoreRouteToken.ts`: 최초 Auth metadata에 잔액 필드가 아직 없으면 null(미확인). 이를 0으로 바꾸어 온보딩 지급 전 탐색을 막던 경합 교정. 실제 0은 그대로 0, 서버 지급·차감·잔액 검증 유지.
- 신규 `apps/web/e2e/guest-demo-ready-ride.spec.ts` 및 `apps/web/scripts/ride-verify/guest-demo-ready-ride.config.ts`: 실행중 demo 서버 재사용, 프로젝트·에뮬레이터 플래그·localhost host 확인 후 실제 SDK/서버/Mapbox로4거리 시험.
- 신규 `scripts/ready-ride-onboarding-supervisor.test.mjs`: 실제 잔액 구독 callback을 SDK 경계에서 실행, 미확인/null·실잔액0·지급10을 구분.

## 시험·실패 기록

- 첫 브라우저 실행 4 FAIL: 2km는 온보딩 경합으로 요청 전 토큰부족 차단(120초 대기 실패), 3/5/10km는 실제 생성·Go 표시 검증 후 잘못된 스크린샷 상대경로로 ENOENT 실패. 실패를 통과로 처리하지 않았다. 제품 경합과 `testInfo.outputPath`를 수정한 뒤 재실행.
- 수정후 임시 설정 4 PASS(13.4초). 영구 설정·실행중 앱의 demo 플래그 검증 추가 후 최종4 PASS(16.8초). 네 거리 모두 HTTP200/found/LineString/좌표3개이상/양의거리/목표거리 일치/주행시작 표시/다른경로 표시/실패문구 없음. 800×360 가로, headless·worker1. 실제 Directions 사용, 고도·날씨만 공용 Open-Meteo fixture가 대체.
- `node --test scripts/ready-ride-onboarding-supervisor.test.mjs`: exit0 / 1 PASS. 실제0 차단 의미는 유지.
- `node --check scripts/guest-integration-supervisor.mjs`: exit0.
- `node scripts/ride-verify/verify-selectors.mjs` (apps/web): exit0 / 19 PASS.
- 변경 web4파일 eslint: exit0.
- 최종 `npm run build` (apps/web): exit0. 기존 riderRig SADDLE/PELVIS·큰 번들 경고 잔존.
- `git diff --check`: exit0. 기존 CRLF 경고 잔존.
- 별도 Mapbox 상태확인1건: HTTP200/Ok/route1. 자동 경로 API localhost5004 Origin preflight204.
- 전체 서버시험·전체lint·실기기BLE·실제Google팝업 미실행: 이번 수정은 demo 조립 및 web 거리 클릭/잔액 미확인 값 교정. 기존 감리20 기록 유지.

스크린샷은 `.out/guest-demo-ready-ride/`에 최종4장. 자동화 브라우저는 위성 타일 요청 실패 경고가 있어 배경지도 외관 검수는 미통과 범위로 남긴다. 실제 Mapbox 도로 geometry 응답·오렌지 경로·Go 버튼은 확인했다. 사용자가 제공한 실제 Chrome 지도 화면과 구분한다.
