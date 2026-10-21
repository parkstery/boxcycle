# 결과11 — 경로 생성 팝업 3항목 압축

2026-10-21. 지시 [02-task-11.md](02-task-11.md). 구현 Cursor (Composer). Git·배포·허용 4파일 외 수정 없음(본 결과 문서만 추가).

## 제품 변경 요약

1. **「경로 생성」 버튼 제거** — 출발·도착 탭에서 출발·도착이 모두 준비되면 이동수단(자동차/자전거/보행) 클릭마다 `onRouteProfile(profile)` 1회, `tokenFeedback.setRoutePending(true)`, `getRouteTokenInsufficient` 시 차단·비활성. 미완성 핀·거리·방향 탭·도착 핀만 있는 수동 생성 없음 동작 유지.
2. **경로 삭제** — header에서 제거, 하단 `profileBottomRow`에서 수단 3개 오른쪽. 출발 전에도 `onClearRoute` 제공 시 삭제만 노출(`rowProfile`만 hidden). 콜백·원 정리·닫기 유지.
3. **탭** — `headerRow`에서 제목(token)과 같은 줄 오른쪽(compact 21px/0.65rem). 닫기 예약 padding 유지, 긴 토큰 문구 줄바꿈.

## 변경 파일 (허용 4 + 결과)

| 파일 | 역할 |
|------|------|
| `apps/web/src/components/map/mapPopupElements.ts` | DOM·콜백 동작 |
| `apps/web/src/components/map/MapView.css` | header·탭·삭제·create-route 제거 |
| `apps/web/scripts/distance-auto-route/distance-auto-route-contract.test.ts` | 지시11 계약 |
| `apps/web/e2e/route-ride-controls.spec.ts` | fixture `onClearRoute`·즉시생성·토큰·레이아웃 |
| `document/ops/20261020-ui-800x360/03-result-11.md` | 본 문서 |

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

| 명령 | exit | 결과 |
|------|------|------|
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/distance-auto-route/distance-auto-route-contract.test.ts` | 0 | **PASS** 52/52 |
| `npx eslint src/components/map/mapPopupElements.ts e2e/route-ride-controls.spec.ts` | 0 | **PASS** (MapView.css는 eslint ignore 경고만) |
| `npx tsc -p tsconfig.json --noEmit` | 0 | **PASS** |
| `npx playwright test e2e/route-ride-controls.spec.ts` | 0 | **PASS** 7/7 (~24.7s) |

브라우저 실지도·Hosting 배포: **미실행** (Supervisor fixture 정책).

## e2e 증거

- 캡처: `C:\20.HDev\boxcycle\.out\ui-route-ride-20261021\popup-{empty,ready,waypoints}-800.png` (기존 evidence 폴더 재사용).
- 검증 항목: 생성 버튼 0, 거리 탭에서 수단 클릭 시 `data-generated` 0, 출발·도착 탭에서 보행/자동차 각 1회 생성, 토큰 차단 시 증가 없음, 삭제 1회, title·tabs 같은 줄·header에 삭제 없음·하단 삭제가 수단 오른쪽.

## Chief 로컬 확인 (선택)

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npx playwright test e2e/route-ride-controls.spec.ts
```

800×360 preview에서 지도 지점 팝업: 제목 줄 오른쪽 탭, 하단 수단+삭제, 출발·도착 후 수단 탭으로 경로 요청.
