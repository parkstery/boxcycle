# 주행 종료 후 고도 1,000m 탐색 지도 — 2026-10-28

Chief 직접 지시: 주행 종료 후 다음 주행 「이어 가기」 화면이 지나치게 확대되어 매번 축소해야 하므로 고도1,000m로 표시한다. 기존 고정36의 「줌 유지」는 이번 지시로 대체한다. 별도 Chief 결정 없이 명시 범위에서 구현.

구현: `rideEndNorthUp.ts`에서 Mapbox의 현재 cameraToCenterDistance와 중심 위도의 Mercator 1,000m 높이로 평면 지도 줌을 계산한다. 화면 높이·위도에 따라 같은 고도를 사용한다. MapView는 종료 시 지형·건물을 제거한 뒤 중심을 유지하며 정북/pitch0/해당 줌을 기존600ms ease(모션 감소 시0ms)에 함께 적용한다. 종료 hold 및 App/ref 줌 동기화도 이 값으로 유지한다. 초기 진입·일시정지·주행 카메라 프리셋·다음 주행 시작 계약은 보존한다. 서버/DB/Rules/동기화 변경 없음.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
cd C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/map/ride-terrain-lifecycle.test.mjs scripts/ride-end-north-up/north-up-on-end-contract.test.ts
$env:RTW_DEV_PORT='5031'
node scripts/e2e/run-with-deadline.mjs --limit-sec 70 -- npx playwright test ride-terrain-guard --grep 'real Mapbox' --workers=1 --retries=0
npx eslint src/lib/map/rideEndNorthUp.ts src/components/map/MapView.tsx
```

- 단위/실제MapView·App effect 11PASS/0FAIL. 종료 줌/ref 일치·축소·중심/정북/평면, 일시정지·시작 전이 보존.
- 기존 실제 Mapbox WebGL 회귀1PASS/39.8초(外부요청mock·합성DEM). 기본1280×720,699×273,1920×930에서 종료 고도1,000m(소수첫자리 허용오차)·중심 유지·정북/평면, 기존 자동2D/회복/수동OFF 계약 통과. `terrain-guard/preview.ts`는 이 검증용이며 실제 앱 effect는 별도 위11개에 포함.
- 대상 eslint 오류0/기존MapView 경고10.

실행 폴더 `C:\20.HDev\boxcycle`:

```powershell
cd C:\20.HDev\boxcycle
npm run build -w boxcycle-web
npm run check:dep
git diff --check -- apps/web/src/lib/map/rideEndNorthUp.ts apps/web/src/components/map/MapView.tsx apps/web/scripts/map/ride-terrain-lifecycle.test.mjs apps/web/scripts/terrain-guard/preview.ts apps/web/e2e/ride-terrain-guard.spec.ts
```

타입/Vite빌드PASS(기존큰청크경고), 의존방향 위반0/순환0, 대상diff검사PASS.

중간 실패: 최초Node 직접import는 Mapbox CommonJS named export 오류→default import로 교정 후 위11개PASS. `check:dep`를 apps/web에서 실행해 스크립트 없음→루트에서 재실행PASS. 최초 검색의 루트src·PowerShell glob 경로 오류는 apps/web 실제 경로로 교정. 실패를 시험통과로 계산하지 않음.

실폰·실Firebase계정 주행 종료 및 전체quick은 미실행. 관련 effect·실제Mapbox 검증으로 범위를 한정함. 기존 dirty 보존·커밋/푸시/배포 없음.

## Chief 확인

```powershell
cd C:\20.HDev\boxcycle
npm run dev:localhost -- --port 5031
```

기존 서버가 실행 중이면 재사용. `http://localhost:5031/` 새로고침→주행 시작→종료→다음 주행 「이어 가기」 안내에서 넓어진 지도·우하단 고도1.0km 확인→경로 설정. 운영 배포는 수행하지 않았다.
