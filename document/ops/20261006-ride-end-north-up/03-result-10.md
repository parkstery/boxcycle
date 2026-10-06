# 결과 10 — 주행 종료 시 지도 정북 복귀

- 담당: Developer(Cursor CLI) · 지시: [02-task-10.md](02-task-10.md)
- 시각: 2026-10-06 · 커밋 **안 함**
- RideSummarySheet.* 미터치(지시 09-2 소유)

## 판정

**DEVELOPMENT_DONE** — 종료 시 bearing→0° ease(600ms), 중심·줌 유지, paused 불변. 계측 e2e·단위·tsc 통과. `test:e2e:menu-a` 통과. `test:e2e:u3` 는 **본 변경과 무관**하게 실패(수정 전 코드 동일 실패).

## 흐름 (파일:줄)

```
App.tsx:2824  rideActive = running|paused
     ↓ rideStatus→idle
MapView.tsx:899–929  shouldEaseNorthUpOnRideActiveChange(true→false)
     → holdCameraAfterRideEndRef=true
     → easeMapNorthUpAfterRideEnd (lib/map/rideEndNorthUp.ts:49–75)
rideCameraFollow.ts:481–483  apply3DState(false) 는 pitch→0 만 (bearing 안 넣음)
MapView.tsx:2288–  rAF tick: 비주행·hold 중 tickRideCameraFollow 스킵
MapView.tsx:1728–  fitBounds hold (isSameRouteLine)
MapView.tsx:2477–  mapZoom props hold + App idle 줌 재동기(pushHeldZoom)
```

일시정지: `rideActive` 유지 → `shouldEaseNorthUp…` false → 복귀 없음.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/map/rideEndNorthUp.ts` | 신설 — 판정·ease·`isSameRouteLine` |
| `apps/web/src/components/map/MapView.tsx` | 종료 effect·hold·tick/fitBounds/zoom 가드 |
| `apps/web/src/components/map/rideCameraFollow.ts` | apply3DState 주석( pitch만 ) |
| `apps/web/scripts/ride-end-north-up/north-up-on-end-contract.test.ts` | 단위 계약 |

임시 e2e `_tmp-ride-end-north-up-10.spec.ts` 는 검증 후 **삭제**.

## 검증

| 명령 | 결과 |
|---|---|
| `cd apps/web && npx tsc -b --noEmit` | 0 |
| `node --test scripts/ride-end-north-up/north-up-on-end-contract.test.ts` | 7 pass |
| eslint 변경 파일 | 기존 MapView hooks warning만(증가 0·신규 0) |
| 계측 e2e `--workers=1` (에뮬레이터) | **1 passed** (24.6s) |
| `npm run test:e2e:u3` | **FAIL** — `세션 속도 km/h` 슬라이더 미검출 |
| `npm run test:e2e:u3` (수정 전 MapView/rideCameraFollow) | **동일 FAIL** → **비관련** |
| `npm run test:e2e:menu-a` | **1 passed** (13.4s) |

### 계측 수치표 (`.out/`)

| 항목 | before | after | 기준 | 결과 |
|---|---|---|---|---|
| End bearing | 140° | 0° | ≈0 ±1° | OK |
| End centerMovePx | — | 0 | <1 | OK |
| End zoomDelta | 17.5 | 17.5 (Δ0) | <0.01 | OK |
| Pause bearing Δ | 95° | 95° (Δ0) | ≤1° | OK |

이전 미완 실행(OOM 전)은 bearing만 맞고 center≈220px·zoomΔ≈3.6 이었음 — App idle `setMapZoom`/`followMode=left` 복원·fitBounds 경합. hold·tick 가드·held zoom 재동기으로 해소.

### 촬영 690×275

- `.out/01-before-end-rotated-690x275.png`
- `.out/02-after-end-north-up-690x275.png`
- `.out/end-metrics.json` · `.out/pause-metrics.json`

## 남은 이슈

- `test:e2e:u3` RouteDock 속도 슬라이더 셀렉터 불일치 — 본 묶음 범위 밖(병행 HUD/Dock 작업 가능성). Supervisor/해당 묶음에서 별도 처리.
- 임시 계측 spec 삭제 완료. 재현 필요 시 git 이력·이 결과의 수치표로 대체.
