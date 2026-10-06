# 결과 06 — 시계 HUD 우하단 · 맵 스타일/줌 상시 표시

- 담당: Developer(Cursor CLI) · 지시: `02-task-06.md`
- 판정: **DEVELOPMENT_DONE** · 커밋·푸시 없음
- 미니맵(`features/map-overlays`)·지시 07 변경: **미수정** (건드리지 않음)

## 변경 요약

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/maphud/MapHud.tsx` | `mapControls` 를 `quickCamera` 에서 분리한 독립 prop. 우상단 한 줄 `[QC?][야외 − +][계정]`. 시계는 우하단 슬롯으로 이동. 게이트·요약에서는 맵 제어 숨김 |
| `apps/web/src/components/maphud/MapHud.css` | `.hud-clock` absolute 우하단(고도/축척·저작권 위). QC 스택·`tr-under--with-ride-controls` 제거. `tr-under` top = pad + **44px**(맵 제어 행 높이) |
| `apps/web/src/App.tsx` | `mapControls` 상시 배선. idle = `setMapZoomStepRequest` ±1 + 기존 줌 한계 disabled. 주행 = 기존 거리/줌 분기 유지. 스타일 = `nextOutdoorsSatelliteMapStyle` |

`boxcycle-theme.css` 미수정(글래스 규칙 그대로 적용).

## diff 요약

```
 apps/web/src/App.tsx                      | 152 +++++++++++++----------
 apps/web/src/components/maphud/MapHud.css |  37 ++----
 apps/web/src/components/maphud/MapHud.tsx | 199 +++++++++++++++---------------
 3 files changed, 197 insertions(+), 191 deletions(-)
```

## 검증

| 명령 | exit | 결과 |
|---|---|---|
| `npx tsc -b --pretty false` | 2 | **본 작업과 무관** 기존 2건 유지(`App.tsx` SavedRoute Promise 반환형 · `RideRoutePanel` `queryText` 누락). HEAD(변경 되돌린 상태)에서도 동일 2건 |
| `npx eslint` MapHud.tsx + App.tsx | 0 | **0 errors · 7 warnings**(전부 App 기존 hooks). 증가 0 |
| `npm run test:e2e:menu-a` | 0 | **1 passed** (~16s) |
| `npm run test:e2e:touch-targets` | 1 | after **2 failed / 3 passed**. before(변경 되돌림)도 **2 failed / 3 passed** → **본 변경 무관**(예: `.hud-icon-btn` 부재·표고 자식 수) |
| `npm run test:e2e:hud-shots` | 1 | after **1 failed / 4 passed**(좌상단 RTW/계기판 y). before도 **동일 실패** → **본 변경 무관**(우상단·우하단만 변경) |
| 임시 촬영 spec | 0 | **2 passed**(690×275 · 1000×640). 실행 후 `e2e/_tmp-hud-clock-map-controls-06.spec.ts` **삭제** |

## 촬영·측정

디렉터리: `document/ops/20261006-hud-clock-map-controls/.out/`

| 그림 | file:/// |
|---|---|
| 690 idle | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/690x275-idle.png |
| 690 idle 줌 전 | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/690x275-idle-zoom-before.png |
| 690 idle 줌 후 | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/690x275-idle-zoom-after.png |
| 690 riding | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/690x275-riding.png |
| 1000 idle | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/1000x640-idle.png |
| 1000 idle 줌 전 | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/1000x640-idle-zoom-before.png |
| 1000 idle 줌 후 | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/1000x640-idle-zoom-after.png |
| 1000 riding | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/1000x640-riding.png |
| 계측 JSON | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/690x275-metrics.json · file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/1000x640-metrics.json |

### 배치·겹침 (실측)

| 뷰포트 | TR 한 줄 overflow | 순서 | 시계↔고도/축척/attrib | 시계↔표고/미니맵 | idle ± 캔버스 변화 | 「맵」이 TR 아래 |
|---|---|---|---|---|---|---|
| 690×275 | **false**(riding TR 363×44) | idle `[야외−+][계정]` · riding `[1–6][야외−+][계정]` | 겹침 없음 · clockAboveScale true | false / false | **true** | true |
| 1000×640 | **false** | 동일 | 겹침 없음 | false / false | **true** | true |

- 맵 제어 버튼 `min-height: 44px`(기존 D2 유지).
- 690 idle: 컨트롤 행 ≈96×44, 계정 왼쪽. 시계 ≈103×30 @ (577, 201).
- Mapbox 고도/축척 rect 의 y 가 vh(275) 밖으로 잡히는 경우 있음(`margin-bottom: -0.25rem` 등) — 시계는 그 위에 두고 스크린샷에서도 우하단 시계가 바닥 크롬 위에 보임.
- `MapView.css` 의 우상단 Mapbox 컨트롤 `margin-top` 은 허용 파일 밖이라 미조정(구 2단 행 여유를 조금 더 가질 수 있음).

## 범위 밖 발견

1. **tsc 기존 2건** — SavedRoute 반환형 · `RideRoutePanel` `queryText` (본 지시 허용 파일 밖).
2. **touch-targets / hud-shots** — before·after 동일 실패. 좌상단 RTW/계기판 y 계약·제거된 `.hud-icon-btn` 등. 본 배치와 무관.
3. 작업 트리에 다른 묶음(예: ride-summary-layout) 임시 파일이 있을 수 있음 — **미수정**.

## Git

커밋·푸시 **하지 않음**. 허용 3파일(+ ops 결과·`.out` 증거)만 본 작업 산출.
