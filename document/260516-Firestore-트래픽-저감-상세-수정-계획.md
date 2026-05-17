# Firestore 트래픽 저감 · Activity World 정렬 — 상세 수정 계획

작성일: 2026-05-16  
최종 정렬: 2026-05-16 (BOXCYCLE 세계관·자문 반영)  
대상: `apps/web` 클라이언트, Firestore 스키마(신규 aggregate), Rules·Functions(2단계 이후)  
관련 철학: **길(route) 중심 · 실제 세계 탐험 · 살아 있는 활동 세계 · 좁은 realtime 동행**

> **제품 용어(2026-05-17):** Lobby → **Trailhead**, Room(방) → **Trail**. 본문의 「방」「로비」는 맥락상 Trail·Trailhead를 가리킨다. Firestore `rooms/`·`roomId` 는 유지 — [용어집](260517-제품-용어-Trailhead-Trail.md).

> **Route Token(경로 토큰):** 창작 루프·원장·Directions 연동의 단일 진실 — [Route Token 경제·온보딩 설계](260518-Route-Token-경제-설계.md). 본 문서 §1.5·§4.5는 **읽기 패턴**만 다룬다.

---

## 0. 문서의 중심축 (변경 사항)

초기 초안은 **「rider realtime 동기화 비용 절감」**에 가까웠다.  
BOXCYCLE 세계관·자문 정리 이후, 본 문서의 중심축은 아래로 이동한다.

| 이전 중심 | 새 중심 |
|-----------|---------|
| 사람 위치 realtime fan-out을 조금 더 효율화 | **Activity World** — aggregate·저빈도로 “세계가 살아 있음” |
| `liveCourseRides` / `coursePresence` / 관전 dots | **Ride Session Layer**에서만 촘촘한 realtime |
| 방(room) 단위 로비·관전 | **코스·길(route)** 단위 발견·활동 시각화 |
| spectator = 실시간 사람 추적 | **activity discovery** — 펄스·heat·최근 흔적 |

**결론**: 1단계 최적화는 **유지·완료 방향**이며 세계관과 **충돌하지 않는다**.  
2단계 이후는 “실시간 통합”만이 아니라 **World / Course Activity aggregate 도입**과 **UI 개념 전환(activityOverlay)** 이 본문이다.

---

## 1. 세계관과 Firestore 역할 (3층 모델)

서비스 구조와 데이터 빈도를 맞춘다.

### 1.1 Global Activity Layer

- **목표**: “텅 빈 세계”가 아닌 **활동하는 세계(activity world)**.
- **표시 예**: 최근 30일 흔적(회색), 현재 라이브 펄스(녹색), 인기 코스, 활성 코스 수.
- **데이터**: 대부분 **aggregate**, 저빈도 갱신, **위치 스트리밍 최소화**.
- **현재 코드 힌트**: `appMeta/worldPresence` + `WORLD_PRESENCE_POLL_MS` (90s `getDoc`) — 프로토타입에 해당.

### 1.2 Course Layer

- **목표**: 코스 = 작은 커뮤니티·만남·탐험 공간. “누가 몇 명인지”, “최근 인기”, “지금 살아 있는지”.
- **데이터**: `courseActivity/{courseId}` 등 **문서 1건/코스** 위주. 클라이언트는 코스 진입·줌 아웃 시 **저빈도 읽기**.
- **현재와의 관계**: `courses` 메타 + (신규) activity 문서. `listPublishedPublicCourses`는 **lazy** 유지.

### 1.3 Ride Session Layer

- **목표**: **같은 코스·근접 구간·제한 인원**에서만 동행감(마커·진행·채팅·그룹 등 — 후속 기능).
- **데이터**: `coursePresence`, `liveCourseRides`(또는 후속 세션 채널) — **세션 중에만** 촘촘한 쓰기·구독.
- **세션 밖**: 정밀 rider tracking **하지 않음** → Firestore read/write 폭증 방지.

### 1.4 방(room)의 위치

- `rooms/{roomId}`는 **파티·초대·운영 도구**로 유지 가능.
- 세계의 **1급 좌표는 코스·타일·길**이다. 장기적으로 합류·공유는 `?course=` / 저장 경로 링크 중심으로 재정의(별도 UX 이슈).

### 1.5 토큰·창작 루프 (Firestore와 분리하되 정렬)

- 토큰 = **경로 생성 권한** · 세계 확장. 운동 → 토큰 → 경로 생성 → 공개 → 발견 → 재운동.
- aggregate에 유리한 **저비용 고가치 데이터**: 최근 30일 활동, 좋아요, 월간 인기, 탐험 이벤트, 토큰 드롭 위치.
- 상세 제품 스펙 — [Route Token 경제·온보딩 설계](260518-Route-Token-경제-설계.md) (단일 진실). 본 계획은 **읽기 패턴**만 정렬한다.

---

## 2. 배경 및 목표 (기술)

### 2.1 관측된 문제

- 테스트 인원(1~2명) 대비 읽기·쓰기·Rules 평가 과다.
- 스냅샷 리스너·연결 수 ≈ 탭 수 × (로비 + liveCourseRides + coursePresence).
- **철학과 불일치**: 전역 맵에서 **3중 realtime**으로 “살아 있는 세계”를 흉내 내면 비용만 커지고, **activity world**에는 aggregate가 맞다.

### 2.2 원인 요약(코드 기준)

| 유형 | 내용 | 세계관 정렬 |
|------|------|-------------|
| 컬렉션 구독 3종 | `rooms/*/members`, `rooms/*/liveCourseRides`, `coursePresence/*/members` | **Ride Session / 로비 보조**로 격하, 전역 생명감의 주역 아님 |
| 주기 쓰기 | 로비·코스 하트비트, `liveCourseRides` merge, 라이브 좌표 throttle | 1단계로 완화 완료, 2단계에서 **세션 밖 쓰기 차단** |
| 일회 읽기 | 카탈로그·심사·코스 geometry | lazy + 캐시(1단계) |
| 이펙트 churn | publisher `routeGeometry` deps | 1단계에서 제거 |

### 2.3 문서 목표 (재정의)

1. **1단계**: 즉시 비용·churn 감소 (**세계관과 일치** — “전역 realtime 남발” 억제).  
2. **2단계**: **World / Course Activity aggregate** 도입 + realtime을 **Ride Session**으로 한정.  
3. **3단계**: 세션 realtime만 RTDB/WebSocket 등 분리 검토, Firestore는 **완주·요약·aggregate·창작(길)**.

---

## 3. 1단계 — 즉시 비용 절감 (구현 상태)

> **상태**: 2026-05-16 기준 **코드 반영 완료**. 콘솔 전후 측정은 팀 스모크 후 §7.2에 기록.

### 3.1 `useLobbyLiveCourseRidePublisher` 의존성 정리 — **완료**

| 항목 | 내용 |
|------|------|
| 파일 | `apps/web/src/hooks/useLobbyLiveCourseRidePublisher.ts` |
| 수정 | `routeGeometry`를 effect deps에서 제거, ref로 최신 geometry 유지 |
| 효과 | 경로 재계산 시 `deleteLobbyLiveCourseRide` 반복 감소 |

### 3.2 실시간 정책 상수 1차 튜닝 — **완료**

파일: `apps/web/src/lib/rideSyncPolicy.ts`

| 상수 | 이전 | 적용값 |
|------|------|--------|
| `LOBBY_PRESENCE_HEARTBEAT_ACTIVE_MS` | 12_000 | **30_000** |
| `COURSE_PRESENCE_HEARTBEAT_ACTIVE_MS` | 12_000 | **24_000** |
| `LOBBY_LIVE_PROGRESS_MIN_WRITE_MS` | 4_000 | **8_000** |
| `LOBBY_LIVE_PROGRESS_MAX_WRITE_MS` | 15_000 | **25_000** |

**주의**: `LOBBY_STALE_MS`(240s)와 UI “비활성” 표시 정합은 스모크 시 확인.

### 3.3 코스 geometry `getDoc` 캐시 — **완료**

| 파일 | `apps/web/src/lib/firestoreCourses.ts` — `fetchCourseRoutePayload` |
|------|------|
| 수정 | `courseId`별 메모리 캐시 + in-flight 공유 |

### 3.4 퍼블릭 카탈로그·심사 메타 Lazy load — **완료**

| 영역 | 수정 |
|------|------|
| `useOfficialCoursesHub` | 마운트 시 `listPublishedPublicCourses` 제거 |
| `usePublicRouteReviewMeta` | 마운트 시 `refreshPublicRouteMeta` 제거 |
| `App.tsx` | `menuFirestorePrimedUidRef` — **MENU 최초 오픈(세션당 uid 1회)** 시 카탈로그·심사 메타 로드 |
| `useSavedRoutesWorkspace` | 로드 완료 후 `refreshPublicRouteMeta` 제거 |

**UX**: 메뉴를 열기 전에는 퍼블릭 목록·심사 배지가 비어 있을 수 있음 — 의도된 trade-off.

### 3.5 `liveCourseRides` 퍼블리셔 tick — **완료**

| 항목 | `PROGRESS_POLL_MS` 2000 → **3500** |

### 3.6 1단계에서 **의도적으로 하지 않은 것**

- `spectatorOverlay` → `activityOverlay` 전환 (2단계 UI).
- `courseActivity` / `worldActivity` 스키마 (2단계 데이터).
- 방(room) 제거·코스 딥링크 (제품 별도).

---

## 4. 2단계 — Activity World 중심 (중기)

**전제**: 1단계 적용 후 Firebase 콘솔 **읽기/쓰기/Rules** 재측정.

### 2단계 착수 상태 (2026-05-16)

| 항목 | 상태 | 비고 |
|------|------|------|
| `courseActivity/{courseId}` 클라이언트 `getDoc` + 캐시 | **완료** | `firestoreCourseActivity.ts`, `useCourseActivity` |
| `worldActivity/global` 클라이언트 읽기 | **완료** | `firestoreWorldActivity.ts` (HUD 연동은 후속) |
| Firestore Rules 읽기 전용 | **완료** | `courseActivity`, `worldActivity` |
| CF `courseActivityOnRideCreated` | **완료** | `rides` 생성 시 7d/30d increment |
| `rides.courseId` 저장 | **완료** | 입문·공식 코스 주행 종료 시 |
| activityOverlay 지도 레이어 | **프로토타입** | 녹색 pulse / 회색 heat, 현재 코스 1개 |
| HUD 코스 activity 한 줄 | **완료** | `courseActivityHudLine` |
| `liveCourseRides` 관전 | **유지** | **같은 방**이면 idle·주행·일시정지 모두 구독; **다른 방**은 미구독(기존 `roomId` 경계) |
| 다중 코스 heat·타일 `worldActivity` | **부분 완료** | 카탈로그·`highlightedCourses` 병합 오버레이; 타일별 `worldActivity/{tileId}`는 미착수 |
| `liveNow` / `activeRiderCount` 서버 집계 | **완료** | CF `courseActivityOnLiveCourseRideWritten` + 6h `courseActivityScheduledReconcile` |
| `highlightedCourses` 서버·지도 | **완료** | CF `refreshWorldHighlightedCourses`(세션 시작/종료), 클라이언트 카탈로그 병합 |
| `worldActivity/global` HUD 병합 | **완료** | `fetchWorldActivityGlobal` + `mergeWorldHudLines` |
| 퍼블릭·입문 코스 배치 `courseActivity` | **완료** | `fetchCourseActivitiesBatch`, `usePublishedCoursesActivityMapOverlay` |
| 지도 다중 코스 pulse/heat + LOD | **완료** | span>30km DOT / ≤30km LINE — [지도 LOD 설계](260517-Activity-World-지도-LOD-설계.md) |

**로컬 시드 예시** (콘솔):

```text
courseActivity/basic-alps-grindelwald-5km
  liveNow: true, pulseLevel: 2, activeRiderCount: 1, recentRideCount7d: 3
worldActivity/global
  livePulseCount: 2, activeCourseCount: 1, recentRideCount30d: 10
```

배포:

```bash
firebase deploy --only firestore:rules,functions:courseActivityOnRideCreated,functions:courseActivityOnLiveCourseRideWritten,functions:courseActivityScheduledReconcile
```

### 4.1 World / Course Activity Aggregate 도입 (신규 · 핵심)

**목표**

- 사용자 위치 realtime fan-out 감소.
- “세계가 살아 있다”는 느낌 유지.
- 코스·길 **발견(discovery)** 강화.

**제안 스키마 (초안)**

```text
worldActivity/{tileId}          # 줌/그리드 타일 또는 region 키
  activeCourseCount: number
  livePulseCount: number       # “지금 살아 있음” 코스·세션 수 (aggregate)
  recentRideCount30d: number
  highlightedCourses: string[] # courseId 목록, 저빈도 갱신
  updatedAt: Timestamp

courseActivity/{courseId}
  activeRiderCount: number     # 세션 집계(서버), 클라이언트 fan-out 아님
  recentRideCount7d: number
  recentLikeCount: number
  liveNow: boolean             # pulse
  pulseLevel: 0 | 1 | 2 | 3     # UI glow 강도
  updatedAt: Timestamp
```

**갱신 방식 (권장)**

- Cloud Functions: `rides` 완주·`courses` 좋아요 등 이벤트 시 **increment / 스케줄 reconcile**.
- 클라이언트: `onSnapshot` **지양**, `getDoc` + **60~120s** 폴링 또는 타일 진입 시 1회 (Global Layer).
- 코스 상세 패널: `courseActivity/{id}` **1문서**만 읽기.

**Rules**: 읽기 `isSignedIn()`, 쓰기 **Functions 전용** 또는 제한된 역할.

### 4.2 UI: `spectatorOverlay` → `activityOverlay` (개념 전환)

| 현재 | 지향 |
|------|------|
| `useTrailLiveCourseRideSpectatorOverlay` + 진행률 dots | **activityOverlay**: 코스 펄스, 라이브 경로 glow, recent heat |
| “관전자가 A의 GPS를 쫓는다” | **“이 길(코스)이 지금/최근 살아 있다”** |
| `trails/.../liveCourseRides` 구독 (**같은 Trail**) | **유지** — 주행·일시정지 포함; 다른 Trail은 미구독. aggregate는 **보조**(코스 생명감) |

**지도 LOD (v1 구현 완료):** 멀리(span > 30km) → **점**, 가까이(≤ 30km) → **라인**. 상세·스모크: **[260517-Activity-World-지도-LOD-설계.md](260517-Activity-World-지도-LOD-설계.md)**, 체크리스트 **§J-4**.

**Mapbox 레이어 예 (와이어) — LOD 반영 후**

- **줌 아웃:** 녹색/회색 **점** (`activity-live-dots`, `courseActivity` + `courses.bounds`).
- **줌 인 (≤30km span):** 녹색 `liveCoursePulse` / 회색 `recentActivityHeat` **라인** (기존 pulse/heat 레이어).
- 동행 스프라이트: **Ride Session 참가 중**에만 `coursePresence` peer markers.

**마이그레이션**

1. `activityOverlay` 프로토타입 (aggregate만, dots 유지 병행 가능).  
2. **같은 방** `liveCourseRides`는 주행 중에도 유지 — 트래픽 절감은 하트비트·캐시·aggregate로, **동일 방 위치 공유는 포기하지 않음**.  
3. (선택) 전역·타일 heat만 점진적으로 aggregate로 이전.

### 4.3 Ride Session realtime 범위 명시 (기존 4.1·4.2 대체·정렬)

| 데이터 | 세션 중 | 세션 밖 |
|--------|---------|---------|
| `coursePresence` (liveLngLat) | 쓰기·구독 (throttle 유지) | **문서 유지 또는 aggregate만** — fan-out 최소 |
| `liveCourseRides` | 같은 **방** + 주행·일시정지: 진행률·lastSeen (저빈도 merge) + 구독 | 로그아웃·방 이탈·탭 숨김 시 중단 |
| `rooms/*/members` | 선택: 파티 표시용 저빈도 | 전역 “세계 생명” 주역 아님 |

**추가 작업**

- `CourseSharedPresence` / publisher: **코스·주행 상태가 아니면** 구독·쓰기 **완전 off** (이미 일부 적용, 2단계에서 정책 문서화).
- `LIVE_SHARE_*` 상한 추가 완화(장거리 20~50km) — 동행 마커 지연 vs 쓰기 trade-off 스모크.

### 4.4 로비 `members` + `liveCourseRides` 통합 — **보류·축소**

- 세계관상 **우선순위 낮음**. aggregate가 생기면 방 단위 live 문서 의존을 줄인 뒤, 필요 시 “방 요약 1문서”만 검토.
- 통합 시 Rules·마이그레이션 비용 큼 → **4.1·4.2 이후** 재평가.

### 4.5 저비용 고가치 데이터 (토큰·이벤트와 연동)

Firestore에 **aggregate·저빈도**로 적합한 항목 ([Route Token 설계](260518-Route-Token-경제-설계.md) §6.3 토큰 드롭과 연동):

- 최근 30일 코스/타일 활동 heat  
- 월간 인기·좋아요 집계  
- 탐험 이벤트·토큰 드롭 위치(고정 메타 + 완주 시 보상 트리거)  
- 컨테스트 순위(배치 갱신)

**피해야 할 패턴**: GPS마다 `setDoc`, 큰 `geometry` 배열 전체 overwrite, `position`을 effect deps에 넣은 `onSnapshot` 재생성.

---

## 5. 3단계 — 장기 (스케일·비용)

| 항목 | 설명 | 세계관 정렬 |
|------|------|-------------|
| 세션 realtime 분리 | RTDB/WebSocket — **Ride Session Layer만** | 전역 MMO화 방지 |
| Firestore 역할 | 완주 기록, `savedRoutes`/`courses`, **activity aggregate**, 토큰·감사 | 길·창작·발견 |
| 멀티 탭 단일화 | `BroadcastChannel` 등 (난이도 큼) | 리스너 수 = 탭 수 문제 완화 |
| 타일 CDN | `worldActivity` 타일 JSON 정적화 검토 | Global Layer 저비용 |

---

## 6. 구현 순서 (권장, 갱신)

### 완료

- §3.1 ~ §3.5 (1단계 코드 반영).

### 다음 스프린트

1. **CF·Rules 배포** (아래 명령) + 콘솔 시드.  
2. **§7.1 스모크** — [수동 스모크 체크리스트](260516-수동-스모크-체크리스트.md) §J.  
3. **§7.2 콘솔 전후 측정** + 기준선 표 기입.  
4. (선택) 타일 `worldActivity/{tileId}`, 30일 전역 heat, §4.4 방 통합.

### 이후

- §4.4 방 통합 재평가.  
- §5 세션 채널 분리.  
- [Route Token·첫 경로 생성 온보딩](260518-Route-Token-경제-설계.md) (M1 스프린트).

---

## 7. 검증·수용 기준

### 7.1 정성 시나리오

**1단계 (기존)**

- [x] Publisher deps / 상수 / 캐시 / lazy (코드 반영).  
- [ ] 게스트/로그인 후 기본 방: 로비 목록 정상.  
- [ ] 동일 방 2인: 주행·일시정지·재개 시 상대 표시 유지.  
- [ ] 입문 허브: `coursePresence` 동행 유지.  
- [ ] MENU 최초 오픈 후 퍼블릭·심사 메타 갱신.

**2단계 (추가)**

- [ ] 줌 아웃: aggregate만으로도 “활동하는 세계” 체감(빈 맵 아님).  
- [ ] 코스 패널: `courseActivity` 1회 읽기로 pulse·인기 표시.  
- [ ] **같은 방** 주행 미참여(idle) 시에도 방 내 `liveCourseRides` 관전 유지.  
- [ ] Ride Session 참가 시: 동행 마커·합류 UX 유지.

### 7.2 정량(개발 환경)

| 시나리오 | 측정 |
|----------|------|
| 10분 주행 + 5분 일시정지, 2탭, 동일 방 | 읽기/쓰기/Rules **1단계 전후** |
| MENU 미오픈 콜드 스타트 5분 | **lazy** 후 getDocs 횟수 |
| 2단계 후 동일 시나리오 | aggregate 도입 후 **realtime 구독 수** 감소 목표 |

목표 수치(팀 합의 후 기입):

| 필드 | 1단계 전 | 1단계 후 | 2단계 후 | 측정일 |
|------|----------|----------|----------|--------|
| 읽기(10분 주행+5분 pause, 2탭 동일 방) | | | | |
| 쓰기(동일 시나리오) | | | | |
| Rules 거부 건수 | | | | |
| MENU 미오픈 5분 getDocs | | | | |
| `onSnapshot` 동시 구독 수 | | | | |

- 1단계 목표: 읽기 ___ %, 쓰기 ___ % (기준일: ___).  
- 2단계 목표: `onSnapshot` 동시 구독 ≤ ___ / 클라이언트.

**측정 절차**: Firebase Console → Usage → Firestore, 시나리오 전·후 15분 구간 비교. 개발 환경 URL·브라우저·`room`·계정은 실행 기록에 고정.

---

## 8. 리스크·롤백 · 세계관 충돌 시 우선순위

| 리스크 | 완화 |
|--------|------|
| 하트비트↑ → “비활성” 증가 | `LOBBY_STALE_MS`·UI 카피 |
| activity만으로 생동감 부족 | Session Layer 동행은 유지, pulse·heat로 보완 |
| Lazy → 배지 지연 | MENU 오픈·제출 후 `refresh*` |
| aggregate 지연 | `pulseLevel`·`updatedAt` 표시, “방금 전 활동” 카피 |

**충돌 시 우선순위**: BOXCYCLE 세계관(§1) > 비용 > 레거시 realtime UX.

롤백: 1단계는 커밋 단위 revert. 2단계 aggregate는 feature flag 또는 컬렉션 미사용 시 클라이언트 폴백.

---

## 9. 관련 파일 인덱스

| 구분 | 경로 | 2단계 메모 |
|------|------|------------|
| 정책 상수 | `apps/web/src/lib/rideSyncPolicy.ts` | Session throttle |
| 로비 | `firestoreLobby.ts`, `useLobbyRoomSession.ts` | 보조, aggregate 후 축소 |
| 라이브 코스 | `firestoreLobbyLiveCourseRides.ts`, publisher, spectator overlay | Session·activity 전환 |
| 코스 동행 | `firestoreCoursePresence.ts`, `CourseSharedPresence.tsx` | Ride Session 전용 |
| 카탈로그 | `useOfficialCoursesHub.ts`, `firestoreCourses.ts` | lazy + cache |
| 심사 메타 | `usePublicRouteReviewMeta.ts` | MENU prime |
| 월드 | `firestoreWorldPresence.ts`, `App.tsx` | → `worldActivity` 확장 |
| (신규) | `courseActivity`, `worldActivity` | §4.1 |
| CF 집계 | `functions/src/courseActivityOnRideCreated.ts`, `courseActivityOnLiveCourseRideWritten.ts`, `courseActivityScheduledReconcile.ts`, `courseActivityAggregateCore.ts` | 배포 필수 |

---

## 10. 문서 유지

- 1단계: §3 **완료 표시** 유지, 측정값은 §7.2에追記.  
- 2단계 착수 시: `courseActivity` 스키마 확정본을 §4.1에 고정.  
- 제품 철학 전문: 본 저장소 또는 별도 「BOXCYCLE 세계관」문서와 상호 링크 권장.

---

## 11. 요약 한 줄

**비용을 줄이되, “realtime 라이더 추적”을 더 잘하는 것이 아니라, aggregate로 살아 있는 길의 세계를 보여 주고, 동행 realtime은 Ride Session 안에만 둔다.**
