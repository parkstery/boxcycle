# 결과 09 — 주행 결과 시트 히어로 정리

- 담당: Developer(Cursor CLI) · 지시: [02-task-09.md](02-task-09.md)
- 커밋: 하지 않음
- 허용 파일만 수정: `apps/web/src/components/ride/RideSummarySheet.tsx` · `.css`

## 변경 요약

1. 진행률 배지(`N% → M%`)를 히어로 **열에서 제거**하고 **헤더 행**(「주행 결과」와 「닫기」 사이)에 배치.
2. 히어로는 **[새 도로 | 확인 중…][주행/전체]** 2칸만. 라벨·값에 `white-space: nowrap` 등으로 한 줄 유지.
3. 보조 줄(시간·평속·칼로리·설정)은 그대로.
4. 헤더 `km` 단위 표기는 **의도된 것** — D1(단위는 제목에 한 번) · 코드 주석(2026-09-17 Chief). 삭제하지 않음.

### 배지 위치 선택 이유

| 후보 | 높이 | 결과 |
|---|---|---|
| 히어로 아래 별도 행 | +약 15px | `scrollHeight` 163 / `clientHeight` 158 → 스크롤(컴팩트 e2e 실패) |
| 히어로 위 별도 행 | 동일 | 같은 비용 |
| **헤더 행(제목↔닫기)** | **+0** | 남는 폭에 nowrap 칩. 컴팩트 e2e 통과 |

지시 후보 「헤더 오른쪽이 비어 있으면」에 가깝게, 「닫기」 왼쪽 여유에 넣었다. 완주·진행률 없음에서는 배지 DOM 자체가 없어 헤더 높이는 종전과 같다.

## 줄 수 계측 (height / line-height)

출처: `shots-09/*/01-incomplete-metrics.json` 등 (뷰포트 690×275 시트 기준).

| 요소 | before (열 배치) | after (헤더 행) |
|---|---|---|
| 거리 `0.12 / 0.18` | h=41.59 / lh=20.79 → **lines≈2** | h=20.8 / lh=20.79 → **lines=1** |
| 진행률 배지 | 히어로 옆 열 · lines≈1.4 | `badgeParent=ride-summary__head` · lines≈1.5(칩 한 줄) |
| 새 도로 라벨/값 | 이 촬영에선 「확인 중…」(positive 미도착) | 동일. nowrap 가드 추가 |
| `title-unit` km | 유지 | 유지 |
| 완주 거리 | — | lines=1 · scrollHeight=clientHeight=158 |
| 새 도로 0(solo) | — | `heroes-main--solo` · 거리 1줄 · 배지 없음 |

## 촬영 (before / after)

루트: `document/ops/20261006-ride-summary-layout/shots-09/`  
시나리오: ① 미완주(진행률) ② 완주 ③ 새 도로 0(DOM으로 conquest 칸 접어 `confirmed_zero` 배치 재현).

| | before | after |
|---|---|---|
| ① 690×275 | [file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/01-incomplete-690x275.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/01-incomplete-690x275.png) · sheet […-sheet.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/01-incomplete-690x275-sheet.png) | [file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/01-incomplete-690x275.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/01-incomplete-690x275.png) · sheet […-sheet.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/01-incomplete-690x275-sheet.png) |
| ① 1000×640 | [file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/01-incomplete-1000x640.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/01-incomplete-1000x640.png) | [file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/01-incomplete-1000x640.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/01-incomplete-1000x640.png) |
| ② 690×275 | [file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/02-complete-690x275.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/02-complete-690x275.png) | [file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/02-complete-690x275.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/02-complete-690x275.png) |
| ② 1000×640 | [file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/02-complete-1000x640.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/02-complete-1000x640.png) | [file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/02-complete-1000x640.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/02-complete-1000x640.png) |
| ③ 690×275 | [file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/03-newroad-zero-690x275.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/03-newroad-zero-690x275.png) | [file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/03-newroad-zero-690x275.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/03-newroad-zero-690x275.png) |
| ③ 1000×640 | [file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/03-newroad-zero-1000x640.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/before/03-newroad-zero-1000x640.png) | [file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/03-newroad-zero-1000x640.png](file:///C:/20.HDev/boxcycle/document/ops/20261006-ride-summary-layout/shots-09/after/03-newroad-zero-1000x640.png) |

메트릭 JSON: 각 stem의 `*-metrics.json` 동봉. 임시 e2e `_tmp-ride-summary-layout-09.spec.ts` 는 촬영 후 삭제.

## 검증

| 항목 | 결과 |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` (apps/web) | **0** |
| `npx eslint src/components/ride/RideSummarySheet.tsx` | **0** (css 는 eslint ignore 경고만, error 0) |
| `ride-summary-compact.spec.ts:625` 컴팩트 시트 | **통과** (스크롤 없음·6줄 이하·CTA/문구 제거) |
| `npm run test:e2e:ride-summary` 전체 | **미통과** — 아래 범위 밖 |

### 전체 e2e 실패 (기대값 완화하지 않음)

같은 파일 `ride-summary-compact.spec.ts` 안의 **다른 describe** 가 실패. RideSummarySheet 변경과 무관·지시 06(MapHud) 병행과 겹친다.

1. **RouteDock 레이아웃** — dock 폭 밴드 등(허용 파일 밖).
2. **다음 주행 카드 자리** — `mapboxgl-ctrl-zoom-in` 이 카드에 가려 hit 실패. 지시 06이 맵 줌 상시 표시를 만지는 중.

시트 컴팩트 단언은 레이아웃을 계측하지만, 이번 변경에 맞추려면 **기대값을 느슨히 할 필요는 없었다**(통과). 실패 2건은 MapHud/RouteDock 쪽 검수·지시 06 완료 후 재실행이 맞다.

## 범위 밖 발견

- 지시 06 병행: `MapHud.*` / `App.tsx` 미수정. 포트 8080 점유 대기는 지시대로 1분 간격 폴링 후 e2e 실행.
- 미완주 시트에서 칼로리 미산정 시 「체중·강도 설정」 `min-height: 44px` 때문에 시트 `scrollHeight > clientHeight` 가 남을 수 있음(이번에 헤더 배지로 고친 스크롤과는 별축). 기존 보조 줄 계약.
- 에뮬레이터에서 conquest CF 가 늦어 「새 도로 +N」 대신 「확인 중…」이 찍히는 경우가 많음. ③은 DOM으로 solo 배치를 강제해 촬영.

## 상태

- 구현·시트 계측·컴팩트 시트 e2e: **완료**
- `test:e2e:ride-summary` 스위트 전체 그린: **BLOCKED by 범위 밖(지시 06 HUD/줌)** — Supervisor 재실행 또는 06 병합 후 확인 권장
- 커밋: 금지 준수
