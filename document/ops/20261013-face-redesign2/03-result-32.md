# 결과32 — dock 패널 크기 변화에 ResizeObserver 연결

- 소유: `apps/web/src/components/map/MapView.tsx` 중 route pick dock lifecycle만. 다른 dirty(기존30/31·타 담당자) 미접촉.
- commit/push/merge/deploy/server/하위 agent/다른 UI 없음.

## 수정 (재지시32 확정안 그대로)

1. 지도 초기화 effect 안에 effect-local `let dockPanelResizeObserver: ResizeObserver | null = null` 1개를 `teardownRoutePickDock` 정의 전에 선언.
2. `mountDockedRoutePanel`에서 기존 `onDockResize → positionRoutePickDockPanel` 배치 계산을 그대로 쓰는 observer를 생성·`panel.observe(panel)`:
   ```ts
   dockPanelResizeObserver?.disconnect();
   dockPanelResizeObserver = new ResizeObserver(onDockResize);
   dockPanelResizeObserver.observe(panel);
   ```
   - callback은 기존 `onDockResize` 그 자체(내부 dragging guard `routePickDockDraggingRef` 유지, `dataset.dockClickLng/Lat` → `positionRoutePickDockPanel` 재-clamp).
   - `requestAnimationFrame`/interval/global resize dispatch 추가 없음. window `resize` 경로·위치 기억·drag·close·지도 resize 경로 그대로.
   - observer는 이 dock panel에만 부착, 앱 다른 패널에 부착 없음.
3. `teardownRoutePickDock`에서 `disconnect()/null` 후 기존 정리 수행. 새 panel mount는 기존 `teardownRoutePickDock()` 경유이므로 이전 observer가 먼저 해제됨.
4. 지도 effect의 바깥 cleanup(기존 teardown과 중복된 수동 정리 구간)에도 같은 `disconnect()/null` 추가 — unmount 시 관찰자 누수 방지. 동작 변경 없음.

## 검증

- `git diff --check`: 통과(출력 없음).
- `apps/web npx tsc -b --pretty false`: 통과(출력 없음).
- `git diff --stat`: `MapView.tsx`만 +9/-0(본 묶음 기준), 나머지 dirty 불변 확인.

## Supervisor 실제 확인 요청 (본 Developer 미실행)

- 667/740/844 실폭에서 위치 → 거리(펼침) → 양쪽(둘 다 펼침) → 위치(접기) 순으로 `panel rect`가 canvas 안에 있는지, 내용 잘림 여부, 기존 drag 정상 여부.
- 큰 두 패널이 화면보다 높을 경우: 기존 정책(`MapView.css` — `.map-view__pick-dock-panel .map-view__pick { max-height: min(70vh, 26rem); overflow-y: auto; }`)에 따른 내부 스크롤만 허용하고, 그 상태를 보고에 기록 요망. 본 수정은 maxheight/overflow 정책을 바꾸지 않음.
- 원격 경로 탐색·실기기 검증은 수행하지 않았음(Developer 로컬 정적 검증만).
