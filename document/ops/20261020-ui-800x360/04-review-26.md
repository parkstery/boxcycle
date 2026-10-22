# 긴 터치1회 검수

2026-10-22 · record · LOCAL_VERIFIED / Chief 해결 확인. [결과26](03-result-26.md).

cwd `C:\20.HDev\boxcycle\apps\web`:

- `node --experimental-strip-types --test scripts/map/map-route-pick-gesture.test.ts`: exit0/14 PASS. timer→busy→native menu→cancel→즉시다음touch, menu→timer 전 확정, 중복0·이동/우클릭취소 검증.
- `$env:RTW_DEV_PORT='5002'; node scripts/e2e/run-with-deadline.mjs --limit-sec 90 -- node ../../node_modules/@playwright/test/cli.js test e2e/map-route-runtime.spec.ts e2e/distance-route-continuation.spec.ts --workers=1 --retries=0 --reporter=line`: exit0/4 PASS/26.7s. 신규 touch contextmenu/cancel 시험은 교정 전1 FAIL→교정 후PASS.
- `npx eslint src/components/map/mapRoutePickGesture.ts scripts/map/map-route-pick-gesture.test.ts e2e/map-route-runtime.spec.ts`: exit0/오류0.
- 최종 타입/build/전체 gate는27에서 통합검증.

증거 `.out/step26-repro.log`, `step26-browser.log`, `step26-gesture.log`, `step26-lint.log`. Chief: ‘이제 긴 탭 한번에 재탐색이 된다’ 확인·커밋/푸시 승인. 실제 엔진 CDP 이벤트 시험과 실제폰 성능 측정은 구분한다. 기존5002 보존. 배포 없음.
