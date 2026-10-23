# 맵 뷰 다이어트 — 결과 (2026-10-23)

## 지운 항목

### 함수·상수 (`rtwMapConfig.ts`)

- `RTW_MAP_STYLE_URL`
- `resetRtwStyleSnapshot`
- `applyRtwLayerStyle` 및 Dark 전용 POI/건물/도로 스냅샷·레이어 처리 전부

### 컴포넌트·훅

- `MapView.tsx`: RTW Dark `useEffect`, `showRtwPoi` prop, `resetRtwStyleSnapshot` 호출
- `useAppMapCameraState.ts`: `showRtwPoi` / `setShowRtwPoi` 상태
- `App.tsx`: `showRtwPoi` 전달, `MapViewSheet`에 넘기던 스타일·시점·줌·POI prop

### `MapViewSheet` prop (시트 UI)

- `mapStyle`, `mapStyleOptions`, `onMapStyle` — 지도 스타일 칩 3개
- `followMode`, `onFollowMode` — 시점 줄 전체
- `mapZoom`, `onMapZoom` — 줌 줄 전체
- `showRtwPoi`, `onShowRtwPoi` — 고급 설정 「장소 이름」 체크박스

### 시트 UI 블록

- 「지도」 줄: Spinatlas Dark / 야외 / 위성 칩 (3D 뷰만 유지)
- 「시점」 줄
- 「줌」 줄 (비주행)
- 「장소 이름」 체크박스

## 추가·유지

- `normalizeMapStyle()` — 레거시 Dark URL·미지원 스타일 → `DEFAULT_MAP_STYLE`(Outdoors)
- `MAP_STYLE_OPTIONS` — Outdoors·Satellite 2종, `MAP_STYLE_OUTDOORS` / `MAP_STYLE_SATELLITE` 명명 상수
- `resolveCamera1ExitMapStyle` — 복원 시 `normalizeMapStyle` 적용

## 고친 시험·하네스

| 파일 | 변경 |
|------|------|
| `apps/web/scripts/ui-800x360/preview.tsx` | `MapViewSheet` 새 prop 계약 |
| `apps/web/scripts/conquest/recent-road-display-dom.test.mjs` | 동일 |
| `apps/web/e2e/peer-sync-s1.spec.ts` | `setFollowFree` → 퀵 카메라 2→1 (routeFit/free) |
| `apps/web/e2e/peer-sync-s3av.spec.ts` | 동일 |
| `apps/web/e2e/peer-sync-s3b3.spec.ts` | 줌 슬라이더 → `__RTW_MAP__.setZoom` |
| `apps/web/e2e/peer-sync-s41.spec.ts` | 동일 |
| `apps/web/scripts/map/ride-label-names-headless.mjs` | 스타일 3종 → 2종 (night 제거) |

`ui-800x360.spec.ts` 맵 시트 관련 검사(높이 ≤210, `free`/`OSRM` 비노출)는 수정 없이 통과.

## 저장된 Dark 값

- **맵 스타일은 localStorage/sessionStorage에 저장하지 않음** (grep·`appSessionKeys` 확인).
- 방어: `normalizeMapStyle`이 `navigation-night-v1`·`dark-v11` 및 그 외 비(Outdoors/Satellite) URL을 Outdoors로 정규화. Quick Camera 1 이탈 시 `resolveCamera1ExitMapStyle`에서 적용.

## 검증 (실행 위치: `C:\20.HDev\boxcycle\apps\web`)

| 항목 | 결과 |
|------|------|
| `npx tsc -b --noEmit` | 통과 |
| `npx eslint` (변경 파일) | 0 error (기존 warning만) |
| `npm run test:quick` | **1347 통과 / 0 실패** |
| `node ../../scripts/check-code-tidy.mjs` | 기준선 이내 — knip exports **186**, duplicates **7** (작업 중 `MAP_STYLE_OUTDOORS` export 시 187로 일시 상승했으나 non-export로 복구) |
| `RTW_DEV_PORT=5016 npx playwright test ui-800x360 --workers=1 --retries=0` | **12 통과 / 1 실패** — 실패만 `ui-800x360.spec.ts:84` 「시작·센서·접기…」(ride-control-bar 높이 44>36, 지시서에 명시된 기존 실패) |

### 캡처

- `C:\20.HDev\boxcycle\.out\mapview-diet-after.png` — preview `?state=map` (800×360)

## Git

- 커밋·푸시 없음 (지시 준수)

## 감리 (2026-10-23)

- **판정: 통과 — 감리 수정 2건 포함.**
  1. `camera1Mode.ts` 의 `normalizeMapStyle` import 가 의존 방향 게이트를 깼다(0 → 1). 맵 스타일은 어디에도 저장되지 않아(보고서 확인) 카메라 복원 경로에 Dark 가 들어올 수 없다 → 파일 원복.
  2. 쓰는 곳이 없어진 `MAP_STYLE_OPTIONS` export 가 knip exports 를 185 → 186 으로 올렸다 → 삭제, `normalizeMapStyle` 은 모듈 안으로.
- 감리 재검: tsc 0 · test:quick 1347/0 · code-tidy 기준선 이내(exports 185) · dep-direction 통과 · ui-800x360 12 통과 + 기존 `:84` 1 실패.
- 캡처: `.out/mapview-diet-after.png` — 내 도로망 · 3D 뷰 · 고급 설정만 남음.
