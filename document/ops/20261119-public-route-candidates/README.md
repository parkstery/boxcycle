# 퍼블릭 코스 확충 — 국가·거리별 대표 코스 추천

작성: Codex · 2026-11-19. 최신 상태: **4개 공개 등록·ecf600c7 푸시·Hosting 배포 완료**. 공개43개·9개국. [등록·릴리스](release.md).

최신 결과는 [코스별 검증표·좌표·표고·3D·등록 판정](validation.md), 재현 데이터는 `audit.json`·`inventory.json`·`route-designs.json`·`evidence/`에 있다. 아래는 추천 당시의 후보·거리와 인계 배경을 보존한 기록이다.
Chief: 「대표성있는 퍼블릭 코스를 거리와 지역(국가) 별로 더 추가할 필요가 있다」 → 「퍼블릭 코스 추천 사항 커밋하라. 다음 명령은 새로운 세션에서 이어갈 것이다. 입력 메시지 작성해 줘」.

최초 추천 때는 운영 목록 중복·실제 경로·표고·국가·3D를 검증하지 않았다. 후속 검증 결과는 위 문서에서 구분하며, 등록4개의 최종 거리·ID는 릴리스 문서에 기록한다. 아래 거리는 기존 안내 또는 설계 목표이며 Spinatlas 등록 geometry의 확정값이 아니다.

## 선정 기준

- **Chief 확정(2026-11-19)**: Spinatlas는 OSM 기반 인터넷 도로 데이터를 달린다. 도로 데이터가 존재하고 앱에서 경로가 연결되면 주행 대상으로 삼는다. 현실의 공사·통행 폐쇄·자전거 통행 금지·보행 전환 안내는 코스 제외/보류 사유로 쓰지 않는다. 데이터 연결·경로 품질·거리·표고·지역 정보·3D 표시는 계속 검증한다. 이 기준으로 안시·일월담·리치먼드의 기존 보류/조건부 판정을 해제했다. 실제 공개 등록은 후속 지시에 따른다.
- 우선8개 국가·12개 후보로 시작한다. 거리 구간은5~10km / 10~20km / 20~30km / 40~60km / 70~110km를 채운다.
- 도시·공원·운하·강변·호수·해안·산악 지형을 고르게 갖춘다. 사진상 유명세뿐 아니라 현재3D 지도에서 지형·수면·도로 형태가 읽히는지를 실제 검수한다.
- 같은 길을 왕복해 거리만 늘리기보다 순환·편도를 활용해 「내 도로망」 확장과 연결한다. 기존 후보와의 유사도는 별도 검수한다.
- 거리와 지형 유형은 구분한다. 짧은 산악 경로를 거리만 보고 초급 코스로 분류하지 않는다. 실제 실내 자전거 부하가 지형과 자동 연동된다고 가정하지 않는다.
- 1차는 짧은 코스·평지·호숫가, 2차는 산악과 해상 교량을 포함한다. 이후 오세아니아·아프리카·남미 후보를 보완해 대륙 균형을 넓힐 수 있다.

## 후보12개

| 단계 | 국가 | 후보 | 안내/목표 거리 | 지형·선정 이유 | 근거 |
|---|---|---|---|---|---|
| 1차 | 한국 | 여의도 한강 선정 구간 | **5~10km — 설계 목표** | 짧은 체험·워밍업용 도시 평지. 출발·종점·구간 미확정 | 이번 제안에서 선정한 구간, 공식 거리 인용 아님 |
| 1차 | 영국 | 리치먼드 파크 도로 순환 | 약10.8km | 짧은 순환, 공원·완만한 기복. Tamsin 비포장 트레일과 도로 순환을 구분 | [London Dynamo 도로 순환 안내](https://www.londondynamo.co.uk/guides/best-cycling-training-routes-richmond-park/) |
| 2차 | 프랑스 | 알프뒤에즈 등반 | 13.8km | 짧은 거리의 대표 산악. Bourg d’Oisans→공식 정상 도착 구간 | [Alpe d’Huez 관광청](https://www.alpedhuez.com/en/alpe-dhuez-the-mythical-climb/) |
| 1차 | 한국 | 아라자전거길 | 21km | 서해갑문→한강갑문, 운하·평지 대표 | [자전거행복나눔](https://www.bike.go.kr/bbs/road.do?bbsCtgrySn=8&bbsCtgrySubSn=44&key=2006176973258) |
| 1차 | 네덜란드 | 암스텔강–오우데르케르크 선정 구간 | **20~30km — 설계 목표** | 강변·풍차·농촌. 공식 전체 경로 그대로의 거리라고 보지 않음 | [I amsterdam 암스텔 자전거 경로](https://www.iamsterdam.com/zien-en-doen/natuur-en-activiteiten/routes/fietsroute-amstel) |
| 2차 | 미국 | 캘리포니아17마일 드라이브 | 약27km | 태평양 해안·구릉. 명칭17mile의 km 환산을 참고한 근삿값, 진입/종점 선택 후 계산 필요 | [Visit California](https://www.visitcalifornia.com/experience/17-mile-drive/) |
| 1차 | 대만 | 일월담 순환 | 30km | 호수·산세·구릉. Xiangshang 방문자센터 기준 순환 후보 | [일월담 공식 자전거 안내](https://theme.sunmoonlake.gov.tw/ComeBikeDay/FullPage.aspx?a=323&l=2) |
| 1차 | 프랑스 | 안시 호수 순환 | 40km | 호숫가 중거리 대표. 공식 안내의 전체 순환 | [안시 관광청](https://www.lac-annecy.com/itineraire-cyclotourisme/boucle-cyclo-tour-du-lac-dannecy-annecy/) |
| 2차 | 일본 | 비와호 남호 순환 | 약50km | 긴 평지·호숫가. 전체 비와이치193km와 구분 | [일본 국토교통성 비와이치](https://www.mlit.go.jp/road/bicycleuse/good-cycle-japan/national_cycle_route/biwaichi.html) |
| 2차 | 이탈리아 | 셀라론다 — 코르바라 출발 | 50.7km | 돌로미티 산악·고갯길 대표. MTB/리프트 경로와 도로 자전거 경로를 구분 | [Alta Badia 관광청](https://www.altabadia.org/it/bici/percorsi-bici-alta-badia-dolomiti/dettaglio/oa/sellaronda-in-bici-da-corsa) |
| 2차 | 일본 | 시마나미 카이도 | 70km | 섬·바다·교량. 해상 교량의 높이/접지/카메라 표시 검수 필요 | [일본 국토교통성](https://www.mlit.go.jp/road/bicycleuse/good-cycle-japan/national_cycle_route/shimanami.html) |
| 2차 | 한국 | 제주 용두암→법환바당 선정 구간 | **100~110km — 설계 목표** | 장거리 해안. 공식 안내 구간 합은 약107km, 실제 노선 계산 후 확정 | [자전거행복나눔 제주환상](https://www.bike.go.kr/bbs/road.do?key=2006176979144) |

조사일은2026-11-19. 외부 안내는 경로 시작점/변형에 따라 거리가 다를 수 있으므로 등록값으로 그대로 복사하지 않는다. 위 순서는 등록 완료 순서가 아니다.

## 다음 세션의 첫 작업

1. 최신 HANDOFF·이 묶음·원본 정책을 읽고 현재 퍼블릭 목록을 읽기 전용으로 확인한다. UI 최근80개 제한 목록을 전체 국가별 등록 현황으로 오인하지 않는다. 접근 권한이 없으면 조회 범위를 명시한다.
2. 국가별·거리별 빈 구간과 기존 경로 중복을 비교해 1차6개 우선순위를 확정한다. 첫6개는 여의도·리치먼드·아라·암스텔·일월담·안시다.
3. 각 후보의 출발/경유/도착 좌표, 단절 없는 도로 경로, 실제 거리·표고, 국가 메타데이터 및 경로 유사도를 확인한다. 순환과 편도, ferry/lift 포함 여부를 구분한다.
4. 실제 앱의 경로/profile과3D에서 교량·터널·지면 접지·QC2/3 시야를 검수한다. 기사 사진만 보고 게임 안 풍경을 보증하지 않는다.
5. 코스별 검증 결과와 등록 가능한 후보를 표로 보고하고 기존 공개 등록 절차에 맞는 후속 작업을 정리한다. 이 인계 단계에서는 운영 데이터 쓰기·공개 게시를 실행한 상태가 아니다.

## 현재 코드 제약과 확인 위치

- `apps/web/src/lib/route/publicRouteAutoReview.ts`: 최대거리120,000m, 최대좌표5,000개. 최소거리는 현재개발완화100m이고 주석상 운영 복구 기준은5,000m. 추천 기본은5km 이상으로 잡았으며 정책 변경을 제안하는 문서가 아니다.
- 서버 `functions/src/publicRouteAutoReviewCore.ts`와 클라이언트 정책의 실제 최신값을 다음 세션에서 다시 대조한다.
- 퍼블릭 요약 목록은 `publicationListings`와 `routePublications` 경로를 사용한다. `apps/web/src/lib/route/repo/firestoreCourses.ts`, `firestoreRoutePublications.ts`, 서버 listing 모듈을 작업에 필요한 범위에서 확인한다. 기존 course 계열 식별자는 임의 rename하지 않고 신규 식별자는 route/publication을 따른다.
- 국가를 title로 추정해 쓰지 말고 기존 지역 메타데이터 계약을 확인한다. 기존 등록 geometry나 전체 DB를 일괄 덮어쓰지 않는다.

## 이어받을 제품 상태

- `main2` 기준. Hosting 배포 코드4c1f2ef0, 배포 문서021b5f42. [배포 기록](../20261119-mobile-3d-investigation/release.md).
- QC2/3 지형 회피는 Chief 성공 확인. DPR 기본 상한1.5·perflab·라이더 존재 계측 수정까지 Hosting 반영. 결과창/RPM 정렬도 함께 반영됨.
- 당시 정상 pre-push·전체quick1581/0, 커밋 사본 관련40/0, 운영HTML/17에셋 일치·DPR3 입력에서실효1.5/GL1200×540 확인.
- PC 개발 빌드의3.41fps 병목은 해결했다고 보고하지 않는다. 주행 중 흰 화면은 원인 미확정이며 Chief 지시로 보류. 건물 간섭도 보류. 이 세 문제를 코스 추천 작업에 섞지 않는다.
- 인터벌 안내·표고 timeout·도구·비용 조사 등 타 작업의 미커밋 변경이 많다. 모두 보존하고 추천 문서 커밋에 포함하지 않는다.

## 실행 정보

실행 폴더: `C:\20.HDev\boxcycle`.

```powershell
Set-Location C:\20.HDev\boxcycle
node scripts/handoff-check.mjs
Get-Content document\ops\20261119-public-route-candidates\README.md
```

운영 확인 주소: https://boxcycle-dc2df.web.app/
새 세션 입력 메시지: [next-session.md](next-session.md).
최초 추천 커밋(1ecd0258)은 문서만 작성했으므로 build/단위/브라우저/DB 시험을 새로 실행하지 않았다. 당시에는 Markdown 경로·12개 후보·8개 국가·1차6개·스테이징 범위를 확인했다. 후속 조회·경로·표고·3D와 검사106개의 결과는 `validation.md`를 따른다.
