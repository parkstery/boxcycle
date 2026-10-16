# 지시 M1 — 주행 중 지도 구성 비용 측정 스위치 (`?mapcut=`)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — **OpenCode Muse Spark** |
| 작업 위치 | `C:\20.HDev\boxcycle-mapcut` (브랜치 `perf/map-cut-lab`, 기준 `main2` `9acb5d6`) |
| 결과 파일 | `C:\20.HDev\boxcycle-mapcut\document\ops\20261016-map-cut\03-result-m1.md` |

## 배경 (운영 perflab 실측)

지도 렌더 JS(라이더 제외)가 프레임당 PC 7.3 ms, 폰 10.7 ms 로 가장 큰 덩어리다. 화면 구성을 바꾸는 결정은 Chief 가 하므로, 이번에는 **무엇을 빼면 얼마나 빨라지는지 실기기에서 잴 수 있는 스위치**만 만든다. 기본 화면은 바꾸지 않는다.

알려진 후보(코드에서 확인):
- 지형 `setTerrain({ exaggeration: 1.3 })` — `apps/web/src/components/map/rideCameraFollow.ts` 475–491행
- 3D 건물 `fill-extrusion` 레이어 — 같은 파일 506행 부근
- 스타일 `mapbox://styles/mapbox/navigation-night-v1` 등(`lib/map/rtwMapConfig.ts`) 의 라벨·POI·도로 세부 레이어, 하늘·안개(fog/sky)
- **주행 화면 왼쪽 미니맵**(두 번째 Mapbox 지도 인스턴스가 있는지 확인 — 있다면 매 프레임 지도가 두 번 그려지는지)
- 그 밖에 주행 중 추가되는 소스·레이어(경로 선, 정복 셀, heat/pulse 점 등)

## 할 일

1. **조사**: 주행 중 실제 활성 스타일의 레이어 목록을 종류별로 세고(symbol/line/fill/fill-extrusion/raster/hillshade/sky/custom), 지형·안개·미니맵 여부와 미니맵의 렌더 빈도를 표로 결과에 적는다. 미니맵이 별도 `mapboxgl.Map` 이면 그 `_render` 시간도 perflab `breakdown` 에 `minimap` 항목으로 잰다(perflab 일 때만).
2. **스위치** `?mapcut=a,b,c`(운영 포함, 쿼리 있을 때만 동작, 없으면 기존 그대로): 다음 키를 지원 — `terrain`(지형 끔), `buildings`(3D 건물 끔), `labels`(symbol 레이어 숨김), `poi`(POI 계열 symbol 만 숨김), `sky`(sky/fog 끔), `minimap`(미니맵 렌더 중지 또는 숨김), `roads`(도로 세부·보조 line 레이어 숨김 — 경로·정복 등 앱 레이어는 유지). 레이어 숨김은 `setLayoutProperty(visibility, none)`, 스타일이 다시 로드되면 재적용. 앱 기능 레이어(경로, 라이더, 정복, 출발/도착)는 절대 숨기지 않는다.
3. perflab 패널 상단에 적용된 mapcut 목록 한 줄, 복사 JSON 에 `mapcut` 배열.
4. **헤드리스 비교**(dev 서버 5070, 브라우저 1개, 끝나면 종료): 같은 코스·카메라 2·줌 22 부근에서 `mapcut` 없음 / 각 키 하나씩 / 전부, 각 10 s 의 `map.exRiderMeanMs`·틱·프레임 평균을 표로. 헤드리스는 GPU 가 실기기와 다르므로 **JS 시간 위주**로 해석.

## 검증

PowerShell `apps/web`: tsc, 변경 파일 eslint, **루트 `node scripts/check-dep-direction.mjs --check` 의 "lib 파일 전원 도메인 지정 PASS(미지정 0)"**(새 lib 파일은 `apps/web/dep-layers.json` 등록), `npm run test:quick`(worktree `functions/lib` 부재 3건 외 0), `npm run test:rider-preserve`, `npm run build`. 단위 시험: mapcut 쿼리 파싱(알 수 없는 키 무시), 쿼리 없을 때 아무 레이어도 건드리지 않음.

## 금지

쿼리 없는 화면 변경, 앱 기능 레이어 숨김, 스타일 URL 변경, commit · push · 배포, 백그라운드 잔류.
