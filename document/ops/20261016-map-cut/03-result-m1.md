# 결과 M1 — 주행 중 지도 구성 비용 측정 스위치 (`?mapcut=`)

| 항목 | 내용 |
|---|---|
| 지시 | `document/ops/20261016-map-cut/02-task-m1.md` (Supervisor Claude, 2026-10-16) |
| 수행 | Developer (OpenCode Muse Spark), 작업 위치 `C:\20.HDev\boxcycle-mapcut`, 브랜치 `perf/map-cut-lab` |
| 상태 | 완료 (commit·push·배포 없음, dev 서버 종료 확인) |

## 1. 조사 — 주행 중 활성 스타일 레이어 census

헤드리스(`?perflab=1`, 줌 22·pitch 80·베어링 0 고정, idle 지도)에서 `__RTW_MAP__` 실측.
주행 상태(running)가 아니라 idle 근사이며, 이유는 §4에 적었다.

| 종류 | 개수 | 비고 |
|---|---|---|
| background | 1 | |
| raster | 1 | 위성·지형 타일이 아닌 베이스 1장 |
| line | 73 | 도로·경계·수계 등 (앱 레이어 제외, 아래 참조) |
| symbol | 20 | 전부 라벨·POI·실드 |
| circle | 3 | |
| fill-extrusion | 0 | idle(enable3D off)에는 없음. 주행 중 3D 켜지면 `boxcycle-3d-buildings` + 스타일 `building` 추가 |
| sky | 0 | sky 타입 레이어 없음 |
| hillshade | 0 | |
| 합계 | 98 | |

- 지형: idle 부팅은 `enable3D=false` → `setTerrain(null)` 상태라 `getTerrain()` = off.
  주행 중 3D가 켜지면 `boxcycle-dem` 소스 + `exaggeration: 1.3` (`rideCameraFollow.ts` `apply3DState`).
- 안개: `getFog()` = on (idle). `sky` 키 적용 뒤 off 확인.
- 미니맵: 별도 `mapboxgl.Map` **아님**. `RouteMinimap` = 정지 지도 이미지 1장(`routeMinimapStaticImageUrl`, 경로·상자 동일 시 재요청 없음) + SVG 경로·현재 위치·펄스. 매 프레임 지도가 두 번 그려지지 않는다.
  페이지 내 `canvas.mapboxgl-canvas` = 1개. idle에서는 미니맵 DOM 자체가 없다(`active`가 riding/paused일 때만 렌더).
- 미니맵 렌더 빈도: React 렌더는 `liveLngLat`·상자 변경 시, 펄스·깃발은 CSS 애니메이션(합성). 별도 Map이 없으므로 perflab `breakdown`에 `minimap` 항목을 추가하지 않았다(지시 조건 "별도 Map이면" 불충족).
- 주행 중 추가되는 앱 소스·레이어(코드 확인, 전부 `boxcycle-`/`route`/`distance-`/`debug-`): `route`(경로선), `boxcycle-conquest-traces(-halo)`, `boxcycle-conquest-live(-glow)`, 라이더(`boxcycle-rider-preserved-layer` 또는 `boxcycle-rider-prototype-layer`), `distance-target-circle-*`·`distance-offered-line`, 관전·활동 오버레이. mapcut이 절대 숨기지 않는다(단위 시험으로 고정).

## 2. 스위치 `?mapcut=a,b,c`

- 파서·적용: `apps/web/src/lib/map/mapCut.ts` (신규, 도메인 `map`에 `dep-layers.json` 등록).
  쿼리 있을 때만 동작, 없으면 지도 호출 0건(단위 시험 "미적용 보장" 2건).
  알 수 없는 키 무시, 대소문자·공백 무시, 중복 제거.
- 키별 동작 (`setLayoutProperty(visibility, none)` + `setTerrain/setFog(null)`, 전부 try/catch):
  - `terrain` — `setTerrain(null)`.
  - `buildings` — `boxcycle-3d-buildings` + `fill-extrusion` 중 id에 `building` 포함(앱 접두 제외).
  - `labels` — `symbol` 전부(앱 레이어 제외). 실측 20개 전부 숨김 확인.
  - `poi` — `symbol` 중 `poi-label`·`airport-label`·`transit-label`. 실측 3개 숨김 확인.
  - `sky` — `sky` 타입 레이어 + `setFog(null)`(+ `setSky(null)` 시도). 실측 fog on→off 확인.
  - `minimap` — 지도 호출 없음. `RouteMinimap`이 `effectiveActive=false`로 null 반환(DOM·정지 지도 요청·ResizeObserver·펄스 없음).
  - `roads` — `line` 중 id에 `road` 포함(앱 레이어 제외). 실측 18개(`road-motorway-trunk`·`road-primary`·`road-minor`·케이싱 등) 숨김 확인. 경로·정복·라이더·관전 레이어 유지.
- 재적용: `MapView`에 `style.load` 재적용 effect + `style.load` 생성 핸들러·`enable3D` effect 직후 적용
  (`apply3DState`가 지형·건물을 되살린 뒤라 순서 고정). 쿼리 없으면 내부 early return.
- 기본 화면 변경 없음: 쿼리 없을 때 호출 0건을 단위 시험으로 고정했고, 헤드리스 `none` 대조로 동일 렌더를 확인.

## 3. perflab 반영

- 패널(`PerfLabPanel`) 헤드에 `mapcut 없음` 또는 `mapcut terrain,buildings,…` 한 줄 상시 표시.
  헤드리스에서 `none` → "mapcut 없음", `all` → 전 키 목록 표시 확인.
- 복사 JSON(`buildReport`)에 `mapcut` 배열 추가.

## 4. 헤드리스 비교 (dev 5070, 브라우저 1개, 종료 후 포트 down 확인)

조건: `?perflab=1` + 변형별, 줌 22·pitch 80(QC2 83.5 근방)·베어링 0, 2 s 안정화 후 10 s 강제 리페인트.
원시: `document/ops/20261016-map-cut/map-cut-headless.json`.
측정값은 앱 perflab이 아닌 페이지 내 계측(`_render` 외곽 래핑 평균 ≒ `map.exRiderMeanMs` 상당 —
idle이라 라이더 레이어 시간 ≈ 0, rAF 프레임 평균). 헤드리스 GPU가 실기기와 다르므로 JS 시간 위주로 해석.

| mapcut | 레이어 수 | 지도 JS 평균 (n) | 프레임 평균 (n) |
|---|---|---|---|
| 없음 | 98 | 3.68 ms (270) | 37.24 ms (269) |
| terrain | 98 | 3.52 ms (274) | 36.63 ms (273) |
| buildings | 98 | 3.54 ms (274) | 36.69 ms (273) |
| labels | 98 | 3.43 ms (269) | 37.37 ms (268) |
| poi | 98 | 3.52 ms (274) | 36.69 ms (273) |
| sky | 98 | 3.52 ms (273) | 36.76 ms (272) |
| minimap | 98 | 3.53 ms (273) | 36.76 ms (272) |
| roads | 98 | 3.53 ms (274) | 36.69 ms (273) |
| 전부 | 98 | 3.11 ms (277) | 36.23 ms (276) |

해석·한계 (정직 기록):

- 개별 키 델타는 헤드리스 오차 범위 안(±0.2 ms 내외)에 있다. "전부"만 −0.57 ms로 방향이 보인다.
  헤드리스는 CPU GL(SwiftShader)이라 절대값이 실기기와 다르다 — **실기기(?perflab=1 + ?mapcut=)에서 같은 표를 재측정해야 Chief 판단 근거가 된다.**
- `terrain`·`buildings`·`minimap`은 idle에서 효과를 볼 수 없다(부팅 시 지형 off·건물 레이어 없음·미니맵 DOM 없음).
  주행 중(3D on·미니맵 표시)에만 델타가 나온다. `sky`는 fog off까지만 확인(스카이 레이어 자체가 없음).
- 프레임 평균 ≈ 36–37 ms는 헤드리스 합성 병목이지 지도 JS가 아니다. 틱은 idle이라 미미하며,
  주행 중 틱·프레임은 실기기 측정 몫으로 남긴다.
- `boxcycle-routable-roads-overlay`는 `none` 포함 전 변형에서 이미 `visibility: none` — 앱 기존 동작이며 mapcut과 무관.

## 5. 검증

| 검사 (PowerShell `apps/web`, 전부 포그라운드) | 결과 |
|---|---|
| `npx tsc -b` | 통과 (수정 1회: `applyMapCutToMap(map: unknown)` — mapbox-gl 제네릭 시그니처 충돌 해소) |
| `npx eslint` 변경 5 파일 | 에러 0. `MapView.tsx` warning 8건은 변경부와 무관한 기존 항목 |
| 루트 `node scripts/check-dep-direction.mjs --check` | M0 FAIL — **기존 결함 입증**: 변경 전부 stash 후에도 동일 1건 FAIL (`route-token-onboarding-grant.test.mjs` → `functions/lib` 미존재). 요구 항목 "lib 파일 전원 도메인 지정"은 **PASS(미지정 0)** — 신규 `map/mapCut.ts` 등록 정상 |
| `npm run test:quick` | ride 757/0 · **map 91/0**(신규 15 포함) · peer 72/0 · meters 58/0 · tools 34/0. route 3 실패는 전부 `functions/lib` 부재(`harness-active` 모듈·`index.js`·`index.harness.js` ENOENT) + 1 건너뜀 — 지시 예상("부재 3건 외 0")과 일치, 변경부와 무관 |
| `npm run test:rider-preserve` | 44 + 6 전부 통과 |
| `npm run build` | 성공 (chunk 크기·SADDLE/PELVIS 경고는 기존) |
| 단위 시험 `scripts/map/map-cut-contract.test.ts` (신규 15) | 파싱(7 키·순서·무시·정규화·중복·빈값·캐시) + 쿼리 없을 때 호출 0 + 키별 숨김 7 + 분류 일치 — 15/15 통과 |

브라우저는 Playwright chromium 1개로 9 변형 순차 측정. dev 서버(5070)는 측정 후 종료했고
포트 응답 없음을 확인했다. commit·push·배포 없음. 작업 파일:

- 신규: `apps/web/src/lib/map/mapCut.ts`, `apps/web/scripts/map/map-cut-contract.test.ts`,
  `apps/web/scripts/map/map-cut-lab-headless.mjs`, 본 결과 + `map-cut-headless.json`
- 수정: `apps/web/dep-layers.json` (map 등록 1줄), `MapView.tsx` (적용 3곳),
  `PerfLabPanel.tsx` (상단 1줄 + JSON 배열), `RouteMinimap.tsx` (`minimap` 시 null)
