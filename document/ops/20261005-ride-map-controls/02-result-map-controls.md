# 결과 — 주행 카메라 아래 맵 제어

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — Cursor CLI 결과 |
| 작성 | 2026-10-05 |
| 상태 | **DEVELOPMENT_DONE** |
| 지시 | [01-task-map-controls.md](01-task-map-controls.md) |

## 판정

지정 범위 구현·검증 완료. 커밋·push 없음. 다른 워크스페이스 변경은 건드리지 않음.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/maphud/MapHud.tsx` | QC 스택 아래 `맵 제어` 보조 행(스타일 토글·거리 ±). QC 있을 때만 렌더. pointer/touch 전파 차단 |
| `apps/web/src/components/maphud/MapHud.css` | 스택·보조 행 스타일. 터치 44px는 `::after`(D2). `tr-under--with-ride-controls`로 「맵」 트리거 내림 |
| `apps/web/src/App.tsx` | `quickCamera.mapControls` 배선. 스타일=Outdoors↔Satellite, ±=`handleRideCameraDistancePreset` + 기존 MIN/MAX/STEP |
| `apps/web/src/lib/map/rtwMapConfig.ts` | `nextOutdoorsSatelliteMapStyle` · `mapStyleHudShortLabel` · Outdoors/Satellite URL 상수 |

맵 뷰 시트·entry-contract·카메라 알고리즘은 변경하지 않음.

## 동작 (모드별)

주행 중(`running`/`paused`)에만 QC와 함께 표시. 기존 맵 뷰 시트의 **rideActive → 거리** 분기와 동일하게 ±는 `rideCameraDistanceM`을 조정한다(새 zoom 체계 없음).

| 모드 | ± 의미 | 비고 |
|---|---|---|
| aerial / forward·backward·left·right (QC1 aerial·QC4~6) | `rideCameraDistanceM` → follow framing | 시트 거리 슬라이더와 동일 |
| QC2·QC3 | product tune이 매 프레임 `distanceM` 덮어씀 | **기존 시트도 동일** — 상태값은 바뀌나 화면 거리는 튜닝값이 유지. 새 설계로 풀지 않음 |
| topDown / north / keep | `distanceM=0`, 줌은 `mapZoom` | 시트도 rideActive면 거리를 보여 줌을 안 건드림 — 동일 한계 |
| routeFit (QC1, follow=`free`) | fitBounds 1회 후 free | 거리 ±는 상태에만 반영, free tick이 프레이밍을 안 잡음 |

스타일 토글: Outdoors↔Satellite. 현재가 RTW Dark(또는 그 외)면 첫 클릭 → Outdoors. 시트 목록의 Dark는 유지. 표시/aria: 현재 짧은 라벨 + 다음 동작(`맵 스타일 야외, 클릭 시 위성`).

## 검증

| 명령 | exit | 결과 |
|---|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` (apps/web) | 0 | 15단계 전부 유효. 앵커 변경 없음 |
| `npx tsc -b --pretty false` | 0 | 타입 오류 없음 |
| `npx eslint` (변경 TS/TSX) | 0 | 신규 오류 없음(App 기존 hooks warning만) |
| `npm run test:ride-camera-framing` | 0 | 89 pass / 0 fail |
| style helper 왕복(node import) | 0 | Out↔Sat, Dark→Out PASS |
| Playwright @ `127.0.0.1:5010` (기존 서버 재사용, workers=1, 740×300) | 0 | 게스트→입문→주행→컨트롤 표시·토글 왕복·± 클릭 |

### Playwright 증거 (740×300)

캡처: [.out/after-ride-controls.png](.out/after-ride-controls.png) · [.out/after-toggle-zoom.png](.out/after-toggle-zoom.png) · [.out/metrics.json](.out/metrics.json)

| 항목 | 전(추정) | 후(측정) |
|---|---|---|
| QC/컨트롤 영역 | QC 행만 ≈177×27 (~2.1% vp, 높이 기준) | 컨트롤 행 96.4×27.3 @ (440, 41) — 면적 비율 **1.19%** |
| 스타일 버튼 | — | 36.3×27.3, 내용 대비 폭 ≈2.27 |
| 터치 44px | — | 시각 높이 27px + `::after` 세로 확장(D2). ±는 양축 `::after` |
| overlap | — | account / 「맵」 트리거 / QC **겹침 없음** |
| 토글 | — | 야외→위성→야외 roundTrip **true** |

Dark→Outdoors 브라우저 2차 시도는 센서 칩 타임아웃으로 미완. helper 단위 검사로 Dark→Outdoors는 PASS. 경계 disabled는 시트와 동일 클램프(`<=MIN` / `>=MAX`)로 배선.

`test:e2e:ride` / Firebase emulator 풀 진입 e2e는 미실행(기존 5010 live 서버로 동일 시퀀스 검증함). auth bypass 신설 없음.

## 한계·대안 (설계 변경 안 함)

1. **QC2·QC3 product tune 덮어쓰기** — 거리 UI가 상태를 바꿔도 매 프레임 튜닝 거리로 복귀. 대안: tune 적용 시 user distance 우선, 또는 QC2/3에서 ± disabled. Chief/카메라 의미 변경이라 이번 범위 밖.
2. **topDown·routeFit에서 거리 ± 체감 약함** — 시트가 rideActive일 때 이미 거리만 노출하는 것과 동일. 대안: followMode별 mapZoom/거리 분기(시트와 HUD 동시 공통화) — 새 체계라 보류.

## Git

커밋·push·merge·배포 **하지 않음**. 본 작업 파일만 수정.
