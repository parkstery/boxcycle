# 결과08 — Mapbox 지구본·나침반 제거

2026-10-21. Cursor CLI Composer2.5 session `af6dd3b5-9d0f-4d7b-b389-381f76d2074d`, 시작 main2/4d6725b4. 지시08 범위 구현 후 tsc·Node시험 실행 확인. eslint 셸의 최종 결과/최종 보고를 제출하지 않은 상태에서 Supervisor가 CLI를 중단했다(exec45347 exit1). 개발자 최종 제출로 취급하지 않고 Supervisor가 단일 writer로 검수·결과 기록을 이어받았다.

- MapView의 MapZoomGlobeControl/NavigationControl 등록 및 import 제거. 단순 CSS 숨김이 아니라 해당 버튼 DOM/Tab 타깃이 생성되지 않는다.
- 더 이상 참조되지 않는 MapZoomGlobeControl.ts(50줄)와 두 버튼 전용 CSS 제거. Git에 이전 버전 보존. 공용 하단 컨트롤·mapGlobeView 유틸·HUD/맵뷰·지도제스처는 유지.
- 회귀시험 scripts/map/map-control-visibility.test.ts 2개 추가, ui-edge-live.spec.ts에 우상단 버튼0 assert 추가.

Supervisor 독립 검증(실행 위치 C:\20.HDev\boxcycle):

1. `node --experimental-strip-types --test scripts/map/map-control-visibility.test.ts` (cwd apps/web): 2/2 PASS, exit0.
2. `node node_modules/eslint/bin/eslint.js apps/web/src/components/map/MapView.tsx apps/web/e2e/ui-edge-live.spec.ts apps/web/scripts/map/map-control-visibility.test.ts`: exit0, 오류0/기존 MapView 경고8. Cursor npx eslint 결과는 미확정이므로 이 독립 실행으로 대체.
3. `npm run build`: exit0(tsc 포함). 기존 SADDLE/PELVIS export·큰 청크 경고 유지.
4. Playwright 실제 App/Mapbox, http://127.0.0.1:5022: 800×360/667×300/844×390 모두 지도존재=true, globe/compass/top-right button=0, logo/attribution/scale/altitude 각각1. 운영 인증/주행 쓰기는 하지 않음. 첫 map.loaded() 대기는 지속 렌더링 상태로 timeout; 실제 지도 객체/컨트롤 DOM 검사로 전환해 PASS. 인트로 상태에서 검사했으며 인증 후 주행 e2e 재실행·실기기 검증은 하지 않음.
5. `git diff --check` PASS. 실지도 e2e의 새 assert는 추가만 했으며 이번에는 미실행. 전체 pre-push/배포 결과는 감리08에 후속 기록.

이전 다른 작업의 ops 변경/evidence/cdbox.bat는 보존. Mapbox 로고·저작권 표시, 하단 축척·고도는 제거 대상 아님.
