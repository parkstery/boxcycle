# 가장자리 배치·Git 검수

2026-10-22 · record · LOCAL_VERIFIED / Git 진행. Chief 긴탭1회 해결확인·커밋/푸시승인. [결과27](03-result-27.md).

cwd `C:\20.HDev\boxcycle\apps\web`: `npm run test:distance-auto-route` exit0/145PASS, `npm run build` exit0/타입포함PASS/4.02s. 기존 번들/SADDLE/PELVIS 경고 유지.

`$env:RTW_DEV_PORT='5002'; node scripts/e2e/run-with-deadline.mjs --limit-sec 100 -- node ../../node_modules/@playwright/test/cli.js test e2e/map-route-runtime.spec.ts e2e/distance-route-continuation.spec.ts --workers=1 --retries=0 --reporter=line` exit0/4PASS/49.1s. 최초 가장자리≤9px·반복재탐색x변화≤1px 확인. 기존 긴터치/native menu/cancel·수단변경·삭제/새출발·옛응답 무효화 회귀 포함.

root `node scripts/check-dev-tools.mjs --check`: query 미등록1FAIL→등록 후PASS/WARN0. `git diff --check` exit0. 증거 `.out/step27-browser.log`, `step27-distance.log`, `step27-build.log`. 실제폰 새 배치·실지도외관 미검증. 기존5002 유지·배포 없음. 공용 ops README/PROGRESS에 이번 이전의 다른 변경이 섞여 있어 두파일은 커밋 제외하고 현상 보존한다. 이번 묶음 README와21~27 지시/결과/검수는 포함한다.

Chief 직접 확인:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

기존 서버가 있으면 재실행하지 않고 http://localhost:5002 새로고침 → 출발/거리확정 → 다른 방향 연속탐색·긴탭1회 요청 → 창이 좌우 가장자리를 유지하는지 확인. 드래그로 옮긴 뒤 재탐색 시 위치 유지 확인. Git 최종 결과는 후속 기록.
