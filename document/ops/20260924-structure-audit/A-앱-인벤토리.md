# A — `apps/web/src` 앱 인벤토리 (2026-09-24)

> 읽기 전용. HEAD `3b97160`.

## 0. 조사 방법 (근거의 출처)

| 방법 | 내용 |
|---|---|
| 도달성 분석 | `main.tsx` 기점 import 그래프 BFS. `from "x"` · `import("x")` · bare side-effect `import "x"` · `.css` 전부 해석. 도달 330 / 총 358 |
| 교차 검증 | 도달 불가 파일 전부를 `grep -rn <심볼>` 로 `apps/` `e2e/` `scripts/` `functions/` `document/` 재확인 |
| 동적 import | 저장소 전체 동적 `import()` 9건 전수 확인 — 문자열 조립·변수 경로 **0건**(전부 리터럴). 따라서 도달성 분석이 안전하다 |
| 순환 | DFS back-edge 검출 |

## 1. 요약 10줄

1. `apps/web/src` 총 **360 파일** (ts 251 · tsx 60 · css 37 · mjs 7 · mts 3 · json 2), 코드 48,750줄.
2. 라벨: ACTIVE ~232 · SUPPORT ~46 · DUPLICATE 14 · DEAD 24 · LEGACY 17 · EXPERIMENTAL 9 · TEST 1 · CONFIG 4 · UNKNOWN 3.
3. **최대 문제 ①** `MapView.tsx` 4,903줄 / `useEffect` 68개 / import 48개 — 지도·카메라·라이더·피어·오버레이·디버그 6책임 혼재. `App.tsx` 3,030줄 / `useState` 47개 / import 91개.
4. **최대 문제 ②** `lib/` 에 **158개 파일이 평면(flat)**. 도메인 폴더가 없어 중복·유사 util 식별이 불가능.
5. **최대 문제 ③** 퇴역 용어 `course` 가 파일명 10개·내용 46개 파일에 잔존. `firestoreCourses.ts`(554줄, fan-in 16)는 **살아있는 핵심 모듈이 옛 이름을 단** 최악의 케이스.
6. **삭제 후보 24건** — `main.tsx` 도달 불가 + 저장소 전체 grep 0건 교차 확인 완료.
7. 중복: `components/` 루트의 **1줄 re-export shim 14개**, Phase 6 `course→route/publication` alias shim 7개.
8. 순환 의존 **4쌍**(전부 `lib/` 내부, 전역 폭발 없음).
9. 디버깅 잔재: `console.log` 13줄(전부 `[C1]`~`[C4]`·`[PhaseD]` 임시 추적 태그), `window.__rtw*` 전역 **40종**.
10. **TODO/FIXME 는 0건** — 대신 `@deprecated` JSDoc 28건이 부채 마커.

## 2. 디렉터리 구조 개요

| 경로 | 파일수 | 라벨 | 비고 |
|---|---|---|---|
| `src/` 루트 | 3 | ACTIVE | `App.tsx`(3030) `main.tsx` `vite-env.d.ts` |
| `app/` | 3 | ACTIVE/DEAD | `env.ts`·`useAppSheetNavigation.ts` ACTIVE, `index.ts` DEAD |
| `components/` 루트 | 22 | 혼재 | **14개가 1줄 shim** |
| `components/auth` | 4 | ACTIVE | `index.ts` 만 DEAD |
| `components/map` | 10 | ACTIVE | `MapView.tsx` 4903줄 · `index.ts` DEAD |
| `components/maphud` | 2 | ACTIVE | |
| `components/ride` | 14 | ACTIVE | `RideHistoryPanel` 소비자 0 |
| `components/riderLightLab` | 1 | EXPERIMENTAL | 라이팅 실험 패널 |
| `components/route` | **0 (빈 폴더)** | DEAD | 디렉터리만 남음 |
| `components/route-dock` | 3 | ACTIVE | |
| `components/sensor` | 3 | ACTIVE | |
| `components/trail` | 4 | 혼재 | 2개 DEAD + `index.ts` DEAD |
| `components/weather` | 1 | **DEAD** | 기능 전체 미연결 |
| `features/map-overlays` | 13 | ACTIVE | |
| `features/ride-feedback` | 4 | ACTIVE | |
| `hooks/` | 39 | 혼재 | 4개 DEAD |
| `lib/` | **158 (평면)** | 혼재 | 최대 구조 문제 |
| `lib/peerMotion` | 14 | ACTIVE | 유일하게 잘 모듈화된 하위 도메인 |
| `lib/riderPrototype` | 10 | ACTIVE/SUPPORT | |
| `services/` | 13 | ACTIVE | |

## 3. DEAD — 삭제 후보 (24건, 전부 교차 검증 완료)

| File | Classification | Reason | Dependency Risk | Action |
|---|---|---|---|---|
| `components/CourseSharedPresence.tsx` | DEAD | `@deprecated Phase 6` alias shim. 저장소 전체 grep **0건**. 도달 불가 | 낮음 — `PublicationSharedPresence` 로 대체됨 | 삭제 후보 |
| `hooks/useCourseActivity.ts` | DEAD | `useRouteActivity` 위임 alias. 참조 0건 | 낮음 | 삭제 후보 |
| `hooks/useCourseActivityMapOverlay.ts` | DEAD | re-export만. 참조 0건 | 낮음 | 삭제 후보 |
| `hooks/useOfficialCoursesHub.ts` | DEAD | `usePublicationCatalogHub` re-export만. 참조 0건 | 낮음 | 삭제 후보 |
| `lib/firestoreCourseActivity.ts` | DEAD | `@deprecated Phase 6`. 참조 0건 | 낮음 | 삭제 후보 |
| `lib/firestoreCoursePresence.ts` | DEAD | `@deprecated Phase 6`. 참조 0건 | 낮음 | 삭제 후보 |
| `hooks/useTrailLivePublicationRidePublisher.ts` (106L) | DEAD | 참조 0건. `document/ops/sync-relay/S43-touch-baseline.json` 이 "has no callers (HANDOFF)" 로 이미 기록 | 낮음 | 삭제 후보 |
| `lib/virtualRideDuration.ts` (14L) | DEAD | 참조 0건. `useVirtualRideSession` 은 쓰지 않음(이름만 유사) | 낮음 | 삭제 후보 |
| `components/weather/WeatherOverlay.tsx` (158L) | DEAD | 참조 0건, 도달 불가 | 낮음 — 날씨 기능 전체 미연결 | 삭제 후보 |
| `components/weather/WeatherOverlay.css` | DEAD | 위 파일만 import | 낮음 | 삭제 후보 |
| `lib/weather/openMeteoWeather.ts` (153L) | DEAD | 유일 소비자가 `WeatherOverlay.tsx`(DEAD). `e2e/open-meteo-stub.ts` 의 1건은 **주석 언급일 뿐 import 아님** | 중간 — 고도 API 와 혼동 주의 | 검토 필요 |
| `components/trail/TrailSwitcher.tsx` | DEAD | `@deprecated 2026-05-19`. 참조 0건 | 낮음 | 삭제 후보 |
| `components/trail/TrailSwitcher.css` | DEAD | 위 파일만 import | 낮음 | 삭제 후보 |
| `components/trail/TrailheadPresence.tsx` (52L) | DEAD | 참조 0건. **단 `TrailheadPresence.css` 는 `PublicationSharedPresence.tsx:39` 가 import 중 → CSS 유지** | 중간 | 삭제 후보(**tsx만**) |
| `components/ride/RideHistoryPanel.tsx` (161L) + `.css` | DEAD | 배럴이 export 하지만 소비자 0 | 중간 — 주행 기록 UI 재도입 예정이면 보존 | 검토 필요 |
| `features/map-overlays/useWorldActivityCatalog.ts` (76L) | DEAD | `@deprecated`. 유일 참조가 배럴 재export, 실소비자 0 | 낮음 | 삭제 후보 |
| `app/index.ts` | DEAD | 배럴. 소비자는 직접 import | 낮음 | 삭제 후보 |
| `components/auth/index.ts` | DEAD | 배럴. grep 0건 | 낮음 | 삭제 후보 |
| `components/map/index.ts` | DEAD | 배럴. grep 0건 | 낮음 | 삭제 후보 |
| `components/trail/index.ts` | DEAD | 배럴. grep 0건 | 낮음 | 삭제 후보 |
| `components/RideHistoryPanel.tsx` | DEAD(shim) | 1줄 re-export. grep 0건 | 낮음 | 삭제 후보 |
| `components/SavedRoutesPanel.tsx` | DEAD(shim) | 실소비자는 하위 경로 직접 import | 낮음 | 삭제 후보 |
| `components/TrailSwitcher.tsx` | DEAD(shim) | 대상도 DEAD | 낮음 | 삭제 후보 |
| `components/TrailheadPresence.tsx` | DEAD(shim) | 대상도 DEAD | 낮음 | 삭제 후보 |
| `components/route/` (빈 디렉터리) | DEAD | 소스 0개 | 낮음 | 삭제 후보 |

## 4. DUPLICATE — 루트 shim 10개 (살아있음, 통합 후보)

`components/` 루트에 `export * from "./<서브폴더>/<파일>";` **한 줄**만 있는 파일들. `App.tsx` 가 이 shim 경로로 import 하고 있어 **지금 지우면 빌드가 깨진다**.

| File | 대상 | 소비자 | Risk | Action |
|---|---|---|---|---|
| `components/MapView.tsx` | `map/MapView` | `features/map-overlays/AppMapStage.tsx:2` | 중간 | 통합 후보 |
| `components/MapViewSheet.tsx` | `map/MapViewSheet` | `App.tsx:75` | 중간 | 통합 후보 |
| `components/MapillaryRideViewer.tsx` | `map/MapillaryRideViewer` | `App.tsx:162` **동적 import** | **높음** — 정적 리팩터 도구가 못 잡는다 | 검토 필요 |
| `components/AuthGateCard.tsx` | `auth/AuthGateCard` | `App.tsx` | 중간 | 통합 후보 |
| `components/GuestEntryCard.tsx` | `auth/GuestEntryCard` | `App.tsx` | 중간 | 통합 후보 |
| `components/SignUpNicknameCard.tsx` | `auth/SignUpNicknameCard` | `App.tsx` | 중간 | 통합 후보 |
| `components/RideRoutePanel.tsx` | `ride/RideRoutePanel` | `App.tsx` | 중간 | 통합 후보 |
| `components/RideSettingsSheet.tsx` | `ride/RideSettingsSheet` | `App.tsx` | 중간 | 통합 후보 |
| `components/RideSummarySheet.tsx` | `ride/RideSummarySheet` | `App.tsx` | 중간 | 통합 후보 |
| `components/TrailHubPanel.tsx` | `trail/TrailHubPanel` | `App.tsx:45` | 중간 | 통합 후보 |

→ 소비자의 import 경로를 실제 경로로 바꾸면 한 번에 사라진다. 기계적 치환이며 런타임 동작 변화 0.

## 5. LEGACY — `@deprecated` 마커 28건

| File:Line | 내용 | Action |
|---|---|---|
| `lib/ride/rideSyncPolicy.ts:39,42,85,132,137` | 호환 alias 5개 — **fan-in 18 핵심 모듈** | 유지(alias만 점진 제거) |
| `lib/route/repo/firestoreCourses.ts:482` | `ensurePublicationPresenceFlagsMerged` 로 대체 | 검토 필요 |
| `lib/ride/repo/firestoreRides.ts:24,40` | "read fallback only" 필드 2개 | 유지 |
| `lib/route/repo/firestoreRoutePublications.ts:164` | shim → `findPublishedRoutePublicationById` | 통합 후보 |
| `lib/activity/repo/firestoreRouteActivity.ts:196` | 낙관 heat 제거 잔재 | 검토 필요 |
| `lib/activity/activityWorldLod.ts:10` / `activityWorldTraceStyle.ts:10` / `activityWorldPollPolicy.ts:44` | 상수·함수 alias | 통합 후보 |
| `lib/route/directionsDirectGuard.ts:7` | `VITE_DIRECTIONS_DIRECT` — "프로덕션에서 제거됨" | 검토 필요 |
| `lib/route/fetchRouteElevations.ts:46` | 호장 샘플러로 대체 | 통합 후보 |
| `lib/map/mapPickRouteDock.ts:130` | 진단·회귀용 보존 | 유지 |
| `lib/peerMotion/mergePackets.ts:49` | alias | 통합 후보 |
| `services/mapboxForwardGeocode.ts:63` | `fetchMapboxPlacePickDetail` 로 대체 | 통합 후보 |
| `components/MenuPanel.tsx:7` | 하위 호환용 prop | 검토 필요 |
| `features/map-overlays/worldPublicationMapDots.ts:7` | 단 `useAppMapOverlays.ts:452` 가 실호출 중 | 유지 |
| `lib/route/publicRouteAutoReview.ts:14` | **주석 처리된 export** — 저장소 유일 | 삭제 후보 |

## 6. 거대 파일 상위 15 — 책임 수

| # | File | 줄수 | 책임 | 혼재 내역 | Action |
|---|---|---|---|---|---|
| 1 | `components/map/MapView.tsx` | **4,903** | **6+** | `useEffect` **68개**, import 48. 지도·카메라·라이더·피어·오버레이·디버그 | **최우선 분할** |
| 2 | `App.tsx` | **3,030** | **5+** | `useState` **47개**, `useEffect` 25, import **91**. 전역 상태·시트 네비·인증·주행 라이프사이클·오버레이 조율 | **최우선 분할** |
| 3 | `components/UserInfoSheet.tsx` | 787 | 3 | `useState` 15 — 프로필·닉네임·티어·게스트 리셋 | 검토 필요 |
| 4 | `components/maphud/MapHud.tsx` | 729 | 2 | HUD 렌더 + 동행 카운트 | 유지 |
| 5 | `lib/route/repo/firestoreSavedRoutes.ts` | 701 | 2 | export 22 — CRUD + 진행률 정책 | 통합 후보 |
| 6 | `hooks/useRideEndAndPersistence.ts` | 655 | 3 | 종료 판정·영속화·정복 결과 | 검토 필요 |
| 7 | `features/map-overlays/useAppMapOverlays.ts` | 613 | 4 | 오버레이 전부를 한 훅이 조율 | 검토 필요 |
| 8 | `components/ride/SavedRoutesPanel.tsx` | 593 | 2 | 목록·정렬·필터 | 유지 |
| 9 | `lib/route/publicRouteRequests.ts` | 575 | 3 | 요청·심사·명명 정책 | 통합 후보 |
| 10 | `lib/route/repo/firestoreCourses.ts` | 554 | 2 | export **26**, **이름이 퇴역 용어**인데 fan-in 16 | 검토 필요(개명) |
| 11 | `components/PublicationSharedPresence.tsx` | 521 | 3 | presence 구독·peer 동기·렌더 | 검토 필요 |
| 12 | `lib/riderPrototype/preservedRiderRig.ts` | 494 | 1 | 단일 소비자 | 유지 |
| 13 | `hooks/useBleCrankRpm.ts` | 484 | 2 | BLE 연결 + RPM 계산 | 유지 |
| 14 | `components/map/rideCameraFollow.ts` | 484 | 1 | 카메라 추종 전담 | 유지 |
| 15 | `hooks/useDistanceAutoRoute.ts` | 477 | 2 | 자동 경로 + ETA·에러 | 유지 |

**Fan-in 상위**: `lib/geo/geo.ts` 83 · `lib/firebase.ts` 36 · `lib/trail/repo/firestoreTrail.ts` 33 · `services/mapboxDirections.ts` 24 · `lib/ride/rideSyncPolicy.ts` 18 · `lib/route/repo/firestoreSavedRoutes.ts` 17 · `lib/trail/repo/firestoreTrailLivePublicationRides.ts` 17 · `lib/route/repo/firestoreCourses.ts` 16.
→ **`lib/geo/geo.ts`(export 21, fan-in 83)가 사실상 전역 허브.**

## 7. 순환 의존 (4건, 전부 `lib/` 내부)

| 경로 | Risk | Action |
|---|---|---|
| `lib/activity/activityWorldLod.ts` ↔ `lib/ride/rideSyncPolicy.ts` | **높음** — fan-in 14/18. deprecated alias 이관 중 생긴 상호 참조 | 검토 필요 |
| `lib/trail/repo/firestoreTrailLivePublicationRides.ts` ↔ `lib/peerMotion/repo/rtdbTrailMotion.ts` | 중간 — Firestore/RTDB 두 소스가 서로의 타입 참조 | 검토 필요 |
| `lib/trail/repo/firestoreOpenTrailListings.ts` ↔ `lib/trail/repo/firestoreTrailInstance.ts` | 중간 | 검토 필요 |
| `lib/trail/repo/firestoreTrailInstance.ts` ↔ `lib/trail/trailAccessPolicy.ts` | 중간 — 정책이 데이터층을 역참조 | 통합 후보(정책→순수함수화) |

컴포넌트 계층 순환은 **없다**. 4건 모두 `lib/` 평면 구조가 원인이며 도메인 폴더로 나누면 자연 해소된다.

## 8. 네이밍 불일치

| 문제 | 근거 | Action |
|---|---|---|
| **퇴역 용어 `course`** | 파일명 10개, 내용 46개 파일. `firestoreCourses.ts`(554L·fan-in 16)·`usePublishedCoursesActivityMapOverlay.ts`(414L)·`OfficialCourseListModal.tsx` 는 **살아있는 ACTIVE 코드** | 검토 필요(일괄 개명 = 별도 작업) |
| 폴더 규칙 혼재 | `route-dock`(kebab) vs `riderLightLab`(camel) vs `maphud`(소문자) vs `map`/`ride`/`trail` — **4가지 규칙 공존** | 검토 필요 |
| 계층 규칙 혼재 | 같은 성격 코드가 `components/` 루트 · `components/<도메인>/` · `features/<도메인>/` 3곳 분산. `features/` 는 2개뿐이라 규칙이 아님 | 검토 필요 |
| `lib/` 평면화 | **158 파일 무분류**. `firestore*` 25 · `ride*` 24 · `route*` 17 · `activityWorld*` 5 · `distanceAutoRoute*` 6 · `rider*` 5 | 검토 필요(최대 개선 여지) |
| Sheet/Panel/Modal 3종 접미사 | `RideSettingsSheet`(57L) 가 `RideSettingsPanel`(63L) 을 감싼다. `SavedRoutesPanel`/`SavedRoutesModal`/`RouteListModalShell` 도 삼중 | 통합 후보 |
| `app/` vs `App.tsx` | 대소문자만 다른 형제 — 대소문자 비구분 파일시스템에서 위험 | 검토 필요 |

## 9. 디버깅 잔재

### console.log — 13줄

| File:Line | 태그 | 성격 | Action |
|---|---|---|---|
| `App.tsx:1988, 1999` | `[C1]` `[C2]` | 지역 적용·카메라 점프 임시 추적 | **삭제 후보** |
| `components/map/MapView.tsx:3778, 3788, 3791, 3795` | `[C3]` `[C4]` | 외부 카메라 점프 추적 | **삭제 후보** |
| `features/map-overlays/useAppMapOverlays.ts:395` | `[PhaseD]` | source 진단 | **삭제 후보** |
| `components/map/DebugWorldLightMap.tsx` ×6 | `[DebugWorldLight]` | 전용 디버그 컴포넌트 내부 | 유지 |

`[C1]`~`[C4]` 는 **한 번의 카메라 디버깅 세션 잔재**가 명백하다(연속 번호 태그). 7줄 제거는 무위험.

### 전역 디버그 플래그 — `window.__rtw*` / `__RTW_*` 40종

`__RTW_CAMERA_PHASE*`(5) · `__RTW_CAMERA_TRACE*`(4) · `__RTW_MAP_TICK*`(4) · `__rtwMotion*`(7) · `__rtwRoute*`(5) · `__rtwReadSubs*`(2) · `__rtwGeo*`(2) 외.
설치 모듈 7개가 SUPPORT 로 존재: `installHudCompanionDebug.ts` · `installReadSubscriptionDebug.ts` · `installTouchActivityDebug.ts` · `mapTickProbe.ts` · `mapDebugPhase.ts` · `cameraRenderPhase.ts` · `peerMotion/peerSyncDebug.ts`.
→ **프로덕션 번들에 전부 포함된다.** 제거가 아니라 **빌드 플래그 게이팅** 검토 대상(기능 변경이므로 이번 범위 밖, 기록만).

### 주석 처리된 코드

전 소스 통틀어 **1건** — `lib/route/publicRouteAutoReview.ts:14`. 나머지 주석은 전부 한국어 설계 근거 서술로 **품질이 높다**.

## 10. TODO / FIXME

**0건.** 이 프로젝트는 TODO 대신 **`@deprecated` JSDoc(28건)** 과 `document/ops/` 릴레이 문서로 부채를 추적한다. 방치 기간(git log 기준):

| 묶음 | 최종 수정 | 방치 |
|---|---|---|
| Phase 6 `course` shim 6종 | **2026-06-19** | 약 3개월 |
| `TrailSwitcher` / `TrailheadPresence` | 2026-06-19 | 약 3개월 |
| `useTrailLivePublicationRidePublisher` | 2026-06-19 | 약 3개월 |
| `useWorldActivityCatalog` | 2026-06-19 | 약 3개월 |
| `virtualRideDuration` | 2026-06-23 | 약 3개월 |
| `weather` 일체 | 2026-07-12 | 약 2.5개월 |
| `RideHistoryPanel` | 2026-08-29 | 약 1개월 |

→ **2026-06-19 에 대규모 이름 이관(Phase 6)이 있었고, 그때 만든 호환 shim 을 아무도 회수하지 않았다.**

## 11. UNKNOWN — 판단 보류 (3건)

| File | 왜 모르는가 | Action |
|---|---|---|
| `components/ride/FirstRideIntroCard.tsx` + `.css` (35L) | 배럴만 export, 실소비자 0 → 기계적으로는 DEAD. **그러나 `document/ops/20260923-first_ride/20260923-지시01-….md:38` 이 「지우지 마라」 명시**, 수행결과도 유지 확인. 재도입 예정 자산 | **유지** |
| `components/riderLightLab/RiderLightLabPanel.tsx` + `lib/riderPrototype/riderLightLab.ts` | 실연결. 프로덕션 노출 여부를 정적으로 판정 불가 | EXPERIMENTAL — 검토 필요 |
| `components/map/DebugWorldLightMap.tsx`(378L) + `TickTestOffBadge.tsx` + `features/map-overlays/ActivityWorldLodDebugPanel.tsx` | 도달 가능. 프로덕션 게이팅 여부 확인 필요 | EXPERIMENTAL — 검토 필요 |

## 12. SUPPORT / TEST / CONFIG

| File | Classification | Reason |
|---|---|---|
| `lib/route/sensorChipSlot.ts` | **TEST 전용** | 도달 불가. 유일 소비자 `scripts/ride-hierarchy/sensor-chip-slot-contract.test.ts` — **계약 테스트만을 위해 존재하는 프로덕션 코드** |
| `lib/riderPrototype/riderBody.mjs` | SUPPORT | `scripts/build-rider-candidate.mjs:38` · `scripts/rider-preview/riderCandidate.mjs:31` 이 소비 |
| `lib/directionsDirectGuard.core.d.mts` · `routeTokenPopupDisplay.d.mts` · `routeTokenSpendState.d.mts` | CONFIG | 짝 `.mjs` 의 타입 선언. 도달 불가가 정상 |
| `vite-env.d.ts` | CONFIG | Vite 앰비언트 타입 |
| `lib/riderPrototype/geometry.json` · `riderAnthropometry.json` | SUPPORT | 라이더 리그 데이터 |
| `lib/riderPrototype/riderIk.mjs` · `riderRig.geometry.mjs` · `riderGlbPedalPose.pose.mjs` | SUPPORT | 오프라인 리깅/포즈 자산 |

---

## 가장 위험한 것 5

1. **`components/map/MapView.tsx` 4,903줄 · `useEffect` 68개.** effect 간 실행 순서 의존이 암묵적이다. 어떤 정비도 여기부터 시작하면 안 된다 — **먼저 계약 테스트를 깔아야 한다.**
2. **`App.tsx` `useState` 47개 · import 91개.** 어떤 상태가 어떤 effect 를 깨우는지 추적 불가. `MapView` 와 props 강결합이라 둘을 따로 리팩터할 수 없다.
3. **`lib/geo/geo.ts` fan-in 83 / `lib/firebase.ts` 36 / `lib/trail/repo/firestoreTrail.ts` 33.** 세 파일이 단일 장애점. `lib/` 도메인 분할 시 가장 광범위한 diff.
4. **순환 `activityWorldLod.ts` ↔ `rideSyncPolicy.ts`**(fan-in 14/18). 모듈 초기화 순서에 따라 상수가 `undefined` 로 읽힐 수 있는 잠재 버그.
5. **퇴역 용어 `course` 가 ACTIVE 코드에 박혀 있다** — `firestoreCourses.ts`(fan-in 16). 개명하려면 16개 소비자 + Firestore 컬렉션명 호환까지 걸려 「쉬운 정비」가 아니다. **문서화로 먼저 봉합할 것.**

## 가장 쉬운 정비 5

1. **DEAD 24건 삭제** — 도달 불가 + 저장소 전체 grep 0건 이중 확인. 동적 import 9건 전수 검사 결과 문자열 조립 경로 없음. **런타임 위험 0.** (단 `TrailheadPresence.css` 는 살아있으니 `.tsx` 만, `openMeteoWeather.ts`·`RideHistoryPanel` 은 복원 계획 확인 후.)
2. **`console.log` 7줄 제거** — `App.tsx:1988,1999` / `MapView.tsx:3778,3788,3791,3795` / `useAppMapOverlays.ts:395`.
3. **루트 shim 10개 통합** — 소비자 import 경로 치환. **단 `MapillaryRideViewer` 는 `App.tsx:162` 동적 import 라 수동 확인 필수.**
4. **DEAD 배럴 4개 + 빈 디렉터리 1개 제거** — `app/index.ts` · `components/auth|map|trail/index.ts` · `components/route/`.
5. **주석 처리 export 1줄 제거** — `lib/route/publicRouteAutoReview.ts:14`.

---

## 부록: 갈래 C 에 넘긴 발견

- `tmp/rider-shape-preserving/` 아래 **프로젝트 전체 사본**이 존재한다(`apps/web/src/components/map/MapView.tsx` 등 동일 경로 복제). **grep 결과를 오염시키고 있다.**
- 저장소 루트에 untracked 빈 파일 `0`.
- `lib/route/sensorChipSlot.ts` 는 계약 테스트 전용 프로덕션 코드 — 테스트 배치 정책 검토 대상.
