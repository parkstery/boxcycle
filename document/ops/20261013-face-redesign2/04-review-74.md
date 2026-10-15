# 검수74 — 콜로세움 인트로 배경

2026-10-15 Supervisor Codex. Developer Cursor session 1ef05ff2-4fe7-47cf-9ef3-5a97560b1b5a, 실행 exit0. 원본 main2 HEAD1f5f14d. 지시74·결과74·실제 diff 확인. **APPROVED / Chief 화면 확인 대기**.

App.tsx +12줄과 신규 appIntroMapView.ts만 제품 변경. 소개 활성화 때 기존 지도 스타일을 Satellite, 카메라를 콜로세움 [12.4922,41.8902] 주변 zoom16으로 한 번 이동. 초기 viewport 폭에 따라 카메라를 서쪽으로 옮겨 콜로세움을 오른쪽 약76%에 배치. 렌더마다 점프하지 않으며 이후 기존 지도 조작 가능. 인증 선택에도 로마를 유지. 소개 대상이 아닌 로그인·명시 로그아웃·탈퇴 안내는 기존 지도 유지. 지도 인스턴스/API/저장/공용 props 추가 없음.

독립 검증:

- `node document/ops/20261013-face-redesign2/intro-74-qa.cjs` exit0. 실제 Vite 모듈의 계산값을 Mapbox MercatorCoordinate로 투영하여 초기 폭667/740/800/844/1366에서 랜드마크 x/width=.76 확인. 잘못된 폭0/-1/NaN/Infinity의 800px 폴백 확인. 실제 앱 소개의 위성 스타일, CTA→기존 인증 카드 후 위성 유지, 명시 로그아웃 후 기존 Outdoors 유지 PASS. 증거 intro-74-results.json.
- apps/web `node scripts/ride-verify/verify-selectors.mjs` exit0,17단계 PASS.
- apps/web `npm run build` exit0,423모듈. 기존 번들크기 및 riderRig SADDLE/PELVIS export 경고 유지.
- Developer `npx tsc --noEmit`, 변경2파일 eslint, selector17 exit0. ESLint 오류0/기존 App hooks 경고7.
- 제품 diff 확인 및 공백 검사 PASS.

실제 위성 타일의 콜로세움 외관은 샌드박스 네트워크 차단 때문에 미검증. 이전 자동 승인 검토의 외부 통신 거부를 우회하지 않았다. 이번 확인은 좌표/스타일/초기 프레이밍 계산과 로컬 앱 전환에 한정. 실기기·실주행·배포·푸시 없음. Chief는 새 시크릿 창 http://localhost:5014 에서 확인.
