# 결과 — 줌 실제 동작 재작업

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — Cursor CLI 결과 |
| 작성 | 2026-10-05 |
| 상태 | **DEVELOPMENT_DONE** |
| 지시 | [04-task-zoom-rework.md](04-task-zoom-rework.md) · [03-review-rework.md](03-review-rework.md) |

## 판정

03 검수 이슈(방향·QC2/3·routeFit·터치)만 수정·검증 완료. 커밋·push 없음. 02·기존 타 작업 변경 보존.

## 변경 파일 (이번 재작업)

| 파일 | 내용 |
|---|---|
| `apps/web/src/App.tsx` | −/+ 방향 교정. 거리 모드→`handleRideCameraDistanceFromUserZoom` + 상대배율(×1.25). free/topDown/north/keep→`mapZoomStepRequest`. soft max≥250(aerial200) |
| `apps/web/src/components/map/rideCameraFollow.ts` | productTune 거리는 `spanFloorMode!=='userZoom'`일 때만. pitch/bearing/앵커 유지. camlab 전원 우선 |
| `apps/web/src/components/map/MapView.tsx` | `mapZoomStepRequest`(실측 getZoom±delta). mapZoom props 적용은 suppress 후 deferred(유실 방지) |
| `apps/web/src/components/maphud/MapHud.tsx` | aria/title을 줌 축소·확대로 |
| `apps/web/src/components/maphud/MapHud.css` | 터치 44px=실높이(`min-height:44px`). 가로 `::after` 제거. tr-under 오프셋 44px |

## 동작

| 모드 | − / + | 비고 |
|---|---|---|
| aerial·forward/back/left/right | 거리↑ / 거리↓ → userZoom | QC2/3은 tune 거리 덮어쓰지 않음. QC 재선택 시 preset 복원 |
| free(routeFit)·topDown·north·keep | 실측 zoom −1 / +1 | idle sync와 setMapZoom 경합 회피 위해 step request |
| 스타일 토글 | 유지(Outdoors↔Satellite) | |

## 검증

| 명령 | exit | 결과 |
|---|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` | 0 | 15단계 유효 |
| `npx tsc -b --pretty false` | 0 | 통과 |
| eslint (변경 TS) | 0 | 신규 error 없음(App hooks warning만) |
| `npm run test:ride-camera-framing` | 0 | 89 pass |
| Playwright `.out/verify-zoom-rework.mjs` @5010 workers=1 740×300 | 0 | **pass:true** |

### Playwright 증거

캡처: [.out/after-zoom-rework.png](.out/after-zoom-rework.png) · [.out/metrics-zoom-rework.json](.out/metrics-zoom-rework.json)

| 항목 | 결과 |
|---|---|
| QC2 +/− | zoom 20.70→21.30(+), hold300, →20.99(−). QC 재선택 preset 쪽 복원 |
| QC1 routeFit | 15.69→16.7→15.7 |
| aerial | +/− 방향·버튼 enabled(무효화 없음) |
| 컨트롤 rect | 96.4×44 @ (440, 45.5), 면적 **1.91%** vp |
| 터치 | 실높이 44px(pseudo 아님). zoom 버튼끼리·style/− overlap **없음**. QC/account/맵트리거 visual overlap 없음 |
| hit-test | 중심이 각 버튼 aria에 일치 |

## 근거·한계

- free에서 App `setMapZoom`만 쓰면 idle `onMapZoom` sync가 경합해 무반응이 났다 → 실측 step request로 최소 확장.
- 거리 ±는 시트 STEP(0.5m)이 aerial200에서 무감이라 상대배율 1.25 사용(제스처 상대줌에 맞춤).
- 맵 뷰 시트 슬라이더 의미·QC preset 수치·pitch/bearing/앵커·peer sync **미변경**.

## Git

커밋·push **하지 않음**.
