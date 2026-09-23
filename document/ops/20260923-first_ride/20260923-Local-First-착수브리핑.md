# 착수 브리핑 — Local First Ride (개발팀장 = 커서)

> 이 문서는 **맥락**이다. 할 일은 `20260923-지시01-*.md` 에 있다.
> 먼저 이 문서를 읽고, 그다음 지시01 을 읽고, 바로 착수하라.

## 1. 이 묶음이 풀려는 문제

첫 사용자가 지도를 열면 도로는 보이는데 **「어디를 달려야 하지?」** 에 답이 없다.
RTW 는 Street View 를 쓰지 않기로 했으므로, 특정 장소에 대한 호기심은 영상이 아니라
**사용자와의 관계성**(내가 아는 동네)에서 와야 한다.

그래서 경험 순서를 이렇게 바꾼다:

```
Recognition → Ride → Claim → Explore → Choose
(여기 내가 아는 곳인데) → (일단 달려보자) → (달린 길이 내 것이 됐다) → (저 길도?) → (내가 고른다)
```

지시01 은 이 중 **Recognition 한 칸**이다. 경로 생성(Ride)은 지시02 다.

## 2. 반드시 먼저 알아야 할 것 — 이미 있는 것을 다시 만들지 마라

| 네가 만들고 싶어질 것 | 이미 있는 것 |
|---|---|
| 경로 자동 생성기 | `functions/src/distanceAutoRouteCore.ts` — 후보 스윕(거리 7종 × 방위 5종) · 도로 스냅 · 거리 오차 스코어 · 목표 절단 · 호출 예산 13회 |
| 지명 → 좌표 | `components/MenuPlaceSearch.tsx` (Mapbox geocoding). 새 검색 UI 를 만들지 마라 |
| 지도 카메라 이동 | `App.tsx` 의 `setExternalCameraJump({ lngLat, zoom, requestId })` — `NextRideCard` 가 쓰는 것과 같은 것 |
| 첫 화면 카드 자리 | `components/ride/FirstRideIntroCard.tsx` + `firstRideIntroVisible` 게이트(`App.tsx:1692` 근처). `NextRideCard` 와 **같은 좌하단 anchor** 를 공유하며 동시에 뜨지 않는다 |
| Claim 데이터 | `rides/{id}.conquestResult.newMeters` · `conquest/{uid}` · `hooks/useConquest.ts` |

**자체 도로 그래프(Edge/Node)를 만드는 것은 미채택 결정이다**(결정 로그 09-23).
OSM 원데이터 파이프라인을 들이지 마라. 후보 스윕 확장으로 간다.

## 3. 용어 (UI 문자열은 Ontology 가 지배한다)

- **Ready Ride** — 시스템이 사용자 대신 만들어 바로 달릴 수 있게 내놓은 Route.
  **사용자 노출 명칭으로 확정**됐다(Ontology §2.2). 영문 그대로 쓰고 조사를 붙인다 —
  「Ready Ride를 시작」. 한글 음차(레디 라이드)·번역어 병행 **금지**
- **새 데이터 모델을 만들지 마라.** Ready Ride 의 그릇은 Route(필요 시 SavedRoute)다.
  새 Firestore 컬렉션·새 상태 기계 금지
- 구분해야 하는 셋: **추천 코스**(목록에서 고름) · **입문 코스**(고정 3경로) · **Ready Ride**(한 건이 제시됨)
- 금지어: Room·방·Lobby·로비(→ Trail·Trailhead), 「비로그인」(→ 인증 전 / Guest),
  z20·셀·타일(→ 내 도로망·새 도로 +N km), 신규 코드의 `course`/`courseId`(→ `route`/`publication`)

## 4. 이 앱의 물리적 제약 (자주 잊힌다)

- **폰 가로 전용**이다. 세로는 회전 오버레이가 덮는다. 가로에서 루트 글꼴 13.5px
- **폰 가로 실제 CSS 높이는 약 275px** 이다. 900×400 에서만 재면 실기와 100px 이상 어긋난다
- 지도 위에 얹는 UI 는 `pointerdown`/`touchstart` 를 막지 않으면 **터치가 지도로 샌다**(이 리포 4회 반복)
- 실내 주행이다. 사용자는 그 길을 **눈으로 보지 못한다** — 「내가 아는 곳」을 전달하는 매체는
  지명 라벨·초기 줌·카피뿐이다. 이 라운드의 성패가 거기 달려 있다

## 5. 보고 규약

- 수행결과는 `20260923-지시01수행결과-<내용>.md` 로 **이 폴더에 쓴다**
- 보고에 항상 포함: **워크트리 · 브랜치 · `npm run dev` URL · `git diff --stat -- apps/web/src`**
- 캡처는 지시서 §캡처 목록을 **전부** 채운다. 빠지면 내용과 무관하게 반려
- `git commit`·`git push` **금지**. 커밋은 감리 승인 후 별도 지시한다
- 같은 수정 3회 실패 · 브라우저 5분 무진전이면 **멈추고 감리에 올려라**. 혼자 4회째를 시도하지 마라
