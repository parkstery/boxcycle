# BOXCYCLE — 현재 단계·범위·스택 및 1차 마일스톤

| 항목 | 내용 |
|------|------|
| 문서 유형 | **product** + **architecture**(요약) — PM·개발 공통의 단일 진실(현재 단계) |
| 최초 작성 | 2026-05-09 |
| 상태 | **코드 반영 중** — `apps/web` + Firebase(Auth·Firestore·**Directions Callable**)·Mapbox GL; Geocoding 프록시 등은 미도입 |
| 연결 문서 | [문서 생성·수정 지침](260509-BOXCYCLE-문서-생성-및-수정-지침.md), [**RTW 마스터 비전 및 종합계획**](260511-RTW-마스터-비전-및-종합계획.md), [Mapbox 시뮬 검증 기록](260508-개발중간보고-HTML과-JS-프로토타입.md), [아키텍쳐·DB 장기안](260509-아키텍쳐-DB설계.md), [Firestore→Postgres 피하기](260509-Firestore-Postgres-이전-체크리스트.md), [실행·리팩터링](260509-app-js-프론트백엔드-분리-1차리팩터링.md), [Phase별 실행 체크리스트](260511-Phase별-실행-체크리스트-Course-Session-Presence.md), [제품 용어 Trailhead·Trail](260517-제품-용어-Trailhead-Trail.md), [사용자 tier·진입](260519-사용자-tier-및-진입-정책.md), [World Activity Presence](260523-World-Activity-Presence-설계.md), [Firestore 스키마 초안](260509-Firestore-컬렉션-스키마-초안.md) |

> **제품 용어(2026-05-17):** Lobby → **Trailhead**, Room(방) → **Trail**. Firestore `trails/{trailId}` 가 Trail 인스턴스 경로이다.

---

## 1. 단계 선언

- **Mapbox 기반 실내 사이클링 시뮬 검증**은 완료되었다. 당시 정적 HTML·`app.js` POC는 **[260508 기록](260508-개발중간보고-HTML과-JS-프로토타입.md)** 및 커밋 이력으로만 참고하고, **저장소 루트 레거시 파일은 제거**하였다.
- **현재부터는 본격 프로젝트**로 진행한다. 문서·커뮤니케이션에서 **「프로토타입」 꼬리표는 사용하지 않는다.** (과거 구간만 지칭할 때는 **검증 POC** 또는 **260508 기록** 으로 구분한다.)
- 개발은 **프론트엔드와 백엔드(및 데이터)를 동시에** 진행한다.

---

## 2. 1차 마일스톤 (멀티 유저 운영 검증)

**목표 한 줄:** 서비스 형태로 **동시에 여러 사용자가 같은 체계 안에서 인증·상태 공유가 가능함**을 확인한다.

### 2.1 인수 조건 (최소)

아래를 만족하면 1차 마일스톤 **달성**으로 본다. 세부 수치는 실행 문서·이슈에서 조정 가능하나, **범위 축소 시 본 문서를 갱신**한다.

| # | 항목 | 설명 | 진행 (2026-06-24) |
|---|------|------|-------------------|
| A | 인증 | **Google(Gmail) 로그인** 하나로 빠른 검증. 다른 제공자·이메일 비밀번호는 1차 범위 밖으로 둘 수 있다. | ✅ 코드 — 게스트·익명 자동 진입은 [tier·진입](260519-사용자-tier-및-진입-정책.md) 정책 따름 |
| B | 사용자 식별 | 로그인 사용자마다 **서버(Firebase) 기준 고유 ID**가 있고, 클라이언트가 이를 기준으로 동작한다. | ✅ `users/{uid}` merge |
| C | 동시 접속·공유 상태 | 동일 **Trail/코스**에 **2명 이상**이 동시에 참여할 때, Firebase 기준으로 상대 존재·진행이 반영된다. | 🔄 코드 — `trails/…/members`, `livePublicationRides`, Trailhead **활성 Trail 목록**·관전. RTW `sessions/`·`presence/` 루트 컬렉션은 **미착수** |
| D | 영속화 | Trail 멤버·하트비트·주행 메타 등 최소 데이터가 Firebase에 저장·동기된다. **`sessions/{sessionId}` 는 1차 직후 후순위** | ✅ `trails`·`rides`·`courses`·`openTrailListings` 등. `sessions/` 도입은 후순위 유지 |
| E | 재현 가능 | 스테이징·Hosting URL에서 PM이 계정 2개 데모를 재현한다. | ⬜ **PM 확인** — 배포 URL·시나리오 체크리스트: [수동 스모크](260516-수동-스모크-체크리스트.md) |

### 2.2 1차에서 의도적으로 미포함 (명시적 후순위)

- 코인·구독·유료 플랜·풍부한 UGC 검증 파이프라인  
- 네이티브 Kotlin 앱·React Native (필요 시만 검토)  
- PostgreSQL·PostGIS 전환 (Firebase 검증 후 분리)  

상세 로드맵은 [260509-아키텍쳐-DB설계.md](260509-아키텍쳐-DB설계.md)의 장기안을 따르되, **현재 단계의 진실은 본 문서**이다.

---

## 3. 기술 스택 (PM 결정 + 시니어 정렬)

### 3.1 클라이언트 (웹)

- **Vite + TypeScript + React** 로 본 개발을 진행한다.  
- **최종 단계** 안드로이드 배포는 **웹 앱을 감싸는 방식(WebView / Capacitor 등)** 을 우선한다.  
- **Kotlin 네이티브·React Native** 는 요구(성능, 스토어 정책, 백그라운드, 센서 등)가 분명해질 때만 검토한다.

### 3.2 백엔드·데이터 (초기)

- 서비스 완성 상태를 빠르게 확인하는 것이 우선이므로, **초기에는 Firebase를 단일 스택**으로 둔다 (인증·Firestore 등 제품에 맞는 구성).  
- **이후** 트래픽·쿼리·비용·도메인 요구에 따라 **PostgreSQL 등으로 분리**한다. 분리 시 스키마·데이터 이전 난이도를 줄이려면 [260509-Firestore-Postgres-이전-체크리스트.md](260509-Firestore-Postgres-이전-체크리스트.md)를 설계 시점부터 준수한다.

### 3.3 Mapbox·외부 API

- 과거 검증 POC(260508 기록)는 클라이언트에서 Mapbox를 직접 호출했다.  
- 본 개발에서는 **토큰 보호·레이트 제한**을 위해 **서버 측 프록시(Cloud Functions `getMapboxDirections` 등)** 를 쓴다. 실행 순서는 [260509-app-js-프론트백엔드-분리-1차리팩터링.md](260509-app-js-프론트백엔드-분리-1차리팩터링.md)와 정렬한다.

---

## 4. 저장소·코드 상태

### 4.1 웹 앱·인프라

- **본 개발:** `apps/web` (`boxcycle-web`) — 루트 **npm workspaces**, `npm install`·`package-lock.json` 은 루트 단일.
- **스택:** Vite + TypeScript + React, Firebase Auth, Mapbox GL(타일 `VITE_MAPBOX_ACCESS_TOKEN`), Callable **`getMapboxDirections`** (`functions/`, `MAPBOX_ACCESS_TOKEN` 시크릿).
- **배포:** 루트 `firebase.json` — Firestore rules/indexes, Hosting `apps/web/dist`. 비밀·키는 `apps/web/.env`(`.env.example` 참고).

### 4.2 Firestore 경로 (현재 코드·Rules 기준)

| 경로 | 용도 |
|------|------|
| `users/{uid}` | 프로필·tier 필드 |
| `trails/{trailId}` | Trail 메타(`default`는 Trailhead 허브, 루트 문서 없을 수 있음) |
| `trails/{trailId}/members/{uid}` | Trailhead·Trail presence·하트비트 |
| `trails/{trailId}/livePublicationRides/{uid}` | 같은 Trail 내 출판 경로 주행 진행·관전(구 `liveCourseRides`) |
| `coursePresence/{courseId}/members/{uid}` | 입문 허브 등 **코스 단위** 동행(`presenceEnabled`) |
| `courseActivity/{courseId}` | Activity World 집계(저빈도 읽기) |
| `routePublications/{id}` · `publicationPresence/{id}` | 경로 출판·월드 dot([World Presence](260523-World-Activity-Presence-설계.md)) |
| `rides/{id}` · `courses/{id}` · `savedRoutes/{id}` | 주행 기록·코스·저장 경로 |
| `openTrailListings/{trailId}` | Trailhead MENU **주행 중 Trail** projection (`riderCount` > 0). CF `openTrailListingProjection` + 클라이언트 fallback |
| `livePresence/{uid}` | 글로벌 라이브(설계 범위 내) |
| `rooms/…` | **레거시 read-only** — 신규 쓰기는 `trails/` ([용어집 §8](260517-제품-용어-Trailhead-Trail.md)) |

Rules: `coursePresence` 는 `courses/{courseId}.presenceEnabled == true` 게이트. 시드는 `firestoreCourses.ts` `ensureBasicCoursesSeeded`.

### 4.3 병행 완료·진행 중 (1차 마일스톤 외)

| 영역 | 상태 | 참고 |
|------|------|------|
| Trail·livePublicationRides 관전 | ✅ | `useTrail*`·`firestoreTrail*`·Trailhead idle 관전 |
| Trailhead MENU 목록 | ✅ | `useOpenTrails` — listing + CG, **활성 라이더만** (2026-06) |
| Route Dock·지명 검색 UI | ✅ | 좌하단 Route Dock, HUD 「지명」 — [UX IA](260515-ux-주행-여정-및-패널-IA.md) |
| Activity World LOD | ✅ | [LOD 설계](260517-Activity-World-지도-LOD-설계.md) |
| Firestore 부하 1차 저감 | ✅ | [(cycle) 종합보고](260515-(cycle)Firestore-부하-경감-조치-종합보고서.md) |
| App 도메인·훅 분리 | ✅ 1차 | [결과 보고](260516-App-도메인-훅-분리-결과-보고서.md) |
| tier·identity D1~D6 | 🔄 부분 | [tier·진입](260519-사용자-tier-및-진입-정책.md) — Stripe 운영·UI 후속 |
| World Activity Presence M1~M3 | 🔄 | [설계](260523-World-Activity-Presence-설계.md) |
| RTW `sessions/` · `presence/` | ⬜ | [Phase 1-B](260511-Phase별-실행-체크리스트-Course-Session-Presence.md) |

### 4.4 다음 2주 (우선순위)

1. **1차 마일스톤 E** — Hosting/스테이징에서 2계정 Trail·입문 허브 동행 데모 PM 서명 ([스모크](260516-수동-스모크-체크리스트.md)).
2. **Phase 1-A-3** — Rules 회귀 T1~T3 수동 확인.
3. **World Presence** — 설계 M 잔여·비용 체크리스트와 정합 ([Firebase 비용](260523-Firebase-비용-운영-체크리스트.md)).

### 4.5 과거 POC

루트 정적 `index.html` / `app.js` 제거. 상세는 [260508 기록](260508-개발중간보고-HTML과-JS-프로토타입.md).

---

## 5. 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-09 | 최초 작성 — 단계 선언, 1차 마일스톤, 스택(Firebase 초기·Vite+React·Android wrap) |
| 2026-05-09 | `apps/web` 스캐폴딩 반영, §4 코드 상태·문서 상태 갱신 |
| 2026-05-09 | Mapbox 지도 + Firestore 사용자 프로필 동기화 반영 |
| 2026-05-09 | 로비 `rooms/default/members` 실시간 접속 표시·하트비트 반영 |
| 2026-05-09 | 동적 `roomId` (`?room=` · 입장 UI) 반영 |
| 2026-05-11 | RTW 마스터 비전·Phase 실행 체크리스트 연결, 인수 조건 D에 `sessions/{sessionId}` 후순위 명시 |
| 2026-05-11 | §4 코드 상태 갱신(Firestore 컬렉션·Hosting·`.env`·미완 Functions); 상단 상태 메타 정렬 |
| 2026-05-11 | §4 Rules `presenceEnabled` 일반화 반영, 다음 작업 목록에서 동일 항목 제거 |
| 2026-05-11 | Directions Callable·§4·상단 메타 반영(Geocoding 프록시는 후속) |
| 2026-05-16 | 루트 정적 POC 제거; npm **workspaces**(`apps/web` → `boxcycle-web`): 루트 단일 `npm install`·잠금 파일, 루트 스크립트가 워크스페이스 위임 |
| 2026-05-26 | §2.1 인수 조건 진행 열, §4 진행 대시보드·Firestore 경로표·다음 2주, tier·World Presence 연결 |
| 2026-06-24 | §2.1·§4.2 `livePublicationRides`·`openTrailListings` 정책, Trail 목록·Route Dock·지명 검색 §4.3 반영 |
