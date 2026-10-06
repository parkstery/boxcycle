# 결과 06-4 — Mapbox 컨트롤은 제자리, 카드가 비킨다

- 담당: Developer(Cursor CLI) · 지시: `02-task-06d.md`
- 판정: **DEVELOPMENT_DONE** · 커밋·푸시 없음
- worktree / `git restore` / `git clean` / stash / `.env*`: **미사용·미수정**

## 택한 해법

1. **`MapView.css`**: `max-height:560px` 의 `ctrl-top-right` **`margin-right` 예약 제거**. +/−/지구/나침반은 오른쪽 가장자리 유지(대기·주행 동일). TR+「맵」 아래 `margin-top` 은 유지하되, 오른쪽 복귀 후 「맵」 트리거와 1줄 겹치지 않게 **+0.45rem** 여유.
2. **`NextRideCard.css`**: 짧은 뷰포트에서 앵커 `right` 는 TR 과 같은 선 유지(「다음 주행 카드 자리」 e2e). 앵커에 `padding-right: 24px + 0.35rem` 거터 → **카드 본체**만 컨트롤 열 왼쪽. 앵커는 `pointer-events: none` 이라 거터 위 클릭이 Mapbox 버튼에 닿는다.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/map/MapView.css` | margin-right 제거 · short margin-top +0.45rem |
| `apps/web/src/components/ride/NextRideCard.css` | short viewport ctrl gutter (`padding-right`) |
| ops `shots-06d/` · `03-result-06d.md` | 계측·촬영·본 결과 |

## 검증

| 명령 | exit | 결과 |
|---|---|---|
| `cd apps/web && npx tsc -b --noEmit` | 0 | **0** |
| 「다음 주행 카드 자리」(`--grep` 우하단) | 0 | **1 passed** (~40s) |
| `npm run test:e2e:menu-a` | 0 | **1 passed** (~13s) |
| 임시 촬영 spec `_tmp-hud-clock-map-controls-06d` | 0 | **1 passed**. 실행 후 **삭제** |

## 겹침·가장자리 계측

출처: `shots-06d/06d-overlap-metrics.json`  
`card∩ctrl` = `.next-ride__card` ∩ `.mapboxgl-ctrl-top-right` 면적.  
오른쪽 가장자리 판정: `ctrl.x >= viewportWidth - 60`.

| 장면 | ctrl x | ≥ W−60 | cardBody∩ctrl | zoom reachable |
|---|---|---|---|---|
| **690 idle** + 카드 | **666** | **true** | **0** | all true |
| **740 idle** + 카드 | **716** | **true** | **0** | all true |
| **1000 idle** + 카드 | **958** | **true** | **0** | all true |
| **690 주행 중** | **666** | **true** | n/a(카드 없음) | all true |

06-3 대비: 690 idle 에서 ctrl 이 x≈416(중앙) → **x=666(오른쪽)** 으로 복귀. 주행 중에도 동일.

### 잔여 관측 (범위 밖·수정 안 함)

- idle 에서 카드 본체와 **시계** rect 교차 > 0(카드 하단·우하단 시계 대역이 겹침). e2e 가 카드 아래 끝 = RouteDock 아래 끝을 요구해 카드를 위로 올리기 어렵다. 거터 덕분에 시계 오른쪽 끝은 카드 밖으로 보임(캡처).
- RouteDock·미니맵과 카드 교차 = 0.

## 촬영

디렉터리: `document/ops/20261006-hud-clock-map-controls/shots-06d/`

| 그림 | file:/// |
|---|---|
| 690 idle + 다음 주행 | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/shots-06d/690x275-idle-next-ride.png |
| 740 idle + 다음 주행 | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/shots-06d/740x360-idle-next-ride.png |
| 1000 idle + 다음 주행 | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/shots-06d/1000x640-idle-next-ride.png |
| 690 주행 중 | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/shots-06d/690x275-riding.png |
| 계측 JSON | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/shots-06d/06d-overlap-metrics.json |

## 「거리」 체크박스 실패 판정 (수정 안 함)

대상: `ride-summary-compact.spec.ts` 「들어오면 「거리」가 켜져 있다」(~158) 포함 describe `자동 End`.

| 회차 | exit | 관측 |
|---|---|---|
| **1** | 1 | `toBeChecked`(158)는 **통과**. 직후 「거리 ON 이면 방향 안내가 보인다」(161) **실패**(20s). 당시 Functions 가 `lib/index.js` 부재 → 로드 지연 로그와 겹침 |
| **2** | 0 | Functions 정의가 시험 전에 로드된 뒤 **PASS** (~44s) |

**재현성**: 플래키(환경·Functions 콜드스타트). CSS 레이아웃 회귀로 보이지 않음.

**원인 후보** (blame / log, 수정 없음):

| 후보 | 근거 |
|---|---|
| Functions 에뮬레이터 미준비 | 1회차: `functions/lib/index.js does not exist` → 이후 mid-test 로드. 안내 문구·반경 원은 `getDistanceAutoRoute`/가이드 링 경로와 연동 |
| `distanceModeOn: true` 계약 자체 | `rideContinuationSetup.ts:118` — `1f35c4b` (2026-09-04) 부터 고정. 최근 레이아웃 커밋과 무관 |
| e2e 도입 | `3c73e59` (2026-09-18) — 「거리」 OFF 세션 종료 시험. 단언 문구「들어오면 「거리」가 켜져 있다」 |

## 지도 타일

촬영·e2e 는 `stubMapboxStyle` 사용 → 캔버스가 검게 보이는 것은 **토큰/타일 실배송이 아님**. 콘솔에 Mapbox **401 없음**. 기록된 오류는 Functions CORS/`ensureRouteTokenOnboardingHttp` Failed to fetch · Firestore emulator 일시 unavailable(에뮬레이터 기동 직후)뿐.

## Git

커밋·푸시 **하지 않음**. 허용 범위(`MapView.css` · `NextRideCard.css` + ops 결과·`shots-06d/`)만 본 작업 산출.
