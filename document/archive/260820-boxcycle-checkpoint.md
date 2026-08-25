# BOXCYCLE 코드베이스 점검 체크포인트 — 질문·답변 기록

| 항목 | 내용 |
|---|---|
| 문서 유형 | **보고서** — 세션 질의응답의 기록 |
| 일자 | 2026-08-20 |
| 브랜치 | `main2` (기준 커밋 `d879588`) |
| 성격 | 코드 **조사·분석만** 수행. 수정·커밋 없음 |
| 범위 | 재설계 관점 / 실사용 버그 2회 / Firebase 비용 / 멀티플레이어 전 구간 추적 |
| 주의 | 내용은 2026-08-20 코드 기준. 이후 수정과 다를 수 있다 |

---

## 목차

| # | 질문 | 결과 |
|---|---|---|
| 0 | 죽은 코드·중복 로직 목록 | **미완** — 답변 전 질문이 전환됨 |
| 1 | 처음부터 다시 설계한다면? | 문제 6건 · 유지 자산 6건 · 교살 순서 5단계 |
| 2 | 실사용 환경에서만 나는 버그 | 8건 (높음 3 · 중간 3 · 낮음 2) |
| 3 | Firebase/Firestore 사용 패턴과 비용 | O(N²) 확인 · 폭증 후보 8곳 |
| 4 | 12개 시나리오 대입 버그 재조사 | 9건 (심각 3 · 높음 2 · 중간 4) |
| 5 | 멀티플레이어 아키텍처 전 구간 추적 | 8단계 · 독립 rAF 2개 · 비대칭 시간축 |

---

# 0. 미완 — 죽은 코드·중복 로직 목록

> **질문** — 죽은 코드, 중복 로직, 더 이상 사용되지 않는 state/ref/effect, 과거 구현의
> 흔적, 의미 없는 abstraction을 찾아라. 수정하지 말고 목록만 작성해라.

조사 착수 직후 질문이 전환되어 **답변하지 않았다.** 다만 이후 조사에서 부수적으로
확인된 죽은 코드가 몇 건 있으므로 다음 착수 시의 출발점으로 기록해 둔다.

| 대상 | 위치 | 상태 |
|---|---|---|
| `mergePeerMotionPackets` | `peerMotion/mergePackets.ts:13` | 제품 경로 **미배선** (사용처 grep 0건) |
| `pickFresherPeerMotionPacket` | `peerMotion/mergePackets.ts:49` | `@deprecated` alias |
| `PEER_RECONCILE_SOFT_M` 외 3 | `rideSyncPolicy.ts:55-64` | 상수만 존재, integrator 미사용 |
| `PEER_SPEED_EXTRAP_MAX_MS` | `rideSyncPolicy.ts:86` | `@deprecated` alias |
| `LIVE_SHARE_MIN/MAX_WRITE_INTERVAL_MS` | `rideSyncPolicy.ts:7,10` | 정의만 있고 **참조 0건** |
| `findPublishedRoutePublicationByCourseId` | `firestoreRoutePublications.ts:165` | 단순 alias (courseId→id) |
| 외삽 상한 3종 공존 | 12s / 1.2s / 3s | "지금 모델"이 코드만으로 불확정 |

---

# 1. 처음부터 다시 설계한다면

> **질문** — 현재 구현이 옳다는 전제를 버리고 처음부터 다시 설계한다면 어떻게
> 만들겠는가? 현재 구조의 문제점과 유지해야 할 부분을 비교해라.

## 1.1 진단 근거

`App.tsx` 2,211줄(useState 36개, 훅 호출 83개) · `MapView.tsx` 3,255줄(props 약 40개) ·
`src/lib`에 presence/live 계열 파일 9개 이상 · 상태관리 라이브러리와 Context 모두 부재
(전부 props로 흐름).

## 1.2 다시 만든다면 하지 않을 것

### ① App.tsx = 신(神) 컴포넌트 오케스트레이터

`App.tsx:166~917`에 36개 useState가 지도 줌·날씨·Trail 가시성·요약 시트·정복 기준선까지
전부 한 컴포넌트에 산다.

이벤트 버스가 없어서 **nonce 카운터로 이벤트를 흉내**내고 있다 —
`rideFollowCameraNonce`, `rideJoinBurstNonce`, `openSavedTabNonce`, `activityMapRefreshNonce`.
"숫자를 올리면 아래 어딘가의 effect가 반응한다"는 암묵 계약이라, 흐름 추적이 grep에 의존한다.

> **백지 설계** — 스토어(zustand 계열) + 슬라이스(rideSession / trail / routeWorkspace /
> mapViewport / overlays)와 명시적 이벤트로 대체. App은 레이아웃만 담당.

### ② MapView = 40개 props로 만든 명령형 세계의 방화벽

`MapView.tsx:1179-1258`의 props 타입 자체가 문제를 자백한다 — Conquest 궤적, Mapillary
토큰, 카메라 점프, spectator dot, LOD 뷰포트 콜백, "확정 후 제거 예정" 개발용 슬라이더까지
한 장의 계약서에 다 들어 있다.

오버레이 하나 추가 = props 추가 + App 배선 + `useAppMapOverlays` 배선, **3곳 수정.**

> **백지 설계** — mapbox 인스턴스를 가진 MapController 서비스 + 오버레이 플러그인
> 레지스트리(각 오버레이가 source/layer/lifecycle을 자기 모듈에서 등록).
> props는 카메라·스타일 등 코어만.

### ③ Presence·동기화 채널의 지층화

`firestoreTrail`(presence) · `firestoreCoursePresence` · `firestorePublicationPresence` ·
`firestorePublicationSessionPresence` · `firestoreGlobalLivePresence` ·
`firestoreWorldPresence` · `rtdbTrailMotion` · `liveLocationSnapshot` +
`publishLiveLocationFanout`(다중 채널 부채꼴 쓰기).

**"내가 어디서 달리고 있다"라는 사실 하나가 6~7개 스키마로 복제된다.**
sync-relay S4가 touch 합침 같은 증상 치료를 하는 근본 원인이 이 다중 채널이다.

> **백지 설계** — 단일 Presence Gateway. 쓰기는 정책 기반 파이프라인 1개
> (1 writer → 채널별 projection), 읽기는 `(channel, scope)` 키의 구독 허브 1개.
> 문서 스키마는 capability 필드를 가진 presence 문서 1종으로 통합.

### ④ course / route / publication 용어 지층

`firestoreRoutePublications.ts:165-168`의 `findPublishedRoutePublicationByCourseId(courseId)`가
단순 alias인 것처럼, 데이터 모델 진화의 퇴적층이 코드 전반에 노출돼 있다.

Ontology §0.1이 일괄 rename을 금지한 것은 타당하나, 백지라면 **경계에 anti-corruption
layer 1곳**을 두고 내부는 `publication` 단일 애그리거트만 쓰게 했을 것.

### ⑤ 주행 세션 상태기계의 분산

`RideSessionStatus`는 `useVirtualRideSession`에 있지만, 시작·종료·영속화·프리젠스 정리·
카메라 전환이 `useRideEndAndPersistence`, `useRideUiStage`, App 본문 glue에 흩어져 있다.

> **백지 설계** — 명시적 FSM 모듈 1개(idle→running→paused→ended→persisted)에
> 부수효과를 전이 구독자로 부착.

### ⑥ DEV 계측이 프로덕션 훅 안에 상주

`useAppMapOverlays.ts`의 `runActivityWorldLodP0Checks`, `runPublicationPresenceParseChecks`,
`mapDebugPhase` 분기들. 유효한 규율이지만 빌드 플래그로 분리된 계측 모듈이었어야 한다.

## 1.3 다시 만들어도 그대로 가져갈 것

| 자산 | 이유 |
|---|---|
| **SubscriptionHub 패턴** (3종) | refCount 공유 구독은 정확히 맞는 프리미티브. 문제는 패턴이 아니라 3벌 복제 — 제네릭 1개로 통합만 하면 됨 |
| **`lib/` 순수 로직 분리** (geo, rideSyncPolicy, peerMotion integrator) | replay 하네스로 실주행 없이 회귀 고정 가능. **이 코드베이스의 가장 좋은 부분** |
| **Firestore + RTDB 이원화** | 고빈도 모션=RTDB, 내구 상태=Firestore. 재설계해도 동일한 결론 |
| **`features/map-overlays` 추출 방향** (AppMapStage) | 방향은 옳고 미완일 뿐. 재설계의 씨앗으로 그대로 사용 |
| **관심사별 훅 명명** (`useRideBgm`, `useBleCrankRpm` …) | 배선은 문제여도 단위 자체는 응집도가 높음 |
| **문서 체계** (Ontology·결정 로그·상태보드·Skill/Harness) | 재설계 시 가장 비싼 "왜"가 이미 보존돼 있음 |

## 1.4 결론 — 전면 재작성이 아니라 교살(strangler)

전면 재작성은 정당화되지 않는다. 좋은 이음새(`lib/` 순수 함수, 허브, features 추출)가
이미 있어 점진 치환이 가능하다. 지렛대 순서:

1. **구독 허브 제네릭화** (저위험, 3벌 → 1벌)
2. **nonce → 이벤트/스토어 전환** — App.tsx 상태를 슬라이스로 이관 (App 해체의 핵심)
3. **Presence Gateway 통합** — sync-relay S4의 자연스러운 종착점. 결정 로그를 거쳐 별도 계획으로
4. **MapView 오버레이 레지스트리화** — props 40개를 코어 10개 이하로
5. **course→publication ACL 경계 정리** — 마이그레이션 비용상 마지막 (Ontology §0.1 절차 준수)

> **가장 큰 위험**은 ③과 ②를 동시에 건드리는 것. 동기화 채널 통합(③)이 진행 중이므로,
> 완료 전에는 ①·②처럼 **데이터 스키마를 건드리지 않는 구조 정리만** 하는 것이 안전하다.

---

# 2. 실사용 환경에서만 나는 버그 (1차)

> **질문** — 현재 코드에서 정상적인 사용 시나리오에서는 발견하기 어렵지만 실제 사용자
> 환경에서 발생할 가능성이 있는 버그를 찾아라.

## 2.1 높음

### ① RTDB onDisconnect 1회 무장 — 순단 후 유령 peer 잔류

`rtdbTrailMotion.ts:107-113`

```js
if (onDisconnectArmed.has(key)) return;   // (trail,uid)당 딱 1회
await onDisconnect(r).remove();
onDisconnectArmed.add(key);
```

RTDB `onDisconnect`는 **서버에서 1회 실행 후 소멸**한다. 공식 패턴이 `.info/connected`
콜백에서 재무장하는 이유인데, 이 코드베이스에는 `.info/connected` 구독이 **없다**(grep 0건).

**시나리오** — 지하철·엘리베이터 순단 → 서버가 remove 실행(1회분 소진) → 재연결 →
5Hz 발행이 행을 재생성 → **재무장 안 됨** → 이후 탭 강제 종료·두 번째 순단 시 모션 행
영구 잔류 → 나중에 진입한 모든 사용자에게 유령 dot.

수신측 `pruneInactive`는 로컬 제거일 뿐 RTDB 행은 못 지운다.
개발 환경(연결이 안 끊김)에서는 재현 불가능한 전형적 실환경 버그.

### ② 보간 타임라인이 벽시계 — 시계 보정 시 peer 순간이동

`integrator.ts:50,145` (ingest `recvAtMs`와 step `nowMs` 모두 `Date.now()`)

모바일은 백그라운드 복귀·NTP 동기화 때 시계가 수 초 단위로 점프한다.

- 시계가 **앞으로** 점프 → renderTime이 버퍼를 지나쳐 전 peer가 1.2s 외삽 후 hold
- 시계가 **뒤로** 점프 → 버퍼 내 `recvAtMs` 단조 가정이 깨져
  (`span = s1.recvAtMs - s0.recvAtMs`가 0 또는 음수 근처) 보간 t가 발산 가능

`spectatorRideExtrap.ts`·`pruneInactive`도 같은 시계를 쓴다.
rAF 타임라인에는 단조 시계(`performance.now()`)가 정본이어야 할 자리.

### ③ 같은 코스 재주행 시 retrograde 영구 폐기 — peer가 결승점에 고정

`integrator.ts:75` (`packet.distM < newest.distM - 0.05` → `discard-retrograde`)

**시나리오** — peer가 완주(`completed`) 직후 **10초 안에**(=`PEER_DRIVE_SIM_GRACE_MS`
prune 전, RTDB 행도 살아 있어 activeUids 유지) 같은 publication을 다시 시작 →
distM이 0으로 리셋된 패킷이 전부 retrograde로 폐기.

그런데 `applyPeerMotionIngest`는 dedup **전에** `entity.phase = packet.phase`를 갱신하므로
phase는 `live`가 되고, step은 옛 newest(결승점)에서 `entity.speedMps`로 외삽 →
**재출발한 peer가 결승점에 붙어 있는 것으로 보이며, 상대가 이전 최고 지점을 다시 통과할
때까지 지속**된다.

다른 publication 전환은 upstream 필터(`syncFromPresence.ts:32,39`)가 막지만,
**같은 pid 재주행**은 막는 게 없다.

## 2.2 중간

### ④ `serverAtMs`는 서버 시각이 아니라 송신자의 `Date.now()`

`rtdbTrailMotion.ts:75` (`t: Date.now()`) → decode에서 `serverAtMs`로 명명.

**이름이 계약을 거짓말한다.** 이 값을 로컬 시계와 비교하는 로직
(`mergePackets.ts:29` `Date.now() - rtdbMs <= 2_500`)은 기기 간 시계차가 2.5초만 넘어도
(모바일에서 흔함) 신선도 판정이 뒤집힌다.

현재 `mergePeerMotionPackets`는 제품 경로 미배선이라 **잠복 상태** — 누군가 merge를 다시
켜는 순간 실환경에서만 터지는 형태로 활성화된다.

### ⑤ 무선 burst 도착 → 수신 시각 보간이 지터를 증폭

`integrator.ts:171-172`

모바일 무선은 절전 후 패킷 여러 개를 한꺼번에 flush한다. 송신 간격 100ms짜리 두 스냅샷이
recvAt 5ms 차로 붙으면, 보간 구간 300ms 분량의 이동이 5ms span에 압축돼 통과 시 위치가 점프.

`resolveSpeedMps`의 `dtSec > 0.04` 가드(`integrator.ts:39`)도 burst에서는 속도 갱신을
건너뛰고 낡은 속도를 유지한다. (S4-4 "톡톡" 증상과 같은 구조 — 확정 원인이라 단정하지 않음)

### ⑥ 저속에서 dedup 임계 0.05m가 버퍼를 굶김

`integrator.ts:68-77`

100ms 간격 기준 0.05m 전진 = **1.8km/h**. 그 이하(급경사 오르막, 출발 직후)에서는 패킷
대부분이 `dup-same-dist`로 버려져 버퍼가 희소해지고, 보간 대신 1.2s 외삽→hold 사이클이
반복돼 **저속 peer만 뚝뚝 끊겨 보인다.**

## 2.3 낮음

### ⑦ 오프라인 중 single-flight 고착

`motionPublishFlight.ts` — RTDB `set` promise는 서버 확인까지 pending이므로 순단 동안
`writing=true` 고착, 이후 job은 slot 1건만 유지. 재연결 시 회복되고 수신측 dedup이 옛
스냅샷을 걸러 실해는 작지만, **재연결 직후 낡은 좌표 1건이 먼저 발행되는 순서**는 인지 필요.

### ⑧ PEER_MAX 30 초과 peer 영구 미표시

`PeerMotionRegistry.ts:24,128` — `entities` Map 삽입 순서로 앞 30명만 렌더하고 `break`.
대형 Trail에서 31번째 이후 진입자는 먼저 온 사람이 나가기 전까지 **절대 표시되지 않는다**
(우선순위 기준 없음 — 거리·화면 근접 무관).

## 2.4 요약표

| # | 위치 | 트리거 환경 | 증상 |
|---|---|---|---|
| ① | `rtdbTrailMotion.ts:109` | 네트워크 순단 2회 | 유령 peer 영구 잔류 |
| ② | `integrator.ts:50,145` | 시계 보정(NTP·복귀) | peer 순간이동/hold |
| ③ | `integrator.ts:75` | 같은 코스 즉시 재주행 | peer 결승점 고정 |
| ④ | `rtdbTrailMotion.ts:75` | 기기 시계차 >2.5s | (잠복) 신선도 오판 |
| ⑤ | `integrator.ts:171` | 무선 burst 도착 | 위치 점프 |
| ⑥ | `integrator.ts:68` | 1.8km/h 미만 저속 | 끊기는 이동 |
| ⑦ | `motionPublishFlight.ts` | 장기 오프라인 | 재연결 직후 낡은 발행 1건 |
| ⑧ | `PeerMotionRegistry.ts:128` | 31명 이상 Trail | 신규 peer 미표시 |

①·②·③은 현재 S4 계열 계측으로는 잡히지 않는 유형(재현 조건이 네트워크·시계·수명주기).
수정 착수 시 replay 하네스에 **"순단·시계 점프·재주행" 시나리오를 먼저 추가**하는 편이 순서에 맞다.

---

# 3. Firebase / Firestore 사용 패턴과 비용

> **질문** — 이 프로젝트의 Firebase/Firestore 사용 패턴을 전부 조사해라. 사용자가
> 1명, 2명, 10명, 100명일 때 read/write가 어떻게 증가하는지 추정하고 비용 폭증
> 가능성이 있는 코드를 찾아라.

## 3.1 쓰기 인벤토리 — 주행 중 라이더 1인당

| 채널 | 위치 | 주기 | 시간당 write |
|---|---|---|---|
| `trails/{t}/livePublicationRides/{uid}` | `rideSyncPolicy.ts:28,40,43` MIN=MAX=**1,000ms** | **1Hz** | **3,600** |
| `livePresence/{uid}` (global) | `rideSyncPolicy.ts:103-105` | 4~12s | ~300–900 |
| coursePresence heartbeat | `rideSyncPolicy.ts:19` | 24s | 150 |
| trail members heartbeat | `rideSyncPolicy.ts:25` | 30s | 120 |
| Trail `lastActivityAt` touch | heartbeat 간격으로 합침(최근 커밋) | 합산됨 | ~120 |
| RTDB motion | `PEER_MOTION_PUBLISH_INTERVAL_MS=100` | 10Hz | 문서 과금 아님 · **대역폭 과금** |

**주행 1시간 ≈ Firestore write 4,300건/인.**
종료 시 rides 생성 → `conquestOnRideCreated`·`mileageOnRideCreated`·`routeTokenOnRideCreated` 1회성.

## 3.2 읽기 인벤토리 — 접속자 1인당

| 채널 | 위치 | 형태 |
|---|---|---|
| Trail 내 liveRides | `firestoreTrailLivePublicationRides.ts:88` (허브 공유) | onSnapshot — **라이더 write마다 1 read** |
| 전 세계 liveRides | 같은 파일 `:244` collectionGroup, limit 80, 상시 | onSnapshot — **전 세계 라이더 write마다 1 read** |
| globalLivePresence | `firestoreGlobalLivePresence.ts:63` — **컬렉션 전체, where/limit 없음** | onSnapshot |
| publicationPresence | 폴 60s, active 48 + closed 32 = 최대 80 docs/분 | getDocs |
| routeActivity(liveNow) | 폴 60s (idle 600s) | getDocs |
| openTrailListings | onSnapshot + Trail마다 `countTrailLiveRidersFresh` = **문서 48개 실읽기로 카운트** (`:193,205` — `count()` 미사용) | getDocs × Trail 수 |
| conquest chunks/traces | `firestoreConquest.ts:53,69` — **전량 getDocs, 상한 없음** | 세션당 1회 |

## 3.3 Cloud Functions 증폭

`livePublicationRides` 문서에 **write당 트리거 2개**:

- `routeActivityOnLivePublicationRideWritten` (heartbeat-only 조기 반환 가드 있음 —
  그래도 **호출 과금은 발생**)
- `openTrailListingOnLiveCourseRideWritten`

→ 라이더 1인당 **함수 호출 ~2회/초 = 7,200회/h**. progress가 0.012(코스의 약 1.2%) 움직일
때마다 routeActivity/worldActivity 집계 write 체인 + 세션 시작·종료마다
`refreshWorldHighlightedCourses()`.

## 3.4 스케일 추정

> 가정 — 동시 접속의 절반이 주행, 전원이 맵 화면(=collectionGroup + trail 구독 보유).
> 핵심 항은 **라이더 R × 구독자 U × 1Hz**이고, 같은 Trail이면 trail 구독과
> collectionGroup 구독이 **같은 문서를 이중 read** 한다.

| 동시 사용자 | 라이더 | Firestore reads/h | writes/h | 함수 호출/h | 비고 |
|---|---|---|---|---|---|
| 1 | 1 | ~7천 | 4.3천 | 7.2천 | 혼자여도 하루 2–3시간이면 무료 티어 read(5만/일) 초과 |
| 2 | 2 | ~2.9만 | 8.6천 | 1.4만 | R×U=4 → 이중구독 시 8 reads/s |
| 10 | 5 | **~36만** | 2.1만 | 3.6만 | 이미 read가 write의 17배 |
| 100 | 50 | **1,800만~3,600만** | 21.5만 | 36만 | reads만 **시간당 $11~22**(@$0.06/10만). 피크 3h/일 ≈ **$30–60/일** |

**RTDB 별도** — 100명 시 모션 다운스트림 ≈ 50 라이더 × 100 구독 × 10Hz × ~0.1KB
≈ 5MB/s ≈ 18GB/h → **시간당 ~$18**(@$1/GB). Firestore와 같은 자릿수의 폭탄.

> **증가 차수** — 쓰기는 O(N), **읽기·RTDB 대역폭은 O(N²)**. 폭증은 전부 읽기 쪽.

## 3.5 비용 폭증 후보 (우선순위)

1. **Firestore liveRide 1Hz heartbeat** — `rideSyncPolicy.ts:40,43`.
   모든 N² 항의 분모. 모션은 이미 RTDB 10Hz로 가므로 Firestore는 4~10s면 충분한 구조.
   **이것 하나로 read·함수 호출이 4~10분의 1**로 줄어드는 지렛대.
2. **write당 함수 트리거 2개** — `routeActivityOnLivePublicationRideWritten.ts:111`,
   `openTrailListingProjection.ts:53`. heartbeat까지 호출되는 구조 자체가 증폭기.
3. **collectionGroup 상시 onSnapshot** — `firestoreTrailLivePublicationRides.ts:244`.
   전 세계 라이더의 1Hz 문서를 모든 접속자가 실시간 구독. 이미 존재하는 60s 폴이나
   함수 projection 문서 1개 구독으로 강등 가능.
4. **같은 문서 이중 리스너** — trail 구독(`:88`)과 collectionGroup(`:244`)이 동일 문서
   갱신을 각각 과금.
5. **globalLivePresence 무제한 컬렉션 구독** — `firestoreGlobalLivePresence.ts:63`.
   limit·지역 필터 없음.
6. **카운트를 문서 48개 실읽기로** — `firestoreTrailLivePublicationRides.ts:193,205` +
   `useOpenTrails.ts:92`의 `Promise.all`. `getCountFromServer()` 집계면 read 1건.
7. **conquest 전량 로드** — `firestoreConquest.ts:53,69`. 사용자 수가 아니라 **사용 기간**에
   비례해 자라는 폭탄.
8. **publicationPresence 60s×80docs 폴** — 100명이면 시간당 48만 read 추가.

## 3.6 결론

현재 구조는 **10명 선까지는 견디고, 100명에서 read(수천만/일)와 RTDB 대역폭이 비용의
90% 이상**을 차지한다. 근원은 하나 — *"Firestore liveRide 문서를 1Hz로 두드리고, 그
문서를 모두가 2중으로 실시간 구독하며, write마다 함수 2개가 깨어나는"* 체인.

①번(1Hz→4~10s) 하나가 체인 전체를 줄이는 최대 지렛대이고, ③⑤⑥은 독립적으로 고칠 수
있는 확실한 절감처.

---

# 4. 12개 시나리오 대입 버그 재조사

> **질문** — 정상 시나리오에서 발견하기 어렵지만 실제 사용자 환경에서 발생할 가능성이
> 있는 버그를 찾아라. 조건: 두 명 동시 접속 / 한 명 네트워크 끊김 / 탭 백그라운드 /
> 모바일 화면 잠금 / reconnect / 빠른 start·stop / trail 변경 / 상대가 먼저 나감 /
> 새로고침 / 느린 인터넷 / Firebase 응답 순서 뒤바뀜 / 3명 이상 접속

## 4.1 심각 — 유령이 영구히 남는 조합

### ① 유령 peer가 세션 내내 얼어붙은 채 지도에 남는다

`rtdbToPacket.ts:9` · `rowToPacket.ts:70` · `syncFromPresence.ts:32,39`

패킷 변환·수집 **어느 단계에도 신선도 검사가 없다.** `publicationId` 일치만 본다.
`serverAtMs`/`lastSeenAtMs`는 packet에 담기만 하고 게이트로 쓰이지 않는다.
(`isTrailLivePublicationRideRowPeerVisible`의 4초 규칙은 **HUD 패널 전용**이고
지도 마커 경로에는 안 걸린다.)

제거 수단은 `markActiveUids` + `pruneInactive` 뿐인데 결정적 구멍이 있다:

```js
// PeerMotionRegistry.ts:98
if (this.activeUids.has(uid)) continue;   // 나이 검사 자체를 건너뜀
```

- RTDB `onValue`는 **값이 변하지 않으면 재발화하지 않는다.** 낡은 motion 노드는 조용히 남는다.
- 그런데 Firestore 스냅샷이 올 때마다 `syncPeerMotionFromPresence`가
  `motionRowsRef.current`(그 낡은 노드 포함)를 그대로 넘긴다 →
  **유령 uid가 매번 activeUids로 되살아난다.**
- 결과: `pruneInactive`가 영원히 그 uid를 건너뛴다. 화면에는 1.2초 외삽 후 정지한
  라이더가 **세션 내내** 박혀 있다.

**트리거** — 상대방이 나감 + ②의 onDisconnect 미발동, 또는 RTDB/Firestore 삭제 순서 뒤바뀜.

### ② onDisconnect가 1회 소진 후 재무장되지 않는다

`rtdbTrailMotion.ts:107-113` — (§2 ①과 동일 결함)

여기서 중요한 것은 **결과의 크기가 달라진다**는 점이다. 순단 자체는 간헐적이지만,
그 결과로 남은 낡은 RTDB 노드는 ①에 의해 **자가 회복이 불가능한 영구 유령**으로 굳는다.

### ③ 새로고침·탭 닫기 정리 경로가 아예 없다

`beforeunload`/`pagehide` 핸들러 **grep 0건**.
React의 unmount cleanup은 브라우저 새로고침에서 실행되지 않는다.

| 문서 | 정리 주체 | 새로고침 시 |
|---|---|---|
| `livePresence/{uid}` | 클라 cleanup만 | **영구 잔류** |
| `trails/{t}/livePublicationRides/{uid}` | 클라 cleanup만 | 잔류(다음 세션이 덮어씀) |
| `publicationSessions/{scope}/members/{uid}` | 클라 cleanup만 | **영구 잔류** |

Cloud Functions export 전수(`functions/src/index.ts:234-266`) 확인 결과
**`livePresence` 스윕 함수가 없다.** `openTrailListingsSweep`·`subscriptionExpireSweep`·
`routeActivity*Reconcile`만 존재.

여기에 `firestoreGlobalLivePresence.ts:63`이 **limit·where 없이 컬렉션 전체를 onSnapshot**
하므로, 새로고침이 누적될수록 모든 접속자가 죽은 문서까지 매번 읽는다.
`isGlobalLivePresenceFresh`(240초)는 읽은 **뒤에** 거르는 표시 필터일 뿐 읽기 비용을 못 막는다.

## 4.2 높음

### ④ joinBurst가 세션 스코프를 무시 — 격리 계약 위반 + 고아 문서 누적

`rideJoinPresenceBurst.ts:18` vs `PublicationSharedPresence.tsx:103,174,303,314`

```js
// PSP — isolateByTrail 이면 Trail 단위 격리
const sessionScopeId = isolateByTrail ? `${pid}::${trailId}` : pid;
upsertPublicationSessionMember(user, sessionScopeId);   // :174 쓰기
deletePublicationSessionMember(uid, scope);             // :303 삭제
touchPublicationSessionMember(..., sessionScopeIdRef);  // :314 하트비트

// joinBurst — 스코프를 모른다
upsertPublicationSessionMember(user, snapshot.publicationId);  // ← 순수 pid
```

`App.tsx:2195`가 `isolateByTrail={!sharedRideIsExplicitCourse}`이므로
**UGC·개인 주행은 전부 격리 대상.** 그런데 주행 시작 버스트는 격리되지 않은 `pid` 스코프에
멤버 문서를 쓴다.

- 그 문서를 **삭제하는 주체도, 하트비트하는 주체도 없다** — PSP는 `pid::trailId`만 관리.
- 주행 시작 1회 = 고아 문서 1개, 영구 누적.
- PSP `:100-102` 주석이 명시한 격리 목적("참여하지도 않은 남의 개인 주행자가 접속자로
  뜨지 않는다")이 **시작 시점에 무너진다.** 해당 publication을 공식 코스로 보는
  클라이언트(`isolateByTrail=false`)에는 이 고아들이 참가자로 보일 수 있다.

### ⑤ 느린 인터넷에서 join burst 재시도가 중첩된다

`useLiveLocationPublishSession.ts:240-247`

```js
const retryId = window.setInterval(() => {
  void attempt().then((ok) => { if (ok) window.clearInterval(retryId); });
}, 300);
const stopId = window.setTimeout(() => window.clearInterval(retryId), 4_000);
```

`attempt()`는 async인데 **재진입 가드가 없다.** 응답이 300ms를 넘으면 이전 attempt가
끝나기 전에 다음이 발사된다. 4초 창 / 300ms = **최대 13개 중첩.**

attempt 1회당 실제 쓰기: 멤버 upsert + liveRide merge + `touchTrailInstanceActivity` +
global presence + motion enqueue.

**느린 회선일수록 쓰기가 폭증하는 역방향 구조.**
`joinBurstDoneNonceRef`는 성공 **후에** 세팅되므로 이미 떠 있는 attempt들을 막지 못한다.

## 4.3 중간

### ⑥ Trail을 바꾸면 이전 Trail 동행이 최대 10초 남는다

`PublicationSharedPresence.tsx:149` vs `:196,230,290`

```js
useEffect(() => { resetPeerMotionRegistry(); }, [publicationId]);  // trailId 없음
// 구독 effect들은 [pageVisible, trailId]
```

`isolateByTrail`이 명시적으로 지원하는 **"같은 publication, 다른 Trail"** 전환에서
registry가 초기화되지 않는다. 새 Trail의 첫 스냅샷이 `markActiveUids`를 갱신해도,
`pruneInactive`는 `lastIngestLocalMs > 10초`를 요구하므로 **방금까지 살아 있던 peer는
즉시 지워지지 않는다.**

### ⑦ 백그라운드 동안 prune이 완전히 무력화된다

`PublicationSharedPresence.tsx:158,199,233` + `PeerMotionRegistry.ts:98`

탭이 백그라운드로 가면 세 구독이 모두 해제되고 rows가 비워진다. 그러나
**`resetPeerMotionRegistry()`는 호출되지 않고**, `markActiveUids`도 더 이상 호출되지
않으므로 `activeUids`가 옛 peer를 그대로 붙들고 있다 → `pruneInactive`가 나이 검사를 건너뛴다.

화면 잠금 5분 후 복귀하면, 새 스냅샷 도착 전까지 **5분 전 위치의 유령**이 먼저 그려진다.
(rAF는 즉시 재개되지만 구독 재수립은 네트워크 왕복이 필요해 순서가 어긋난다.)

### ⑧ 3명 이상 — guest 번호가 클라이언트마다 다르게 보인다

`guestNametag.ts:21` · `PublicationSharedPresence.tsx:373-379`

```js
const i = guestUidsSorted.indexOf(uid);
return i >= 0 ? `guest${i + 1}` : "guest";
```

`guestUidsSorted`는 **각 클라이언트가 그 순간 보고 있는 `active` 멤버 목록** 기준.
멤버 문서 도착 시점이 다르거나(느린 회선), ④의 스코프 불일치로 목록이 갈리면
**내 화면의 guest2가 상대 화면에서는 guest3**이 된다. 3명 이상에서만 눈에 띈다.

또 `guestUidsRef.current`는 `useEffect`로 뒤늦게 채워지므로(`:377`), 첫 스냅샷 시점에는
`[]`이라 **잠깐 전원이 번호 없는 "guest"** 로 표시된다.

### ⑨ epoch 자료구조가 무한 증가한다

`motionPublishFlight.ts:56,59,80,139` · `routePublishFlight.ts:57,61,86,154` (동일 구조 2벌)

`sessionKeyByEpoch`(Map)와 `cancelledEpochs`(Set)에 **delete·clear가 한 번도 없다.**
탭 전환 1회 = 백그라운드 cancel 2건 + 복귀 시 새 epoch 2건. 장시간 세션에서 탭을 자주
오가면 단조 증가. 실해는 낮지만 **수명주기 자료구조에 상한이 없다**는 점은 기록할 값.

## 4.4 시나리오 → 결함 대응표

| 시나리오 | 해당 항목 |
|---|---|
| 두 명 동시 접속 | ④ ⑧ |
| 네트워크 순단 | ② → ① |
| 탭 백그라운드 | ⑦ ⑨ |
| 모바일 화면 잠금 | ⑦ + 시계 점프(§2 ②) |
| reconnect | ② ⑤ |
| 빠른 start/stop | retrograde 폐기(§2 ③) |
| trail 변경 | ⑥ |
| 상대방이 먼저 나감 | ① ② |
| 새로고침 | ③ ④ |
| 느린 인터넷 | ⑤ ⑧ |
| 응답 순서 뒤바뀜 | ① (RTDB/Firestore 삭제 순서) |
| 3명 이상 | ⑧ + PEER_MAX(§2 ⑧) |

## 4.5 결론

**가장 위험한 것은 단일 결함이 아니라 ②→①의 연쇄다.**
onDisconnect 소진은 간헐적이지만, 그 결과로 남은 낡은 RTDB 노드는 ①의 신선도 게이트
부재 때문에 **자가 회복이 불가능한 영구 유령**으로 굳는다.

이 둘은 각각 **한 줄짜리 방어**(`.info/connected` 재무장 / ingest 시 `serverAtMs` 나이 컷)로
끊을 수 있는 지점이기도 하다.

검증 착수 시 replay 하네스에 **순단·시계 점프·재주행·Trail 전환** 시나리오를 먼저 넣는
편이 순서에 맞다 — 현재 하네스는 이 네 가지를 모두 모의하지 못한다.

---

# 5. 멀티플레이어 아키텍처 전 구간 추적

> **질문** — 이 프로젝트의 multiplayer architecture를 처음부터 끝까지 추적해서 설명해라.
> 데이터 생성 / 로컬 상태 저장 / rAF 업데이트 / React state 반영 / 서버 전송 /
> Firebase·relay 저장 / 상대방 수신 / 화면 렌더링

## 5.0 전체 지도

```
[속도 입력]  슬라이더 / BLE 크랭크
     │
①   ├─ rAF 루프 A ─ virtualDistanceRef (m, 스칼라) ← 정본
     │   useVirtualRideSession.ts:96-140
     │
②   ├─ 3중 저장: ref(진실) / state(200ms) / 전역 샘플러(백채널)
     │
③   ├─ rAF 루프 B ─ MapView.tsx:2313  ← React 우회, ref 직접 읽기
     │   ├→ 내 마커·카메라
     │   └→ 동행 위치 계산 → GeoJSON
     │
④   ├─ setMetricsUi 200ms ─→ HUD 텍스트만
     │
⑤   ├─ setInterval 100ms ─ 스냅샷 생성 → 3채널 스로틀 → single-flight
     │   useLiveLocationPublishSession.ts:372
     │
⑥   ├─ RTDB 10Hz (모션)  +  Firestore 1Hz (presence·집계)
     │                            └→ Cloud Functions ×2
     ▼
⑦  [상대 클라이언트] 구독 3개 → syncPeerMotionFromPresence → 버퍼 push
     │
⑧  rAF 루프 B → now−160ms 보간 → 경로 투영 → DOM/GLB 마커
```

## 5.1 데이터 생성 — 정본은 `distM` 스칼라 하나

`useVirtualRideSession.ts:96-140`

```js
const deltaMs = Math.max(0, ts - lastAnimTsRef.current);      // rAF 타임스탬프
appliedSpeedRef.current = stepRideSpeedKmh(applied, target, deltaMs);  // 램프
virtualDistanceRef.current += (applied * 1000 / 3600) * (deltaMs / 1000);
```

핵심 설계 결정 — **위치의 정본은 경로상 거리 `virtualDistanceRef`(m) 하나**이고
lng/lat이 아니다. 좌표는 필요할 때마다 `getPointOnRouteByDistance(geom, capDist)`로
투영해 만든다(`:126,131`).

고정 경로 위를 달리는 도메인이라 1차원으로 충분하고, 좌표를 정본으로 두면
투영·반올림 오차가 위치를 오염시키기 때문.

속도 입력은 두 갈래 — 슬라이더(`App.tsx:201`)와 BLE 크랭크 센서(`useBleCrankRpm.ts`).
둘 다 `speedRef`로 수렴한 뒤 `stepRideSpeedKmh` 램프를 통과한다(급가속 시 순간 점프 방지).

도착 처리는 특이하다 — `routeLen` 도달 시 최종 flush 후 **다음 프레임을 예약하지 않고
rAF를 끊는다**(`:120-128`). 상태(`running`) 전환은 호출측 `App.tsx`가 메트릭 변화를 보고
마무리한다.

## 5.2 로컬 상태 저장 — 3중 저장과 백채널

| 저장소 | 갱신 | 용도 |
|---|---|---|
| `virtualDistanceRef` | rAF마다 (~16ms) | **진실값** |
| `metricsUi` state | 200ms (`METRICS_UI_MS`) | HUD 텍스트 |
| 전역 샘플러 | 등록 1회, 읽기는 pull | 발행 경로의 백채널 |

세 번째가 아키텍처적으로 중요하다. `useVirtualRideSession.ts:200-217`이
`registerPeerSyncDistanceSamplers`로 rAF 원본을 읽는 함수를 전역에 등록한다:

```js
registerPeerSyncDistanceSamplers({
  sampleVirtualDistanceM, sampleAppliedSpeedKmh,
  sampleTargetSpeedKmh: () => speedRef.current, sampleRouteLens: ...
});
```

이유는 §5.5에서 드러난다 — **발행이 React state(200ms 낡음)를 우회해 rAF 원본을 읽어야
하기 때문.** props 사슬을 타면 200ms 지연이 그대로 네트워크로 나간다.

## 5.3 rAF 업데이트 — 독립된 두 루프

이 앱에는 서로 독립적인 rAF 루프가 **둘** 돈다.

- **루프 A** (`useVirtualRideSession.ts:96`) — 거리 적분. 데이터를 만든다.
- **루프 B** (`MapView.tsx:2313-2449`) — 렌더. 카메라·내 마커·동행 마커.

루프 B는 루프 A의 결과를 React가 아니라 **함수 포인터로 직접 당겨온다**:

```js
const sampleFn = sampleLiveLngLatRef.current;
const sampled = sampleFn?.() ?? liveLngLatRef.current;   // :2325-2326
```

루프 B가 한 프레임에서 하는 일(순서대로):

1. `syncLiveSelfRiderVisual` — 내 스프라이트 위치·방향·페달
2. `tickRideCameraFollow` (`:2341`) — 카메라 추종
3. `stepPeerDriveAndBuildGeoJson` (`:2363`) — **동행 위치 계산 + GeoJSON 생성**
4. `syncPeerDomMarkers` / `syncRiderGlbModels` (`:2371,2424`)

내 라이더와 동행이 **같은 `specs` 배열**에 담겨 한 번에 넘어간다(`id: "live-self"`, `:2409`).
렌더 기하는 공유하지만 위치의 출처는 완전히 다르다 — 내 것은 `sampleLiveLngLat()`(지금),
동행은 registry의 `displayDistM`(160ms 전).

예외 격리(`:2437-2448`):

```js
const tick = (now) => {
  try { tickBody(now); } catch { /* noop */ }
  finally { peerRidersRafRef.current = requestAnimationFrame(tick); }
};
```

한 프레임의 예외가 rAF 체인을 끊으면 카메라와 라이더가 **영구 정지**하고 스타일을
되돌려도 복구되지 않기 때문.

## 5.4 React state 반영 — HUD 전용 경로

`flushUi` (`useVirtualRideSession.ts:69-81`)가 200ms 게이트를 걸고 `setMetricsUi`를 호출한다.
rAF마다 setState하면 무한 렌더가 되므로 필수.

이 state가 흐르는 곳은 **HUD 텍스트(거리·시간·속도)뿐.** 지도 마커는 §5.3의 ref 경로로,
발행은 §5.5의 샘플러 경로로 간다.

> **React는 이 아키텍처에서 실시간 위치 데이터의 주 경로가 아니라 표시용 곁가지다.**

수신 측 React state는 별개 — `PublicationSharedPresence`의
`rows`/`liveRideRows`/`motionRows`가 `startTransition`으로 감싸여 렌더 우선순위를
낮춘다(`:206,215`).

## 5.5 서버 전송 — 스냅샷·스로틀·single-flight

`useLiveLocationPublishSession.ts:372` — `setInterval(tick, 100)`.

**스냅샷 생성** `buildLiveLocationSnapshot` (`liveLocationSnapshot.ts:88`):

```js
const sampled = peekSampleVirtualDistanceM();
const virtualDistanceMeters = Number.isFinite(sampled) ? sampled : input.virtualDistanceMeters;
//                            ↑ rAF 원본 우선, React 200ms state는 폴백일 뿐
```

속도도 동일하게 rAF 적용속도 우선(`:104-106`). 진행률은 **geometry 길이 기준**으로
계산해(`computeRouteProgressRatio`) 클라이언트마다 다른 Directions 거리를 무시한다 —
그래야 내 위치와 상대가 본 내 위치가 같은 fraction을 쓴다.

**3채널 스로틀** (각각 다른 주기):

| 채널 | 상수 | 주기 |
|---|---|---|
| motion | `PEER_MOTION_PUBLISH_INTERVAL_MS` | 100ms |
| route progress | `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS` | 1,000ms |
| global presence | `GLOBAL_LIVE_PRESENCE_MIN/MAX` | 4~12s + 최소 이동거리 |

**single-flight** (`motionPublishFlight.ts:275-350`) — 배열 큐가 없다:

```js
if (writing) { slot = job; return { accepted: "slot" }; }   // 대기 슬롯 1칸을 최신으로 덮어씀
```

느린 회선에서 큐가 쌓여 낡은 위치를 순서대로 게워내는 대신 **항상 최신 것 하나만**
남긴다(latest-wins). 여기에 `epoch` 소유권이 얹혀 있어, 취소된 세션의 늦은 쓰기는
`isEpochLive` 검사에서 폐기되고(`:281,289`), 지연 삭제(`drainDeferredCleanups`)가
그 쓰기가 실제로 끝난 뒤에 돈다.

## 5.6 Firebase / relay 저장 — 2계층 분리

**RTDB — 모션 (고빈도·휘발성)**
`trails/{trailId}/motion/{uid}`, 페이로드를 극단적으로 압축(`rtdbTrailMotion.ts:69-79`):

```js
{ p: publicationId, d: 0.1m반올림, v: 0.01반올림, ph: phase, t: Date.now() }
```

`onDisconnect().remove()`로 비정상 종료 시 자동 삭제를 걸어둔다(`:112`).
※ `t`는 이름과 달리 **송신자의 로컬 시계**이며 디코드 시 `serverAtMs`로 명명된다(`:90`).

**Firestore — presence·집계 (저빈도·내구)**

- `trails/{tid}/livePublicationRides/{uid}` — 1Hz, `setDoc(merge)` + `serverTimestamp()`
- `livePresence/{uid}` — 전역 dot
- `publicationSessions/{scope}/members/{uid}` — 참가자 명단 (24s/180s heartbeat)

livePublicationRides write는 **Cloud Functions 2개를 깨운다** —
`routeActivityOnLivePublicationRideWritten`(집계),
`openTrailListingOnLiveCourseRideWritten`(Trailhead 목록 projection).
heartbeat만 바뀐 write는 함수가 조기 반환한다(`PROGRESS_AGGREGATE_MIN_DELTA=0.012`).

## 5.7 상대방 수신 — 병합·dedup·버퍼

`PublicationSharedPresence.tsx`가 구독 3개를 보유하고, 둘은 refCount 허브를 거친다
(같은 Trail을 보는 컴포넌트가 여럿이어도 실제 구독은 1개):

- `:174` 세션 멤버
- `:201` liveRides → `acquireTrailLivePublicationRidesSubscription`
- `:245` RTDB motion → `acquireTrailMotionSubscription`

motion/liveRide 콜백 **둘 다** `syncPeerMotionFromPresence`를 호출한다.
소스 선택(`syncFromPresence.ts:76-78`):

```js
// RTDB(10Hz)가 있으면 그것만 ingest. 두 소스를 같은 사이클에 모두 넣으면
// 거의 같은 recvAtMs 에 distM 이 미세하게 다른 스냅샷 2개가 생겨 보간 jitter.
if (rtdbPacket) registry.ingest(rtdbPacket, label);
else if (fsPacket) registry.ingest(fsPacket, label);
```

`mergePeerMotionPackets`(필드 단위 병합)가 파일로는 존재하지만 이 경로에서는
**호출되지 않는다.**

`applyPeerMotionIngest` (`integrator.ts:44-90`)의 두 가지 계약:

- **dedup 기준은 `serverAtMs`가 아니라 `distM` 전진.** 시계를 기준으로 삼으면 Firestore
  시각이 앞설 때 RTDB 위치가 통째로 버려져 버퍼가 굶는다.
- **`entity.speedMps`는 dedup되어도 매 ingest 갱신**된다(`:59`). 정지 패킷은 distM이 안
  변해 버퍼에 안 쌓이는데, 버퍼의 낡은 속도로 외삽하면 멈춘 peer가 7m 미끄러지기 때문.

버퍼는 최대 16개(`PEER_INTERP_BUFFER_MAX`), 각 항목은
`{distM, recvAtMs: Date.now(), speedMps, phase, seq}`.

## 5.8 화면 렌더링 — 160ms 지연 보간

루프 B가 `stepPeerDriveAndBuildGeoJson`(`peerRidersDrive.ts:37`)을 호출하면 세 단계가 돈다.

**1) prune** — `activeUids`에 없고 10초(`PEER_DRIVE_SIM_GRACE_MS`) 지난 엔티티 제거

**2) step** — `stepPeerMotionEntity` (`integrator.ts:139-176`)

```js
const renderTime = nowMs - PEER_INTERP_DELAY_MS;   // 160ms 전
```

- `renderTime`을 감싸는 두 스냅샷을 **선형보간**한다. 외삽(미래 추측)이 아니므로
  가속·감속에 고무줄이 없고 추월이 정확히 재생된다 — 약 160ms 뒤지지만 정확하게.
- 스트림이 끊기면 `entity.speedMps`로 최대 1.2초 외삽 후 hold.
- 마지막에 `clampRouteDist`.

**3) buildRenderFeatures** — `displayDistM` → `getPointOnRouteByDistance` → lng/lat,
`headingAtRouteDistanceMeters` → 방향, 속도 EMA → 페달 프레임. 최대 `PEER_MAX=30`명.

출력은 GeoJSON FeatureCollection이고 두 경로로 나간다:

- `syncPeerDomMarkers` — DOM 마커
- `syncRiderGlbModels` — GLB 3D 모델 (`RIDER_PROTOTYPE_MODE === "glb"`)

줌 게이트 — `mapZoom > MAP_PEER_SPRITE_MIN_ZOOM`이 아니면 빈 FC를 넘겨 멀리서는
스프라이트를 그리지 않는다(`:2362,2370`).

## 5.9 이 아키텍처의 성격 — 세 가지 축

### 1차원 정본

위치가 `distM` 스칼라이고 좌표는 렌더 시점 투영이다. 실내 자전거 + 고정 경로 도메인에
정확히 맞는 선택이고, **이 코드베이스에서 가장 견고한 결정.**

### React 우회

실시간 데이터는 React를 통과하지 않는다.
생성(ref) → 렌더(`sampleLiveLngLat`), 생성(ref) → 발행(전역 샘플러).
React state는 200ms HUD 텍스트 전용 곁가지.

성능상 필요한 선택이지만, 그 대가로 **같은 값의 출처가 셋**이 되어
"어느 self가 진짜인가"가 계측에서 반복 문제가 된다.

### 비대칭 시간축

내 라이더는 "지금"(rAF), 동행은 "160ms 전"(수신 시계 보간).
카메라는 내 위치를 물고 있으므로 **화면상 상대 위치는 두 시계의 차이**로 정의된다.

그리고 보간의 축이 송신 시각이 아니라 `recvAtMs`(수신 시각)라서 —
clock skew를 피하는 대신 **도착 지터를 움직임에 주입**한다(`integrator.ts:171-172`).
S4-4에서 추적 중인 "동행이 앞뒤로 톡톡 튄다"가 정확히 이 지점의 구조적 귀결이다.

---

# 6. 종합 — 이 체크포인트가 남기는 것

## 6.1 서로 만나는 지점

세 갈래 조사(재설계 / 버그 / 비용)가 **같은 구조 하나**를 가리켰다.

```
                    「내가 어디서 달리고 있다」가
                     6~7개 스키마로 복제된 구조
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   §1 ③ 재설계           §3 폭증 후보 ①④        §4 ①③④ 유령·고아
   Presence Gateway      1Hz × 이중구독          정리 주체 불명확
   통합 필요             = O(N²)                  = 삭제 못 하는 문서
```

## 6.2 한 줄짜리 방어로 끊을 수 있는 것

| 조치 | 위치 | 막는 것 |
|---|---|---|
| `.info/connected` 재무장 | `rtdbTrailMotion.ts:107` | §4 ② → ① 연쇄 |
| ingest 시 `serverAtMs` 나이 컷 | `rtdbToPacket.ts` / `rowToPacket.ts` | §4 ① 영구 유령 |
| joinBurst에 `sessionScopeId` 전달 | `rideJoinPresenceBurst.ts:18` | §4 ④ 고아 문서 |
| `attempt` 재진입 가드 | `useLiveLocationPublishSession.ts:240` | §4 ⑤ 쓰기 폭증 |
| liveRide heartbeat 1Hz → 4~10s | `rideSyncPolicy.ts:40,43` | §3 비용 체인 전체 |

## 6.3 큰 계획이 필요한 것

- **Presence Gateway 통합** (§1 ③) — 결정 로그를 거친 별도 계획. sync-relay S4의 종착점.
- **App.tsx 해체 / MapView 레지스트리화** (§1 ①②) — 단, ③ 완료 전에는
  **데이터 스키마를 건드리지 않는 범위**로 제한.
- **replay 하네스 확장** — 순단 · 시계 점프 · 재주행 · Trail 전환 · 수신 지터.
  현재 하네스는 이 다섯을 모의하지 못하므로, 위 수정들의 회귀를 고정할 수 없다.

## 6.4 미완

- §0 죽은 코드·중복 로직 전수 목록 (부분 결과만 기록됨)
- 본 문서의 모든 항목은 **조사 결과이며 수정·검증되지 않았다.**
  착수 시 각 항목을 재현 시험으로 확인할 것.

---

## 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-08-20 | 최초 작성 — 세션 질의응답 5건 기록 (조사 전용, 코드 수정 없음) |
