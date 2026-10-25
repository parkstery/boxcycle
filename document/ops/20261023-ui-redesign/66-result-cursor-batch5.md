# 결과66 — Cursor 묶음5 fixture·시험 (지시65)

2026-10-25 KST · **Cursor CLI** · Codex 제품(`mapPopupElements.ts`, `RoutePickPopup.css`)과 분리.

## 조사 — 기존 popup·거리·route-media 패턴

| 근거 | 재사용 내용 |
|---|---|
| `e2e/route-ride-controls.spec.ts` L85–117 | Vite에서 `mapPopupElements.ts` 동적 import, `buildPickPopup` 직접 호출, `#popup-audit` data-* 카운터, `map-view__pick-popup` + `mapboxgl-popup-content` + `mapboxgl-popup-close-button` / dock 시 `map-view__pick-dock-panel` + `map-view__pick-dock-close` |
| `e2e/distance-direction-attention.spec.ts` L7–15 | 동일 import·`MapView.css` link, `.map-view__pick--awaiting-profile`·수단 강조 |
| `e2e/route-media-controls.spec.ts` L19–41 | 고정13 `Start`·`+WP`·`End`, `주행 시작` disabled/empty·녹색 재생, 3 뷰포트 geometry |
| `MapView.tsx` L1338–1361, L1525–1541 | 출발 핀 있으면 dock(`map-view__pick-dock-layer`→`map-view__pick-dock-panel`+`map-view__pick-dock-close`), 없으면 `map-view__pick-popup` Mapbox popup |
| `mapPopupElements.ts` L55–102, L684–717 | `buildPickPopup` deps·`setInlinePhase(searching/failed)`·탭 `Start·End` / `거리·방향` |
| `distanceAutoRouteMapBridge.ts` L4–18 | fixture mock bridge (`registerDistanceAutoRouteMapBridge`) |
| `routeTokenSpendBridge.ts` L41–50 | `bindRouteTokenUser` + `setSubscribedRouteTokenBalance` 로 token-empty |
| `e2e/ui-redesign-batch4.spec.ts` L9–27 | 3 뷰포트·`BATCHn_EVIDENCE_DIR` 캡처 패턴 |
| `mapPopupElements.ts` L12–13 | 제품 CSS — `MapView.css` + Codex `RoutePickPopup.css` (지시65 승인 후 추가분) |

## 변경 파일 (소유 범위만)

| 파일 | 내용 |
|---|---|
| `apps/web/scripts/ui-redesign-batch5/fixture.html` | 하네스 HTML, `#batch5-fixture` |
| `apps/web/scripts/ui-redesign-batch5/fixture.ts` | 실제 `buildPickPopup`, MapView dock/popup 호스트, bridge·토큰 mock, data-* 콜백 카운터, `console.log('fixture-ready')` |
| `apps/web/e2e/ui-redesign-batch5.spec.ts` | 8 state × 3 뷰포트 경계·글자, 거리±/칩/탭, 고정13·1, 토큰/탐색/실패, 콜백·주행 자동 시작 없음 |
| `document/ops/20261023-ui-redesign/66-result-cursor-batch5.md` | 본 결과 |

## fixture `?state=`

| state | 용도 |
|---|---|
| `location` | Start·End 탭, 출발·도착 확정, dock 닫기 |
| `distance` | 거리·방향 탭, ±·숫자·1/3/5/10/20 칩 |
| `no-start` | floating `map-view__pick-popup`, 출발 핀·닫기 |
| `token-empty` | 잔액 0·수단 비활성 |
| `searching` | `setInlinePhase('searching')` |
| `failed` | `setInlinePhase('failed')` |
| `ready-start` | `getCanStartRide`·녹색 재생·`onStartRide` 카운터 |
| `waypoints-max` | 경유 3개·`+WP` disabled |

`#batch5-fixture` data 속성: `select-point-calls`, `route-profile-calls`, `close-calls`, `start-ride-calls`, `clear-route-calls`, `last-profile`, `last-select-kind`, `fixture-ready`, …

캡처: `BATCH5_EVIDENCE_DIR` 설정 시에만 PNG.

## 검증 (미실행 — 지시65, Codex만 실행)

| 항목 | 상태 |
|---|---|
| `npx playwright test ui-redesign-batch5` | **미실행** |
| dev 서버 / npm | **미실행** |
| 제품·기존 preview/e2e/HANDOFF/PROGRESS | **미수정** |
| 커밋·푸시·배포 | **없음** |

## 다음

Codex: before 캡처(`evidence/instruction65/`)·Playwright·회귀·비교 HTML·결과67.
