# 거리 안내 원 방사 화살표 결과

2026-10-22 · record · [지시21](02-task-21.md).

## 변경

- `distanceAutoRoute.ts`: `inferCircleLineMetrics`, `buildCircleRadialArrowFeatureCollection`, `buildCircleRadialArrowsFromLineString` — 12개(30°), MultiLineString(몸통+날개×2), 반경 비율로 길이 제한.
- `MapView.tsx`: 참고 원과 동일 조건으로 `distance-target-circle-arrows` source·line/casing layer 추가, 원 제거 시 함께 제거, `style.load`/`idle` 재적용. `fitBounds`·원 GeoJSON API는 기존과 동일.

## 검증

| 명령 | cwd | exit | 결과 |
|---|---|---:|---|
| `npm run test:distance-auto-route` | `C:\20.HDev\boxcycle\apps\web` | 0 | PASS 143/143 |
| `npx eslint src/components/map/MapView.tsx src/lib/route/distanceAutoRoute.ts` | `C:\20.HDev\boxcycle\apps\web` | 0 | PASS (기존 MapView warning 8, error 0) |
| `npx tsc -p tsconfig.json --noEmit` | `C:\20.HDev\boxcycle\apps\web` | 0 | PASS |
| dev 서버·브라우저 시각 확인 | — | — | 미실행 (지시: 상시 dev 금지) |

Git/배포 없음. 범위 외 dirty·evidence 보존.
