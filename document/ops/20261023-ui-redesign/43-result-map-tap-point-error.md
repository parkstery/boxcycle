# 결과 42 — 지도 짧게 탭할 때 `Cannot read properties of undefined (reading 'x')` 오류 수정

## 바꾼 파일

| 파일 | 변경 내용 |
|---|---|
| `apps/web/src/components/map/mapPickEvent.ts` | 신규 생성. `mapMouseEventFromPickCommit` 순수 함수로 분리. `commit.point`(평범한 `{x, y}`)를 `new mapboxgl.Point(x, y)` 인스턴스로 변환해 반환. |
| `apps/web/src/components/map/MapView.tsx` | `mapPickEvent.ts`에서 `mapMouseEventFromPickCommit` import. 기존 인라인 함수(1587–1591행) 제거. |
| `apps/web/scripts/map/map-pick-event.test.ts` | 신규 생성. `mapMouseEventFromPickCommit` 동작 검증 5개 케이스. |

## 2번 탐색 범위와 결과

### `queryRenderedFeatures` 호출부 (2건)

1. `apps/web/src/components/map/mapMarkerElements.ts:164`
   - `map.queryRenderedFeatures(event.point, { layers })` 호출.
   - **수정 전**: `event.point`가 평범한 `{x, y}` 객체 → mapbox-gl 3.23 내부에서 `Point.convert(geometry[0])` 호출 시 `undefined.x` 오류.
   - **수정 후**: `mapMouseEventFromPickCommit`이 `mapboxgl.Point` 인스턴스를 넣어주므로 정상 동작.

2. `apps/web/src/components/map/DebugWorldLightMap.tsx:118`
   - `map.queryRenderedFeatures({ layers: [DEBUG_LAYER_ID] })` — `point` 인자 없음. **문제 없음**.

### `as mapboxgl.MapMouseEvent` 캐스트 (2건, 모두 `MapView.tsx`)

1. `1562행` (`openRoutePickAtRef.current` 내부)
   - `const point = map.project(picked)` → `mapboxgl.Point` 인스턴스 반환. **문제 없음**.

2. `1590행` (기존 인라인 `mapMouseEventFromPickCommit`)
   - `point: commit.point` 평범한 객체 전달. **버그 원인**.
   - **수정됨**: `mapPickEvent.ts`의 함수로 교체해 `new mapboxgl.Point(...)` 생성.

**결론**: 위 2개 외에 평범한 `{x, y}`를 `MapMouseEvent.point`로 넘기는 곳은 **없음**.

## 시험 결과

### 신규 단위 시험 단독 실행
```
✔ mapMouseEventFromPickCommit
  ✔ point가 mapboxgl.Point 인스턴스여야 한다
  ✔ x, y 값이 보존되어야 한다
  ✔ lngLat이 올바르게 변환되어야 한다
  ✔ 음수 좌표도 정상 처리되어야 한다
  ✔ 소수점 좌표도 정상 처리되어야 한다
ℹ tests 5 · pass 5 · fail 0
```

### `npm run test:quick map` (지도 묶음 전체)
```
✓ map    지도·화면 읽기    통과  156  실패   0  (17개 파일, 3.1초)
```

### 정적 검사
| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | 통과 (출력 없음) |
| `npx eslint 변경파일` | 오류 0, 경고 9개(기존 코드 관련, 수정 범위 밖) |
| `node scripts/check-code-tidy.mjs` | 기준선 이내 통과 |
| `node scripts/check-dep-direction.mjs --check` | 방향 위반 0건, 순환 0쌍 — 통과 |

## 못 한 것
- 없음. 지시된 모든 항목(수정·탐색·시험·검증) 완료.
## 감리 (Supervisor Claude Code, 2026-10-24 15:0x KST) — **PASS**

- 원인·수정 일치: `mapMouseEventFromPickCommit` 를 `src/components/map/mapPickEvent.ts` 로 빼고 `point` 를 `new mapboxgl.Point(x, y)` 로. 동작 시험 `scripts/map/map-pick-event.test.ts` 5/5(`instanceof Point`·좌표 보존), `test:quick` 지도 묶음에 자동 포함(16→17 파일).
- Supervisor 정리: import 경로의 `.ts` 확장자 2곳(`MapView.tsx`, `mapPickEvent.ts`)을 주변 관례대로 뺌. tsc PASS, 시험 재실행 5/5.
- 버그는 10-22 `95020c5e` 부터 운영 배포본에 있었다. 이번 배포로 함께 고쳐진다.
