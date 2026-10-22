# 지시12 결과 — mapPopupElements 에서 마커·활동 팝업 요소 분리

2026-10-22 · 담당 Claude impl-standard · 지시 [02-task-12.md](02-task-12.md) · 규칙 [02-task-p3-rules.md](02-task-p3-rules.md)

## 옮긴 함수 (본문 그대로 → `apps/web/src/components/map/mapMarkerElements.ts`)

- `pickPickPopupAnchor`
- `createLiveRiderMarkerRoot`
- `createRouteEndpointPinEl`
- `createTemporaryRoutePinEl`
- `createWaypointMarkerEl`
- `buildActivityWorldPopupElement` (모듈 비공개 그대로 — `tryOpenActivityWorldPinPopup` 만 쓴다)
- `tryOpenActivityWorldPinPopup`

함께 옮긴 import: `mapboxgl`, `ensureRiderPedalStripKeyframes`, `RIDER_PEDAL_SPRITE_REVISION`, `ACTIVITY_HEAT_DOTS_LAYER`, `ACTIVITY_PULSE_DOTS_LAYER` (옮긴 함수들만 쓰던 것들이라 `mapPopupElements.ts` 에서는 지웠다).

`mapPopupElements.ts` 는 `export { pickPickPopupAnchor, createLiveRiderMarkerRoot, createRouteEndpointPinEl, createTemporaryRoutePinEl, createWaypointMarkerEl, tryOpenActivityWorldPinPopup } from "./mapMarkerElements";` 로 다시 내보낸다. 기존 import 파일(`MapView.tsx`, `useMapPinMarkers.ts`)은 손대지 않았다.

## 남긴 것과 이유

- `buildPickPopup`, `PickPopupAutoRouteUi`, `PICK_POPUP_PROFILE_ICON_SVG`: 본문 수정 없음, 팝업 본체.
- `isWaypointSlotEnabled`, `waypointSlotTitle`: `buildPickPopup` 안(경유지 W1~W3 버튼)에서만 쓰므로 그쪽에 둔다. 마커 쪽은 쓰지 않는다.
- `apps/web/src/lib/**` 가 아니라 `components/map` 이라 `dep-layers.json` 배정 목록 추가 대상이 아니다(해당 파일은 `lib` 도메인만 배정).

## 소스 문자열 계약 확인

`apps/web/scripts/**` 에서 `mapPopupElements.ts` 를 `readFileSync` 하는 시험 3곳을 모두 확인했다.

- `distance-auto-route-contract.test.ts` — `indexOf("function buildPickPopup")` 이후를 잘라 검사. `buildPickPopup` 이전(옮긴 부분)의 문자열을 찾는 단언 없음. `function buildPickPopup` 은 그대로 한 번만 존재.
- `distance-auto-route-click-intent.test.ts` — `applyDistanceDirectionMode`, `selectStart`, `endBtn.onclick` 등 `buildPickPopup` 내부만 검사.
- `scripts/ride-verify/entry-contract.mjs` — `startRideBtn.setAttribute("aria-label", "주행 시작")` 등 `buildPickPopup` 내부 앵커.
- 옮긴 7개 함수명·클래스(`route-pin`, `waypoint-marker`, `activity-popup`, `cycling-sim-marker` 등)를 찾는 시험은 `scripts/**` 에 없음 → 옮기지 못한 함수 없음.

## 줄 수

| 파일 | 전 | 후 |
|---|---|---|
| `mapPopupElements.ts` | 1,176 | 1,007 |
| `mapMarkerElements.ts` (신규) | - | 189 |

## 검사 결과 (apps/web, 마지막 편집 후)

- `npx tsc -b --noEmit`: 출력 없음, 종료 코드 0.
- `npx eslint src/components/map`: 0 errors, 9 warnings — 전부 기존 `MapView.tsx` 의 react-hooks/exhaustive-deps 경고(내가 건드린 두 파일은 경고 없음).
- `node ../../scripts/check-dep-direction.mjs --check`: baseline 이내 — 통과.
- `npm run test:quick`: 합계 통과 1341 · 실패 0 (ride 843 / route 176 / map 151 / peer 72 / meters 58 / tools 41).

## 계획과 달라진 점

없음. 새 파일에 한 문단짜리 머리 주석(옮긴 사유)을 붙였고, `mapPopupElements.ts` 에 재내보내기 주석 한 줄을 달았다. Playwright 는 실행하지 않았다.
