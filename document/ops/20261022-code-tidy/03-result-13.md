# 결과13 — App.tsx 1차 분리 (A·B·C 완료, D 보류)

2026-10-22 · 지시 [02-task-13.md](02-task-13.md) · 규칙 [02-task-p3-rules.md](02-task-p3-rules.md)

## 요약

- `apps/web/src/App.tsx` **3,752줄 → 3,656줄** (−96줄, 보완 후). 지시서의 3,741줄은 이전 측정값이고 착수 시점 실측은 3,752줄.
- A·B 는 훅으로, C 는 순수 함수로 옮겼다. **D 는 소스 문자열 계약 때문에 옮기지 않았다.**
- 건드린 파일: `src/App.tsx`, 새 파일 3개(`src/app/`). 시험·설정·baseline·CSS 무변경.

## 구간별

### A — 지도·카메라 상태 → `src/app/useAppMapCameraState.ts` (114줄)

- 옮긴 구간: `mapStyle` ~ `rideCameraRestoreRef` (App.tsx 269–324행, 56줄). 원문 그대로 한 덩어리.
- 인자: 없음.
- 반환(객체, App 에서 같은 이름으로 구조 분해): `mapStyle setMapStyle showRtwPoi setShowRtwPoi mapZoom setMapZoom rideCameraDistanceM setRideCameraDistanceM rideFollowCameraNonce setRideFollowCameraNonce rideJoinBurstNonce setRideJoinBurstNonce mapViewportSpanKm mapViewportCenterLngLat mapLodZoom mapLodSpanKm onMapViewport onMapLodViewport followMode setFollowMode activeQuickCamera setActiveQuickCamera camera1Mode setCamera1Mode camera1StyleBeforeEnterRef camera1UserToggledStyleRef lockBaseHeading setLockBaseHeading rideCameraSpanFloorMode setRideCameraSpanFloorMode mapZoomStepRequest setMapZoomStepRequest mapZoomStepSeqRef enable3D setEnable3D followModeSnapshotRef mapZoomSnapshotRef rideCameraRestoreRef` (App 밖에서 쓰이지 않는 `setMapViewportSpanKm` 등 4개 setter 는 반환하지 않음).
- 호출 자리: 원래 구간 자리(`useConquest` 직후). 앞뒤 훅 순서 불변.
- 새 파일 맨 위에 `/* eslint-disable react-hooks/refs */` 를 둠 — App.tsx 는 `eslint.config.js` 에서 이 규칙이 꺼져 있고(설정 수정 금지), 구간 안의 render 중 ref 동기화(`followModeSnapshotRef.current = followMode` 등)가 새 파일에서 error 가 되기 때문. 기존 관례(`MapView.tsx`, `useActivityWorldDataSync.ts` 의 파일 단위 disable)를 따름.

### B — 센서 준비 → `src/app/useAppRideInputReadiness.ts` (80줄)

- 옮긴 구간: `manualSpeedKmh` ~ `rideTargetSpeedKmh` (App.tsx 325–387행). 지시서는 `useBleCrankRpm` 부터라 했으나 바로 앞의 `manualSpeedKmh`·`rideInputMode` `useState` 두 개가 A 와 B 사이에 끼어 있어 B 에 포함했다(연속 구간 유지, 순서 불변).
- 인자: 없음.
- 반환: `manualSpeedKmh setManualSpeedKmh rideInputMode bleCrankRpm switchRideInputToManual switchRideInputToCadence rideInputReadiness rideTargetSpeedKmh`.
- 포함된 DEV 훅 `window.__rtwSetRideInputMode` 이펙트, 렌더 중 이전값 비교 setState 도 순서·내용 그대로 이동.
- **계약 시험 때문에 남긴 것:** `scripts/ride-verify/entry-contract.mjs` 의 `go-precondition` 앵커가 `src/App.tsx` 에서 `/const rideInputReady = isRideInputReady\(/` 를 찾는다. 그래서 훅이 `rideInputReadiness` 를 돌려주고, **`const rideInputReady = isRideInputReady(rideInputReadiness);` 한 줄(순수 식, 훅 아님)은 App.tsx 에 남겼다.** `isRideInputReady` import 도 App 에 남음. (이 줄이 원래 `rideInputReadiness` 와 `rideTargetSpeedKmh` 사이에 있었으나 훅이 아니므로 순서 영향 없음.) `nickname-gate-contract` 의 `indexOf("rideInputReady", fnAt)` 도 사용처 위치가 안 바뀌어 그대로 동작.

### C — 계기판 표시값 → `src/app/appHudValues.ts` (87줄, 순수 함수 `computeAppHudValues`)

- 옮긴 구간: `sessionDistanceMeters` ~ `hudMetrics` (App.tsx 2880–2927행, 48줄). 계기판 표시값 계산만. 뒤따르는 `accountInitial…accountChip`(계정 칩)과 `snap`/`liveElapsedSec`/`caloriesEstimate`(ref `.current` 읽기)는 HUD 값이 아니거나 ref 에 묶여 있어 옮기지 않았다.
- 인자(객체): `rideMetrics sessionStartOffsetMeters startPlaceLabel endPlaceLabel lastEndedWasAdhoc routeDistanceMeters rideStatus routeGeometry summaryVisible avgSpeedLabel`.
- 반환: `elapsedLabel cumulativeDistanceMeters suggestedRouteName hudMetrics` (`sessionDistanceMeters` 는 App 밖에서 쓰이지 않아 반환하지 않음; 나머지 중간값은 함수 안에서만 사용).
- 훅이 아니므로 순서 문제 없음. 원문 식·문구 그대로.

### D — `rideControlPanel` JSX → 보류 (옮기지 않음)

- 이유: `scripts/ride-hierarchy/sensor-chip-slot-contract.test.ts` 가 `App.tsx` 소스에서 `/<RideControlBar/`, `/canStartRide=\{canStartRideWithInput\}/`, `/cadence=\{cadenceHud\}/` 를 찾는다(구간 D 안의 문자열). `<AppRideControlPanel …/>` 로 바꾸면 `<RideControlBar` 가 App.tsx 에서 사라져 이 시험이 깨진다. 지시서 규칙(시험 수정 금지, 구간 이동 금지)에 따라 보류. 같은 시험이 `{rideControlPanel}` 도 요구하므로 변수 자리 자체는 유지해야 함.
- 해제하려면 감리가 해당 시험 앵커를 새 파일을 읽도록 고치는 결정이 먼저 필요하다.

## 소스 문자열 계약 점검

`rg -l "App.tsx" apps/web/scripts` 로 9개 파일 확인, 각각이 찾는 문자열을 구간과 대조했다.

| 시험 | 찾는 것 | 결과 |
|---|---|---|
| sensor-chip-slot-contract | `<RideControlBar`, `canStartRide=…`, `cadence=…`, `{rideControlPanel}` | 구간 D → **D 보류** |
| ride-verify/entry-contract | `const rideInputReady = isRideInputReady(` | 구간 B 안 → **그 한 줄만 App 에 남김** |
| nickname-gate-contract | `handleStartRide` 이후 첫 `rideInputReady` | 위치 불변, 무관 |
| 나머지 6개 (visibility-gate, distance-auto-route, start-screen-after-deletion, conquest-emphasis, listener-scope-gate, trail-lifecycle) | A·B·C 구간 밖 식별자 | 무관 |

## 검사 결과

- `npx tsc -b --noEmit` (apps/web): 통과(출력 없음).
- `npx eslint src/App.tsx src/app`: **error 0**, warning 16. 기준(원본 App.tsx)은 7건. 늘어난 9건은 모두 `react-hooks/exhaustive-deps`: A·B 의 setter·ref 가 훅 반환값이 되면서 린트가 「안정된 setState/ref」임을 알아보지 못해 바깥 `useCallback`/`useEffect` 의존성에 `setActiveQuickCamera`, `setFollowMode`, `setLockBaseHeading`, `setMapStyle`, `setRideCameraDistanceM`, `setRideCameraSpanFloorMode`, `camera1*Ref` 등을 추가하라고 경고한다. 동작은 동일(식별자 안정). 의존성 배열은 지시대로 건드리지 않았다. 경고를 없애려면 감리 결정으로 해당 배열에 안정 식별자를 추가하거나 경고를 용인.
- `npm run test:quick` (마지막 편집 후): 통과 1341 · 실패 0.
- `node scripts/ride-verify/verify-selectors.mjs`: 19단계 전부 유효.
- 루트 `node scripts/check-dep-direction.mjs --check`: 방향 위반 0, baseline 이내 통과(`app/` 은 appLayer 라 새 파일 등록 불필요).
- Playwright 는 실행하지 않음.

## 계획과 달라진 점

- B 범위를 지시서보다 약간 앞(`manualSpeedKmh`, `rideInputMode`)까지 넓힘(연속성 때문).
- D 보류, B 의 한 줄 잔류(위 계약 사유).
- 새 파일 `useAppMapCameraState.ts` 에 파일 단위 `react-hooks/refs` disable 추가.

## 보완 (감리 판정 후)

1. **exhaustive-deps 경고 9건 제거.** 린트가 요구한 식별자는 전부 `useState` setter 또는 `useRef` 객체(`set*`, `camera1StyleBeforeEnterRef`, `camera1UserToggledStyleRef`, `followModeSnapshotRef`, `mapZoomSnapshotRef`, `rideCameraRestoreRef`)뿐이어서 해당 의존성 배열 끝에 추가했다. 렌더마다 같은 정체성이라 효과·콜백은 다시 실행되지 않는다. 고친 자리(보완 전 행 기준): 이펙트 593(`[rideStatus]`, 16개 추가), 콜백 1188·1998·2098·2420·이펙트 2522(각 `setActiveQuickCamera`·`setFollowMode`·`setLockBaseHeading`), 콜백 2662(9개), 2675·2680(`setRideCameraDistanceM`·`setRideCameraSpanFloorMode`). 비-setter/ref 를 요구한 경고는 없었다. 이 편집은 옮긴 구간 밖이며 배열에 식별자만 덧붙였다(App.tsx +9줄).
2. 새 파일 `useAppMapCameraState.ts` 첫 줄 주석에 이유를 붙였다: `/* eslint-disable react-hooks/refs -- App.tsx 에서 옮긴 기존 패턴, eslint.config.js 의 App.tsx 예외와 같은 범위 */`.
3. 재검사: `npx tsc -b --noEmit` 통과 · `npx eslint src/App.tsx src/app` error 0 / **warning 16 → 7**(원래 7건과 동일, 남은 7건은 모두 이번 작업 이전부터 있던 `rideResumeSlot`, `calorieProfile.*`, `setUserInfoSheetOpen` ×2, `setMenuOpen` ×2, `useMemo` 불필요 의존성) · `npm run test:quick` 통과 1341 / 실패 0 · `verify-selectors` 19단계 유효.
