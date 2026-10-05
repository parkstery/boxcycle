# 결과 — 축척 왼쪽 카메라 고도

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — Cursor CLI 결과 |
| 작성 | 2026-10-05 |
| 상태 | **DEVELOPMENT_DONE** |
| 지시 | [07-task-camera-altitude.md](07-task-camera-altitude.md) |

## 판정

축척 바로 왼쪽 읽기 전용 카메라 고도 라벨 구현·검증 완료. 커밋·push·배포 없음. 기존 줌/맵제어·카메라 알고리즘 미변경.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/map/MapCameraAltitudeControl.ts` | Mapbox `IControl`. `getFreeCameraOptions().position.toAltitude()` → `고도 N.N m` / `≥1000m` 시 km. 비정상은 `고도 —`. `move`·`render` 갱신, 동일 문자열이면 DOM skip, `onRemove` 리스너 해제. aria/title=`카메라 고도(해수면 기준)` |
| `apps/web/src/components/map/MapView.tsx` | ScaleControl 직후 `MapCameraAltitudeControl` 를 `bottom-right` 에 추가 |
| `apps/web/src/components/map/MapView.css` | bottom-right flex 같은 행(고도 order1 · 축척 order2 · attrib 아래 줄). 축척 기본 margin 제거로 세로 정렬 |

## 동작

- 소스: Mapbox 카메라 해수면 고도(m). 주행 거리·줌을 고도로 쓰지 않음.
- 표시: `고도 12.3 m` / `고도 1.2 km`. React 리렌더 없음.
- 배치: 축척 왼쪽 같은 행. 주행 제어·저작권과 겹침 없음(실측).

## 검증

| 명령 | exit | 결과 |
|---|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` | 0 | 15단계 유효 |
| `npx tsc -b --pretty false` | 0 | 통과 |
| `npx eslint src/components/map/MapCameraAltitudeControl.ts` | 0 | 통과 |
| Playwright `.out/verify-altitude.mjs` @5010 · 740×300 | 0 | **pass:true** |

### Playwright 증거

캡처: [.out/altitude-cam1.png](.out/altitude-cam1.png) · [.out/altitude-cam2.png](.out/altitude-cam2.png) · [.out/altitude-zoom.png](.out/altitude-zoom.png) · [.out/altitude-style.png](.out/altitude-style.png)  
측정: [.out/metrics-altitude.json](.out/metrics-altitude.json)

| 항목 | 결과 |
|---|---|
| 표시=toAltitude | cam1/cam2/zoom/style 모두 match |
| 카메라 1→2 | 고도 변화(camChanged) |
| 줌 확대 후 | 고도 갱신(zoomChanged) |
| Outdoors↔Satellite | 토글 유지, 고도 match |
| 배치 | 축척 왼쪽·주행 FAB/attrib 겹침 없음 · aria/title OK |

## 한계·비범위

- 상태보드/ops index는 Supervisor 마무리(지시대로 미수정).
- 카메라·동행·줌 알고리즘·기존 맵 제어 동작 변경 없음.
