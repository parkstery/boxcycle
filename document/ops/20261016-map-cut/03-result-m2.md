# 결과 M2 — 주행 중 가까운 카메라에서 지도 글자 숨김 (Chief 결정 A)

| 항목 | 내용 |
|---|---|
| 지시 | `document/ops/20261016-map-cut/02-task-m2.md` (Supervisor Claude, 2026-10-16) |
| 수행 | Developer (OpenCode Muse Spark), 작업 위치 `C:\20.HDev\boxcycle-labels`, 브랜치 `perf/ride-near-labels` (기준 `main2` `3cb4b21`) |
| 상태 | 완료 (commit·push·배포 없음, 브라우저·dev 서버 미사용, 백그라운드 잔류 없음) |

## 1. 구현

- 신규 `apps/web/src/lib/map/rideLabels.ts` (도메인 `map`, `dep-layers.json` 등록):
  - 대상은 M1 분류 재사용 — `classifyMapCutLayers(layers, ["labels"])` 와 같은 집합
    (`symbol` 중 앱 레이어 `boxcycle-`/`route`/`live-self`/`debug-`/`distance-` 제외). DOM 이름표는 건드리지 않는다.
  - `RIDE_LABELS_HIDE_ZOOM = RIDER_POSE_ANIMATION_MIN_ZOOM`(19, `riderDetailLod` import — `map` 은 `rider` import 가능),
    `RIDE_LABELS_SHOW_ZOOM = 18.7`.
  - 순수 상태 함수 `shouldHideRideLabels({ riding, zoom, currentlyHidden, forceShow })`:
    강제 표시·비주행·줌 모름 → 표시, 미숨김 + 줌 ≥ 19.0 → 숨김, 숨김 중에는 18.7 미만에서만 복원.
  - `RideLabelsController`: 숨기기 전 각 레이어 `visibility` 를 기억했다가 그대로 복원
    (원래 `none` 은 호출 없이 `none` 유지). `update` 는 상태가 바뀔 때만 `setLayoutProperty`,
    `reapply` 는 `style.load`·스타일 교체 후 같은 숨김을 새 스타일에 다시 적용.
    `map` 인자는 `unknown` (M1 과 같은 mapbox-gl 제네릭 충돌 회피 — `tsc` 1회 수정).
  - 비상 스위치 `?labels=1` → 항상 표시 (`parseRideLabelsForceShow` + `isRideLabelsForceShown`).
    `?mapcut=` 과 공존 — mapcut 뒤에 등록·적용되므로 mapcut 이 숨긴 레이어는 원본 `none` 으로 기억되어 복원해도 `none` 유지.
  - 공유 싱글턴 `getRideLabelsController()` + `readRideLabelsHidden()`.
- `MapView.tsx`: mapcut `style.load` effect 뒤에 글자 effect 추가 (`[mapLoaded, rideActive]`).
  `zoom`·`zoomend` + `rideActive` 변화에 `controller.update(map, { riding: rideActive, zoom: map.getZoom() })`,
  `style.load` 에 `controller.reapply(map)`. 전부 try/catch (실패가 주행 지도를 막지 않음).
- `PerfLabPanel.tsx`: 상단 `mapcut …` 줄 옆에 `글자 숨김/표시`, 복사 JSON 에 `rideLabelsHidden`.

## 2. 시험

신규 `apps/web/scripts/map/ride-labels-contract.test.ts` (11건, 전부 통과):

- 상태 함수: (주행 아님 → 표시), (주행·19.2 → 숨김), (숨김 중 18.8 → 숨김 유지),
  (18.6 → 표시), (`?labels=1` → 항상 표시), (줌 모름 → 표시).
- 원래 `visibility: none` 레이어는 숨김 시 호출 없이, 복원 후에도 `none`.
- 상태가 같으면 `setLayoutProperty` 호출 0 (동일 줌 반복·21.5·히스테리시스 안 18.8).
- 앱 레이어(`route`·`live-self`·정복·라이더·`debug-`·`distance-`)는 호출 대상에 없음
  (`getRideLabelLayerIds` = `poi-label`, `road-label` 만).
- `forceShow` 면 숨김 중에도 복원만 호출, `style.load` 뒤 `reapply` 로 같은 숨김 재적용
  (표시 상태 `reapply` 는 호출 0).

## 3. 검증 (PowerShell `apps/web`, 전부 포그라운드)

| 검사 | 결과 |
|---|---|
| `npx tsc -b` | 통과 (수정 1회: `update`/`reapply(map: unknown)` — mapbox-gl 제네릭 충돌, M1 과 같은 사유) |
| `npx eslint` 변경 4 파일 | 에러 0. `MapView.tsx` warning 8건은 변경부와 무관한 기존 항목 |
| 루트 `node scripts/check-dep-direction.mjs --check` | 요구 항목 "lib 파일 전원 도메인 지정" **PASS(미지정 0)** — 신규 `map/rideLabels.ts` 등록 정상. 전체는 M0 FAIL인데 **기존 결함** (`route-token-onboarding-grant.test.mjs` → `functions/lib` 미존재 1건, M1 이 stash 대조로 입증한 것과 동일) |
| `npm run test:quick` | ride 757/0 · **map 102/0**(신규 11 포함) · peer 72/0 · meters 58/0 · tools 34/0. route 3 실패는 전부 `functions/lib` 부재(`harnessActive` 모듈·`index.js`·`index.harness.js` ENOENT) — 지시 예상("부재 3건 외 0")과 일치, 변경부와 무관 |
| `npm run test:rider-preserve` | 44 + 6 전부 통과 |
| `npm run build` | 성공 (chunk 크기·SADDLE/PELVIS 경고는 기존) |

브라우저·dev 서버 미사용 (지시대로 Supervisor 가 배포 후 실제 GPU 로 측정).

작업 파일:

- 신규: `apps/web/src/lib/map/rideLabels.ts`, `apps/web/scripts/map/ride-labels-contract.test.ts`, 본 결과
- 수정: `apps/web/dep-layers.json` (map 등록 1줄), `MapView.tsx` (import 1줄 + effect 1개),
  `PerfLabPanel.tsx` (import 1줄 + 상단 상태 2줄 + JSON 1줄)
