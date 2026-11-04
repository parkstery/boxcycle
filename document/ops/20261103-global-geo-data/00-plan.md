# 전세계 지역 데이터 구조 — 설계 계획 (G0~G5)

| 항목 | 내용 |
|---|---|
| 문서 유형 | ops 계획 — 데이터 구조 확장 설계 |
| 작성 | 2026-11-03 Supervisor Claude Code (Opus 5.5) |
| 상태 | IN_PROGRESS — G1·G3-1 배포, **G2 구현·미배포(11-04, §4.1.1)** |
| 출발점 | Chief 자문 대화(Geographic Data Architecture 제안) + 코드 대조 의견 |

## 1. 결정

### 1.1 확정 (2026-11-03 Chief)

| # | 결정 |
|---|---|
| D1 | **서비스는 하나, 데이터에 지역 표시.** Firebase 프로젝트·DB를 국가·대륙별로 나누지 않는다 |
| D2 | **거리 순위 = 사람 기준(가).** 프로필의 대표 국가로 묶는다 |
| D3 | **정복·개척 순위 = 도로 기준(나).** 달린 도로가 있는 지역으로 묶는다 |
| D4 | ~~기간은 주·월, 연은 추후~~ → D14로 대체 |
| D5 | **도시 단위 보류.** 지역 단계는 대륙·국가·1단계 행정구역(ISO 3166-2)까지 |
| D6 | **공간 칸은 기존 지도 타일 체계로 통일.** Geohash는 도입하지 않고 타일 번호를 quadkey 문자열로 저장해 앞부분 일치 범위 검색에 쓴다 |
| D7 | **지역 판정은 서버 한 곳에서만.** 공개 경계 데이터로 좌표→국가·행정구역을 판정하고, 역지오코딩 API는 쓰지 않는다 |
| D8 | **순위는 기록 전체 훑기 → 사용자별 누적 점수로 전환**한 뒤 지역 범위를 붙인다 |
| D9 | 순서: 판정 모듈 → 공개 경로(Publication) 검색 목록 → 순위 → Trail 목록 → Conquest 지역 통계 |
| D10 | (11-03 2차) **국경 데이터는 한국 관점 판**(독도=KR) |
| D11 | (11-03 2차) **주·월 경계 = 각 사용자 시간대.** 기간 정의는 업계에서 흔한 방식을 따른다: 주 = 월요일 0시~일요일 24시(ISO 주), 월 = 달력 월 |
| D12 | (11-03 2차, 「흔한 방식」 지시에 따른 Supervisor 적용) 기간을 추가할 때는 **달력 연(1/1~12/31)** 을 쓴다. **전세계 「전체(all)」 순위는 유지**한다(Strava 구간 순위도 오늘·주·월·연·전체를 둔다). 「최근 90일」 같은 굴러가는 기간은 순위가 아니라 칭호용(Strava Local Legend 꼴) 후보로만 남긴다 |
| D14 | (11-03 3차, Chief 제안·Supervisor 동의) **연(달력 1/1~12/31, 사용자 시간대) 기간을 처음부터 넣는다.** 지역 순위 기간 = 주·월·연, 전세계는 여기에 전체(all) 추가 |
| D13 | (11-03 2차) 현재 가입 정보에 국가가 없으므로 **가입·계정에 국가 입력을 새로 만든다**(§4.2) |
| D15 | (11-03 4차) Q3·Q4 제안대로. 가입 카드 국가 한 줄(기기 시간대로 미리 채움·필수), 계정에서 30일 1회 변경, 기존 Google 사용자는 다음 접속 때 1회 확인. 준비 작업 G0.5를 계획에 넣고 G1과 진행 |

### 1.2 남은 확인 (Chief)

없음. Q3·Q4는 2026-11-03 Chief가 제안대로 승인했다(D15). 아래는 기록으로 남긴다.

| # | 질문 | Supervisor 권장 |
|---|---|---|
| Q3 | 국가 입력 방식 | 가입 카드(`SignUpNicknameCard.tsx`, 닉네임·칼로리)에 국가 한 줄을 **기기 시간대로 미리 채워** 넣고 확인만 받는다(필수). 계정에서 변경할 수 있되 **30일에 1회**(작은 나라로 옮겨 1위를 차지하는 조작 방지, Supervisor 제안). 화면은 시안 → Chief 승인 |
| Q4 | 기존 Google 사용자(5명) | 다음 접속 때 한 번만 「국가 확인」을 묻는다(미리 채움) |

## 2. 현재 코드 상태 (2026-11-03 확인)

| 데이터 | 현재 | 문제 |
|---|---|---|
| Publication `routePublications` | `firestoreRoutePublications.ts` 목록: `status==published` + `limit(80)`, 지역 조건 없음. 문서에 `geometryCoordsJson`(경로 전체 좌표) 포함 | 목록마다 좌표 전체를 받는다. 전세계 80개만 보인다 |
| 순위 `leaderboardCore.ts` | 캐시(5분) 만료 시 기간 안의 `rides` 전체를 페이지로 훑어 집계. 주·월 경계 KST 고정. 응답 `scope: "world"` | 비용이 주행 수에 비례한다. 해외 사용자 기간 경계가 어긋난다 |
| Trail 목록 `openTrailListings` | 원본과 분리된 투영 문서가 이미 있음(`openTrailListingCore.ts`). `updatedAt desc limit(40)`. 지역은 자유 문자열 `regionLabel` | 지역 필터가 없다(동시 Trail 수가 적어 급하지 않음) |
| Conquest | `conquest/{uid}/chunks/{z12}` · 셀 z20. 칸 계산은 `functions/src/geoTiles.ts` ↔ `apps/web/src/lib/conquest/conquestTiles.ts` 고정 벡터로 맞춤 | 지역별 통계가 없다 |
| 위치 | Firestore `asia-northeast3`(서울, 변경 불가) · Functions `asia-northeast3` · RTDB `asia-southeast1` | 유럽·미주의 동행 지연(§6) |

## 3. 지역 표시(geoRegion) 규격

### 3.1 필드 — 색인을 쓰기 위해 평평하게(flat) 둔다

| 필드 | 예 | 뜻 |
|---|---|---|
| `geoQuadkey` | `1321...`(z16, 16자) | 기준점이 속한 지도 타일. 앞부분 n자 = z(n) 상위 타일 |
| `geoContinent` | `AS` · `EU` · `NA` · `SA` · `AF` · `OC` · `AN` | 국가 코드에서 표로 구한다(UN M49 기준, 국가당 하나) |
| `geoCountry` | `KR` · `FR` · `US` | ISO 3166-1 alpha-2. 바다·판정 불가는 `null`(전세계 범위에만 나온다) |
| `geoAdmin1` | `KR-11` · `FR-IDF` · `US-NY` | ISO 3166-2. 없으면 `null` |
| `geoResolverVersion` | `1` | 경계 데이터가 바뀌면 올린다. 다시 채울 대상을 이 값으로 고른다 |

이름·표시 문자열(「서울특별시」)은 저장하지 않는다. 화면이 코드를 언어별 표로 바꿔 보여 준다.

### 3.2 기준점

- Publication·Trail: 기존 `courseGeometryAnchor.ts`의 기준점(경로 좌표에서 구한다). 국경을 넘는 경로도 한 지역에만 속한다.
- Conquest·개척: 기준점이 아니라 **새로 Claim한 z12 묶음(chunk)마다** 판정한다(§4.4). 도로 기준(D3)을 지키기 위해서다.

### 3.3 판정 모듈 (G1)

- 위치: `functions/src/geoRegion/`. 순수 모듈로 Firestore를 import하지 않는다. 서버만 판정하고 클라이언트는 판정하지 않는다. 이렇게 해서 `geoTiles.ts` 주석의 「세 번째 구현」 사고를 막는다.
- 경계 데이터: Natural Earth admin-0·admin-1(public domain). 1:10m을 단순화해 쓴다.
- **분쟁 지역 표기**: Natural Earth 관점(POV)별 판 중 **한국 관점 판**을 쓴다(D10, Chief 확정). 어느 판인지 `geoResolverVersion` 기록에 남긴다.
- 속도(G1 구현으로 확정 — 처음 안이던 z8 조회표 대신): 경계를 **단순화(허용오차 0.002°≈200m)·정수 차이값·gzip**으로 4.8MB까지 줄였다. 국가 경계(1.5MB)는 첫 판정 때 읽고, **행정구역은 그 나라가 처음 나올 때만** 읽는다. 다각형 판정 전에 bbox로 거른다. 조회표가 없어 생성·검증할 것이 하나 줄었다. 실측은 §3.4.
- 고정 시험값(G1 완료 조건): 22개 지점 + 규칙 시험 8개 = 30개(`functions/src/geoRegion/geoRegion.test.ts`). 사보타주: KR-11을 KR-41로 바꾼 데이터에서 2개 FAIL → 복원 후 30/30.
- 계측: §3.4.

### 3.4 G1 결과 (2026-11-03, Claude Code 직접 구현)

| 항목 | 값 |
|---|---|
| 파일 | `functions/scripts/geo-region/build-geo-data.mjs`(생성기) · `functions/geo-data/v1/`(데이터 4.8MB, 국가 239·행정구역 3,813) · `functions/src/geoRegion/geoRegionCore.ts`(순수 판정) · `geoRegionData.ts`(적재) · `geoRegion.test.ts` |
| 첫 판정(국가 전체+KR 적재) | 70ms, heap +12MB (로컬 Node 24) |
| 새 나라 첫 판정(RU, 가장 큼) | 12ms, heap +0.4MB |
| 이후 판정 | 평균 0.21ms/점 |
| 재생성 | 같은 입력 → 같은 파일(md5 일치) |
| 시험 | geoRegion 30/30, functions `npm test` 201/201, eslint 0 |

원본 데이터에서 찾아 생성기에 고정한 사항:

- **나라마다 행정구역 단위가 다르다.** 원본이 ISO 첫 단계보다 잘게 나눈 나라는 묶었다. 영국은 자치구 232개 → 잉글랜드·스코틀랜드·웨일스·북아일랜드, 프랑스는 도 101개 → 레지옹(`FR-IDF`), 이탈리아는 현 → 주(`IT-25`), 스페인은 주 → 자치지방(`ES-MD`, 코드 차이 4개는 표로 정정), 필리핀은 주 → 지방. 나머지 나라는 ISO 코드를 그대로 쓴다(슬로베니아·라트비아처럼 ISO 자체가 기초자치단체인 작은 나라는 그대로 둔다).
- **원본 코드 오류**: 모스크바 시·주 코드가 뒤바뀌어 있어 정정했다. 프랑스 `FR-IDF` 뒤에 탭 문자가 붙어 있어 공백을 제거했다. 앞으로 오류를 찾으면 `ADMIN1_CODE_FIXES`에 더하고 버전을 올린다.
- **독도**: 한국 관점 판 국경에는 있고, 행정구역 데이터에는 없다 → 가장 가까운 같은 나라 행정구역 규칙으로 `KR-47`(경북)이 된다.
- **크림**: 원본 행정구역 표기가 엇갈려 있다(코드 `UA-43`, 소속 국가 RUS). 코드 접두어로 묶어 한국 관점 판 국경(UA)과 맞췄다.
- **국가 코드 없는 영토 6곳**(군사기지·분쟁 암초: BRT·ESB·PGA·SCR·USG·WSB)은 제외했다 → 그 안의 점은 가장 가까운 나라 또는 null.
- **해안·작은 섬 보정**: 국경 밖 30km 안은 가장 가까운 나라, 행정구역은 같은 나라 안 150km 안. 태평양 한가운데는 null(전세계 범위에만 들어간다).

다음 버전 후보(필요해지면): 경계 근처 정밀도(현재 약 200m), 행정구역 단위 국가별 재검토, 원본 판 갱신 시 시험값 재확인.

## 4. 데이터별 설계

### 4.1 Publication 검색 목록 (G2) — 가장 급함

- 새 컬렉션 `publicationListings/{publicationId}`. 이미 검증된 `openTrailListings` 방식(원본은 그대로 두고 서버 트리거가 목록 문서를 만든다)을 따른다. `routePublications` 원본·`geometryCoordsJson`은 건드리지 않는다. Ontology상 Publication은 불변 스냅샷이고, 필드 이동은 rename급 결정이 되기 때문이다.
- 필드: `publicationId` · `publicTitle` · `snapshotDistanceMeters` · `snapshotProfile` · `status` · `startLngLat` · `bbox` · geoRegion 5종 · `riderCount`(`routeActivity`에서 반영, 낮은 빈도) · `createdAt` · `updatedAt`.
- 쿼리:
  - 국가: `geoCountry == X, status == published, orderBy createdAt desc, limit N`
  - 대륙·행정구역: 같은 꼴
  - 지도 화면·주변: 화면을 덮는 타일 몇 개(줌에 맞춘 단계)를 구하고, 타일마다 `geoQuadkey` 앞부분 범위 쿼리를 보낸 뒤 화면 밖 결과를 거른다
- Rules: 공개 읽기·서버만 쓰기(`openTrailListings`와 같은 꼴).
- 클라이언트 목록 전환은 기존 `limit(80)` 경로를 대체한다. 지역 선택 화면은 **시안 → Chief 승인 후** 구현한다(디자인 고정 목록 규칙).

### 4.1.1 G2 결과 (2026-11-04, Claude Code 클라우드 세션 직접 구현 · 미배포)

| 항목 | 값 |
|---|---|
| 서버 | `functions/src/publicationListingCore.ts`(순수 투영) · `publicationListingStore.ts`(읽기·쓰기) · `publicationListingProjection.ts`(트리거 `publicationListingOnPublicationWritten`) · `cliBackfillPublicationListings.ts`(`npm run admin:backfill-publication-listings`, 기본 dry-run) |
| 목록 문서 | §4.1 필드에서 `riderCount`는 **뺐다**(지금 화면이 안 쓰고, `routeActivity` 반영은 쓰기를 늘린다 — 화면이 필요해질 때 추가). 대신 카탈로그가 쓰는 `routeId`·`snapshotDurationSec`·`applicantUid`·`publisherDeleted`, 규격 판 `listingSchemaVersion`을 더했다 |
| 목록 대상 | published 만. archived·삭제·좌표 이상 → 목록 문서 삭제. 그래서 쿼리에 `status` 조건이 필요 없다 |
| 지역 기준점 | 경로 첫 좌표(출발점) |
| 쓰기 줄이기 | 동행 켜기(`presenceEnabled`·`updatedAt`만 바뀜)는 즉시 반환, 내용이 같으면 다시 쓰지 않음 |
| Rules·색인 | `publicationListings` 공개 읽기·쓰기 금지. 색인 `geoContinent`·`geoCountry`·`geoAdmin1` + `createdAt desc` 3개 |
| 웹 | `listPublishedPublicationListings`(최근 등록순, 최대 80) → 카탈로그. 비었거나 읽기 실패면 옛 `routePublications` 쿼리로 물러난다(배포 순서 보호). 지역 선택 화면은 아직 없음(시안 → Chief 승인) |
| 탈퇴 | 정책표에 `publicationListings: none` — 원본 익명화를 트리거가 따라 쓴다 |
| 시험 | functions `npm test` 247/0(새 단위 9), 에뮬레이터 `npm run test:publication-listings:emulator` 5/5(최근순·국가·행정구역·대륙·타일 앞부분·비공개 전환·Rules), Rules 사보타주(쓰기 허용) → 1 FAIL. 채우기 에뮬레이터: dry-run 만들기 5·지우기 2 = apply 5·2, 재실행 변경 0 |
| 미측정 | 목록 화면 읽기 비교 — 읽기 수는 문서당 1회로 같고(최대 50건) 줄어드는 것은 좌표를 안 받는 전송량이다. 운영 데이터로 재야 한다 |

배포 순서(Chief 승인 필요): ① `firebase deploy --only firestore:rules,firestore:indexes,functions:publicationListingOnPublicationWritten` ② 내보내기 스냅샷 뒤 `npm run admin:backfill-publication-listings`(dry-run) → `-- --apply` ③ Hosting(언제든 — 물러남이 있어 ①② 전에 올라가도 목록이 비지 않는다). 유럽 RTDB Rules와 무관.

### 4.2 사용자 (G3 선행)

- 현재 `users/{uid}`·가입 카드에는 국가가 없다(2026-11-03 확인: `SignUpNicknameCard.tsx` = 닉네임·체중·체력).
- `users/{uid}.homeCountry`(ISO alpha-2, 본인이 확정한 값)와 `homeCountryChangedAt`(30일 제한용)을 추가한다.
- 미리 채우기: 기기 시간대(`Intl.DateTimeFormat().resolvedOptions().timeZone`)를 IANA `zone1970.tab`의 시간대→국가 표로 바꾼다. 언어 설정(`en-US`를 쓰는 한국 사용자 등)보다 정확하다. GPS·IP로 추정해 저장하지 않는다.
- **시간대는 입력받지 않는다.** 주행 저장 시 기기 시간대를 `rides.timeZone`에 함께 적고, 기간 키는 그 주행의 시간대로 계산한다(D11). 실내 주행이라 대개 집 시간대와 같다.
- 게스트는 국가를 묻지 않는다. 기기 시간대 추정값은 「예상 순위」 계산에만 쓰고 저장하지 않는다.
- 미설정 사용자는 거리 순위에서 대륙·국가 범위 없이 **전세계 범위에만** 들어간다.
- 공개 프로필에는 국가만 보인다.

### 4.3 순위 (G3)

새 컬렉션 `leaderboardScores/{docId}`. 사용자 × 판 × 기간 × 범위마다 문서 하나를 둔다.

| 필드 | 예 |
|---|---|
| `board` | `distance` · `pioneer` |
| `periodKey` | `W2026-45` · `M2026-11` · `Y2026` · `all`(전세계만) |
| `scopeType` · `scopeCode` | `world/-` · `continent/AS` · `country/KR` · `admin1/KR-11` |
| `uid` | 응답에는 싣지 않는다(기존 원칙 유지) |
| `metersT1` · `metersAll` | 센서 인정분 / 전체. `LEADERBOARD_SENSOR_ONLY` 전환이 계속 서버 한 곳에서 되도록 둘 다 누적한다 |

- 쓰기: 주행 저장 트리거에서 `FieldValue.increment`로 더한다. 사용자마다 문서가 따로라서 한 문서에 쓰기가 몰리지 않는다.
  - 거리(D2): 범위 = 전세계 + 대륙 + `homeCountry` (행정구역은 집 지역을 받지 않으므로 없음)
  - 개척(D3): 범위 = 전세계 + 새로 Claim한 도로가 속한 대륙·국가·행정구역. §4.4의 묶음별 판정 결과를 쓴다
- 기간 키: 주행 종료 시각을 그 주행의 `rides.timeZone`으로 바꿔 ISO 주·달력 월을 구한다(D11). 시간대 정보가 없는 옛 주행은 `Asia/Seoul`로 본다.
- 「이번 주 순위」 조회는 **요청한 사람의 시간대로 본 이번 주 키**를 쓴다. 날짜변경선 양쪽 사용자는 같은 순간에 서로 다른 주 키를 볼 수 있다. 이는 각자 「내 주」 원칙(D11)에 따른 의도된 결과다.
- 읽기: 상위 목록은 `board, periodKey, scopeType, scopeCode ==` + `orderBy(활성 meters 필드) desc` + `limit(20)`. 내 순위는 「나보다 큰 사람 수」를 `count()`로 구해 +1 한다(인덱스 1,000건당 1회 읽기). 기존 5분 캐시는 범위별로 유지한다.
- 대표 국가를 기간 중에 바꾸면: 이후 주행만 새 국가로 들어가고 이미 쌓인 점수는 옮기지 않는다.
- 개척 `uses`(내 Publication을 남이 달린 수)는 처음에는 전세계에서만 유지한다.
- **계정 삭제·게스트 정리**: `accountDeletionCore.ts` 컬렉션 목록과 게스트 정리(`purgeGuestUsersCore.ts`)에 `leaderboardScores`를 등록한다. 빠뜨리면 지운 사용자가 순위에 남는다.
- **전환 게이트**: 같은 기간에 대해 기존 훑기 집계와 새 누적 점수의 상위 20위·값이 일치해야 바꾼다(합성 데이터 + 운영 데이터 1회 비교).

### 4.4 Conquest 지역 통계 (G5, 개척 순위의 재료는 G3에서 먼저)

- `conquestOnRideCreated.ts`는 이미 `newCellsByChunk`(z12 묶음별 새 셀)를 만든다. 묶음 중심점을 판정 모듈로 지역에 대응시키고, 지역별 `newMeters`를 합쳐 `rides.conquestResult.byRegion`에 남긴다.
- 개인 누적 통계: `conquest/{uid}/regions/{scopeCode}` → `{ meters, cells, lastRideAt }`.
- 「내 Conquest」 국가·도시 필터는 묶음 ID → 지역 판정으로 화면에서 거른다. 저장 구조(`chunks`)는 바꾸지 않는다.
- 국경 묶음(한 변 약 7.8km)은 중심점 지역으로 몰린다. 최대 수 km 오차가 있다는 것을 문서에 남기고, 필요해지면 셀 단위 판정으로 정밀화한다.

### 4.5 Trail 목록 (G4)

- `openTrailListingCore.ts`가 Publication의 geoRegion을 목록 문서에 복사한다(새 판정 없이 복사만).
- 쿼리는 §4.1과 같은 꼴이다. 실시간 참가자 정보는 지금처럼 RTDB에 두고 목록에는 인원 수만 둔다.

## 5. 단계·완료 조건

| 단계 | 내용 | 완료 조건 |
|---|---|---|
| G0 | 결정 | ✔ D1~D15 |
| G0.5 | 이전 준비(§5.1) | 항목별 완료 조건 |
| G1 | 판정 모듈 + 경계 데이터 생성 | ✔ 2026-11-03 완료(§3.4), Chief 승인 커밋 |
| G2 | `publicationListings` 트리거 + 기존 Publication 채우기 + 클라이언트 목록 전환 | 에뮬레이터 국가·화면 범위 쿼리 시험, 채우기 dry-run 건수 = 실제 건수, 목록 화면 읽기 수 비교 기록 |
| G3 | 사용자 국가 입력(시안 승인)·주행 시간대 기록 → 누적 점수 → 기존 집계와 대조 → 지역 범위·화면 | §4.3 전환 게이트, 계정 삭제 시험, 범위 선택 시안 Chief 승인 |
| G4 | Trail 목록 지역 필드·필터 | 목록 투영 시험(`openTrailListingProjection.test.ts`) 확장 |
| G5 | Conquest 지역 통계·내 도로망 필터 | 국경 묶음 시험, 기존 주행 채우기 |

- 기존 데이터 채우기는 `functions/src/cliBackfill*` 방식(dry-run → 실행 → 감사)을 따른다.
- **Firestore 백업이 꺼져 있으므로** 운영 채우기 전에 내보내기 스냅샷을 만들고 Chief 승인을 받는다. 원본(`rides`·`conquest`·`routePublications`)에는 쓰지 않고 새 필드·새 컬렉션만 만든다.
- 각 단계는 별도 지시서(`01-task-g1.md` …)로 연다. Rules·인덱스·Functions 배포는 단계별로 승인받는다.

### 5.1 G0.5 이전 준비 — 「서버는 하나」 가정 풀어 두기 (D15)

목적: RTDB·Firestore를 나중에 지역별로 늘릴 때 **설정 변경 수준**으로 끝나게 한다. 근거는 §6 「서울 리전 재검토 시점」.

| # | 항목 | 내용 | 완료 조건 |
|---|---|---|---|
| P1 | Trail 동행 서버 지정 | Trail 생성 시 `trails/{id}.motionInstance`(지금은 항상 `asia-southeast1` 기본 인스턴스)를 기록한다. 클라이언트 `rtdbTrailMotion.ts`·`serverClockOffset.ts`는 이 값으로 고른 인스턴스에 접속한다(`getFirebaseDatabase(instance?)`). 값이 없는 옛 Trail은 기본 인스턴스 | peer-sync 재생 하네스 PASS, 실주행 동행 2인 확인, 필드 없는 Trail 호환 시험 |
| P2 | 서버 정리의 인스턴스 목록화 | `accountDeletionHttp.ts`·`guestLifecycleAdmin.ts`가 기본 `getDatabase()` 하나 대신 **인스턴스 목록 상수 한 곳**(`functions/src/rtdbInstances.ts`)을 돈다 | 목록에 가짜 인스턴스를 더한 시험에서 둘 다 그 인스턴스를 정리 |
| P3 | 동행 지연 기록 | 받은 위치 신호마다 (수신 시각 − 송신 서버 시각)을 서버 시계 보정으로 계산해 주행 중 p50·p95를 모으고, 주행 저장 시 `rides.netStats.motionLatencyMs`와 기기 시간대를 함께 남긴다 | 합성 지연 주입 시험(200ms 넣으면 약 200ms 기록), 고빈도 DEV 로그 금지 |
| P4 | 핵심 흐름 소요 시간 | 주행 시작(▶~running)·주행 저장(종료~저장 완료) 소요 ms를 `rides.netStats`에 남긴다. 서버 왕복을 연달아 기다리는 곳을 목록으로 만든다(고치는 것은 별도) | 값이 실제로 0이 아님 확인(축퇴값 방지), 목록 문서 |
| P5 | 접근 통로 게이트 | Firestore는 `getFirebaseFirestore()`, RTDB는 `getFirebaseDatabase()` 밖에서 `getFirestore(`·`getDatabase(`를 직접 부르면 pre-push에서 막는다(기존 구조 게이트 도구 모음에 추가). 사용자 데이터와 전세계 집계를 한 트랜잭션에 묶지 않는 규칙은 이 문서·지시서에 둔다 | 위반 파일을 하나 만들면 게이트가 FAIL(사보타주) |

순서: P5 → P2 → P1 → P3·P4(G3 순위 작업에서 `rides` 쓰기를 만질 때 함께). P1은 동행 코드라 peer-sync 스킬 절차를 따른다.

진행 (2026-11-03, Claude Code 직접, P5·P2 Chief 승인 커밋):
- **P5 완료**: `scripts/check-firebase-accessors.mjs` + pre-push 11종째 + `verify-gates-alive` 2항목. 현재 위반 0. 사보타주 4건(웹 직접 열기·서버 직접 열기·통로 옮김 → FAIL, 주석만 → PASS).
- **P2 완료**: `functions/src/rtdbInstances.ts`(기본 + `EXTRA_MOTION_RTDB_URLS`, 지금 빈 목록). 계정 삭제·게스트 정리·고아 탐색이 추가 인스턴스도 돈다(기본값 빈 목록이라 지금 동작은 같음). 시험 +3, functions 204/204, 사보타주(추가 인스턴스 무시) → 2 FAIL.
- **P1 1차 완료(이름표+Rules, 미배포)**: `apps/web/src/lib/trail/trailMotionInstance.ts`(목록 `default`), Trail 생성 시 `motionInstance: "default"`, `firestore.rules` 생성=허용 목록·수정=변경 금지. 계약 시험 3/3(Rules 목록에 이름만 더하면 FAIL), 에뮬레이터 Rules 시험 8/8(`npm run test:trail-motion:rules`, 검사 제거 시 2 FAIL). web tsc 0·의존 방향·정련·통로 게이트 PASS, test:quick 1477/1(`ride-moments-dom` — 묶음 병렬 vite 캐시 삭제 경합 ENOTEMPTY, 단독 1/1 PASS, 기존 결함). 운영 Rules는 생성 시 추가 필드를 허용하므로 Hosting·Rules 배포 순서 무관.
- **유럽 RTDB 생성(11-03, Chief 승인)**: `boxcycle-dc2df-eu-rtdb`(europe-west1), 주소 `https://boxcycle-dc2df-eu-rtdb.europe-west1.firebasedatabase.app`, RTDB Rules 배포(비로그인 401 확인). 아직 아무도 접속하지 않는다(비용 0). 2차: 이름표 `eu` 추가(앱 목록·Rules·계약 시험), Trail 생성 시 개설자 기기 시간대 `Europe/*` → `eu`, `rtdbTrailMotion.ts`·`serverClockOffset.ts` Trail별 인스턴스 접속, `EXTRA_MOTION_RTDB_URLS`에 유럽 주소, `firebase.json` 다중 인스턴스(+하네스 설정 재생성), peer-sync 재생·에뮬레이터 다중 인스턴스 시험.
- **P1 — Chief가 권장안 승인(11-03)**: ① `motionInstance`는 주소가 아니라 **정해진 이름표**(`default` 등)여야 한다. Trail 문서는 클라이언트가 쓰므로, 주소를 그대로 받으면 악의적 사용자가 남의 동행 위치를 자기 서버로 보내게 만들 수 있다. 그래서 Firestore Rules에 허용 목록·변경 금지를 넣어야 하고, 이는 **Rules 배포**다. ② 실시간 동행 코드(`rtdbTrailMotion.ts`·`serverClockOffset.ts`)의 접속을 Trail별로 나누는 변경이라 peer-sync 재생·실주행 확인이 필요하다. 지금은 인스턴스가 하나뿐이라 당장 얻는 것이 없다. 권장: **이름표 필드 + Rules만 지금**(값은 항상 `default`, 클라이언트 접속 코드는 그대로), 접속 분리는 지역 서버를 켜기 직전에 한다.

### 5.2 지역 서버 추가 비용 추정 (2026-11-03)

**결론: 유럽 RTDB를 더해도 비용은 사실상 같다.** RTDB 요금은 서버 수가 아니라 내려받은 양에 붙는다(다운로드 $1/GB, 무료 약 10GB/월은 프로젝트 전체, 추가 인스턴스 고정 요금 없음, 위치별 요금 표기 없음 — [Firebase 요금](https://firebase.google.com/pricing)). Trail 하나는 한 서버에만 있으므로 중복 전송도 없다.

가정(실제 이용 데이터가 없어 일반값 — 운영 rides 1,164건은 테스트라 중앙값 2.9분·함께 주행 5%):
- 활성 사용자 1명 = 월 10시간 주행, 그중 30%를 평균 4명 Trail에서 달림 → 받는 동행 스트림 평균 0.9개.
- 전송량: 5Hz = 시간당 18,000표본. 받는 표본 약 150B, 내 표본 응답 약 50B([10-29 실측](../20261029-peer-cost-quality/07-traffic-reduction-implementation.md) 하향 3,483B/20표본 기준). → 라이더 1시간 약 3.3MB, 사용자 1명 월 약 33MB.

| 활성 사용자 | RTDB 월 다운로드 | 서울 하나 | 서울+유럽(절반 유럽) | Firestore 4초 위치 복제(쓰기+읽기, 참고) |
|---|---:|---:|---:|---:|
| 100 | 3.3GB | $0 | $0 | 약 $0~1 |
| 1,000 | 33GB | 약 $23 | 약 $23 | 약 $10~20 |
| 10,000 | 330GB | 약 $320 | 약 $320 | 약 $100~210 |

- Firestore 칸은 위치 쓰기 시간당 900회 + 동행 읽기 시간당 810회만 센 값이다. 단가는 서울 요금표를 확인하지 못해 미국 단가 범위(읽기 $0.03~0.06, 쓰기 $0.09~0.18 /10만)로 계산했다. 메뉴·목록·순위 읽기는 빠져 있다.
- 비용을 움직이는 것은 **주행 시간 × 함께 달리는 비율**이다. 모두 4명씩 달리면 RTDB는 약 2.5배가 된다.
- 비용 쪽에서 먼저 손볼 것은 서버 추가가 아니라 Firestore 4초 위치 복제다(HANDOFF 다음 한 걸음 1). 규모가 RTDB와 비슷하다.

## 6. 이번 범위 밖 (기록만)

- 도시 단위(D5)
- 「최근 90일 터줏대감」 칭호 — 기능은 별도 결정. 재료(`rides.timeZone`·`rides.conquestResult.byRegion`)는 G3·G5에서 남기므로 나중에 지난 기록으로 계산할 수 있다
- **RTDB 지역 분산**: 동행 신호가 싱가포르(`asia-southeast1`)를 왕복한다. 유럽 사용자끼리 달리면 왕복 지연이 보간 지연 설정(`peerMotion`)에 직접 영향을 준다. 한 프로젝트에 RTDB 인스턴스를 여러 개 둘 수 있으므로 「Trail 지역 → RTDB 인스턴스」 배정이 후보다. 해외 사용자가 생기면 계측부터 한다.
- Functions 리전 다중화(`region.ts` 단일 상수 원칙 유지)
- **Firestore 서울 리전 재검토 시점** — 아래 중 하나가 생기면 검토한다.
  1. 해외 사용자 비중이 커진다(제안 기준: 주간 활성 사용자의 30%). 또는 미국·유럽 정식 마케팅을 시작한다.
  2. 해외에서 잰 주행 시작·저장 대기가 목표를 넘는다. 순차 왕복 한 번에 대략 미국 서부 +130ms, 미국 동부 +200ms, 유럽 +250ms가 붙는다(일반적인 인터넷 왕복 기준 추정, 실측 필요).
  3. 특정 국가 데이터 보관 규정이나 기업 계약(예: 유럽 체육관 체인)이 현지 저장을 요구한다.
  4. 서울 리전 장애가 해외 낮 시간 전 사용자를 멈추게 하는 것이 사업상 문제가 된다(지금은 단일 리전).
  - 준비: G2·G3에서 핵심 흐름(주행 시작·저장·목록·순위) 클라이언트 소요 시간을 시간대 꼬리표와 함께 남긴다.
  - 먼저 쓸 완화책: 공개 목록·순위 응답을 Hosting CDN 캐시로 내보낸다(해외 가장자리 서버에서 응답).
  - 마지막 수단: 같은 프로젝트에 **다른 위치의 Firestore DB를 추가**한다(한 프로젝트 여러 DB 지원). 다만 사용자·전세계 순위가 어느 DB에 속하는지 정해야 하므로 별도 설계다.
- 물리적 DB 분리(D1에 따라 하지 않는다)
