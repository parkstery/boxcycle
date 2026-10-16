# 결과 P1 — 고밀도 화면 렌더 해상도 상한

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Developer (OpenCode Muse Spark) |
| 지시 | `document/ops/20261016-mobile-pixel-ratio/02-task-p1.md` (Supervisor Claude) |
| 작업 위치 | `C:\20.HDev\boxcycle-dpr` (브랜치 `perf/mobile-pixel-ratio`, 기준 `main2` `4109f2c`) |
| 결론 | **의도 구현 완료 — 단, 지시 문면 그대로는 불가** (아래 §1). 브라우저 실측으로 상한 적용 확인. |

## 1. 지시 문면과의 차이 (먼저 읽을 것)

지시는 `new mapboxgl.Map({ ... pixelRatio })` + `map.setPixelRatio` / `map.getPixelRatio()` 를
전제로 한다. 그러나 저장소가 쓰는 **mapbox-gl 3.23.1 에는 그 API 가 존재하지 않는다**:

- `node_modules/mapbox-gl/dist/mapbox-gl.d.ts` 의 `MapOptions` (18889행~) 에 `pixelRatio` 필드가 없다.
  `pixelRatio` 언급은 `addImage` 메타데이터·타일 내부 필드뿐이다.
- `Map` 에 `get/setPixelRatio` 가 없다 (d.ts·번들全文 검색 0건). 대신 내부 렌더 전체가
  전역 `window.devicePixelRatio` 를 직접 읽는다:
  `Map._resizeCanvas` (`canvas.width = dpr × CSS`), `painter.resize`,
  타일 `pixelRatio`, 셰이더 `u_device_pixel_ratio` 등 (번들 내 `devicePixelRatio` 34건, 전부 `e.o.devicePixelRatio` 경유).
- 따라서 `pixelRatio` 옵션을 주면 **타입 오류(tsc 실패) + 런타임 무시**가 된다. 문면대로 두지 않았다.

대신 **의미는 동일**한 방식으로 상한을 강제했다:
`installRiderMapPixelRatioCap()` 이 `window.devicePixelRatio` 의 JS 관측값을
`min(실측, 상한)` 으로 고정한다. Mapbox 의 resize 경로(`_onWindowResize` → `resize()`,
`orientationchange` 포함)도 같은 값을 다시 읽으므로 회전·리사이즈 뒤에도 상한이 유지된다.
DPR ≤ 2 기기는 `min` 으로 값이 그대로라 동작 변경이 없다. `?maxdpr=` 비교 측정·단위 시험·
perflab 적용값 표시는 지시대로 두었다.

## 2. 변경

- `apps/web/src/lib/map/rtwMapConfig.ts` (+111)
  - `RIDER_MAP_MAX_PIXEL_RATIO = 2` (map 도메인 기존 파일 — `dep-layers.json` 등록 불필요).
  - `parseRiderMapMaxPixelRatio(search)`: `?maxdpr=` 1–4 범위만 인정, 없거나 잘못되면 상수.
  - `resolveRiderMapPixelRatio(dpr, max)`: `min(실측, 상한)` 순수 함수.
  - `getRiderMapMaxPixelRatio()`: 쿼리를 페이지 수명 동안 한 번만 읽어 캐시.
  - `installRiderMapPixelRatioCap()`: `new Map` 보다 먼저 호출, JS 관측 DPR 고정. 적용 비율 반환.
  - `readRiderMapTrueDevicePixelRatio()` / `readRiderMapAppliedPixelRatio()` /
    `resetRiderMapPixelRatioCapForTests()` (시험 전용).
- `apps/web/src/components/map/MapView.tsx` (+14): `new mapboxgl.Map` 직전 설치 호출 +
  근거 주석. 기존 `window resize → map.resize()` 유지 + 상한 유지 근거 주석
  (`setPixelRatio` 는 해당 버전에 없어 별도 강제 호출 없음).
- `apps/web/src/lib/debug/perfLab.ts` (+43): `PerfLabDeviceInfo.mapPixelRatio` 추가.
  `map.getPixelRatio()` 가 없으므로 **지도 캔버스 실측값** (`canvas.width ÷ CSS 너비`) 을 기록한다.
  상한 설치 후 `window.devicePixelRatio` 는 상한값이 되므로, `devicePixelRatio` 항목은
  설치 때 스냅샷한 **실측값**을 우선 보고한다 (debug → map import, `mayImport: ["*"]` 허용).
- `apps/web/src/components/perfLab/PerfLabPanel.tsx`: 기기 줄에 `지도Nx` 한 항목 추가
  (예: `3x · 지도2x`). 복사 JSON(`device`)에도 `mapPixelRatio` 포함.
- `apps/web/scripts/map/rider-map-pixel-ratio-contract.test.ts` (신규, map 묶음):
  상수 2 / DPR 1→1·1.25→1.25·3→2 / 쿼리 4 + DPR 3 → 3 / 잘못된 쿼리 11종 + null →
  상수 / 잘못된 상한·DPR 입력 복귀 / 쿼리 1회 캐시 / 설치 후 JS 관측값 고정. **7건 전부 통과**.

3D 라이더 레이어 확인: `riderPreservedLayer.ts` 는 `new WebGLRenderer({ canvas:
map.getCanvas(), context: gl })` 로 지도 캔버스·GL 컨텍스트를 공유한다. 별도 백버퍼가
없으므로 지도 캔버스 해상도를 그대로 따른다 — 코드 변경 없음 (지시 금지 범위 준수).

## 3. 시험 (전부 PowerShell, 포그라운드)

| 시험 | 결과 |
|---|---|
| 신규 단위 시험 | 7 통과 · 0 실패 |
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| 변경 파일 eslint 5건 | 0 error (MapView 기존 warning 8건만, 본 변경 무관) |
| 루트 `node scripts/check-dep-direction.mjs --check` | `PASS lib 파일 전원 도메인 지정 (0건 미지정)`. FAIL 1건은 `scripts/route-token/... → functions/lib/routeTokenCore.js` — `functions/lib` 미빌드 worktree 환경 탓 (지시에서 예고된 것, `Test-Path` 로 부재 확인) |
| `npm run test:quick` | 총 통과 1158 · 실패 3. 실패는 route 묶음 3건 전부 `functions/lib/index.js(.harness.js)` ENOENT (위와 같은 환경 원인). map 묶음 75/75 (신규 7 포함), ride·peer·meters·tools 0 실패 |
| `npm run test:rider-preserve` | exit 0 (pass 6 · fail 0) |
| `npm run build` (루트) | exit 0 (`built in 1.69s`) |
| 브라우저 (헤드리스 **1회**) | dev 서버 포트 5070, `deviceScaleFactor: 3` + viewport 699×273 + `?perflab=1`. 지도 캔버스 `1398×546` = **CSS(699×273) × 2 정확히**, JS 관측 DPR `2` (실측 3에서 상한 적용). 끝나고 서버 프로세스 2건 모두 종료, 5070 Listen 잔류 없음 확인 |

## 4. 금지 준수

- DPR ≤ 2 기기 동작 변경 없음 (`min` 그대로). 지도 스타일·카메라·라이더 로직 변경 없음.
- commit · push · 배포 없음 (`git status`: 소스 4건 수정 + 시험 1건 신규 + ops dir만).
- 브라우저 1회, dev 서버 종료 후 잔류 프로세스·포트 없음.
- 새 lib 파일 없음 → `dep-layers.json` 변경 없음.

## 5. Supervisor 판단 요청 (차기 묶음용)

1. 본 묶음은 **문면의 `pixelRatio` 옵션 방식을 채택하지 않았다** (API 부재 + tsc 파괴).
   의도(상한 2 + `?maxdpr=` + perflab 표시)는 구현·실측 완료. 이 대체 방식을 P1 완료로
   인정하는지, 아니면 별도 방식(예: MapLibre 전환 같은 큰 변경 — Chief 결정 사항)을
   원하는지 판정해 달라.
2. `window.devicePixelRatio` 재정의는 JS 관측 범위의 전역 개입이다. CSS 레이아웃·미디어쿼리·
   실측 스냅샷에는 영향이 없음을 코드·실측으로 확인했으나, 운영 반영 전 Chief 확인이
   필요하면 별도 묶음으로 올려 달라.
