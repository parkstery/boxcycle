# 결과 06-2 — 폰 가로 주행 중 TR 줄·계기판 겹침

- 담당: Developer(Cursor CLI) · 지시: `02-task-06b.md`
- 판정: **DEVELOPMENT_DONE** · 커밋·푸시 없음
- 지시 09(RideSummarySheet) 파일: **미수정**

## 택한 해법

**a — 좁은 폭에서 시각 폭만 축소 (한 줄 유지).**  
`@media (max-width: 900px) and (max-height: 560px)` 에서 QC·맵 제어·계정 칩의 gap·패딩·글자·버튼 min-width 를 줄였다.  
터치 44px 는 `.hud-quick-camera__btn` / `.hud-ride-map-controls__*` 의 `::after` 로 유지.  
**b(맵 제어 둘째 줄)는 사용하지 않음** — a 만으로 4폭 모두 교차 0.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/maphud/MapHud.css` | 좁은 폭 compact 규칙 + QC/맵 제어 `::after` 터치 확장 |
| `apps/web/src/components/maphud/MapHud.tsx` | **미수정**(지시 06 배선 유지) |

계기판(`.hud-metrics*`) CSS/마크업: **읽기만, 미수정**.

## 검증

| 명령 | exit | 결과 |
|---|---|---|
| `cd apps/web && npx tsc -b --noEmit` | 0 | **0** |
| `npx eslint src/components/maphud/MapHud.tsx` | 0 | **0 errors** (증가 0) |
| `npm run test:e2e:menu-a` | 0 | **1 passed** (~17s). 8080 LISTENING 해제 대기 후 실행 |
| 임시 촬영 spec | 0 | **1 passed**. 실행 후 `e2e/_tmp-hud-clock-map-controls-06b.spec.ts` **삭제** |

## 계측표 (주행 중 · 교차 px)

출처: `document/ops/20261006-hud-clock-map-controls/.out/06b-overlap-metrics.json`  
교차 = TR 컨테이너 rect ∩ 각 `.hud-metrics__cell` rect. 전부 **0**.

| 뷰포트 | TR rect (x,y,w×h) | 새 도로 cell right | gapX (새 도로↔TR) | 교차 px | 배치 |
|---|---|---|---|---|---|
| **690×275** | 392.4, 9.7, **288×44** | 347.5 | **44.9** | **0** | 한 줄 `[1–6][야외 − +][계정]` |
| **740×360** | 441.7, 10.4, **288×44** | 348.2 | **93.5** | **0** | 한 줄 |
| **844×390** | 544.6, 11.5, **288×44** | 349.8 | **194.8** | **0** | 한 줄 |
| **1000×640** | 529.8, 13.6, **457×44** | 418.4 | **111.4** | **0** | 한 줄(데스크톱 크기, compact 미적용) |

참고(지시 06 이전 실패): 690 riding TR 이 **363×44 @ x=317** 이라 새 도로(≈347)를 덮음. 이번 TR 폭 **288**(−75px), left **392**.

690 idle TR: 153×44 @ x=527 (QC 없음 · `[야외 − +][계정]`).

## 촬영

디렉터리: `document/ops/20261006-hud-clock-map-controls/.out/`

| 그림 | file:/// |
|---|---|
| 690 idle | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/690x275-idle.png |
| 690 riding | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/690x275-riding.png |
| 740 riding | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/740x360-riding.png |
| 844 riding | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/844x390-riding.png |
| 1000 riding | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/1000x640-riding.png |
| 계측 JSON | file:///C:/20.HDev/boxcycle/document/ops/20261006-hud-clock-map-controls/.out/06b-overlap-metrics.json |

## Git

커밋·푸시 **하지 않음**. 허용 범위(`MapHud.css` + ops 결과·`.out`)만 본 작업 산출. `MapHud.tsx`/`App.tsx` 의 지시 06 미커밋 변경은 그대로 둠(되돌리기·stash 금지).
