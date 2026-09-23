# 지시01 수행결과 — 첫 화면 Recognition (지역 선택 · 현재 위치 · 카메라)

- **상태**: 수행 완료 / 감리 판정 대기
- **워크트리**: `C:\20.HDev\boxcycle`
- **브랜치**: `main2`
- **dev URL**: `http://127.0.0.1:5000/` (`npm run dev`)
- **커밋·푸시**: 하지 않음 (묶음 금지)

---

## 1. 한 줄

첫 화면 좌하단에 `LocalFirstEntryCard` 를 붙였다. `[지역 선택]`→기존 지명 검색, `[현재 위치]`→클릭 시에만 geolocation, 확정 시 `setExternalCameraJump` zoom **13**. 입문 경로 CTA 는 「또는 입문 경로로 시작」으로 병존.

## 2. 변경 파일

| 파일 | 역할 |
|---|---|
| `apps/web/src/components/ride/LocalFirstEntryCard.tsx` + `.css` | **신규** S0/S1/S2 카드 |
| `apps/web/src/lib/localFirstRegion.ts` | localStorage `rtw.localFirst.region` · 지명 축약 · zoom=13 |
| `apps/web/src/lib/localFirstGeoProbe.ts` | `getCurrentPosition` 호출 계수 (`window.__rtwGeoCallCount`) |
| `apps/web/src/services/mapboxReverseGeocode.ts` | `fetchMapboxReverseGeocodeRegionLabel` (types=place…) |
| `apps/web/src/App.tsx` | `firstRideIntroCard` → LocalFirst · placeSearch intent · 카메라 1회 가드 |
| `apps/web/src/components/ride/index.ts` | export |
| `apps/web/src/features/map-overlays/MapBottomLeftStack.css` | `.local-first-anchor` static 리셋 (폭 붕괴 수정) |

`FirstRideIntroCard.tsx` 는 **유지**(미삭제). `enterBasicHub` 호출은 한 글자도 안 바꿈.

### `git diff --stat -- apps/web/src` (tracked)

```
 apps/web/src/App.tsx                               | 127 +++++++++++++++++++--
 apps/web/src/components/ride/index.ts              |   4 +
 .../features/map-overlays/MapBottomLeftStack.css   |   3 +-
 apps/web/src/services/mapboxReverseGeocode.ts      |  28 +++++
 4 files changed, 152 insertions(+), 10 deletions(-)
```

**untracked 신규** (diff --stat 에 안 잡힘): `LocalFirstEntryCard.tsx/.css`, `localFirstRegion.ts`, `localFirstGeoProbe.ts`

## 3. 설계 준수 (D1–D6)

| # | 결과 |
|---|---|
| D1 첫 화면 권한 요청 없음 | PASS — 로드~S0 `getCurrentPosition` **0** |
| D2 국가→도시 목록 신규 없음 | PASS — `MenuPlaceSearch` 재사용, intent=`localFirst`\|`menu` |
| D3 입문 CTA 병존 | PASS — 「또는 입문 경로로 시작」 |
| D4 `setExternalCameraJump` | PASS — NextRide 와 동일 seq/free/null |
| D5 Firestore 신규 없음 | PASS — `rtw.localFirst.region` only |
| D6 Ready Ride 영문 | PASS — `{지명} · 여기서 첫 Ready Ride` |

## 4. 카메라 zoom

후보 12/13/14 를 마포구·740×300 에서 비교(`05`/`06`/`07`).

**채택: 13** — 구·동 라벨이 읽히고 시가지가 한 화면에 잡힘. 12는 시 단위로 희미, 14는 도로명 위주.

## 5. 수치 (카드 rect)

| 항목 | 900×400 | 740×300 |
|---|---|---|
| 카드 rect (top, left, w, h) | 301.3, 11.5, **236.3**, **82.6** | 202.4, 10.4, **236.3**, **82.6** |
| 카드 높이 / 뷰포트 (%) | **20.6%** | **27.5%** |
| 카드↔RouteDock shell 최소 간격 | **+3.8 px** | **+3.8 px** |
| 카드↔HUD TL 최소 간격 | **+256.7 px** | **+158.9 px** |
| 고른 zoom | **13** (위 이유) | 같음 |

> 초기 `measure.json` 의 gapDock −82 는 `.map-hud` 전체·스택 오측정. `measure-gaps.json` 이 dock shell / HUD TL 기준 정정값.

### 권한 게이트 계측

계수기: `installLocalFirstGeoProbe` → `window.__rtwGeoCallCount`. **클릭 시 0→1** 이 같은 표에 있어 0이 의미를 갖는다.

| 시점 | 기대 | 실측 |
|---|---|---|
| 앱 로드 ~ S0 | 0 | **0** |
| `[현재 위치]` 1회 클릭 후 | 1 | **1** (`beforeCurrentClick=0` → `afterCurrentClick=1`) |
| `[지역 선택]` 만 | 0 | **0** (`afterRegionSearchOnly=0`) |

### localStorage

| 항목 | 실측 |
|---|---|
| 지역 선택 후 JSON | `{"name":"마포구","lngLat":[126.90134,37.565453],"zoom":13,"source":"search","at":"2026-09-23T14:43:32.128Z"}` |
| 새로고침 후 S1 · 카메라 | **예** — 제목 `망원동 · 여기서 첫 Ready Ride`(직전 현재위치 성공이 덮어쓴 뒤 reload; S1 복원·점프 확인) |
| localStorage 차단 컨텍스트 | **S0 정상** (`blockedRendersS0: true`) |

## 6. 캡처

**폴더 (통째로):**
- `document/ops/20260923-first_ride/.out/jisi01/`
- ASCII 미러: `apps/web/.out/first-ride-jisi01/`

| # | 파일 | 확인 |
|---|---|---|
| A | `01-S0-900x400.png` / `02-S0-740x300.png` | S0 두 버튼 + 입문 줄 |
| B | `03-region-search-open.png` | 지명 검색 패널 |
| C | `04-S1-after-pick-740x300.png` | 마포구 · Ready Ride + 카메라 |
| D | `05-zoom12.png` / `06-zoom13.png` / `07-zoom14.png` | 줌 비교 |
| E | `08-S2-denied-740x300.png` | 권한 거부 → S2 |
| F | `09-nextride-regression.png` | NextRideCard 제품 CSS 하네스 (게이트 `!nextRideView` 로 동시 표시 불가) |
| G | `10-riding-hidden.png` | 주행 중 LocalFirst 카드 없음 (`ridingCardVisible: false`) |
| H | `11-legibility-740x300.png` | 원본 크기 가독 |

## 7. 검증

| 항목 | 결과 |
|---|---|
| `tsc -b --noEmit` | **PASS** |
| `npm run build` | **PASS** |
| eslint (만진 TS) | **error 증가 0** |
| e2e/에뮬레이터 잔여 | 캡처 후 playwright 프로세스 **0**. 사용자 Chrome 은 별개 |
| 브라우저 5분 무진전 | 해당 없음(live 캡처 완료) |

## 8. 막혔다 풀린 것

1. 게스트 게이트 8초 대기 → 카드 미표시 → 60초 `waitFor` 로 수정
2. `.local-first-anchor` 가 스택 static 리셋 대상이 아니어서 **폭 ~68px** 붕괴 → `MapBottomLeftStack.css` 에 추가
3. Mapbox ko 공백 지명(`대한민국 서울특별시 마포구`) → `localFirstRegionLabel` 로 **마포구** 축약

## 9. 이 라운드에서 안 한 것

Ready Ride 생성 · `distanceAutoRoute*` 수정 · Firestore · 분석 이벤트 — 지시서 §9 준수.
