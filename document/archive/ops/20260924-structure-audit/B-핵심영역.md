# B — 핵심 기능 영역 구조 감사 (2026-09-24)

> 읽기 전용 조사. 10개 영역의 진입점·의존·결합·legacy·정비 위험도.
> 라벨: `ACTIVE` `SUPPORT` `LEGACY` `DUPLICATE` `DEAD` `EXPERIMENTAL`
> 조사 방법은 §부록.

## 0. 영역 위험도 요약

| 영역 | 정비 위험도 | 한 줄 근거 |
|---|---|---|
| Map | **높음** | `MapView.tsx` 4,903줄 · props 89개 · useState/useRef 96개 — 7개 영역이 이 한 파일에 모인다 |
| Route | **높음** | 경로 생성 경로가 **3갈래**(클릭 Directions · 거리자동 · Ready Ride), 공통 코어 없음 |
| Ride | **중간** | 종료·저장 커널은 `rideEndPersistence.ts` 로 분리됐으나 훅이 App state 20+개를 ref 로 역주입받는다 |
| Trail | **중간** | `rooms→trails` 마이그레이션 완료 선언에도 `?room=` 하위호환·`lobbySpectator*`·`roomId` 잔존 |
| Claim(Conquest) | **낮음** | `useConquest`/`firestoreConquest`/`conquestTiles` 3층 분리, 외부 결합 얇음 |
| Rider | **중간** | 렌더 모드 4종(`legacy`·`iso2d`·`glb`·`preserved`) 동거, `legacy` 는 도달 불가 |
| Firebase | **낮음** | `firebase.ts` 단일 게이트웨이 · 지연 초기화 일관. 단 `firestore*.ts` 20개로 분산 |
| Session | **중간** | live 퍼블리시 채널 3개(Firestore global · Firestore route · RTDB motion)를 fanout 1함수가 떠안음 |
| Camera | **중간** | 상태 App · 계산 lib 3곳 · 적용 MapView 3단 분산, UI 표면 2개 |
| RouteDock | **낮음** | 표시 판정이 `routeDockUiPolicy` 단일 진실로 모임 — 이 영역만 모범 사례 |

---

## 1. Map

**주요 파일**

| 경로 | 라벨 |
|---|---|
| `components/map/MapView.tsx` (4,903L, 184KB) | ACTIVE |
| `components/map/mapViewTypes.ts` (7L) | SUPPORT |
| `components/map/MapViewSheet.tsx` | ACTIVE |
| `features/map-overlays/useAppMapOverlays.ts` (24KB) | ACTIVE |
| `features/map-overlays/AppMapStage.tsx` · `DebugMapStage.tsx` | ACTIVE / EXPERIMENTAL |
| `lib/map/rtwMapConfig.ts` · `mapGlobeView.ts` · `mapBootCenter.ts` | SUPPORT |
| `components/MapView.tsx` (1L) | DUPLICATE(shim) |

**진입점** — `App.tsx` → `<AppMapStage>` / `<DebugMapStage>` → `<MapView>`. 오버레이 데이터는 `useAppMapOverlays()` 가 App 에서 한 번 호출되어 props 로 흘러든다.

**의존** — mapbox-gl, three(라이더 레이어), `lib/activity/activityWorldLod`, `lib/conquest/conquestLayerEmphasis`, `lib/distanceAutoRoute*` 4파일, `lib/riderPrototype/*` 6파일, `lib/camera/rideCameraFraming`, `components/map/rideCameraFollow`, `services/coverageOverlaySync`, `services/mapboxReverseGeocode`.

**다른 영역과 연결되는 지점**

- Route: `onSelectPoint`·`openRoutePickRequest`·`onAutoRouteMapPick`·`autoRoute*` props 9개
- Camera: `rideCameraDistanceM`·`rideFollowCameraNonce`·`followMode`·`externalCameraJump`
- Rider: `liveRiderMotion`·`riderPrototype/*` 직접 import
- Claim: `conquestTraces`·`conquestLiveTraveledMeters`·`onLookupPioneer`
- Session: `trailSpectatorDots`·`globalPresenceDots`
- Trail: `trailSpectatorRoutes`
- RouteDock: `lib/map/mapPickRouteDock.ts` — 맵이 dock 의 화면 사각형을 알고 팝업 위치를 피한다(**역방향 결합**)

**중복/legacy**

- `components/MapView.tsx`·`MapViewSheet.tsx`·`MapillaryRideViewer.tsx` = `export * from "./map/..."` 1줄 shim. App.tsx 는 **아직 shim 경로로 import**(`App.tsx:75`).
- 퇴역 용어 하드코딩: `MapView.tsx:172-179` 의 Mapbox source/layer id 7개가 `boxcycle-lobby-spectator-*`. 상수명은 `TRAIL_SPEC_*` 로 바뀌었으나 **문자열 id 는 lobby 그대로**.
- `RIDER_PROTOTYPE_MODE === "iso2d"` 분기 4곳이 MapView 본문에 잔존(기본값은 `preserved`).

**구조적 문제**

1. props 89개 · 내부 상태 96개 — Map/Route/Ride/Rider/Camera/Claim/Session **7영역의 렌더 책임이 한 파일**.
2. 레이어링 역전: `lib/map/mapGlobeView.ts:2` 가 `components/ride/RideRoutePanel` 에서 `FollowMode` 를 import. **코어가 UI 패널 타입에 의존**.
3. 우회 경로: `lib/map/distanceAutoRouteMapBridge.ts`·`routeTokenSpendBridge.ts`·`mountRouteTokenPopupFeedback.ts` — props 를 안 거치고 전역 레지스트리로 맵에 명령을 꽂는 bridge 3개.
4. `DebugMapStage` + `mapDebugPhase.ts` 의 `debugIsolation` 이 오버레이 체인 전체를 우회 가능 — 정식 경로와 병렬로 사는 **두 번째 맵 스택**.

**정비 위험도: 높음** — 파일 하나를 건드리면 7영역이 동시에 흔들린다.

---

## 2. Route

**주요 파일**

| 경로 | 라벨 |
|---|---|
| `hooks/useRoutePlanning.ts` (11KB) — 클릭 A→B, Mapbox Directions | ACTIVE |
| `hooks/useDistanceAutoRoute.ts` (16KB) — 클릭 방향+거리 자동 | ACTIVE |
| `hooks/useReadyRide.ts` + `lib/route/readyRide.ts` — 2026-09-23 신규 | ACTIVE |
| `lib/route/repo/firestoreSavedRoutes.ts` (26KB) · `savedRoutesLocal.ts` | ACTIVE |
| `lib/route/repo/firestoreCourses.ts` (20KB) | ACTIVE, 이름만 LEGACY |
| `lib/route/repo/firestoreRoutePublications.ts` · `routePublicationResolve.ts` | ACTIVE |
| `lib/route/publicRouteRequests.ts` (22KB) · `publicRouteAutoReview.ts` | ACTIVE |
| `hooks/useSavedRoutesWorkspace.ts` (16KB) | ACTIVE |

**진입점 — 4개**
① `MapView` 지도 클릭 → `onSelectPoint` → `useRoutePlanning`
② RouteDock/거리칩 → `useDistanceAutoRoute`
③ `LocalFirstEntryCard` → `useReadyRide`
④ MENU → `RideRoutePanel` → `OfficialCourseListModal`/`SavedRoutesModal` → 저장·공개 경로 로드

**의존** — `services/mapboxDirections`(①), `services/distanceAutoRouteApi` → CF `distanceAutoRouteHttp`(②③), `lib/route/routeLimits`·`routeWaypoints`·`routeWorkspaceLock`·`routeFingerprint`.

**다른 영역과 연결** — Map(클릭·폴리라인·거리 가이드링), RouteDock(stops·Go 게이트), Ride(`routeGeometry` → `useVirtualRideSession`), Claim(`rideEndPersistence` 가 publication 해소 후 conquest payload 생성), Firebase(Firestore + CF).

**중복/legacy — ⚠ 핵심 발견**

- **경로 생성 3갈래가 공통 코어를 공유하지 않는다.** `useReadyRide.ts:44` 주석이 직접 시인: *"클릭 기반 `useDistanceAutoRoute` 와는 별개 상태 기계다 … 그 훅의 pick_direction 단계 기계를 재사용하지 않는다."*
  ②③ 가 공유하는 것은 `services/distanceAutoRouteApi.fetchDistanceAutoRoute` 와 `lib/route/distanceAutoRouteErrors` 뿐. ①은 아예 다른 서비스(`mapboxDirections`).
  → **결과 적용 지점만 같다**: 셋 다 App.tsx 의 `onApplyRoute`/Go 게이트로 수렴. Ready Ride 는 "기존 Go 게이트에 그대로 얹는" 방식 — **얹혀 있다, 섞이지 않았다**.
- `lib/route/repo/firestoreCourses.ts` — 20KB · **16개 파일이 import** · export 25개 전부 `Course*` 접두. `PublishedPublicCourseSummary`·`CourseRoutePayload`·`fetchCourseRoutePayload(publicationId)` 처럼 **인자는 publication, 타입명은 course** 인 혼종. 퇴역 용어 잔존의 최대 진앙.
- Phase 6 `@deprecated` shim 6개 잔존: `hooks/useCourseActivity.ts`(14L)·`useCourseActivityMapOverlay.ts`(6L)·`useOfficialCoursesHub.ts`(5L)·`lib/firestoreCourseActivity.ts`(29L)·`lib/firestoreCoursePresence.ts`(48L)·`components/CourseSharedPresence.tsx`(12L). **외부 참조 0건**(자기 자신 제외) — `DEAD` 확정 후보.

**구조적 문제**

1. 3갈래 생성기에 **취소·실패·토큰 차감·재시도 정책이 각각 구현**(`useDistanceAutoRoute` 는 `step` 8단계 FSM, `useReadyRide` 는 `status` 3단계 FSM, `useRoutePlanning` 은 `routeLoading` boolean).
2. 이름/개념 혼재 3층: `course`(구) / `publication`(신) / `savedRoute`(사용자) 가 한 데이터 흐름에 공존.
3. Route 토큰 차감이 props 가 아닌 `lib/account/routeTokenSpendBridge.ts` **전역 브리지**로 맵에 전달 — 우회 경로.

**정비 위험도: 높음** — 생성기 통합 시 3개 FSM·3개 에러 정책을 동시에 건드려야 한다.

---

## 3. Ride

**주요 파일**

| 경로 | 라벨 |
|---|---|
| `hooks/useVirtualRideSession.ts` — RAF 주행 엔진 | ACTIVE |
| `hooks/useRideUiStage.ts` — 8단계 UI FSM | ACTIVE |
| `hooks/useRideEndAndPersistence.ts` (26KB) | ACTIVE |
| `lib/ride/rideEndPersistence.ts` (15KB) — 주입 가능 저장 커널 | ACTIVE |
| `lib/ride/rideRecordPolicy.ts` · `rideSessionsStorage.ts` · `rideSessionAnchors.ts` | SUPPORT |
| `components/maphud/MapHud.tsx` (30KB) | ACTIVE |
| `features/ride-feedback/*`(3훅) · `hooks/useRideBgm.ts`·`useRideCoaching.ts`·`useRideMapillaryStreet.ts` | SUPPORT |

**진입점** — `RouteDock.onStartRide` → App `handleStartRide` → `useVirtualRideSession.start()`. 상태는 `useRideUiStage` 가 `gate|gate-nickname|idle|setup|ready-to-start|riding|paused|summary` 로 단일화.

**의존** — Route(`routeGeometry`), Camera(`rideFollowCameraNonce`), Session(퍼블리시), Claim(`conquestTiles`), Firebase(`firestoreRides`).

**다른 영역과 연결** — `useRideEndAndPersistence` 가 허브다: SavedRoutes 진행률 갱신 + Firestore rides 저장 + Conquest payload + RouteActivity 낙관적 갱신 + 역지오코딩 + publication 해소를 한 훅에서 수행.

**중복/legacy** — `lib/ride/repo/firestoreRides.ts:25` 에 `roomId?: string | null` 잔존(퇴역 용어). `functions/src/purgeRideLegacyFieldsCore.ts`·`backfillRidesTerminologyCore.ts` 존재 → 마이그레이션 진행 중.

**구조적 문제**

1. `useRideEndAndPersistence` 가 App.tsx state 를 **MutableRefObject 20+개**로 역주입받는다 — 훅이 독립 단위가 아니라 App 의 클로저 확장.
2. 주행 상태의 진실이 두 곳: `useVirtualRideSession.status`(엔진)와 `useRideUiStage.stage`(UI). 일부 코드는 `rideStatus` 를 직접 본다.
3. `lib/ride/rideRecordPolicy.ts` 가 클라이언트와 `functions/src/rideRecordPolicy.ts` 에 **중복 존재** — 동기화 계약이 코드로 강제되지 않는다.

**정비 위험도: 중간** — 저장 커널이 테스트 가능하게 분리돼 안전망은 있다.

---

## 4. Trail

**주요 파일**

| 경로 | 라벨 |
|---|---|
| `lib/trail/repo/firestoreTrail.ts`(159L) · `firestoreTrailPaths.ts`(5L) | ACTIVE |
| `lib/trail/repo/firestoreTrailInstance.ts`(243L) | ACTIVE |
| `lib/trail/repo/firestoreOpenTrailListings.ts`(386L) | ACTIVE |
| `lib/trail/repo/firestoreTrailLivePublicationRides.ts`(278L) | ACTIVE |
| `hooks/useTrailSession.ts`·`useAppTrail.ts`·`useOpenTrails.ts`·`useTrailInstanceMeta.ts` | ACTIVE |
| `components/trail/TrailHubPanel.tsx`·`TrailSwitcher.tsx`·`TrailheadPresence.tsx` | ACTIVE |
| `lib/trail/trailAccessPolicy.ts`·`trailUrl.ts`·`trailDisplayNumber.ts`·`trailDisplayNumberCache.ts` | SUPPORT |

**진입점** — `useAppTrail()` 이 URL `?trail=` 을 읽어 `trailId` 상태를 만든다 → `useTrailSession` 이 presence upsert + 구독.

**다른 영역과 연결** — Session(하트비트), Map(`trailSpectatorDots/Routes`), Route(Trailhead 공개 Trail 의 publicationId → 코스 로드), Ride(`rideSessionActive` 가 Trail 전환을 잠근다).

**중복/legacy — 퇴역 용어 잔존**

- `hooks/useAppTrail.ts:6` — `?trail=`(하위 호환 `?room=`). 구 URL 파라미터 계속 수용.
- `features/map-overlays/useWorldLivePublicationRideMapOverlay.ts` — `lobbySpectatorDots`/`lobbySpectatorRoutes`/`lobbyActiveRowsKey` 등 **lobby 식별자 15곳**, `useAppMapOverlays.ts:583-594` 로 전파.
- `MapView.tsx:172-179` — `boxcycle-lobby-spectator-*` source/layer id 7개.
- `lib/ride/repo/firestoreRides.ts:25` — `roomId`.
- `firestoreTrailPaths.ts:1` 주석: "`rooms` → `trails` 마이그레이션 **완료** 후 단일 경로" — Firestore 경로는 완료, **코드 식별자는 미완료**.

**구조적 문제** — Trail 개념이 4개 컬렉션과 4개 lib 파일로 퍼져 있고 **"Trail 의 진실"에 단일 진입점이 없다**. App.tsx 가 넷을 각각 import 해 조립한다.

**정비 위험도: 중간** — 용어 정리는 기계적이나 Mapbox layer id 변경은 런타임 영향.

---

## 5. Claim (Conquest)

**주요 파일**

| 경로 | 라벨 |
|---|---|
| `lib/conquest/repo/firestoreConquest.ts` — export 5개뿐 | ACTIVE |
| `lib/conquest/conquestTiles.ts`(8KB) — 셀 계산 | ACTIVE |
| `hooks/useConquest.ts` — 요약+셀+궤적 | ACTIVE |
| `hooks/useLiveConquestPaint.ts` — 주행 중 도색 | ACTIVE |
| `hooks/useRideConquestResult.ts` + `lib/ride/rideConquestResult.ts` + `lib/ride/rideConquestSubscription.ts` | ACTIVE |
| `lib/conquest/conquestLayerEmphasis.ts` | SUPPORT |
| `functions/src/conquestOnRideCreated.ts` · `conquestClaimRead.ts` | ACTIVE |

**진입점** — `useConquest(user, configured)`(읽기) / `useLiveConquestPaint`(주행 중) / `useRideConquestResult`(종료 후 CF 집계 대기 구독).

**2026-09-24 추가분 — `conquestClaimRead`**: `loadClaimedCellsNearStart` 가 `distanceAutoRouteHttp.ts:16` 에서 **경로 생성 함수 안에** import 된다. 즉 Claim 읽기가 Route 생성 경로에 **섞여 들어갔다**(얹힌 게 아니라 결합). 클라이언트 대응 코드 없음 — 서버 전용.

**중복/legacy** — `functions/src/cliPurgeConquestV1.ts` 존재(v1 정리 스크립트). 클라이언트 v1 잔재는 발견되지 않음.

**구조적 문제** — 새 결합(Route 생성 ← Claim 읽기)이 CF 안에서 생겼으므로 **Route 생성기를 통합할 때 이 의존을 같이 옮겨야** 한다. 그 외 3층 분리는 깨끗하다.

**정비 위험도: 낮음** — 파일 8개, 외부 노출 표면이 좁다.

---

## 6. Rider

**주요 파일**

| 경로 | 라벨 |
|---|---|
| `lib/riderPrototype/config.ts` — 모드 스위치 | ACTIVE |
| `lib/riderPrototype/preservedRiderRig.ts`(494L, 22KB) | ACTIVE |
| `lib/riderPrototype/preservedRiderLayer.ts`(298L) — three.js CustomLayer | ACTIVE |
| `lib/riderPrototype/glbModelLayer.ts`(174L) | DUPLICATE(모드 `glb`) |
| `lib/riderPrototype/iso2dMarker.ts`(87L) | DUPLICATE(모드 `iso2d`) |
| `lib/riderPrototype/riderRig.ts` — `.mjs` 파사드 | SUPPORT |
| `lib/riderPrototype/riderLightLab.ts` + `components/riderLightLab/RiderLightLabPanel.tsx` | EXPERIMENTAL |
| `lib/rider/riderPedalMotion.ts`·`riderPedalSpriteMeta.ts`·`riderPedalStripKeyframes.ts`·`riderGlbPedalPose.ts`·`registerPeerRiderPedalSprites.ts` | SUPPORT |

**진입점** — `MapView.tsx:168` `const RIDER_PROTOTYPE_MODE = getRiderPrototypeMode()` — 모듈 로드 시 1회 고정, 이후 4곳에서 분기.

**의존** — three.js, mapbox-gl CustomLayerInterface, `riderRig.geometry.mjs`(**값의 단일 진실이 `.mjs`**, TS 는 파사드).

**다른 영역과 연결** — Map(직접 import·렌더), Ride(`liveRiderMotion`), Session(peer 라이더 `peerRidersDrive`·`peerMotion/*`), Camera(`RIDER_DISPLAY_HEIGHT_M` 기준 거리 하한).

**중복/legacy**

- `RiderPrototypeMode = "legacy" | "iso2d" | "glb" | "preserved"` 4종이 타입에 살아 있으나 `getRiderPrototypeMode()` 는 `"legacy"` 를 **절대 반환하지 않는다** → `"legacy"` 는 DEAD 분기.
- `iso2d` 분기 코드가 MapView 본문 5곳(1194·1259·1261·1317·3290)에 흩어짐. env 로만 도달.
- `glbModelLayer.ts` 와 `preservedRiderLayer.ts` 가 같은 목적(3D 라이더)의 두 구현.

**구조적 문제**

1. 모드 스위치가 **모듈 최상위 상수**라 핫스왑 불가하면서도 분기는 렌더 함수 곳곳에 퍼져 있다 — 전략 패턴이 아니라 if 흩뿌림.
2. `riderLightLab`(2026-09-24)은 **깨끗하게 얹혀 있다**: `?lightlab=1` 없으면 패널 미렌더, 상태는 전용 진입점 하나로만 반영. 정비 시 저위험.

**정비 위험도: 중간** — `legacy`/`iso2d` 제거는 기계적이나 MapView 본문 수술이 필요.

---

## 7. Firebase

**주요 파일**

| 경로 | 라벨 |
|---|---|
| `lib/firebase.ts` — 단일 게이트웨이(지연 초기화 + 에뮬레이터) | ACTIVE |
| `lib/identity/firebaseAuthPopup.ts` · `hooks/useAppAuth.ts` | ACTIVE |
| `lib/firestore*.ts` × 20 | ACTIVE 16 / LEGACY-shim 2 / 이름 LEGACY 2 |
| `lib/peerMotion/repo/rtdbTrailMotion.ts` · `rtdbMotionSubscriptionHub.ts` | ACTIVE |
| `lib/firebase/functionsEmulatorUrl.ts` · `app/env.ts` | CONFIG |
| `lib/debug/readSubscriptionMeters.ts` · `installReadSubscriptionDebug.ts` | SUPPORT(계측) |

**진입점** — `getFirebaseApp()`/`getFirebaseAuth()`/`getFirebaseFirestore()`/`getFirebaseDatabase()`. `isFirebaseConfigured()` 가 앱 전역 게이트.

**다른 영역과 연결** — 전 영역. CF 호출은 `getFunctions(getFirebaseApp(), FUNCTIONS_REGION)` 패턴이 `useRoutePlanning`·`useDistanceAutoRoute`·`useReadyRide` **각각에 반복**(3중복).

**중복/legacy**

- `firestoreCourseActivity.ts`·`firestoreCoursePresence.ts` = `@deprecated` re-export shim, 참조 0건 → DEAD 후보.
- `firestoreCourses.ts` = ACTIVE 인데 이름·타입만 퇴역 용어.
- 구독 허브가 3개 따로: `activeLiveRideTrailIdsSubscriptionHub.ts`·`livePublicationRidesSubscriptionHub.ts`·`rtdbMotionSubscriptionHub.ts` — 같은 패턴(refcount 구독 공유)의 반복 구현.

**구조적 문제** — 20개 `firestore*.ts` 사이에 컬렉션 경로 상수의 단일 진실이 부분적(`firestoreTrailPaths.ts` 만 분리). 나머지는 각 파일에 문자열 리터럴.

**정비 위험도: 낮음** — 게이트웨이 규율이 일관적.

---

## 8. Session (Live / Presence)

**주요 파일**

| 경로 | 라벨 |
|---|---|
| `hooks/useLiveLocationPublishSession.ts`(15KB) | ACTIVE |
| `lib/ride/publishLiveLocationFanout.ts` — 3채널 fanout | ACTIVE |
| `lib/ride/liveLocationSnapshot.ts` — 스냅샷+throttle | ACTIVE |
| `lib/peerMotion/*`(16파일) — integrator·mergePackets·motionPublishFlight·routePublishFlight·PeerMotionRegistry | ACTIVE |
| `lib/ride/rideSyncPolicy.ts` — 주기 상수 단일 진실 | SUPPORT |
| `hooks/useTrailSession.ts`·`useGlobalLivePresence.ts` | ACTIVE |
| `lib/ride/repo/firestoreGlobalLivePresence.ts`·`firestorePublicationSessionPresence.ts`·`firestoreTrailLivePublicationRides.ts` | ACTIVE |
| `lib/storage/appSessionKeys.ts` — sessionStorage 키 | SUPPORT |
| `lib/ride/rideJoinPresenceBurst.ts`·`spectatorRideExtrap.ts` | SUPPORT |

**진입점** — `App.tsx: useLiveLocationPublishSession({...})`, 100ms 틱(`PUBLISH_TICK_MS`)으로 채널별 throttle 판정.

**구조적 문제**

1. **3개 퍼블리시 채널**(Firestore global presence · Firestore route/heat · RTDB motion)이 `publishLiveLocationFanout` 한 함수에 묶이고, 각각 독립 epoch·throttle·cleanup·drain timeout 을 갖는다. 종료 경로가 **6종 정리 호출을 순차 수행** — 실패 지점이 많다.
2. `peerMotion` 하위 publish flight 가 **motionPublishFlight / routePublishFlight 두 벌**로 거의 같은 구조 복제.
3. "session" 이 세 가지 뜻으로 쓰임: 주행 세션(`useVirtualRideSession`), presence 세션(`firestorePublicationSessionPresence`), 브라우저 세션(`appSessionKeys`).

**정비 위험도: 중간** — replay 하네스(`peer-sync` skill)가 있어 회귀 고정 수단은 존재.

---

## 9. Camera

**주요 파일**

| 경로 | 라벨 |
|---|---|
| `lib/map/mapGlobeView.ts` — 줌/피치/거리 범위 상수 | SUPPORT |
| `lib/camera/rideCameraFraming.ts`(18KB) — 프레이밍 계산 | ACTIVE |
| `components/map/rideCameraFollow.ts`(17KB) — 추종 적용 | ACTIVE |
| `lib/camera/camera1Mode.ts`(2026-09-24 신규) — QC1 순환 단계 표 | ACTIVE |
| `lib/camera/cameraFollowTrace.ts`·`cameraRenderPhase.ts` | SUPPORT(계측) |
| `components/map/MapViewSheet.tsx` — 수동 거리 슬라이더 | ACTIVE |
| `components/maphud/MapHud.tsx` — `quickCamera` 버튼 | ACTIVE |

**진입점** — 상태는 **App.tsx** 소유: `camera1Mode`(L235)·`rideCameraDistanceM`·`followMode`·`rideFollowCameraNonce`. QC 버튼 → `App.tsx:2123` `nextCamera1Mode()` 순환 → props 하달.

**2026-09-24 추가분 — `camera1Mode`**: **얹혀 있다(양호)**. 단계 표·표식·라벨이 단일 진실이고 App.tsx·MapHud.tsx 둘 다 이 모듈을 import.

**구조적 문제**

1. **거리 클램프가 두 경로**: `MapViewSheet` 수동 슬라이더는 `RIDE_CAMERA_DISTANCE_MAX_M`(60m)로 클램프, `camera1Mode` preset 경로(`setRideCameraDistanceM` → `computeRideFollowFraming`)는 **그 상한을 거치지 않아 200m 통과**. 같은 값을 두 정책이 다르게 다룬다(의도된 우회).
2. 상태(App)·계산(`rideCameraFraming`+`mapGlobeView`)·적용(`rideCameraFollow` in MapView) 3단 분산에 `externalCameraJump`·`rideFollowCameraNonce` 같은 nonce 기반 명령 채널.
3. `FollowMode` 타입이 UI 패널 소유(레이어링 역전).

**정비 위험도: 중간** — 클램프 이원화가 정비 시 200m 단계를 조용히 죽일 수 있다.

---

## 10. RouteDock

**주요 파일**

| 경로 | 라벨 |
|---|---|
| `components/route-dock/RouteDock.tsx`(19KB) | ACTIVE |
| `components/route-dock/useRouteDockStops.ts` | ACTIVE |
| `lib/route/routeDockUiPolicy.ts` — 표시·잠금 판정 단일 진실 | ACTIVE |
| `lib/route/sensorChipSlot.ts` — dock 과 같은 판정 공유 | SUPPORT |
| `lib/map/mapPickRouteDock.ts`(11KB) — 맵 팝업 회피 배치 | SUPPORT |

**구조적 문제**

1. RouteDock 이 센서 칩·저장 모달·쿼터 에러까지 떠안아 "경로 stops 표시" 이상을 한다(19KB).
2. Map→Dock 역방향 기하 의존(`mapPickRouteDock`)이 DOM 사각형을 통해 이뤄져 테스트가 어렵다.
3. **긍정 사례**: `routeDockUiPolicy.isRouteDockVisible` 이 dock 자신과 `sensorChipSlot` 의 공통 판정 — 주석에 "둘이 갈라지면 칩이 두 곳에 뜨거나 어느 곳에도 안 뜬다"는 과거 사고 기록. **다른 영역이 따라야 할 모델**.

**정비 위험도: 낮음**

---

## 11. 2026-09-24 추가분 — 얹혀 있나 섞여 있나

| 항목 | 위치 | 판정 |
|---|---|---|
| `camera1Mode` | `lib/camera/camera1Mode.ts` + App.tsx·MapHud | **얹힘(양호)** — 단계 표 단일 진실. 단 거리 클램프 우회 경로를 새로 만듦 |
| `riderLightLab` | `lib/riderPrototype/riderLightLab.ts` + 전용 패널 | **얹힘(양호)** — URL 게이트 없으면 미렌더, 전용 진입점 1개 |
| `mapBootCenter` | `lib/map/mapBootCenter.ts`, App.tsx:206 부팅 1회 | **얹힘(양호)** — 다른 참조 0 |
| `readyRide` | `lib/route/readyRide.ts`+`hooks/useReadyRide.ts`+`LocalFirstEntryCard` | **얹힘(위험)** — Go 게이트에만 붙었으나 경로 생성 FSM 을 **세 번째로** 늘렸다 |
| `conquestClaimRead` | `functions/src/conquestClaimRead.ts` → `distanceAutoRouteHttp.ts` | **섞임** — Claim 읽기가 Route 생성 CF 내부 의존이 됨 |

---

## 12. 가장 위험한 것 5

1. **`components/map/MapView.tsx`** — 4,903줄 / props 89개 / 내부 상태 96개. 7영역의 렌더 책임 집중. 어떤 정비든 여기서 막힌다.
2. **경로 생성 3갈래 분기** — 공유는 `fetchDistanceAutoRoute` + 에러 포맷터뿐. 취소·토큰·재시도 정책 3중 구현.
3. **`lib/route/repo/firestoreCourses.ts`** — 20KB · 16파일 import · export 25개 전부 `Course*`. 퇴역 용어 진앙이면서 ACTIVE 코어라 rename 비용이 가장 크다.
4. **`App.tsx` 3,030줄 / useState 47개 / import 159줄** — 주요 훅이 App state 를 ref 로 역주입받아 훅이 독립 단위가 아니다.
5. **Session 3채널 fanout + flight 2벌 복제** — 종료 경로가 6종 정리 호출 순차 수행.

## 13. 가장 쉬운 정비 5

1. **Phase 6 `@deprecated` shim 6개 삭제** — 외부 참조 0건 확인 완료.
2. **루트 1줄 re-export shim 정리** — `components/{MapView,MapViewSheet,RideRoutePanel,TrailHubPanel,AuthGateCard,GuestEntryCard,SignUpNicknameCard,SavedRoutesPanel,RideSummarySheet,RideHistoryPanel,RideSettingsSheet,TrailSwitcher,TrailheadPresence,MapillaryRideViewer}.tsx` 14개. import 를 실제 경로로 바꾸면 제거 가능.
3. **`RiderPrototypeMode` 의 `"legacy"` 제거** — 도달 불가 분기.
4. **`FollowMode` 를 `lib/map/mapGlobeView.ts` 로 이동** — 코어가 UI 를 import 하는 역전 해소. 참조 6곳뿐.
5. **`lobby` 식별자 정리** — `useWorldLivePublicationRideMapOverlay.ts`(15곳)·`useAppMapOverlays.ts`(4곳) 변수명. ※ `MapView.tsx:172-179` 의 Mapbox **layer id 문자열**은 런타임 영향이 있으니 별도 취급.

---

## 부록 — 조사 방법

- 파일 목록: `find apps/web/src -type f \( -name '*.ts' -o -name '*.tsx' \)` → **311개**
- 참조 확인: 각 후보에 대해 `grep -rn "<name>" apps/web/src` 로 import·문자열 참조 전수 확인(추측 없음)
- 퇴역 용어: `grep -rio "course"` **668건** / `grep -rn "room|lobby" -i` 전수
- 크기: `find -printf '%s %p'` 정렬
