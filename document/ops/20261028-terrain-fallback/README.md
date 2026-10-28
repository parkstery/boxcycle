# 주행 지형 자동 완화 및 종료 2D — 2026-10-28

> 최신 Chief 지시 반영: 종료 후 「이어 가기」 지도는 중심 유지·고도1,000m로 축소한다. 아래의 과거 「줌 유지」는 [후속 구현·검증](02-result-end-overview.md)으로 대체한다. 단위/effect11·실제Mapbox WebGL1(폰가로/PC 고도확인)·빌드/의존검사PASS, 미배포.

Chief 구현 지시: 3D 불량 구간은 2D 주행, 정상 구간은 3D 자동복귀. 주행 종료는 지도 탐색을 위해2D로 복귀.

범위: 클라이언트 표시·감시만. 서버/DB/Rules/주행 물리/원본 geometry/저장/동기화 불변. 기존 dirty 보존. RGB→DEM 소스교체는 별개이므로 이번 변경에서 제외.

설계: 사용자 enable3D와 자동fallback 분리. 자동평면시terrain exaggeration0,건물제거,기존2D추적뷰 유지. DEM캐시/로딩 유지해 exaggerated:false로 회복관측. null/비유한값을 결측처리,0/음수는유효. 라이더·지도중심·카메라/시선 지점의 DEM과 카메라고도로 높이충돌을 감시, 연속이상·안정회복 지연으로플리커방지. 4Hz 제한. 렌더루프 불변. 스타일reload·수동off·종료·cleanup 검증. 종료시enable3D=false 및 terrain제거,건물제거,pitch0·기존정북/중심줌유지.

금지: Chief 고정1~35 기존조작/배치 유지,고정34 표시고도/경사 유지. 새 자동평면과 종료2D만명시지시로 추가. 별도숨긴지도/DEM직접다운로드/주기서버요청 없음. 수치상정상인데GPU그림만실패하는모든경우를검출한다고주장하지않는다.

검증 예정: 정책·Mapbox관측/적용adapter fake-map실행시험,종료전이/초기진입회귀,지도quick·카메라·빌드/lint·의존방향. 실제폰재현 별도.

## 최종 구현

- `components/map/rideTerrainGuard.ts`: 250ms 간격, 캐시 DEM 최대5조회/회(20회/초). 라이더/지도중심/카메라·시선 중간2점. 0/음수는 유효, null·NaN·예외는 미로딩. 카메라/시선이 표시지형보다0.3m 미만으로 높으면 충돌 판정. 평면 중에는 현재 카메라 고도에 중심점의1.3배 고도를 더해 복귀 후보를 평가.
- 3D 요청 초기에는 평면으로 데이터 준비 확인. 연속 이상750ms이면 자동평면. 연속 정상2.5초·평면 최소4초 후3D복귀. 모드변경 후1초 안정화, 백그라운드/시간점프는 연속판정을 다시 시작.
- 자동평면은 숫자 exaggeration0 +건물제거, 기존 수동2D처럼 낮은 추적뷰는 유지. `exaggerated:false`로 실제DEM관측 가능. 사용자토글은 켜진 채 「자동 2D」로 표시. 수동OFF·종료는terrain null +건물제거. 사용자OFF뒤타이머가3D를되살리지않음. 일시정지는 주행으로 유지.
- 종료시App의enable3D/fallback 초기화. MapView의기존정북/pitch0 ease에terrain/건물제거를결합. 종료때중심/줌유지. 기존센서/주행기록/정복/라이더접지와경사/카메라preset수치변경없음.
- style.load때현재fallback 적용, unmount·OFF·종료타이머정리. UI콜백은전환시에만. 별도지도/직접DEM API/서버·DB변경없음. 자동평면중에도DEM로딩·terrain렌더러는유지되므로수동OFF와동일한비용이라고주장하지않음. FPS/실폰비용미실측.

## 실행·검증 결과

실행 폴더 `C:\20.HDev\boxcycle`:

```powershell
npm run build -w boxcycle-web
npm run check:dep
npm run test:quick -w boxcycle-web -- map
npm run test:ride-camera-framing -w boxcycle-web
```

타입/Vite빌드exit0(기존큰청크경고). 의존방향위반0/순환0/깨진경로0. 지도quick169PASS/0FAIL(신규정책10·실제effect3포함). 카메라102PASS/0FAIL. 대상diff검사출력없음/exit0.

실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/map/ride-terrain-guard.test.ts scripts/map/ride-terrain-lifecycle.test.mjs scripts/ride-end-north-up/north-up-on-end-contract.test.ts scripts/map/entry-location-camera.test.mjs
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/rider-preserve/rider-terrain-slope.test.ts
node scripts/e2e/run-with-deadline.mjs --limit-sec 90 -- npx playwright test ride-terrain-guard --grep "real Mapbox" --workers=1 --retries=0
node scripts/e2e/run-with-deadline.mjs --limit-sec 60 -- npx playwright test ride-terrain-guard --grep "automatic 2D label" --workers=1 --retries=0
npx playwright test map-menu-consolidation --workers=1 --retries=0
```

- 정책/기존진입/종료27PASS、실제MapView/App effect추가3PASS(합계30). 라이더경사9PASS.
- 실제Mapbox GL JS(WebGL) 단독1PASS/24초. 100m고도합성PNG타일·외부요청차단·가짜토큰/인증응답. 실제`terrain0`에서raw100m/표시0m조회,3D에서표시130m조회,결측주입후0·회복후130,수동OFF비복귀,건물제거·종료pitch/bearing0·중심/줌유지검증. 미로딩은query에null을주입하며실제불량GPU/현장타일재현은아님.
- 「자동 2D」·선택유지·수동OFF UI 단독1PASS/2.6초. 기존메뉴가로3종회귀3PASS/9.7초.
- eslint제품6파일 오류0/기존경고17. 새guard파일오류/경고0.

중간 실패·제한:

1. 단위시험명령을루트에서한번실행해상대경로를못찾음→apps/web에서27PASS.
2. 첫WebGL시험은빈토큰으로Mapbox인증오류·대기. 해당실행프로세스만ID/시작시각확인후종료. 공개서비스접속없는가짜토큰+mock인증으로변경후단독1PASS.
3. WebGL+일반UI5개연속묶음은마지막단계까지진행했으나100초deadline초과. watchdog killTree에OS접근거부기록,해당묶음은실패/중단으로보존(`apps/web/test-results/e2e-deadline-timeout.json`). 동일기능은위단독실행으로모두PASS. 남은이번실행의node4개는시작시각00:36:46~49·PID확인후정리,기존5031유지.
4. 메뉴회귀첫재실행은이전기본경로에계정/카메라검수PNG4장을재생성했다. 이후시험은`MAP_MENU_EVIDENCE_DIR`를명시할때만저장하도록수정,기존제품/보호증거경로변경없음.
5. 전체quick/실센서/실Firebase새주행/Chief실폰·실제오사카문제구간재현은미실행. 수치상DEM정상이나GPU그림만깨지는모든상황의검출은보장하지않음. 최종상태LOCAL_VERIFIED(관련단위·adapter·합성지형WebGL),실제문제구간확인필요. 커밋/푸시/배포없음.

## Chief 확인 순서

기존 `http://127.0.0.1:5031/` HTTP200확인. 해당서버설정/프로세스변경없음. 새로고침후주행→카메라2~6→3D켬→최초약4초「자동2D」이후정상구간3D→문제구간전환/복귀→수동3DOFF비복귀→일시정지/종료→지형·건물OFF·정북·평면·경로탐색확인.

서버가꺼졌을때만:

```powershell
cd C:\20.HDev\boxcycle
npm run dev:localhost -- --port 5031
```

오프라인시험화면: `http://127.0.0.1:5031/scripts/terrain-guard/preview.html`는Playwright의합성타일/mock이있을때만사용한다(일반앱용아님).
