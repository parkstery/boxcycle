# 지도 길게 누르기·오터치 차단 구현 결과

| 항목 | 내용 |
|---|---|
| 문서 유형 | result |
| 작성 | 2026-10-22 |
| 담당 | Cursor AI (Composer) |
| 지시 | [02-task-17.md](02-task-17.md) |
| Git/배포 | **미실행** (지시 준수) |

## 요약

지도 **짧은 탭/클릭**으로는 임시 마커·경로창이 열리지 않고, **canvas에서 약 500ms 정지 롱프레스** 시 기존 `showTemporaryPick` + `openPickSurface` 경로가 **1회**만 실행된다. **거리·방향 armed(`autoRouteMapPick === "direction"`)** 상태에서는 **정지 짧은 탭 1회**로 기존 `onAutoRouteMapPick` 흐름을 유지한다. 짧은 탭만 했을 때는 하단 **「지도를 길게 눌러 위치 선택」** 힌트를 잠깐 표시한다.

## 변경 파일 (허용 범위)

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/map/mapRoutePickGesture.ts` | 신규 — 롱프레스·이동 허용·suppress·UI pointer 누수·cleanup |
| `apps/web/src/components/map/MapView.tsx` | `map.on("click")` 제거, 제스처 부착, direction/롱프레스/활동 pin 분기 |
| `apps/web/src/components/map/MapView.css` | `.map-view__route-pick-hint` |
| `apps/web/scripts/map/map-route-pick-gesture.test.ts` | 순수 로직 + 모의 DOM 부착 하네스 + MapView 계약 |
| `apps/web/e2e/map-route-pick-gesture.spec.ts` | LIVE 에뮬레이터 전용 e2e (기본 skip) |

## 동작 메모

- 롱프레스 **500ms**, 이동 허용 **10 CSS px**, 사용자 pan/zoom 직후 **300ms** pick 억제 (`dragstart`/`zoomstart` + `originalEvent`만 — `map.isMoving` 미사용).
- **멀티터치** 비 primary down 시 세션 취소, **pointercancel**·**resize**·**visibility hidden** 시 타이머 해제.
- **canvas** `classList`에 `mapboxgl-canvas`인 target에서만 시작; **popup/dock 열림** 시 롱프레스 차단.
- **document capture**로 canvas 밖에서 시작한 `pointerId`는 pick에 사용하지 않음.
- `openRoutePickAtRef`·도크 드래그·검색 busy·`onAutoRouteMapPick`·활동 pin 단축 탭 경로 보존.

## e2e·계약 영향

| 항목 | 내용 |
|---|---|
| `e2e/route-pick-popup-title.spec.ts` | `map.click` 한 번으로 팝업을 열던 계약 → **롱프레스 또는 direction armed** 필요. Supervisor/후속에서 시나리오 갱신 필요. |
| `e2e/map-route-pick-gesture.spec.ts` | 신규. `RIDE_VERIFY_LIVE=1` + 에뮬레이터에서만 실행. |

## 검증

실행 위치: `C:\20.HDev\boxcycle\apps\web`

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --test scripts/map/map-route-pick-gesture.test.ts
npx tsc -b --pretty false
```

| 명령 | exit | 결과 |
|---|---|---|
| `node --experimental-strip-types --test scripts/map/map-route-pick-gesture.test.ts` | 0 | **PASS** — 10 tests (순수 2, 부착 하네스 7, MapView 계약 1) |
| `npx tsc -b --pretty false` | 0 | **PASS** |
| `playwright test map-route-pick-gesture` (에뮬레이터·`RIDE_VERIFY_LIVE=1`) | — | **미실행** (로컬 에뮬레이터 미기동) |
| `npm run test:e2e:pick-title` | — | **미실행** — 클릭→팝업 계약 변경으로 후속 갱신 필요 |

## Chief 수동 확인 (권장)

```powershell
Set-Location C:\20.HDev\boxcycle
npm run dev:localhost
```

http://127.0.0.1:5000 — 뷰포트 800×360, 강력 새로고침 후:

1. 지도 **짧은 탭** → 팝업 없음, 힌트 문구 잠깐 표시.
2. 지도 **500ms 이상 길게 누르기** → 임시 마커 + 경로 생성 UI 1회.
3. 팝업/도크 열린 상태에서 지도 롱프레스 → 열리지 않음.
4. 거리·방향 armed 후 **짧은 탭** → 방향 경로 탐색(기존과 동일).
5. 팬/줌 직후 즉시 롱프레스 → 억제(약 300ms 후 재시도).
