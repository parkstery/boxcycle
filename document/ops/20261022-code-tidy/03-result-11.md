# 결과 11 — MapView 압축 (ref 동기화 효과 · 보조 함수 분리)

2026-10-22 · 구현 Claude · 지시 [02-task-11.md](02-task-11.md)

## 1. ref 동기화 효과 → `useAssignRef`

- 새 훅 `apps/web/src/components/map/useAssignRef.ts` (지시 서명 그대로, 의존성 `[ref, value]`).
- **바꾼 효과 40개.** 전부 제자리에서 바꿨다(위치·선언 순서 불변). `useRef` 선언과 초기값, `useLayoutEffect` 는 건드리지 않았다.
  - clearPinMarkersRef, liveRiderNametagRef, routeGeometryRef, routeDistanceMetersRef, liveLngLatRef, sampleLiveLngLatRef, sampleLiveDistMRef, pacerEnabledRef, liveRiderMotionRef, followModeRef, lockBaseHeadingRef, activeQuickCameraRef, rideCameraSpanFloorModeRef, onRideCameraDistanceFromUserZoomRef, prefersReducedMotionRef, enable3DRef, onSelectPointRef, routeWaypointsRef, startLngLatRef, endLngLatRef, routeProfileRef, routeTokenInsufficientRef, onRouteProfileRef, onClearRouteRef, onArmDirectionPickRef, onPreviewDistanceAutoRouteCircleRef, onClearDistanceAutoRouteCircleRef, onSetRouteProfileOnlyRef, onAutoRouteMapPickRef, onRetryDistanceAutoRouteRef, onDismissDistanceAutoRouteRef, autoRouteMapPickRef, autoRouteSessionActiveRef, autoRouteTargetKmRef, autoRouteStatusMessageRef, onSuspendAutoRoutePopupPickRef, onMapZoomRef, onMapViewportRef, onMapLodViewportRef, getActivityWorldPinLabelRef.
- **바꾸지 않은 비슷한 효과와 이유**
  - `rideStartRef` (`[onStartRide, canStartRide]`): 본문 두 줄(`syncRideStart()` 호출 포함) + 의존성 둘.
  - `mapZoomRef` (`[mapZoom]`): `holdCameraAfterRideEndRef` 조건 early-return 이 있다.
  - `rideCameraDistanceMRef` (`[rideCameraDistanceM]`): URL 쿼리 `rideCam` 계산이 끼어 있다.
  - 본문 중간의 `[bootFlyTarget]`, `[mapLoaded, bootFlyHold, bootFlyTarget]` 효과: 본문이 여러 줄이고, `scripts/map/entry-location-camera.test.mjs`·`scripts/identity/entry-location-dom.test.mjs` 가 의존성 배열로 이 `useEffect` 를 AST 로 찾아 실행한다(건드리지 않음).
  - 렌더 중 직접 대입(`xxxRef.current = x;`, 예: `bootFlyTargetPropRef`, `userMileageRef`, `conquestDisplayModeRef`, `coverageOverlayModeRef`)은 효과가 아니므로 대상 아님.

## 2. 보조 함수 분리 (본문 verbatim, 앞에 `export` 만 붙임)

| 새 파일 | 옮긴 함수 |
|---|---|
| `mapViewControls.ts` | `createFixedScaleBoxControl`, `isMapAttachedToContainer` |
| `mapViewReducedMotion.ts` | `subscribeReducedMotion`, `getReducedMotionSnapshot`, `getReducedMotionServerSnapshot` |
| `mapViewSelfRider.ts` | `mountSelfLocationMarker`, `syncLiveSelfRiderVisual` |

(모두 `apps/web/src/components/map/` 아래.) `MapView.tsx` 는 이 이름들을 import 해서 쓴다. 이 함수들은 원래 `MapView.tsx` 에서 export 되지 않았으므로 재내보내기는 없다(`export type { LiveRiderMotion }` 는 그대로).
- `mapViewSelfRider.ts` 는 `RIDER_PROTOTYPE_MODE`/`RIDER_PROTOTYPE_IS_3D` 를 `riderDomMarkers.ts` 와 같은 방식(모듈 상수 `getRiderPrototypeMode()`)으로 자체 선언한다. `MapView.tsx` 쪽 상수는 본문 다른 곳에서 쓰이므로 그대로 남아 있다.
- 옮긴 뒤 `MapView.tsx` 에서 안 쓰이게 된 import(`SELF_LOCATION_MARKER_CLASS`, `createSelfLocationMarkerRoot`, `estimateCrankRpmFromSpeedKmh`, `applyIso2dRiderBearing`)만 정리했다.

## 3. 계약 시험 때문에 남긴 것

`scripts/distance-auto-route/distance-auto-route-click-intent.test.ts` 가 `MapView.tsx` 소스에서 `/if \(markerRef\.current\)/`(441행)를 찾는다 — 이 문자열은 `placeAutoRouteClickDebugMarkerOnMap` 본문에만 있다. 그래서 **`placeAutoRouteClickDebugMarkerOnMap` 은 옮기지 않았고**, 같은 쌍인 `clearAutoRouteClickDebugMarkerOnMap` 도 함께 `MapView.tsx` 에 남겼다(호출 문자열 `clearAutoRouteClickDebugMarkerOnMap(autoRouteClickDebugMarkerRef)` 도 시험이 찾음). 시험은 고치지 않았다.
`createFixedScaleBoxControl` 은 시험(`map-control-visibility.test.ts`)이 호출부 문자열만 찾으므로 옮겨도 안전했다(호출부는 `MapView.tsx` 에 그대로).

## 4. 줄 수

- `MapView.tsx`: 3,589줄 → 3,403줄 (-186). (git diff: +49 / -235)
- 새 파일: `useAssignRef.ts` 8, mapViewControls.ts 35, mapViewReducedMotion.ts 16, mapViewSelfRider.ts 75 (합계 134줄).

## 5. 검사 (apps/web)

- `npx tsc -b --noEmit` → 오류 0.
- `npx eslint src/components/map` → 오류 0, 경고 9 (전부 `react-hooks/exhaustive-deps` 기존 유형. 새 규칙 종류 없음).
- `npm run test:quick` (마지막 편집 후) → `합계 통과 1341 · 실패 0 · 62.2초 · 제외 3개 파일(에뮬레이터·하네스)`.
- `node ../../scripts/check-dep-direction.mjs --check` → `baseline 이내 — 통과`.
- Playwright 는 돌리지 않았다(`entry-location-dom.test.mjs` 포함, 감리 몫). 위 두 시험이 읽는 effect 는 바꾸지 않았다.
