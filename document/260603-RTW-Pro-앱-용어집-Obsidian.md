---
title: RTW Pro 앱 용어집
aliases:
  - RTW Pro 용어집
  - Route Trail 용어
tags:
  - rtw-pro
  - terminology
  - product
  - route
  - trail
status: adopted
updated: 2026-06-03
source_of_truth:
  - document/260603-Route-용어-및-RTW-Pro-브랜딩-통합-전환-방안.md
  - document/260517-제품-용어-Trailhead-Trail.md
---

# RTW Pro 앱 용어집 (Obsidian용)

> **용도:** Obsidian 볼트에 그대로 붙여 넣거나, 이 파일을 `document/` 에서 복사해 쓴다.  
> **기준일:** 2026-06-03 — P0~P4 반영(브랜딩·Route 단일·Firestore 경로 `routeCatalog` 등).  
> **앱:** `apps/web` (RTW Pro). **RTW Free** 는 본 저장소 범위 밖.

---

## 0. 한 줄 원칙

| # | 원칙 |
|---|------|
| 1 | 사용자·기획·신규 문서의 **도메인 엔티티 = Route(경로)** 하나. 공식·입문·퍼블릭·이벤트는 **속성**. |
| 2 | **실시간 함께 달리는 판 = Trail**. 길 나가기 전 허브 = **Trailhead**. |
| 3 | **공식 제품명 = RTW Pro**. `BOXCYCLE` / `Course`(엔티티명) / 「코스」(엔티티 설명) 는 **사용자 노출·신규 문서 금지**. |
| 4 | 코드·DB에 남은 `course*` 는 **레거시 식별자** — 문서·UI에서 새로 쓰지 않는다. |

---

## 1. 브랜드·제품군

| 명칭 | 한 줄 | 앱·문서에서 쓰는 곳 | 쓰지 않는 곳 (사용자 대면) |
|------|------|---------------------|---------------------------|
| **RTW Pro** | Ride The World Pro — 본 앱 | `<title>`, MapHud, 로그인·게스트 카드, RotateOverlay | BOXCYCLE |
| **Ride The World (RTW)** | 제품군·비전 | 마스터 문서, tier·구독 설명 | — |
| **RTW Free** | 별 제품(미완) | “본 repo 비범위” 한 줄만 | Pro와 혼동 금지 |
| **BOXCYCLE** | 엔지니어링 별칭 | repo `boxcycle`, npm `boxcycle-web`, Firebase project id, Mapbox layer id `boxcycle-*` | UI·스토어·Obsidian 제품 소개 |

### 1.1 앱에 보이는 제품명 (현재 구현)

| 위치 | 문구 |
|------|------|
| 브라우저 탭 | `RTW Pro` |
| MapHud | `RTW Pro` |
| AuthGateCard / GuestEntryCard | `RTW Pro` |
| RotateOverlay | `RTW Pro 는 스마트폰 가로 모드에 최적화돼 있어요.` |
| GuestEntryCard 본문 | 입문·**퍼블릭 경로** 주행, **경로** 클라우드 저장, 퍼블릭 신청 |

---

## 2. 도메인 — Route (경로)

### 2.1 개념 계층

| 개념 | 제품 용어 (한) | English | 정의 |
|------|----------------|---------|------|
| 엔티티 | **경로** | **Route** | 지도 LineString·거리·메타. “코스”가 아님. |
| 개인 작업본 | **내 경로** | My Route | 사용자가 저장·이름 붙인 경로 (`savedRoutes`) |
| 운영 카탈로그 | **공식 경로** | Official Route | 운영·시드·승인 후 카탈로그 |
| 입문 허브 | **입문 경로** | Intro Route | 동시 주행 허브 2종(그린델발트·아이슬란드 등) |
| UGC 공개 | **퍼블릭 경로** | Public Route | 심사·승인 후 공개 |
| 출판 스냅샷 | Publication | Publication | `routePublications` — 공개 제목·geometry 스냅샷 |
| 주행 기록 | 주행 / Ride | Ride | `rides` — 완주·통계 |
| 퍼블릭 신청 | 공개 경로 신청 | Public route request | `publicRouteRequests` |

### 2.2 Route vs Trail (헷갈림 방지)

| | Route | Trail |
|---|--------|-------|
| 성격 | **설계도** (정적 geometry) | **지금 함께 도는 판** (인스턴스) |
| Firestore | `routeCatalog`, `savedRoutes`, `routePublications` | `trails/{id}`, `members`, `liveRouteRides` |
| UI 병기 예 | `한강 Official Route · Trail 035` | `Trail 035`, `Trailhead` |

### 2.3 Route 속성 (카탈로그·데이터)

| 속성·분류 | 의미 | 비고 |
|-----------|------|------|
| `category: basic` | 입문·시드 | `isSharedStartHub`, `presenceEnabled` |
| `category: public` | UGC 퍼블릭 | `routePublications` 와 연동 |
| `category: recommended` / `challenge` | 운영 분류 | |
| `visibility: public` | Rules 공개 읽기 게이트 | |
| `type: starter` / `curated` / `ugc` | 출처 | |
| `profile` | cycling / driving / walking | |

---

## 3. Trailhead · Trail (실시간 판)

| 구(舊) | 신(新) | 한 줄 |
|--------|--------|------|
| Lobby | **Trailhead** | 길 나가기 **전** 허브 — 경로 선택, MENU, 계정 |
| Room | **Trail** | **같이 달리는 한 판** — 동시 접속·관전·진행률 |

| 개념 | Firestore (현행) | UI |
|------|------------------|-----|
| Trailhead | `trails/default` (문서 없음·members만) | MENU, 경로 탭, `Trailhead · 이 Trail` |
| Trail (라이브) | `trails/{autoId}` + `members` + `liveRouteRides` | `Trail 001`~`999` (`displayNumber`) |
| Trail 이동 | URL `?trail=` (`?room=` 하위 호환) | TrailHubPanel |

### 3.1 시청·지도 (요약)

| 위치 | 같은 Trail 관전 (`liveRouteRides`) | 전역 Activity (`routeActivity`) |
|------|-----------------------------------|----------------------------------|
| 내 Trail (`≠ default`) | 같은 Trail 주행자만 | 코스(경로) 단위 전역 |
| Trailhead (`default`) | default 에 있는 주행자만 | 전역 |
| 다른 Trail | 구독 안 함 | 전역 |

---

## 4. 앱 UI 카피 — 현재 화면 문자열

> **패널:** `RideRoutePanel` · **Trail:** `TrailHubPanel` · **인증:** `AuthGateCard`, `GuestEntryCard`

### 4.1 경로 패널 탭·구역

| UI 요소 | 한국어 (현재) | English (title/aria 보조) |
|---------|---------------|---------------------------|
| 패널 전체 | 경로 및 라이딩 | Route |
| 탭 1 | **공식경로** | Route / Official routes |
| 탭 2 | **내 경로** | My routes |
| 탭 3 (심사자) | **심사** | Review queue |
| 공식 세그먼트 | **입문** / **퍼블릭** / (이벤트) | Intro / Public / Events |
| 공식 영역 kicker | **공식** | Official |
| 심사 헤더 | **공개 심사** | — |
| 돌아가기 | **경로로** | Back to route |

### 4.2 저장·주행 종료

| UI | 문구 |
|----|------|
| 경로 이름 입력 | `경로 이름 (최대 N자)` |
| 저장 버튼 | **내 경로로 저장** |
| 요약 시트 | 사용자 **경로**로 저장 |

### 4.3 Trail·Trailhead

| UI | 문구 |
|----|------|
| Trailhead presence | `Trailhead · 이 Trail` |
| TrailHub | `Trailhead에서는 ▶ 시 Trail이 열립니다(코스·경로 필요)…` |
| Trail 라벨 | `Trail {displayNumber}` |

### 4.4 아직 「코스」가 남은 UI (정리 예정)

| 위치 | 현재 문구 | 권장 |
|------|-----------|------|
| `CourseSharedPresence` | 입문 **코스** 동행 | **입문 경로** 동행 |
| 일부 주석·aria | 코스·퍼블릭 코스 | 퍼블릭 **경로** |

신규 카피·Obsidian에는 **오른쪽(권장)** 만 사용한다.

---

## 5. Firestore 경로 (P4 현행)

### 5.1 Route·Activity·Presence

| 역할 | **현행 경로** (읽기·쓰기) | 레거시 (read-only, 마이그레이션 후) |
|------|---------------------------|-------------------------------------|
| 공식·퍼블릭 카탈로그 | `routeCatalog/{id}` | `courses/{id}` |
| Activity World 집계 | `routeActivity/{id}` | `courseActivity/{id}` |
| 입문 동행 presence | `routePresence/{routeId}/members/{uid}` | `coursePresence/...` |

### 5.2 Trail·주행

| 역할 | 현행 |
|------|------|
| Trail 인스턴스 | `trails/{trailId}` |
| Trail 접속 | `trails/{trailId}/members/{uid}` |
| Trail 주행 진행률 | `trails/{trailId}/liveRouteRides/{uid}` |
| 개인 경로 | `savedRoutes/{id}` |
| 출판 | `routePublications/{id}` |
| 퍼블릭 신청 | `publicRouteRequests/{id}` |
| 주행 기록 | `rides/{id}` |
| 출판 presence dot | `publicationPresence/{id}` |
| 월드 집계 | `worldActivity/global` |

### 5.3 필드 (레거시 병기)

| 컬렉션 | 신규 필드 | 레거시 (dual-write·read fallback) |
|--------|-----------|-----------------------------------|
| `rides` | `catalogRouteId` | `courseId` |
| `routePublications` | `catalogRouteId` | `courseId` |
| `liveRouteRides` | `courseId` (값 = catalog route id) | 필드명 유지·의미는 Route id |

### 5.4 마이그레이션 CLI

```bash
npm run admin:migrate-route-catalog-paths -- --dry-run
npm run admin:migrate-route-catalog-paths
```

배포 순서: Firestore rules·indexes → 마이그레이션 → functions·hosting.

---

## 6. 코드·타입 식별자 (개발자용)

> 사용자에게 노출되지 않음. 신규 코드는 **오른쪽(권장)**.

| 레거시 | 권장·현행 API |
|--------|----------------|
| `firestoreCourses.ts` | `firestoreRouteCatalog.ts` (re-export) |
| `firestoreCourseActivity.ts` | **`firestoreRouteActivity.ts`** (re-export deprecated) |
| `courseId` (변수) | `catalogRouteId` / `trackedCatalogRouteId` |
| `useOfficialCoursesHub` | `useOfficialRouteCatalog` |
| `useCourseActivity` | **`useRouteActivity`** |
| `PublishedPublicCourseSummary` | `PublishedPublicRouteSummary` (alias 단계) |
| `liveCourseRides` (경로 문자열) | `liveRouteRides` |
| `courseActivity` (컬렉션) | `routeActivity` |
| `App` / `useAppMapOverlays` / `RideRoutePanel` | `routeActivity`, `routeActivityByCatalogRouteId` 등 (2026-06-03 정리) |
| `sanitizeRoomId` | `sanitizeTrailId` |
| `upsertLobbyPresence` | `upsertTrailPresence` |
| CF `courseActivityOnLiveCourseRideWritten` | export명 유지, document: `trails/.../liveRouteRides` |

상수: `apps/web/src/lib/firestoreCollections.ts`, `functions/src/firestoreCollections.ts`

---

## 7. 금지·지양 표

### 7.1 사용자·기획·Obsidian

| 금지 | 대신 |
|------|------|
| BOXCYCLE (제품명) | RTW Pro |
| Course / 코스 (엔티티명) | Route / 경로 |
| 공식 코스, 퍼블릭 코스 | 공식 경로, 퍼블릭 경로 |
| Lobby, Room (UI) | Trailhead, Trail |
| Party, Arena, Match | — |

### 7.2 개발 회의 구어

| 구어 | 말하기 |
|------|--------|
| 로비 | Trailhead |
| 방 3 | Trail 3 |
| courses 컬렉션 (신규 설계) | routeCatalog |

---

## 8. 관련 문서 (저장소)

| 문서 | 역할 |
|------|------|
| `260603-Route-용어-및-RTW-Pro-브랜딩-통합-전환-방안.md` | 전환 로드맵 P0~P4 |
| `260517-제품-용어-Trailhead-Trail.md` | Trailhead/Trail 상세·시청 표 |
| `260518-Route-Publication-통합-모델-및-마이그레이션.md` | Publication·savedRoutes |
| `.cursor/rules/domain-terminology-rtw-pro.mdc` | AI·에이전트 용어 규칙 |

---

## 9. 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-06-03 | 최초 — P0~P4 반영 Obsidian용 용어집, 앱 UI·Firestore 현행 정리 |

---

<!-- 아래: Obsidian «용어» 노트 본문만 필요할 때 §0~§7 복사 (YAML 제외 가능) -->
