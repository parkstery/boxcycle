# 퍼블릭 코스 1차 6개 — 현황·경로 검증

> **후속 최신 상태**: Chief 공개 등록 지시에 따라 여의도·리치먼드·일월담·안시4개를 운영에 등록했다. 아래 미실행 표현과39개 현황은 등록 전 검증 시점의 기록이다. 실제 등록 ID·좌표 합산 등록 거리·국가·배포 상태는 [공개 등록·릴리스](release.md)와 `publication-verification.json`을 따른다.

수행: **Codex** · 2026-11-19 · 실행 폴더 `C:\20.HDev\boxcycle` · 기준 HEAD `1ecd0258`.
운영 공개 등록·신청·저장 경로 생성·배포·커밋·푸시 **미실행**. 제품 소스는 변경하지 않았다. 로컬 검수 화면과 이 묶음만 추가했다.

**Chief 확정(2026-11-19)**: 우리는 OSM 기반 인터넷 도로 데이터를 달린다. 도로 데이터가 존재하고 앱에서 경로가 연결되면 주행 대상으로 삼는다. 현실 공사·통행 폐쇄·자전거 통행 금지·보행 안내는 제외/보류 조건으로 쓰지 않는다. 이 기준으로 안시·일월담·리치먼드는 **등록 검토 가능**으로 정정했다. 여의도 포함4개 검토 가능, 아라 지역 코드 조건부, 암스텔 경로 품질 보류다. 이 정정은 기존 geometry·거리·표고·3D 증거를 재사용하며 새 경로 생성이나 공개 등록을 실행하지 않았다.

## 운영 전체 현황

읽기 전용 조회: 2026-11-19T10:57:56.579Z. `routePublications` **44건 = published39 + archived5**. `publicationListings`39건, 공개 원본과 1:1 일치, 고아0건. 목록 80개 제한 없이 두 컬렉션을 전수 조회했다. 저장한 스냅샷은 공개 필드만 포함한다.

거리 구간은 저장된 snapshotDistanceMeters의 반열린 구간이다. 4,999.999986m 등 반올림하면5km인 값은 <5km에 들어간다. 제목·안내 거리로 분류하지 않았다.

| 국가 | 공개 수 | <5km | 5~<10km | 10~<20km | 20km 이상 | cycling |
|---|---:|---:|---:|---:|---:|---:|
| KR | 31 | 24 | 6 | 1 | 0 | 10 |
| JP | 2 | 2 | 0 | 0 | 0 | 2 |
| US | 2 | 1 | 1 | 0 | 0 | 1 |
| KP | 1 | 0 | 1 | 0 | 0 | 0 |
| NL | 1 | 1 | 0 | 0 | 0 | 1 |
| FR | 1 | 1 | 0 | 0 | 0 | 1 |
| CA | 1 | 0 | 1 | 0 | 0 | 0 |
| 합계 | 39 | 29 | 9 | 1 | 0 | 15 |

국가7개. KR31/39(79.5%), <5km29/39(74.4%). 전체 profile은 cycling15 / driving16 / walking8이다. cycling에서5km 이상은 서울5.382km·양주5.783km 두 건뿐이다. 20~30·30~40·40~60·60~70·70~110·110~120km는 모두 비어 있다. GB·TW는 미등록 국가다. 공개 지시 후에는 여의도·리치먼드·일월담·안시를 등록 검토 대상으로 삼고, 아라 지역 코드와 암스텔 경로 품질을 확인한다.

### 중복

동일 profile의 기존 공개 경로 **253쌍**을 서버의 대칭 샘플 유사도로 비교했다. 28m buffer, 28~200개 거리 표본, 양방향 일치율의 min, 0.9 이상 차단이다.

- 기존 중복: `U3zVrn6oufMyuJOElwRi` ↔ `YP5lMe50BvrIUysBb1A4` — 짧은 거리 / 짧은 거리, cycling, 유사도 1.000. 삭제·보관 처리는 하지 않았다.
- 후보6개는 기존 cycling15건과90회 비교: 최대 유사도 모두0.000. 후보끼리15쌍도 모두0.000. 다른 profile과는 등록 차단 유사도를 비교하지 않았다.
- 기존 거리–geometry 차이가 max(100m,1%)를 넘거나 목록 국가와 최신 resolver 결과가 다른 공개 원본은0건. 이것은 제목과 실제 위치가 일치한다는 보증은 아니다.

## 최신 코드 정책

| 계약 | 확인값·위치 |
|---|---|
| 최소/최대 연장 | 클라 publicRouteAutoReview.ts · 서버 publicRouteAutoReviewCore.ts 모두 **100m / 120,000m**. 100m는 개발 완화, 주석의 운영 복구값5,000m와 구분. 이번 후보는 모두5km 이상. |
| 좌표 | 2~5,000개. 최소 bbox 대각50m. 서버 밀도 한도 max(500, km×400). |
| 생성 경유지 | **최대3개**. apps/web/src/lib/geo/routeWaypoints.ts 및 mapboxDirections.ts의 slice. 상세 랜드마크를 모두 요청에 넣은 초안은 폐기하고 출발+경유≤3+도착으로 재생성. |
| 서버 길이 판정 | autoReviewPublicRouteRequest.ts는 geometry를 다시 합산해 검사한다. Directions distance만 검사한 결과로 대체하지 않았다. |
| 지역 기준 | publicationListingCore.ts: geometry 첫 좌표로 geoCountry/geoContinent/geoAdmin1 결정. 제목에서 국가를 추정하지 않는다. 전체 좌표의 국가도 확인했다. |
| 조회 제한 | UI80·클라/서버 유사도 공개100·서버 pending80. 이번 공개 분포/중복은 전수 스냅샷으로 계산. |

## 6개 후보 판정

아래 거리 두 값은 같은 최종 geometry에 대한 **계산값**이다. Directions는 네트워크 거리, geometry는 서버와 같은 R=6,371,000m haversine 합이다. 실제 도로 측량값이 아니며 안내/설계 목표 거리와 분리한다. 공개 시 보존할 snapshotDistanceMeters와 geometry 판정을 혼동하지 않는다.

표고는 Open-Meteo / Copernicus DEM GLO-90의 거리 균등72점으로 계산했다. +/−는 연속 표본 차이의 양/음 합이며 smoothing은 하지 않았다. 표본 간격90~570m, DEM 해상도90m라 짧은 경사·교량 상판을 놓치고 수목·구조물·셀 잡음도 포함할 수 있다. 누적 상승을 정밀 실측값이나 난이도 확정치로 쓰지 않는다. [API 근거](https://open-meteo.com/en/docs/elevation-api).

| 후보·국가 | 목표/안내 km | Directions / geometry km | 좌표 | DEM min~max m · +/−m | 3D 검수 | 등록 판정 |
|---|---:|---:|---:|---|---|---|
| 여의도 한강 선정 구간 · KR | 5~10 목표 | 6.416 / 6.409 | 250 | 3~17 · +92/−83 | 10/10 관측 통과 | **등록 검토 가능** |
| 리치먼드 파크 도로 중심 순환 · GB | 약10.8 | 10.927 / 10.915 | 332 | 7~60 · +140/−140 | 10/10 관측 통과 | **등록 검토 가능** |
| 아라자전거길 · KR | 21 | 20.307 / 20.284 | 399 | 1~16 · +57/−47 | 10/10 관측 통과 | **조건부 등록 검토** |
| 암스텔강–오우데르케르크 · NL | 20~30 목표 | 22.724 / 22.699 | 962 | -6~10 · +79/−79 | 10/10 관측 통과 | **보류 — 경로 품질** |
| 일월담 순환 · TW | 30 | 27.845 / 27.814 | 1319 | 651~873 · +791/−791 | 10/10 관측 통과 | **등록 검토 가능** |
| 안시 호수 순환 · FR | 40(본문42) | 40.542 / 40.497 | 2008 | 446~546 · +280/−280 | 10/10 관측 통과 | **등록 검토 가능** |

전 후보: 길이·좌표 수·밀도·bbox **24/24 통과**, 국가 기대값6/6 일치, 국가 횡단 없음, 경유지≤3. 일반 신청의 계정 tier·신청 quota·pending 중복·동의·저장 원본 지문·콘텐츠 최종 검수는 공개 지시 후 해당 신청 시점에 재검사해야 한다. 현재 자동 승인 완료라는 뜻은 아니다.

### 경로별 연결·표시·보류 근거

#### 여의도 한강 선정 구간

양화대교 남안→여의도 동쪽 편도. 강북·노들섬 우회 제거.

출발점 지역: AS / KR / KR-11, resolver v1. 길이 6408.676m, 최대 세그먼트 176.0m, 중복 선분 재주행 0.0m, 표고 표본 간격 90.3m. 중복 선분 길이는 동일 좌표 끝점 쌍 재사용만 세므로 전체 중복 주행의 하한이다.

| 순서·지점 | 요청 [경도, 위도] | 도로 스냅 [경도, 위도] | 스냅 거리m · 도로 |
|---|---|---|---|
| 출발 · 양화대교 남단 자전거길 | [126.891619,37.546064] | [126.891619,37.546064] | 0.015 · 한강남자전거길 |
| 도착 · 여의도 동쪽 한강공원 | [126.939,37.523] | [126.93903,37.522974] | 3.943 · 이름 없음 |

Directions 도로명: 한강남자전거길 → 원효대교 출입로.

최종 geometry SHA256: `cc90423947f306ac8e57d87cbd5e187a3338bbafb16e6ac7adad58279a7e3bd7`. 원본 경로·turn별 mode: `evidence/yeouido-directions.json`; DEM: `yeouido-elevation.json`; 3D: `yeouido-3d.json`; 화면: `yeouido-overview.png`, `yeouido-qc2.png`, `yeouido-qc3.png`.

#### 리치먼드 파크 도로 중심 순환

연결된 도로 데이터와 3D 관측 통과. Tamsin Trail 이름의 연결부 4.057m는 경로 구성 정보로 명시하며 통행·노면 조건으로 보류하지 않는다.

출발점 지역: EU / GB / GB-ENG, resolver v1. 길이 10914.854m, 최대 세그먼트 135.9m, 중복 선분 재주행 104.6m, 표고 표본 간격 153.7m. 중복 선분 길이는 동일 좌표 끝점 쌍 재사용만 세므로 전체 중복 주행의 하한이다.

| 순서·지점 | 요청 [경도, 위도] | 도로 스냅 [경도, 위도] | 스냅 거리m · 도로 |
|---|---|---|---|
| 출발 · Roehampton Gate 내부 도로 | [-0.258,51.4535] | [-0.25801,51.453511] | 1.399 · 이름 없음 |
| 경유1 · Queens Road 북쪽 | [-0.294504,51.4463767] | [-0.294504,51.446377] | 0.009 · Queens Road |
| 경유2 · Kingston Gate 내부 Dark Hill | [-0.2845422,51.4221199] | [-0.284542,51.42212] | 0.018 · Dark Hill |
| 경유3 · Broomfield Hill | [-0.2710178,51.4313844] | [-0.271018,51.431384] | 0.016 · Broomfield Hill |
| 도착 · Roehampton Gate 내부 도로 | [-0.258,51.4535] | [-0.25801,51.453511] | 1.399 · 이름 없음 |

Directions 도로명: The Tamsin Trail → Sawyer's Hill → Queens Road → Dark Hill → Broomfield Hill.

최종 geometry SHA256: `118c7ff2e8b1cb1d43ca37884b6ec8f46a4e74b95011478652d56b352c4f4a0e`. 원본 경로·turn별 mode: `evidence/richmond-directions.json`; DEM: `richmond-elevation.json`; 3D: `richmond-3d.json`; 화면: `richmond-overview.png`, `richmond-qc2.png`, `richmond-qc3.png`.

#### 아라자전거길

국가 KR 통과. 인천 출발점에 resolver가 KR-41(경기)을 반환: 광역지역 오분류 여부를 공개 전 확인.

출발점 지역: AS / KR / KR-41, resolver v1. 길이 20283.995m, 최대 세그먼트 1415.5m, 중복 선분 재주행 0.0m, 표고 표본 간격 285.7m. 중복 선분 길이는 동일 좌표 끝점 쌍 재사용만 세므로 전체 중복 주행의 하한이다.

| 순서·지점 | 요청 [경도, 위도] | 도로 스냅 [경도, 위도] | 스냅 거리m · 도로 |
|---|---|---|---|
| 출발 · 서해갑문 자전거길 기점 | [126.603848,37.5570429] | [126.603848,37.557043] | 0.011 · 아라 자전거길 |
| 경유1 · 시천교 남안 자전거길 | [126.6424929,37.5703452] | [126.642493,37.570345] | 0.023 · 아라 자전거길 |
| 경유2 · 계양대교 남안 자전거길 | [126.6861617,37.5708451] | [126.686162,37.570845] | 0.016 · 아라 자전거길 |
| 경유3 · 굴포천 합류 남안 자전거길 | [126.7366893,37.5730098] | [126.736689,37.57301] | 0.020 · 아라 자전거길 |
| 도착 · 한강갑문 자전거길 종점 | [126.7979414,37.5980128] | [126.797941,37.598013] | 0.042 · 아라 자전거길 |

Directions 도로명: 아라 자전거길 → 아라육로.

최종 geometry SHA256: `ad7ea05728f5c8f4a38d98c1f086bc318ffcbd4651ebf8dec878e8f0696f602b`. 원본 경로·turn별 mode: `evidence/ara-directions.json`; DEM: `ara-elevation.json`; 3D: `ara-3d.json`; 화면: `ara-overview.png`, `ara-qc2.png`, `ara-qc3.png`.

#### 암스텔강–오우데르케르크

강변 대신 Europaboulevard·Bankrasweg 등 내륙 우회. 동일 선분 재주행 약1.82km. 목표 강변 양안 순환으로 확정 불가.

출발점 지역: EU / NL / NL-NH, resolver v1. 길이 22698.642m, 최대 세그먼트 377.0m, 중복 선분 재주행 1821.1m, 표고 표본 간격 319.7m. 중복 선분 길이는 동일 좌표 끝점 쌍 재사용만 세므로 전체 중복 주행의 하한이다.

| 순서·지점 | 요청 [경도, 위도] | 도로 스냅 [경도, 위도] | 스냅 거리m · 도로 |
|---|---|---|---|
| 출발 · Magere Brug 서안 | [4.9029,52.363] | [4.903378,52.363076] | 33.605 · Amstel |
| 경유1 · Riekermolen 강변 | [4.893765,52.324078] | [4.893747,52.324337] | 28.868 · De Borcht |
| 경유2 · Ouderkerk N522 도로교 | [4.8992,52.2986] | [4.899166,52.298637] | 4.725 · Burgemeester Stramanweg |
| 경유3 · Ouderkerkerdijk 동안 | [4.9,52.326] | [4.899994,52.325909] | 10.161 · 이름 없음 |
| 도착 · Magere Brug 서안 | [4.9029,52.363] | [4.903378,52.363076] | 33.605 · Amstel |

Directions 도로명: Amstel → Nieuwe Prinsengracht → Weesperstraat → Amsteldijk → Tweede Jan Steenstraat → Van Woustraat → Rooseveltlaan → Europaplein → Europaboulevard → De Borcht → Kalfjeslaan → Kostverlorenweg → Aanloop → Frits Mullerlaan → Olympiadelaan → Lien Gisolflaan → Bankrasweg → Oranjebaan → Amstelslag → Burgemeester Stramanweg → Rozenoordpad → Vrijheidslaan → Rijnstraat → Westeinde → Frederiksplein.

최종 geometry SHA256: `eec33f5e271dcd4d37c31956dc0b8e7a99784d3130c42d23d81b315e9f57a358`. 원본 경로·turn별 mode: `evidence/amstel-directions.json`; DEM: `amstel-elevation.json`; 3D: `amstel-3d.json`; 화면: `amstel-overview.png`, `amstel-qc2.png`, `amstel-qc3.png`.

#### 일월담 순환

연결된 순환 geometry와 3D 관측 통과. API의 walking 8.522m+12.136m는 경로 데이터의 구성 정보다. 현실 보행·자전거 통행 제한을 온라인 주행의 보류 사유로 쓰지 않는다.

출발점 지역: AS / TW / TW-NAN, resolver v1. 길이 27813.650m, 최대 세그먼트 267.2m, 중복 선분 재주행 225.7m, 표고 표본 간격 391.7m. 중복 선분 길이는 동일 좌표 끝점 쌍 재사용만 세므로 전체 중복 주행의 하한이다.

| 순서·지점 | 요청 [경도, 위도] | 도로 스냅 [경도, 위도] | 스냅 거리m · 도로 |
|---|---|---|---|
| 출발 · Xiangshang 방문자센터 연결 중산로 | [120.901175,23.851815] | [120.901175,23.851815] | 0.000 · 中山路 |
| 경유1 · 북동부 중정로 | [120.93748,23.863687] | [120.93748,23.863687] | 0.000 · 月潭自行車道 |
| 경유2 · Ita Thao 중정로 | [120.93171,23.846354] | [120.93171,23.846354] | 0.000 · 中正路 |
| 경유3 · 남서부 환호공로 | [120.905099,23.832264] | [120.905099,23.832264] | 0.000 · 平和巷 |
| 도착 · Xiangshang 방문자센터 연결 중산로 | [120.901175,23.851815] | [120.901175,23.851815] | 0.000 · 中山路 |

Directions 도로명: 中山路 → 月潭自行車道 → 中潭公路 → 中正路 → 平和巷.

최종 geometry SHA256: `42d175139cd7b0f7bcef7d78b715dcf93a5c8f2509f302e339d9d623fcf1f48a`. 원본 경로·turn별 mode: `evidence/sunmoon-directions.json`; DEM: `sunmoon-elevation.json`; 3D: `sunmoon-3d.json`; 화면: `sunmoon-overview.png`, `sunmoon-qc2.png`, `sunmoon-qc3.png`.

#### 안시 호수 순환

RD909a·호수 순환 도로 데이터와 연결된 geometry, 3D 관측 통과. 현실 공사·폐쇄 여부는 선정 조건에서 제외한다.

출발점 지역: EU / FR / FR-ARA, resolver v1. 길이 40496.620m, 최대 세그먼트 437.0m, 중복 선분 재주행 913.2m, 표고 표본 간격 570.4m. 중복 선분 길이는 동일 좌표 끝점 쌍 재사용만 세므로 전체 중복 주행의 하한이다.

| 순서·지점 | 요청 [경도, 위도] | 도로 스냅 [경도, 위도] | 스냅 거리m · 도로 |
|---|---|---|---|
| 출발 · 안시 시청 호숫가 | [6.1285,45.899] | [6.128634,45.899034] | 11.059 · Quai Eustache Chappuis |
| 경유1 · Talloires | [6.213,45.84] | [6.213001,45.839997] | 0.322 · 이름 없음 |
| 경유2 · Doussard 호수 남단 | [6.222,45.795] | [6.220131,45.793139] | 252.907 · 이름 없음 |
| 경유3 · Saint-Jorioz | [6.164,45.835] | [6.163885,45.834953] | 10.385 · 이름 없음 |
| 도착 · 안시 시청 호숫가 | [6.1285,45.899] | [6.128634,45.899034] | 11.059 · Quai Eustache Chappuis |

Directions 도로명: Quai Eustache Chappuis → Quai Napoléon III → Pont des Amours → Voie Verte Tour du Lac d'Annecy → Route d'Annecy → Route du Port → Route de la Brune → Route des tennis → Route des Crozettes → Chemin de Rampon → Le Thoron → Route du Crêt → Rue Noblemaire → Chemin de la Colombière → Chemin Clos du Moine → Place du Port → Chemin de la Ruaz → Chemin de Quoex → Rue André Theuriet → RD 909a → Route de la Vieille Église → Route de la Plage → Allée de la Nublière → Route du Bout du Lac → Route du Taillefer → Route du Laudon → Voie Verte → Rue Saint-Maurice.

최종 geometry SHA256: `46ee9b6998df48e27f3d61281ccd5be99f6798144f1a6a3e7968e45627c41a70`. 원본 경로·turn별 mode: `evidence/annecy-directions.json`; DEM: `annecy-elevation.json`; 3D: `annecy-3d.json`; 화면: `annecy-overview.png`, `annecy-qc2.png`, `annecy-qc3.png`.

여의도는 한강남자전거길을 따라 양화대교 남안에서 여의도 동쪽으로 간다. 원효대교 출입로가 끝부분에 포함되므로 완전한 무교량 코스로 부르지 않는다. 초안10.926km는 강북·노들섬으로 돌아갔으므로 최종 후보에서 제외했다.

아라는 긴 직선 세그먼트가 약1.416km지만 단절로 단정하지 않았다. 내려받은 OSM 자전거 도로망과 거리 균등72점이 **72/72 모두28m 이내**, 전체 개방형 geometry와 연결된 Directions 응답으로 확인했다. 리치먼드도 OSM 도로망72/72 통과했다. OSM에는 기준 시점·지도 오류가 있으므로 교통 개방 보증과 구분한다. © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright

일월담 보행 전환 위치는 [120.926199,23.872922]·[120.927235,23.872271]이다. API 응답의 mode를 임의 변경하지 않고 구성 정보로 보존한다. 현실 보행·자전거 통행 제한은 온라인 주행의 제한으로 적용하지 않는다. 산악·구릉 대표로 보고 평지 초급으로 분류하지 않는다. [일월담 공식 경로 맥락](https://theme.sunmoonlake.gov.tw/ComeBikeDay/FullPage.aspx?a=323&l=2).

안시는 Directions에서 RD909a와 호수 순환 도로 데이터 연결을 확인했다. Chief 기준에 따라 현실 공사·폐쇄 여부는 코스 판정에서 제외하며 **등록 검토 가능**으로 정정한다. 관광청 안내 머리40km·본문42km와 실제 선택 경로 계산값40.542km를 구분했다. [안시 관광청의 경로 안내](https://www.lac-annecy.com/itineraire-cyclotourisme/boucle-cyclo-tour-du-lac-dannecy-annecy/).

암스텔의 Riekermolen 지점은 관리·전문 데이터의 [52.324078,4.893765](https://legacy.molendatabase.nl/nederland/molen.php?nummer=638)을 기준으로 보정했다. N522 교량은 52°17.916′N,4°53.952′E를 도 단위로 환산했다. 강변 길 대신 내륙 도로로 우회하는 응답은 이름만 「강변 양안 순환」으로 확정하지 않았다. [I amsterdam 구간 맥락](https://www.iamsterdam.com/zien-en-doen/natuur-en-activiteiten/routes/fietsroute-amstel).

## 3D 증거 범위

`apps/web/scripts/public-route-review/preview.html`은 Firebase 없이 실제 Mapbox satellite-streets-v12·terrain-rgb·제품 apply3DState(배율1.3)·tickRideCameraFollow·readRideTerrainHealth를 사용한다. CSS800×360 지도에서 QC2/3, 진행률0/25/50/75/100% 각10관측/코스. 실제 canvas1000×450(DPR1.25)로 관측했으며 물리 폰이나 DPR3 시험은 아니다. 같은 최종 geometry hash를 DEM·3D·audit에 묶었다. 초기22관측은 일부 초안 geometry가 섞여 있어 최종 판정에 합산하지 않았다.

지도 © Mapbox / © OpenStreetMap contributors. 위성 영상의 물·도로·공원·산세와 경로선, DEM 수신, 지형 시야·카메라 지상고·지상점의 화면 안 위치·WebGL context를 검사했다. 실제 라이더 대신 점 표식을 사용한다. 전체 실앱 인증→경로 저장→주행 e2e, 물리 폰, 연속 주행, 전 구간 교량·터널 상판 높이 검증은 미실행이다. DEM은 교량 상판 높이를 보장하지 않는다. 등록 검토 가능은 이 한정된 로컬 검수 결과이며 실제 공개 승인 완료가 아니다. 보류된 흰 화면·건물 간섭·FPS 작업으로 확장하지 않았다.

## 실행·검증·재개

```powershell
Set-Location C:\20.HDev\boxcycle
node document/ops/20261119-public-route-candidates/audit.cjs
node document/ops/20261119-public-route-candidates/verify-artifacts.cjs
```

위 명령은 저장된 스냅샷의 오프라인 재검사다. 운영 목록 갱신은 `node document/ops/20261119-public-route-candidates/inventory.cjs`(읽기 전용)를 별도로 실행한다. 경로 재생성은 `generate-routes.cjs`, DEM 재조회는 `elevations.cjs`이며 외부 API를 다시 사용하므로 결과가 달라지면 3D와 보고서도 함께 재검증해야 한다.

검수 주소: `http://127.0.0.1:5000/scripts/public-route-review/preview.html?id=yeouido` (`richmond`, `ara`, `amstel`, `sunmoon`, `annecy`로 변경). 기존 Vite5000을 재사용했다. 새 서버·배포 없음. 재실행 자동 검수: `ego-browser nodejs -e "await import('file:///C:/20.HDev/boxcycle/document/ops/20261119-public-route-candidates/browser-validate.mjs')"`. 완료 후 같은 방식으로 `browser-finish.mjs`를 실행한다. 검수 화면에는 점 표식이 쓰인다.

후속 공개 지시가 오면: ① 보류 조건 해소·공개 범위 결정 → ② 당시 전체 공개·pending 중복 재조회 → ③ 정식 계정으로 앱에서 같은 profile/좌표의 저장 경로 생성·geometry hash/지문 대조 → ④ 제목·소개·태그·국가/광역지역·3D 재검수 → ⑤ 기존 publicRouteRequests/autoReviewPublicRouteRequest 신청 흐름 → ⑥ routePublications와 publicationListings의 공개 수·국가·거리 재조회. 이번에는 어떤 단계의 운영 쓰기도 실행하지 않았다. seed CLI나 Admin SDK 우회 등록도 실행하지 않았다.

실패·전환 기록: 초기 PowerShell node -e의 따옴표 구문 실패는 .cjs 파일로 전환해 해결. Overpass POST406·기본UA429·일부 GET timeout/502 후 명시UA로 아라·리치먼드 자료만 확보했고 나머지를 성공으로 보고하지 않았다. Mapbox 첫 경유 초안의 강북/공원 밖/내륙/왕복 우회를 거리·도로명·반복 선분으로 찾았다. 앱 경유지3개 제한 확인 후 재생성했다. Ego screenshot2회 timeout 후 스킬 안내대로 render 이벤트 안 canvas PNG 추출로 전환했다. 첫 장거리 검수 CLI 종료 뒤 내장 스크립트가 계속된 사실을 확인했고, 완료 뒤 최종 hash가 있는 짧은 검수로 다시 확정했다. 재검수가 끝나기 전 artifact 검사에서는 sunmoon 해시 불일치를 정상 차단했다. 최종 재검수 후 `node document/ops/20261119-public-route-candidates/verify-artifacts.cjs` **106/106 통과**(6 geometry hash·DEM432점·최종 QC60관측). `node scripts/handoff-check.mjs`와 범위 한정 `git diff --check` 통과. 검수 TS ESLint 통과. 새 검수 파일은 제품 소스와 별개이며 전체 build·quick·실주행 e2e는 제품 변경이 없어 실행하지 않았다.
