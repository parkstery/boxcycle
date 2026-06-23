# BOXCYCLE 제품 용어 — Trailhead · Trail

| 항목 | 내용 |
|------|------|
| 문서 유형 | **제품·범위** (`product`) — 용어·브랜딩의 **단일 진실(source of truth)** |
| 작성일 | 2026-05-17 |
| 상태 | **채택** — UI·카피·신규 문서는 본 문서를 따른다. 코드·Firestore 경로는 단계적 반영 |
| 연결 | [주행 여정·패널 IA](260515-ux-주행-여정-및-패널-IA.md), [Firestore 스키마 초안](260509-Firestore-컬렉션-스키마-초안.md), [로비·코스주행자 맵관전](260514-(cycle)로비_코스주행자_맵관전_구현_보고서.md) |

---

## 1. 결정 요약

| 구(舊) 사용자·기획 용어 | 신(新) 제품 용어 | 한 줄 정의 |
|------------------------|-----------------|------------|
| **Lobby** (로비) | **Trailhead** | 길로 나가기 **전** 모이는 허브 — 코스·Trail 선택, MENU, 계정, 설정 |
| **Room** (방) | **Trail** | **같이 달리는 한 판** — 동시 접속·관전·진행률 공유의 인스턴스 (채팅방·게임방 아님) |

**의도:** Room/Lobby의 MMO·경쟁 톤을 줄이고, “같은 길을 달리는 경험(길동무)”에 맞는 언어를 쓴다.

**코스(course)와 구분:** 코스·경로 = 지도에 그려진 **설계도**. Trail = 그 위에서 **지금 함께 도는 세션**. UI에서는 가능하면 `○○ 코스 · Trail 3`처럼 병기한다.

**Trailhead (2026-05-19 갱신):** Trailhead는 **코스·활동 허브 UI**이며, Firestore `trails/default` 는 **presence 허브**로만 쓴다. **주행 세션(라이브 인스턴스)** 은 ▶ 시 `trails/{autoId}` 가 자동 생성된다. 사용자는 “방 만들기”를 하지 않는다.

| 개념 | Firestore | UI |
|------|-----------|-----|
| Trailhead | `trailId=default` (문서 없음·멤버만) | MENU TrailHub, 코스 선택 |
| Trail (라이브 판) | `trails/{id}` 메타 + members + livePublicationRides | `Trail 035` (3자리 `displayNumber`) |
| Ride 기록 | `rides.roomId` = Trail ID | 주행 종료 후 Trailhead 복귀 |

**표시 번호:** 내부 ID = Firestore auto-id. 사람에게는 `001`–`999` 랜덤 `displayNumber` (일일 순번·날짜코드는 미사용).

### 1-c. Trailhead MENU 목록 (2026-06)

**단일 진실(제품):** MENU **Trail list** = **지금 주행 중인 Trail만**.

| 표시 | 미표시 |
|------|--------|
| 활성 라이더 ≥ 1 (`livePublicationRides` 최근 heartbeat 또는 listing `riderCount > 0`) | open trail이지만 주행자 0명 |
| A·B가 서로 다른 Trail 주행 시 — Trailhead(C)에서 **둘 다** 목록에 표시 | 완주 여부·과거 closed trail |
| 호스트 **주행 종료** → listing 삭제 → 목록에서 즉시 제거 | `status==open` 만으로 목록 유지 |

**데이터 소스:** `openTrailListings` (CF projection) + `livePublicationRides` collection group 보강 (`useOpenTrails`). 지도 관전 카탈로그와 동일 CG 기준.

**완주/미완주는 목록 기준이 아님.** 호스트가 `closeTrailInstance`로 Trail을 닫을 때 사라지는 것은 의도된 동작.

---

## 1-b. 시청·지도 (living world, 2026-05-19)

| 위치 | 실시간 위치 (`liveCourseRides`) | 활동 인지 (`courseActivity` / Activity World) |
|------|--------------------------------|-----------------------------------------------|
| **내 Trail** (`trailId !== default`) | **같은 Trail** 주행자만 | 전역(코스 단위) |
| **Trailhead** (`default`) | 구독 안 함 | 전역 |
| **다른 Trail** | 구독 안 함 | 전역 — “지금 N명” 등 aggregate |

---

## 2. 「어느 Trail에서 무엇을 보는가」 (시청 컨텍스트)

로그인·Trailhead 세션이 켜진 사용자는 **항상 정확히 하나의 `trailId`** 에 속한다. UI에서 Trailhead 버튼·기본 진입 = **`default`**.

| 시청자가 있는 Trail (예) | Activity World (`courseActivity`) | 같은 Trail 관전 (`liveCourseRides`) |
|--------------------------|-----------------------------------|-------------------------------------|
| **Trailhead** (`default`) | **전역** — 다른 Trail에 있어도 동일 aggregate | **`default` 에 있는 주행자만** |
| **Trail 3** | **전역** — 위와 동일 | **`3` 에 있는 주행자만** |

**표현 정리 (회의·문서):**

- 「**다른 Trail**의 realtime」→ `trailId` 가 다를 때만 `liveCourseRides` 구독·표시 (Trailhead↔Trail 3 포함).
- 「**다른 Trail**의 aggregate」라고 부르면 **Activity World(`courseActivity`)와 혼동**하기 쉽다. 후자는 Trail **무관**·코스 단위 전역 집계이며, Trailhead에서 보나 Trail 3에서 보나 **같은 문서**를 읽는다.
- 올바른 구분: *「**어느 Trail에 서서**(Trailhead 포함) **전역 Activity World**를 본다」* vs *「**같은 Trail 안**에서만 빨간 관전 점을 본다」*.

구현: `App` 의 `trailId` · `trailheadSessionActive` — Trailhead도 `sanitizeTrailId` 결과가 `default` 이면 하나의 Trail로 취급한다.

**자주 헷갈리는 증상:** Trailhead(`default`)에서는 **빨간 관전 점**이 안 보이고 Trail 3으로 옮기면 보인다 → 주행자가 **Trail 3**에 있기 때문(같은 Trail 관전). Trailhead에서도 **다른 Trail 주행**을 보려면 **녹색 Activity World**(전역 `courseActivity`)를 본다. (과거 버그: 줌 >9 일 때 `highlightedCourses` 를 비워 Activity World 후보가 줄어듦 — `App` 에서 HUD와 분리해 수정.)

---

## 3. 레이어별 용어 (개발 시 혼동 방지)

| 레이어 | Trailhead | Trail | 비고 |
|--------|-----------|-------|------|
| **사용자 UI·HUD·MENU** | Trailhead | Trail 3, Trail 이동 | 우선 적용 대상 |
| **한국어 카피** | 트레일헤드(또는 Trailhead 유지) | 트레일 N / Trail N | 짧은 라벨은 영문 Trail 권장 |
| **URL 쿼리 (현행)** | — | `?trail=` (기본 기록) · `?room=` 하위 호환 | 라벨 Trail, 읽기 시 `trail` 우선 |
| **Firestore 경로 (현행)** | (개념만) | `trails/{trailId}/members`, `trails/{trailId}/liveCourseRides` | `rooms/` 는 마이그레이션 후 read-only |
| **코드 식별자 (현행)** | `lobbySessionActive`, `useLobbyRoomSession` | `roomId`, `sanitizeRoomId` | 주석·타입명은 Trailhead/Trail **별칭** 병기 후 점진 rename |
| **내부 기술 (유지)** | — | `rideSession`, `rideSessionId` (도입 시) | 사용자에게 "Session" 노출은 지양(길고 게임 Session과 혼동) |

---

## 4. 기능 ↔ 용어 매핑 (현재 구현 기준)

| 기능 | 제품 용어 | Firestore / 코드 (현행) |
|------|-----------|-------------------------|
| 로그인 후 presence·하트비트 | Trailhead에서 **활성 Trail** 참가 | `trails/{trailId}/members/{uid}` |
| 같은 Trail 주행 진행률·관전 점 | **Trail** 위 주행/관전 | `trails/{trailId}/liveCourseRides/{uid}` |
| 입문 허브 동행 마커 | **코스** 동행 (Trail과 별도) | `coursePresence/{courseId}/members` |
| Trail 합류 | **열린 Trail** 목록 탭 | `TrailHubPanel` · `fetchOpenTrailInstances` |
| 주행 시작 | **Trail 자동 개설** (기본 open) | `createTrailInstance` · ▶ |
| Trail 공개 전환 | 호스트만 Open/Private | `setTrailVisibility` |
| Trail 이탈 | 로그아웃, **다른 Trail로 이동**, 주행 종료 | `deleteLobbyPresence` / `deleteLobbyLiveCourseRide` 등 |
| 사용자 「나가기」 버튼 | **없음** (Trailhead 정책) | 세션 종료·이동·로그아웃으로만 정리 |

---

## 5. UI 카피 가이드 (한·영)

### 5.1 권장

| 상황 | 예 |
|------|-----|
| 현재 인스턴스 | **Trail 3** / *on Trail 3* |
| 이동 | **Trail 이동** · *Join another trail* |
| HUD 접속 | **이 Trail** · *2 on this trail* |
| 허브 | **Trailhead** · *Back to Trailhead* |
| 활성 수 | **활성 Trail 3개** |
| 주행 종료 | **Trail 종료** (승패 아님) |

### 5.2 지양 (제품 톤)

| 지양 | 이유 |
|------|------|
| Room, Lobby (사용자 UI) | 게임 서버·대기실 연상 |
| Party, Arena, Match | 경쟁·대전 |
| Session (HUD 라벨) | 기술어·길음 — 코드 내부만 |

### 5.3 개발·회의 구어

- “로비” → **「Trailhead 쪽」**
- “방 3” → **「Trail 3」**
- “방 전환” → **「Trail 전환」**

---

## 6. 문서·코드 반영 순서 (권장)

| 단계 | 범위 | 목적 |
|------|------|------|
| **0 (완료)** | 본 용어집 | 합의 고정 |
| **1 (완료)** | `document/` — UX·관전·IA·스모크 체크리스트 | 링크·카피·「로비/방」→ Trailhead/Trail |
| **2 (완료)** | `apps/web` — 사용자 visible 문자열, `aria-label`, 주석 1줄 | 화면·접근성 일치 |
| **3 (완료)** | URL `?trail=` 별칭, `readTrailIdFromLocation` · `?room=` 호환 | 북마크·공유 링크 |
| **4 (완료)** | 타입·파일·훅 rename (`firestoreTrail`, `useTrailSession`, `TrailSwitcher` 등) | 레거시 re-export 유지 |
| **5 (완료)** | Firestore `rooms` → `trails` | 클라이언트·Rules·CF 경로 전환. 데이터: `npm run admin:migrate-rooms-to-trails` |

**원칙:** 단계 1~2만으로도 사용자 체감은 대부분 맞출 수 있다. Firestore 경로는 **의도적으로 유지**해도 된다.

---

## 7. 관련 문서 갱신 체크리스트

갱신 시 본 문서를 링크하고, 본문의 「로비」「방」「room」「lobby」 사용자 표현을 Trailhead/Trail로 맞춘다.

- [x] [260515-ux-주행-여정-및-패널-IA.md](260515-ux-주행-여정-및-패널-IA.md)
- [x] [260514-(cycle)로비_코스주행자_맵관전_구현_보고서.md](260514-(cycle)로비_코스주행자_맵관전_구현_보고서.md)
- [x] [260515-(cycle)Firestore-부하-경감-조치-종합보고서.md](260515-(cycle)Firestore-부하-경감-조치-종합보고서.md) — 상단 용어 안내
- [x] [260516-Firestore-트래픽-저감-상세-수정-계획.md](260516-Firestore-트래픽-저감-상세-수정-계획.md) — 상단 용어 안내
- [x] [260516-수동-스모크-체크리스트.md](260516-수동-스모크-체크리스트.md)
- [x] [260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤.md](260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤.md) — Trail 병기

---

## 8. 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-17 | 최초 채택 — Lobby→Trailhead, Room→Trail (자문·시니어 합의) |
| 2026-05-17 | Firestore `trails/` 전환·마이그레이션 CLI (`admin:migrate-rooms-to-trails`) |
| 2026-05-17 | [Activity World 지도 LOD](260517-Activity-World-지도-LOD-설계.md) — 전역 라이브 코스 점/라인 |
| 2026-05-17 | §2 시청 컨텍스트 — 「어느 Trail」에 Trailhead(`default`) 포함, Activity World vs 관전 구분 |
| 2026-05-19 | §1 Trailhead=허브·▶ 자동 Trail·3자리 displayNumber·§1-b living world 분리·TrailHubPanel |
| 2026-06-24 | §1-c Trailhead MENU 목록 — 주행 중 Trail만, listing+CG 병합 |

### 9. `rooms` → `trails` 배포 순서

1. `npm run deploy:firestore` — `trails` write·`rooms` read-only 규칙 반영  
2. `npm run admin:migrate-rooms-to-trails -- --dry-run` 후 본 실행  
3. `npm run deploy:app` — 웹(`trails` 경로)·Functions(`courseActivityOnLiveCourseRideWritten`)  
4. 스모크: Trail 전환·동행·관전·`courseActivity` 갱신 확인  
