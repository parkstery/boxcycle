# Ride state inventory · SoT (2026-09-07)

| 항목 | 내용 |
|---|---|
| 문서 유형 | **record** — 읽기 전용 조사 스냅샷. 지속 계약: [Ride 결과 데이터계약](../ops/ride-relay/260907-Ride-결과-데이터계약.md) |
| 작성 | 2026-09-07 |
| 범위 | `C:\20.HDev\boxcycle` · 브랜치 `main2` · 읽기 전용 스캔 |
| 규모 | 1차 항목 ~55 (zustand 없음 — React state/ref + Firestore/RTDB + 모듈 싱글톤) |
| 관련 | [도로망 성취결과 1단계 작업지시서](../ops/ride-relay/260907-도로망-성취결과-1단계-작업지시서.md) |

> **읽는 법:** §1 SoT만 먼저 본다. §2~§6은 전수 인벤토리다. 파생(derived)은 주행 쓰기 트리거로 생기지만 주행 세션 SoT가 아니다.

---

## 1. SoT 추려 보기 (Source of Truth)

충돌 시 **이긴 쪽**만 적는다. UI 미러·파생은 제외.

### 1.1 세션·진행 (클라이언트)

| 관심사 | SoT | 비고 |
|---|---|---|
| 주행 중/일시정지/종료 | `rideStatus` (`useVirtualRideSession`) | `RideUiStage`는 UI 파생(auth+pins+summary). **lock/PROD 편집은 `rideStatus`** |
| 주행 중 진행·위치·속도 | rAF refs → `metricsUi` (throttle ~200ms) | 세션 메모리만. 강제 종료 시 end 없으면 소실 |
| 재개 오프셋 | `startOffsetMetersRef` (+ UI `sessionStartOffsetMeters`) | start 시 설정 |
| 요약 시트 노출 | `summaryVisible` / `lastRideResult` (`App.tsx`) | 유효 end 스냅샷 |
| 이어가기 프로필·거리 선호 | **① `continuationLastRideRef` > ② distance-auto `getLastSessionPrefs` > ③ 현재 workspace** | 우선순위 깨지면 과거 버그 재발 |
| 입력 준비(수동/케이던스) | App readiness + cadence helpers | start gate |
| 주행 중 trail (presence용) | **`ridingTrailId` → `menuTrailSanitizedId`** | 메뉴 `trailId`만 쓰면 피어 어긋남 |
| 재개 후보 | `resumeCandidateId` + `savedRoutes[].lastProgressRatio` | idle + incomplete & \<0.98 |

### 1.2 경로 workspace (클라이언트)

| 관심사 | SoT | 비고 |
|---|---|---|
| Start/End/waypoints·profile·geometry | `useRoutePlanning` workspace | PROD riding 중 lock |
| 자동 Route 마법사 | `useDistanceAutoRoute` | 적용 후 geometry는 planning SoT로 이관 |
| MapView↔자동Route 브리지 | `distanceAutoRouteMapBridge` 싱글톤 | latest register |
| 저장 루트 목록·진행률 | **Firestore `savedRoutes` transaction `max(server, requested)`** · localStorage 낙관적 | 서버 max가 최종 |

### 1.3 Live presence (이중 채널)

| 관심사 | SoT | 비고 |
|---|---|---|
| 존재·히트(~1Hz) | Firestore `trails/{trailId}/livePublicationRides/{uid}` | latest client merge · `lastSeenAt` stale |
| 피어 보간(~5Hz) | RTDB `trails/{trailId}/motion/{uid}` | onDisconnect 삭제 · **FS와 stale 정책 섞지 말 것** |
| 코스/퍼블리케이션 멤버 | `publicationSessions/.../members` (coursePresence 별칭) | join/leave |
| 월드 닷 | `livePresence/{uid}` | cleanup 시 삭제 |
| HUD 타인 수 | `window.__rtwOtherLiveRiderCount` | 구독 미러 |

**레거시:** `liveCourseRides` — 마이그레이션/감사만. 활성 경로 = `livePublicationRides`.  
**죽은 경로:** `useTrailLivePublicationRidePublisher` — 앱 import 없음 (잔존 UNCLEAR).

### 1.4 종료 기록·히스토리

| 관심사 | SoT | 비고 |
|---|---|---|
| 완료 라이드 문서 | Firestore `rides/{rideId}` **immutable create** | CF가 `mileageApplied` / `conquestResult` 등 부가 |
| 즉시 UX 히스토리 | localStorage `boxcycle_web_ride_sessions_v1` | merge by id · **local UUID ≠ Firestore addDoc id** |
| discard | client/server **쌍** `MIN_MEANINGFUL_*` (≤100m or ≤5s 등) | 불일치 시 refresh 후 유령/소실 |

### 1.5 서버 파생 (라이드 create 트리거) — SoT는 CF

| 관심사 | SoT |
|---|---|
| 마일리지 | `mileageOnRideCreated` → `users/{uid}.mileage*` |
| Route Token 적립 | `routeTokenOnRideCreated` |
| 정복 | `conquestOnRideCreated` (+ client conquest payload) |
| route/world activity | `routeActivityOnRideCreated` 등 |
| live→activity | `routeActivityOnLivePublicationRideWritten` |

클라이언트 optimistic heat는 **임시** — CF 전에 잠깐 어긋날 수 있음.

### 1.6 진행률 삼중 (가장 위험한 SoT)

```
주행 중     →  client virtualDistanceMeters
재개 UI     →  savedRoutes.lastProgressRatio
종료 후     →  Firestore max() 로 savedRoutes·lastRideResult 패치
```

중도 킬(end 없음) → 진행 소실. end 전에는 FS에 progress 없음.

### 1.7 설계 시 한 줄 규칙

1. **세션 진실은 `rideStatus` + rAF metrics** — stage는 UI.
2. **presence trail은 `ridingTrailId`**.
3. **live는 FS(존재)와 RTDB(모션)를 섞어 읽지 않는다.**
4. **이어가기 선호 우선순위 ① lastRide ② prefs ③ current.**
5. **rides 문서는 create-only** — 메트릭 클라이언트 갱신 금지.
6. **savedRoutes progress는 서버 max.**
7. **discard 임계는 client/server 동기화 필수.**

---

## 2. Client session / stage / metrics / input

| 이름 | 선언 위치 | 변경 위치 | 소비 위치 | persistence | 서버/클라이언트 | source of truth | lifecycle |
|---|---|---|---|---|---|---|---|
| `rideStatus` | `hooks/useVirtualRideSession.ts` | App start/pause/resume · `useRideEndAndPersistence`→idle | overlays, RouteDock, locks, live, coaching | memory | client | client RAF session | idle→running→paused→idle |
| `metricsUi` / ride metrics | `useVirtualRideSession.ts` | rAF · reset/sync | HUD, end-ride, live, peer | memory | client | rAF refs; UI ~200ms | start 리셋 · pause 동결 |
| `startOffsetMetersRef` | 동상 | `resetDistances` | end 거리·anchors | memory | client | session ref | start 설정 |
| `RideUiStage` | `hooks/useRideUiStage.ts` (파생) | — | RouteDock 등 | none | client | auth+rideStatus+pins+summary | 매 렌더 |
| `summaryVisible` | `App.tsx` | end/도착 · dismiss | stage, RideSummarySheet | memory | client | App UI | continue/close 시 클리어 |
| `lastRideResult` | `App.tsx` · `lib/rideEndResult.ts` | end · progress 패치 · continue 클리어 | summary, continuation | memory | client | end 스냅샷 | discard/continue 시 null |
| `continuationLastRideRef` | `App.tsx` | lastRide에서 복사 | `resolveRideContinuationSetup` | memory | client | lastRide > prefs > current | 페이지 내 |
| arrival gate | `features/ride-feedback/useRideArrivalAutoEnd.ts` | virtual≥route | summary 경로 | memory | client | distance gate | idle 시 리셋 |
| `sessionStartOffsetMeters` | `App.tsx` | start | HUD | memory | client | start offset 미러 | 세션 |
| `ridingTrailId` | `App.tsx` | start · leave/end | presence trail | memory | client | riding > menu | end/leave 클리어 |
| `resumeCandidateId` / `resumeRatio` | `App.tsx` | load saved · start 클리어 | RouteDock resume | memory / derived | client | savedRoutes ratio | idle+candidate |
| nextRide dismiss/view | `App.tsx` · `lib/nextRideTarget.ts` | dismiss · 파생 | NextRideCard | memory / none | client | recent+SavedRoute | 페이지 |
| `rideInputMode` / speeds / readiness / `pedalActiveSecRef` | App + cadence libs | BLE·UI·1Hz | start gate · conquest | memory | client | App | 세션 |
| RouteDock chrome | `components/route-dock/RouteDock.tsx` | local UI | dock only | memory | client | local | visible stages |
| route lock (PROD) | `lib/routeWorkspaceLock.ts` | — | edit block | none | client | PROD && !idle | riding/paused |
| ride camera / nametag / coaching / BGM / Mapillary | App + hooks | start/follow/presence | MapView·audio·overlay | memory | client | 각 훅 | 세션 묶임 |

---

## 3. Route workspace

| 이름 | 선언 위치 | 변경 위치 | 소비 위치 | persistence | 서버/클라이언트 | source of truth | lifecycle |
|---|---|---|---|---|---|---|---|
| start/end/waypoints / profile / geometry·distance·duration | `hooks/useRoutePlanning.ts` | pick · auto-route · saved | ride · map · save | memory | client | workspace | clear/disarm |
| place labels | `useRoutePlanning.ts` | reverse geocode | UI · ride snapshots | memory | client | geocode / formatLngLat | pins 따름 |
| DistanceAutoRoute session | `hooks/useDistanceAutoRoute.ts` | arm/disarm/pick/API | dock · map bridge | memory | both (CF HTTP) | wizard → applied geometry | disarm 클리어 |
| `lastSessionPrefsRef` | 동상 | 성공 arm | continuation #2 | memory | client | last arm | 페이지 |
| MapBridge 싱글톤 | `lib/distanceAutoRouteMapBridge.ts` | register | MapView | memory | client | latest | unmount null |
| saved load refs / `lastEndedWasAdhoc` | `hooks/useSavedRoutesWorkspace.ts` | load/clear/end | resume · summary save | memory | client | load/end | end/clear |
| `savedRoutes[]` | workspace + firestore/local libs | load/save/progress tx | resume · next-ride | Firestore + localStorage | both | **FS max(server,req)** | TTL 90d 등 |
| publication/hub/entry refs | `App.tsx` | enter/leave | live · rides.routeEntry | memory | client | hub>official>trail | leave/end |

---

## 4. Live presence / peer

| 이름 | 선언 위치 | 변경 위치 | 소비 위치 | persistence | 서버/클라이언트 | source of truth | lifecycle |
|---|---|---|---|---|---|---|---|
| `livePublicationRides/{uid}` | `lib/firestoreTrailLivePublicationRides.ts` | live publish · finalize/delete | spectator · CF | Firestore | both | latest merge | ride→삭제 |
| RTDB `motion/{uid}` | `lib/rtdbTrailMotion.ts` | ~5Hz | peer 보간 | RTDB | both | latest + onDisconnect | 세션 |
| `livePresence/{uid}` | `lib/firestoreGlobalLivePresence.ts` | fanout | world dots | Firestore | both | latest merge | cleanup 삭제 |
| publication/course members | presence libs | upsert/touch | peer HUD | Firestore | both | freshness | join/leave |
| trail members | `useTrailSession` | trail join | HUD | Firestore | both | freshness | trail lifecycle |
| `liveRideRows` / HUD count / peer samplers | presence · `liveRideHudSignal` · peerMotion | subscribe/publish | map HUD | memory | client | snapshot/count | mount |
| legacy `liveCourseRides` | functions migrate | CLI | (web 미사용) | Firestore | server tooling | →livePublicationRides | purge |
| `useTrailLivePublicationRidePublisher` | hook | — | **호출자 없음** | — | client | superseded | UNCLEAR |

---

## 5. Persistence / drafts

| 이름 | 선언 위치 | 변경 위치 | 소비 위치 | persistence | 서버/클라이언트 | source of truth | lifecycle |
|---|---|---|---|---|---|---|---|
| `rides/{rideId}` | `lib/firestoreRides.ts` | end `addDoc` | history · CF | Firestore | both | **immutable create** | end 1회 |
| local recent sessions | `lib/rideSessionsStorage.ts` · `useRecentRideSessions` | end local · merge | history · next-ride | localStorage | both | merge by id | guest 정책 |
| end draft / discard | `useRideEndAndPersistence` | end 조립 | local→FS | memory→… | client→server | local first; **id 분열** | discard 임계 |
| session anchors | `lib/rideSessionAnchors.ts` | end | continuation | ride doc+local | both | end geometry | 1회 |

---

## 6. Derived (ride side-effects)

| 이름 | 선언 위치 | 변경 위치 | 소비 위치 | persistence | 서버/클라이언트 | source of truth | lifecycle |
|---|---|---|---|---|---|---|---|
| user mileage | `functions/.../mileageOnRideCreated.ts` | rides create | stats | Firestore | server | CF tx | on ride |
| route tokens | `routeTokenOnRideCreated.ts` | 동상 | balance | Firestore | server | CF by rideId | on ride |
| conquest | `conquestOnRideCreated.ts` | 동상 | paint/summary | Firestore | server | CF (+ client payload) | derived |
| route/world activity | `routeActivityOnRideCreated.ts` 등 | rides·live | heat | Firestore | server | CF | derived |
| optimistic heat | client end mark | end-ride | temp UI | memory | client | 임시 | CF 전 어긋남 가능 |

---

## 7. Overlap / SoT 리스크 목록

1. 진행률 삼중 (virtual / savedRoutes.ratio / FS max)
2. ride id 분열 (local UUID ≠ Firestore id)
3. live 이중 채널 (FS ~1Hz vs RTDB ~5Hz)
4. `ridingTrailId` vs 메뉴 trail
5. continuation 우선순위
6. discard client/server 임계 쌍
7. `RideUiStage` ≠ `rideStatus`
8. orphan live publisher hook

---

## 8. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-09-07 | `main2` 코드 기준 초판 (인벤토리 + SoT 추림) |
