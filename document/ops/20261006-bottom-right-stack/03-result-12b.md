# 결과 12-2 — 축척 정확성 복구 · 폰 가로 하단 잘림 · 카메라 hit-test

- 담당: Developer(Cursor CLI) · 지시: `02-task-12b.md`
- 판정: **DEVELOPMENT_DONE** · 커밋·푸시 없음
- worktree / `git restore` / `git clean` / stash / checkout / `.env*`: **미사용·미수정**
- 병행 금지 파일(지시 13: `useRideEndAndPersistence.ts`·`rideEndPersistence.ts`·`rideEndResult.ts`·`rideRecordPolicy.ts`·`RideSummarySheet.*`): **미수정**

## 택한 해법

1. **축척 정확성** (`MapView.tsx` + `MapView.css`): `ScaleControl` 을 `map-ctrl-scale-box`(120×16 고정) wrapper 로 감쌈. `.mapboxgl-ctrl-scale` 의 `width !important` 제거 → Mapbox inline 폭이 줌에 따라 변함(왼쪽 정렬).
2. **하단 잘림** (`MapView.css`): `mapboxgl-ctrl-bottom-right` 의 `margin-bottom: -0.25rem` 제거(실측 overflow ≈ 3.375px = 0.25×13.5). 시계 간격을 유지하려고 `--br-clock-above-scale` 을 `0.55→0.8rem`(tall `0.15→0.4rem`)으로 보정.
3. **카메라 hit-test** (`MapHud.css`, compact `max-width:900 × max-height:560`): QC·줌 `::after` 를 스타일 칩과 같이 **높이만 44px**(가로 이웃 덮지 않음). 06-2 배치·시각 폭 유지.
4. **NextRideCard.css**: 공유 토큰만 쓰므로 파일 본문 변경 없음(카드 bottom 은 `--br-clock-above-scale` 따라감).

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/map/MapView.tsx` | `createFixedScaleBoxControl` — ScaleControl wrapper 만 |
| `apps/web/src/components/map/MapView.css` | 바깥 상자·막대 분리 · margin 0 · clock 토큰 보정 |
| `apps/web/src/components/maphud/MapHud.css` | compact QC/줌 `::after` 높이-only |
| `apps/web/src/components/ride/NextRideCard.css` | 변경 없음(토큰 공유) |
| ops `shots-12b/` · `03-result-12b.md` | 계측·촬영·본 결과 |

## 검증

| 명령 | exit | 결과 |
|---|---|---|
| `cd apps/web && npx tsc -b --noEmit` | 0 | **0** |
| 임시 계측 `_tmp-bottom-right-stack-12b` | 0 | **1 passed** (~18s) · `emulators:exec` · `RTW_DEV_PORT=5012`. 실행 후 **삭제** |
| 「다음 주행 카드 자리」(`ride-summary-compact.spec.ts:459`) | 0 | **1 passed** (배치 런, menu-a 와 함께) |
| `npm run test:e2e:menu-a` 본문(`menu-declutter-a`) | 0 | **1 passed** (동일 배치) |

배치 1회차: 계측만 zoom DOM detach 로 실패했으나 카드 자리·menu-a 는 PASS. 계측은 일시정지+QC evaluate click 으로 재실행 PASS.

## 계측 (출처: `shots-12b/12b-metrics.json`)

### hit-test 690×275 주행(일시정지 직전)

1–6 · 야외(스타일) · − · + → **9/9** `elementFromPoint` = 해당 버튼(또는 자식).

### 주행 중 줌 3단 · 바깥 상자 / 막대

| 뷰포트 | alt Δw/Δh | box Δw/Δh | 막대 폭(3단) | max bottom ≤ ih |
|---|---|---|---|---|
| 690×275 | **0/0** | **0/0** | 89.64 · 97.88 · 97.77 | **275 ≤ 275** |
| 740×360 | **0/0** | **0/0** | 91.33 · 111.06 · 110.86 | **360 ≤ 360** |

### 시계→고도/축척 (일시정지 · 3폭)

| 뷰포트 | clock→scale gap | scale/alt bottom |
|---|---|---|
| 690×275 | **4.45** | 275 / 275 |
| 740×360 | **5.16** | 360 / 360 |
| 1000×640 | **4.00** | 640 / 640 |

카드∩시계·카드→시계 ≥8: 동 배치에서 「다음 주행 카드 자리」 e2e PASS 로 회귀 확인(지시 12 단언 유지).

## 촬영

디렉터리: `document/ops/20261006-bottom-right-stack/shots-12b/`

| 그림 | file:/// |
|---|---|
| 690 주행 줌 | file:///C:/20.HDev/boxcycle/document/ops/20261006-bottom-right-stack/shots-12b/690x275-riding-zoom.png |
| 740 주행 줌 | file:///C:/20.HDev/boxcycle/document/ops/20261006-bottom-right-stack/shots-12b/740x360-riding-zoom.png |
| 690 일시정지 스택 | file:///C:/20.HDev/boxcycle/document/ops/20261006-bottom-right-stack/shots-12b/690x275-riding-paused-stack.png |
| 740 일시정지 스택 | file:///C:/20.HDev/boxcycle/document/ops/20261006-bottom-right-stack/shots-12b/740x360-riding-paused-stack.png |
| 1000 일시정지 스택 | file:///C:/20.HDev/boxcycle/document/ops/20261006-bottom-right-stack/shots-12b/1000x640-riding-paused-stack.png |
| 계측 JSON | file:///C:/20.HDev/boxcycle/document/ops/20261006-bottom-right-stack/shots-12b/12b-metrics.json |

## Git

커밋·푸시 **하지 않음**. 허용 파일 + ops 결과·`shots-12b/` 만 본 작업 산출.
