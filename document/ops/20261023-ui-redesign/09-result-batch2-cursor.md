# 묶음 2 구현 결과 — Cursor

| 항목 | 값 |
|---|---|
| 상태 | **구현 완료(로컬 게이트)** |
| 지시 | [08-task-batch2.md](08-task-batch2.md) |
| 시안 | [04-Main](mockups/04-Main.png) · [08-Riding](mockups/08-Riding.png) · [09-Paused](mockups/09-Paused.png) |
| git | 조작 없음(지시) |

## 체크리스트

- [x] 대기 HUD: 경로 km · 고도 시작→끝 (`rideElevationProfile` → `computeAppHudValues`)
- [x] `CameraViewMenu`: 6→1 드롭다운, `onSelect`·ESC·바깥 클릭·`menuitemradio`·`카메라 N · …` aria
- [x] `RideControlBar`: 시작 44px 파랑 / 주행 pause 56·stop 44 / 일시정지 3버튼 직접 노출 (`재개` aria 유지)
- [x] 코칭 HUD 한국어 — 소스 `phraseManifest.ts`·`aiCoach.ts` (TTS 영문 유지), 표시 `coachingDisplayKo.ts` + `tipId`
- [x] `RouteDock` 250px 흰 카드·출발/경유/도착·교환·센서 칩(ready/setup)
- [x] `preview.tsx` props 동기화
- [x] tsc / eslint(변경) / selector 19

## 변경 요약

| 영역 | 내용 |
|---|---|
| 대기 지표 | `route-preview` 에서 시간/평균/속도 제거, 경로 km + 고도(로딩/오류/없음 상태 문구) |
| 주행 지표 | 일시정지 시 속도 숨김, riding + 실제 `crankRpm` 일 때만 케이던스 칼럼 |
| 카메라 | `CameraViewMenu.tsx` — 주행 중 우상단, 맵 스타일/줌은 대기만(맵 뷰 시트 접근 유지) |
| 주행 조작 | 파랑 「주행 시작」 / pause 56 / stop 흰 44 / paused 「경로 바꾸기」「주행 끝내기」「다시 달리기」 |
| RouteDock | 주행·일시정지 시 숨김(미니맵), ready 에 센서·주소 카드 |
| 센서 슬롯 | `route-dock` \| `ride-control-bar` \| `none` (주행 중 HUD rpm만) |

## 변경 파일

| 파일 | 요약 |
|---|---|
| `apps/web/src/components/maphud/MapHud.tsx` · `.css` | 지표 분기·코칭 KO·paused 배너·카메라 메뉴·compact 계정 |
| `apps/web/src/components/maphud/CameraViewMenu.tsx` · `.css` | 신규 |
| `apps/web/src/components/ride/RideControlBar.tsx` · `.css` | 시안 조작 바 |
| `apps/web/src/components/ride/RideMediaButton.css` | pause 56·stop neutral |
| `apps/web/src/components/route-dock/RouteDock.tsx` · `.css` | 시안 카드·센서 |
| `apps/web/src/app/appHudValues.ts` | route-preview + 고도 wiring |
| `apps/web/src/lib/coach/coachingDisplayKo.ts` | HUD 표시 문구 32개 |
| `apps/web/src/lib/camera/quickCameraMenuLabels.ts` | 메뉴 라벨 |
| `apps/web/src/lib/route/sensorChipSlot.ts` | 3슬롯 |
| `apps/web/src/App.tsx` | elevation·cadenceRpm·dock cadence |
| `apps/web/scripts/ui-800x360/preview.tsx` | 프리뷰 props |
| `apps/web/scripts/ride-verify/entry-contract.mjs` | 시작/재개·센서 슬롯 앵커 |
| `apps/web/scripts/ride-hierarchy/sensor-chip-slot-contract.test.ts` | 슬롯 계약 갱신 |

**미수정:** 묶음1 제품·Supervisor 로그인/e2e·git·서버/에뮬레이터.

## 검증 (Cursor)

작업 폴더: `C:\20.HDev\boxcycle\apps\web`

```powershell
cd C:\20.HDev\boxcycle\apps\web
npx tsc -b --noEmit
npx eslint src/components/maphud/MapHud.tsx src/components/maphud/CameraViewMenu.tsx src/components/ride/RideControlBar.tsx src/components/route-dock/RouteDock.tsx src/app/appHudValues.ts src/lib/route/sensorChipSlot.ts src/lib/coach/coachingDisplayKo.ts src/lib/camera/quickCameraMenuLabels.ts scripts/ui-800x360/preview.tsx
node scripts/ride-verify/verify-selectors.mjs
```

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | **PASS** |
| eslint (위 TS/TSX) | **PASS** |
| `verify-selectors.mjs` | **PASS** 19단계 |

**미실행(Supervisor):** ui-800x360 Playwright·실앱 e2e·캡처·comparison-batch2·`ui-800x360` bar 높이 검사 갱신·headless 카메라 겹침 스크립트.

## Chief 확인 (프리뷰)

묶음1과 동일 하네스 포트(서버 기동은 Supervisor 소유 — 이미 5020 이 있으면 생략):

```powershell
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
npm run dev:localhost -- --mode harness
```

브라우저: `http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=ready-to-start` (대기) · `?state=riding` · `?state=paused`

## 메모

- `+ 경유지` 는 지도 팝업(`mapPopupElements.ts`)이 유일한 추가 경로 — 도크 버튼은 이번에 넣지 않음(새 pick 모드 API 없음).
- 코칭 예시 시안 문구(「힘을 빼고 리듬을 찾으세요」)는 `tip_26` 한국어 매핑과 동일 계열.
