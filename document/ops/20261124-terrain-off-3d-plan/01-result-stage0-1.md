# 0·1단계 결과 — 실험 분리와 시야 확장

2026-11-24 · Claude Code 직접 구현·측정(위임 없음) · 상태: **Chief 시야 1km 확정, 미커밋·미배포**
승인: Chief 「권장안대로 진행하겠다. 시작해」

## 판정

- 1km 시야는 실제 앱에서 동작한다. 네 코스 모두 먼 건물이 나타난다.
- **1km의 합격 기준(최저 24FPS · p95 41.7ms)은 안정적으로 통과하지 못했다.** 평균은 27~35FPS이며 2단계(라벨·그림자 절감)가 필요하다.
- **2km는 지금 켤 수 없다.** 남산 외에는 평균 24FPS 안팎이거나 미달이다.

## 바꾼 것

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/map/rideViewDistance.ts` (신규) | 원거리 한계 1km, 시야 안의 z14 이하 타일을 z15로 나눔. 주행 중·지형 OFF·피치 60° 이상·줌 15 이상·Mercator·SDK 3.23.1에서만 동작 |
| `apps/web/src/components/map/MapView.tsx` | 시야 확장 연결, 도착 연출 보호, 종료 이동 보호, 실험 스위치 제거 |
| `apps/web/src/components/map/rideCameraFollow.ts` | 실험 카메라 제거, `holdCamera` 추가, 지형과 3D 객체 분리는 유지 |
| `apps/web/src/App.tsx` | 도착 연출을 지형 스위치와 분리 |
| `apps/web/package.json`·`package-lock.json` | mapbox-gl을 3.23.1로 고정(`^` 제거) |
| `apps/web/dep-layers.json`·`apps/web/dev-tools.json` | 새 파일·비교용 주소 스위치 등록 |
| 시험 | `ride-view-distance.test.ts` 신규 11건, 종료·도착 계약 추가 |

지형 실험(`ride3DPreview`·`rideCameraPosePreview`·`rideCameraTolerancePreview`·배율 슬라이더)은 제품 소스에서 뺐다. 분리 전 상태는 `backup\apps-uncommitted-20261124.patch`와 `backup\apps-untracked-20261124.tgz`에 있다. 5218 서버의 이미 빌드된 화면은 건드리지 않았지만, 다시 빌드하거나 `20261119-camera-terrain-follow\tools`의 해당 시험을 돌리려면 사본을 먼저 되살려야 한다. 건물 외관 비교판(`?buildingpreview=1`)은 4단계까지 유지한다.

## 함께 고친 결함 3건

1. **도착 연출이 지형 OFF에서 나오지 않던 조건** — 미커밋 변경의 회귀.
2. **연출 도중 카메라가 상공으로 올라가던 문제** — 지형 ON에서도 재현되는 기존 결함. 경로 전체 보기 맞춤이 연출 중에 실행됐다.
3. **2를 고치자 드러난 종료 이동 취소** — 종료 순간 3D 적용이 다시 실행돼 1km 정북 이동을 취소했다. 종전에는 2가 우연히 가렸다.

수정 뒤 지형 OFF/ON 모두 연출 중 낮은 구도 유지(피치 64°/59°), 종료 후 고도 1,000m·정북·지형 해제를 실제 앱에서 확인했다.

## 실제 앱 FPS

GTX1660 · Edge headless · 1562×754 · 15km/h · 카메라 2(실제 중심 13.5m·고도 1.5m·피치 83.5°) · 10초 · 에뮬레이터 빌드. 라이더·주행선·미니맵·HUD 포함. 값은 평균/최저 1초/p95(ms), 「·」는 회차 구분.

| 코스 | 종전 135m | 1km | 2km |
|---|---|---|---|
| 남산 | 55.1/53/24.7 · 54.7/47/25.3 | 32.0/26/44.4 · 35.4/31/35.9 | 27.0/22/51.5 · 28.8/26/45.9 |
| 파리 | 46.9/40/28.0 · 45.4/39/28.9 | 27.6/13/54.8 · 27.2/17/51.4 | 19.7/12/86.1 · 19.8/12/95.6 |
| 뉴욕 | 43.1/40/30.3 · 42.8/36/30.6 | 31.4/27/42.3 | 25.1/24/51.9 |
| 암스테르담 | 49.7/45/27.8 | 29.3/25/49.1 | 19.8/17/68.6 |

1회차 앞 7건은 제가 전체 시험을 동시에 돌려 오염됐고, 뒤이은 일부 표본도 겹쳤을 수 있다. **위 표는 시험과 겹치지 않은 2·3회차만 썼다.** 뉴욕·암스테르담의 일부 칸은 1회뿐이다. 원자료에는 오염 표본(`-r1`)도 남겼다.

상호·교통 라벨과 그림자를 끈 1km(2회차): 남산 36.4/31/36.9 **통과**, 파리 30.4/24/45.2, 뉴욕 35.0/29/37.4 **통과**, 암스테르담 31.6/28/43.3. 파리·암스테르담은 p95가 조금 모자란다. 단독 지도 시험보다 절감 폭이 작았다.

파리의 최저 13~17FPS는 한 번에 130~156ms 걸리는 순간 때문이다. 원인은 아직 나누지 않았다(2단계에서 확인).

## 검증

- 통과: 전체 `test:quick` 1,659건/실패 0, 그중 map 200건/0. `tsc -b --noEmit` 오류 0. 변경 파일 lint 오류 0(기존 경고 10). 의존 방향·dev-tools·code-tidy·lock 게이트, 진입 셀렉터 21단계.
- 실제 앱: FPS 47표본, 카메라 2→1→2 전환과 주행 종료 후 SDK 기본 복원, 도착 연출 지형 OFF/ON.
- 시험 과정의 실패: 새 effect의 의존성 순서 충돌 1건(수정), 지형 ON 수명주기 시험의 조작 순서 오류 1건(하네스 수정 후 통과).
- 미실행: 스마트폰, 실제 센서, 급회전 연속 영상, 장시간·발열, 동행 다수, 정식 e2e 전체. 개발 서버 5000에서는 새 파일 제공만 확인했다.
- 타일 요청은 0~14건 늘었다. 수신량은 교차 출처 측정 제한이 있어 결론 내지 않는다.
- 관찰만 한 것: 도착 캡처에 축하 라이더가 보이지 않았다(게이트·「완주」 표시는 보임). 한 장면만 보았고 원인은 조사하지 않았다.

## 확인 방법

접속: http://localhost:5000/ 에서 **Ctrl+F5** → 로그인 → 코스 → 주행 시작. 이 서버는 운영 Firebase를 쓰므로 주행 기록이 실제로 저장된다.

- 지금(1km): http://localhost:5000/
- 종전과 비교: http://localhost:5000/?viewdist=0
- 2km: http://localhost:5000/?viewdist=2000

운영과 분리해 다시 재기(Firestore 8080·RTDB 9000 에뮬레이터가 떠 있어야 한다):

```powershell
node "C:\20.HDev\boxcycle\document\ops\20261124-terrain-off-3d-plan\tools\app-fps\run-app-fps.mjs" "C:\20.HDev\boxcycle\document\ops\20261124-terrain-off-3d-plan\tools\app-fps\cases-distance.json"
node "C:\20.HDev\boxcycle\document\ops\20261124-terrain-off-3d-plan\tools\app-fps\run-app-fps.mjs" "C:\20.HDev\boxcycle\document\ops\20261124-terrain-off-3d-plan\tools\app-fps\cases-lifecycle.json"
```

증거: `evidence\app-stage1.png`(네 코스 전후), `evidence\app-stage1-rows.jsonl`, `evidence\app-arrival-terrain-off.png`, `evidence\lifecycle-off.json`, `evidence\lifecycle-on.json`.

## Chief 질문 후속 (같은 날)

- **파리의 순간 멈춤**: 24초 동안 80ms 넘게 걸린 프레임이 1km에서 27개(최대 213ms), 같은 조건 135m에서 0개. 4.4~5.4초와 13.3~15.1초에 몰렸다. 방향이 크게 꺾인 순간은 아니었다(프레임당 0.8° 이하). 대부분 새 지도 타일(`composite` z15·16)이 도착하거나 앱의 주행선·도로망 소스(`boxcycle-conquest-live`·`recent-new`)가 타일 14~31장을 다시 만든 때와 겹치고, 한 번에 최대 143ms의 그리기가 있었다. 도착 타일 수는 1초에 81~187개(135m는 40~92개)였다. 타일 사건이 없는 느린 프레임도 있어 단일 원인으로 확정하지 않는다. 원자료 `evidence\diag-paris-1000.json`·`diag-paris-0.json`. 시야가 늘면서 앱의 주행선 소스까지 더 많은 타일로 나뉘는 점이 2단계의 첫 점검 대상이다.
- **교통 라벨**: Standard의 `showTransitLabels` — 역·정류장, 공항, 페리·케이블카 이름. 도로명·교통량이 아니다.
- **그림자**: 파리·뉴욕 시작 구간의 켬/끔 화면(`evidence\shadow-on-off.png`)에서는 차이를 알아보기 어려웠다. 벽면 명암은 그림자를 꺼도 남는다. 비용은 단독 지도 시험에서 평균 FPS +19~46%였고, 앱에서 그림자만 따로 잰 값은 아직 없다.

## 다음

2단계: 라벨·그림자 절감, 파리의 순간 멈춤 원인 분리. 권장안 ③(주행 중 상호·교통 라벨과 그림자 OFF)을 적용한다.
