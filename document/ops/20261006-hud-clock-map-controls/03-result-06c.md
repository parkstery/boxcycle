# 결과 06-3 — 「다음 주행」 카드 ↔ Mapbox 줌 + 겹침

- 담당: Developer(Cursor CLI) · 지시: `02-task-06c.md`
- 판정: **DEVELOPMENT_DONE** · 커밋·푸시 없음
- worktree / `git restore` / `git clean`: **미사용**

## 계측으로 확인한 원인

폰 가로(~275px)에서 Mapbox `ctrl-top-right` 열이 화면 오른쪽 끝(다음 주행 카드와 같은 세로 띠)에 남고, 카드 상단이 줌 +/−·지구 버튼과 **면적으로 겹친다**.  
a275e3a 이후 idle TR 에 `[야외 − +]` 가 상시 들어가도 카드 `right` 자체는 같으나, 짧은 높이에서 우측 열이 카드와 공유되면 `elementFromPoint` 이 카드를 친다.

## 택한 해법

**짧은 뷰포트(`max-height: 560px`)에서 Mapbox 우측 컨트롤에 `margin-right` 를 줘 다음 주행 카드 열 왼쪽으로 비킨다.**  
예약 폭 = `NextRideCard` 의 `max-width`(`min(18rem, 100vw - 2rem)`) + pad. Mapbox 기본 컨트롤은 유지(숨김·제거 없음).  
데스크톱(1000×640)은 세로 여유가 있어 `margin-right` 없이 TR+「맵」 아래 `margin-top` 만 44px 행에 맞춤.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/map/MapView.css` | `ctrl-top-right` margin-top 을 TR 44px+「맵」 기준으로 갱신. `max-height:560px` 에서 margin-right 로 다음 주행 열 예약 |
| `apps/web/src/components/ride/NextRideCard.css` | 짧은 뷰포트 breakpoint 를 560px 로 맞춤(MapView 예약과 동기). 주석 |
| `MapHud.tsx` / `MapHud.css` | **미수정**(지시 06 배치 유지) |

## 검증

| 명령 | exit | 결과 |
|---|---|---|
| `cd apps/web && npx tsc -b --noEmit` | 0 | **0** |
| `npx eslint` NextRideCard.tsx · MapHud.tsx | 0 | **0 errors**(증가 0) |
| `npm run test:e2e:ride-summary` | 1 | **「다음 주행 카드 자리」 PASS**. 스위트 전체 3 passed / 2 failed — 실패는 「거리」 체크박스(본 작업 무관)·RouteDock **센서 안내 깜빡임(기존)** |
| `npm run test:e2e:menu-a` | 0 | **1 passed** (~12s) |
| 임시 촬영 spec | 0 | **1 passed**. 실행 후 `e2e/_tmp-hud-clock-map-controls-06c.spec.ts` **삭제** |

## 겹침 계측표 (idle · 다음 주행 카드 있음)

출처: `shots-06c/06c-overlap-metrics.json`  
교차 = rect 면적(px²). Mapbox 버튼 `elementFromPoint` reachable 전부 true.

| 뷰포트 | card rect | TR | 맵 트리거 | Mapbox ctrl | card∩ctrl | card∩TR | card∩맵 | TR∩ctrl | 맵∩ctrl | zoom-in reachable |
|---|---|---|---|---|---|---|---|---|---|---|
| **690×275** | 483,157 197×104 | 527,10 153×44 | 634,58 46×25 | **416,78 24×104** | **0** | **0** | **0** | **0** | **0** | **true** |
| **740×360** | 533,241 197×104 | 577,10 153×44 | 684,58 46×25 | **466,78 24×104** | **0** | **0** | **0** | **0** | **0** | **true** |
| **1000×640** | 759,450 227×131 | 775,14 211×44 | 933,63 53×29 | 958,99 42×148 | **0** | **0** | **0** | **0** | **0** | **true** |

690/740: Mapbox 열이 카드 왼쪽(≈x416/466)으로 이동. 1000: 세로 분리만으로 교차 0(margin-right 미적용).

## 촬영

디렉터리: `document/ops/20261006-hud-clock-map-controls/shots-06c/`

| 그림 | file:/// |
|---|---|
| 690 idle + 다음 주행 | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/shots-06c/690x275-idle-next-ride.png |
| 740 idle + 다음 주행 | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/shots-06c/740x360-idle-next-ride.png |
| 1000 idle + 다음 주행 | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/shots-06c/1000x640-idle-next-ride.png |
| 계측 JSON | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/shots-06c/06c-overlap-metrics.json |

## 범위 밖·환경

1. RouteDock **센서 안내 깜빡임** — 기존 실패(지시·검수 09-2). 본 diff 와 무관.
2. 「거리」 체크박스 e2e 실패 — 본 허용 파일 밖·레이아웃 회귀와 무관해 보임(Functions `lib/index.js` 부재 경고와 함께 관측).
3. worktree 사고로 유실됐던 `apps/web/.env`(Mapbox pk) 는 로컬 형제 트리에서 **복구만** 함(gitignore · 커밋 안 함). 없으면 지도 토큰 없음 화면으로 e2e 불가.

## Git

커밋·푸시 **하지 않음**. 허용 범위(`MapView.css` · `NextRideCard.css` + ops 결과·`shots-06c/`)만 본 작업 산출.
