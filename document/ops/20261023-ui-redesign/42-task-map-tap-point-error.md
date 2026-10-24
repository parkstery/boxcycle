# 지시 42 — 지도 짧게 탭할 때 `Cannot read properties of undefined (reading 'x')` 오류

2026-10-24 Chief 보고(콘솔 캡처) · 발주 Claude Code · 구현 **OpenCode `nemotron-3-ultra-free`** · 결과 파일 `43-result-map-tap-point-error.md`

## 증상 (Chief 콘솔, localhost:5000 주행 중)

```
Uncaught TypeError: Cannot read properties of undefined (reading 'x')  mapbox-gl.js
  at tryOpenActivityWorldPinPopup (mapMarkerElements.ts:164:24)
  at Object.onActivityPinShortTap (MapView.tsx:1684:16)
  at finishPointer (mapRoutePickGesture.ts:227:17)
  at HTMLDocument.onPointerUp (mapRoutePickGesture.ts:235:5)
```

## 원인 (Supervisor 조사)

- `apps/web/src/components/map/MapView.tsx:1586` `mapMouseEventFromPickCommit` 가 `point: commit.point` 로 **평범한 객체 `{x, y}`** 를 넣는다(`MapRoutePickCommit.point` 타입, `mapRoutePickGesture.ts:12`).
- `mapMarkerElements.ts:164` `map.queryRenderedFeatures(event.point, { layers })` — mapbox-gl 3.23 은 첫 인자가 `Point` 인스턴스도 아니고 `[number, number]` 배열도 아니면 **상자 `[p1, p2]`** 로 보고 `Point.convert(geometry[0])` 를 부른다 → `undefined.x` 오류.
- 결과: 활동(pulse/heat) 점 레이어가 있을 때 지도를 짧게 탭하면 매번 예외가 나고, 뒤따르는 `onShortTapNoPick`(경로 선택 안내)도 실행되지 않는다. 활동 점 팝업도 열리지 않는다.

## 할 일

1. `mapMouseEventFromPickCommit` 의 `point` 를 `new mapboxgl.Point(commit.point.x, commit.point.y)` 로 만든다(같은 파일에서 mapboxgl 를 이미 import 하는지 확인). 다른 동작은 바꾸지 않는다.
2. 같은 종류 실수가 더 있는지 찾는다: `apps/web/src` 에서 `queryRenderedFeatures(`·`queryRenderedFeatures(` 에 넘기는 값과 `as mapboxgl.MapMouseEvent` 로 만든 가짜 이벤트 전부(`grep -rn "queryRenderedFeatures\|as mapboxgl.MapMouseEvent" apps/web/src`). 평범한 `{x, y}` 를 넘기는 곳이 있으면 같은 방식으로 고치고 결과에 파일:줄로 적는다. 없으면 「없음 — 찾은 범위」를 적는다.
3. 재발 방지 시험 하나: `apps/web/scripts/map/` 에 node 단위 시험(기존 `scripts/map/*.test.ts` 형식)을 더하거나, 할 수 없으면 이유를 적는다. 시험은 소스 문자열 검사(grep)가 아니라 **동작**을 확인해야 한다 — 예: `mapMouseEventFromPickCommit` 를 순수 함수로 작은 모듈(`src/components/map/mapPickEvent.ts` 등)에 빼고, 결과 `point` 가 `Point` 인스턴스(`x`·`y` 보존, `instanceof`)인지 확인. 새 파일을 만들면 `npm run test:quick` 목록에 들어가는지(또는 `test:next-ride` 의 `scripts/map/*` 나열) 확인해 넣는다.

## 금지

- 이 지시와 관계없는 파일 수정 금지. **다른 실행자(Cursor)가 동시에 `RouteDock.*`, `MapBottomLeftStack.css`, `e2e/ui-800x360.spec.ts`, `e2e/address-minimap-width.spec.ts` 를 고치고 있다 — 그 파일들 손대지 말 것.**
- 묶음 3 미커밋 변경(`NextRideCard.*`, `RideSummarySheet.*`, `preview.tsx` 등) 손대지 말 것.
- `git restore`·`checkout`·`stash`·`worktree`·`clean`·커밋·푸시 금지. `tmp/` 손대지 말 것. 서버를 띄우거나 끄지 말 것(3000·5000·5040 등).
- 고정 목록(`document/reference/product/261024-RTW-Chief-지정-디자인-고정.md`) 화면 변경 없음.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

1. `npx tsc -b --noEmit`
2. 변경 파일만 `npx eslint <파일들>` 오류 0
3. 새 시험 단독 실행 + `npm run test:quick` 합계
4. 루트 `C:\20.HDev\boxcycle`: `node scripts/check-code-tidy.mjs`, `node scripts/check-dep-direction.mjs --check`

## 결과 파일 `43-result-map-tap-point-error.md`

바꾼 파일, 2번 탐색 범위와 결과, 시험 명령별 통과·실패(실패 원문), 못 한 것. 한국어, 사실만.
