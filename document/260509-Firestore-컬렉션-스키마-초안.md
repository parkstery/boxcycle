# BOXCYCLE — Firestore 컬렉션 스키마 초안 (현재 코드 기준)

| 항목 | 내용 |
|------|------|
| 문서 유형 | architecture (실행 스키마 초안) |
| 최초 작성 | 2026-05-09 |
| 상태 | 제안 |
| 연결 문서 | [RTW 마스터 비전](260511-RTW-마스터-비전-및-종합계획.md), [코스 수명·UGC 품질 정책](260511-코스-수명-UGC-품질-정책.md), [경로 저장 계층화](260511-경로저장-계층화-Frozen-Route-Segment.md), [Firestore Rules 일반화](260511-Firestore-Rules-일반화-방안.md), [현재 단계·1차 마일스톤](260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤.md), [Firestore→Postgres 체크리스트](260509-Firestore-Postgres-이전-체크리스트.md), [아키텍처·DB 장기안](260509-아키텍쳐-DB설계.md), [제품 용어 Trailhead·Trail](260517-제품-용어-Trailhead-Trail.md) |

> **제품 용어:** `rooms/{roomId}` = **Trail** 인스턴스. `members` = Trailhead에서 해당 Trail 참가자 presence.

---

## 1) 목표

- 현재 `apps/web` 코드에서 이미 쓰는 데이터(`users`, `rooms/{roomId}/members`)를 기준으로,
- 로컬 주행기록(`localStorage`)을 서버 영속(`rides`)으로 승격 가능한 구조를 먼저 확정한다.
- 이후 Postgres 이전 시 테이블 분해가 쉬운 형태로 유지한다.

---

## 2) 컬렉션 구조 (v1 + v2 후속)

```json
{
  "users": "사용자 기본 프로필",
  "rooms": {
    "{roomId}": {
      "members": "Trail presence (Trailhead·Trail 전용; coursePresence 코스 동행과 별도)"
    }
  },
  "rides": "주행 세션 요약 기록 (Phase 4 이후 'activities'로 명칭 정렬)",
  "courses": "경로/코스 메타 + (소형) GeoJSON 또는 geometryRef 포인터",
  "presence_events": "선택: 실시간 이벤트 로그(짧은 TTL 운영 권장)",

  "sessions": "(2026-05-11 추가) 같은 코스에서 여러 세션 동시 가능. linkedCourseId 보유",
  "presence": {
    "{sessionId}": {
      "members": "(2026-05-11 추가) 세션 내부 실시간 위치/속도/하트비트"
    }
  },
  "coursePresence": "(현재 코드) 코스 단위 동행 — Phase 1-D에서 'presence/{sessionId}'로 이전 후 폐기",
  "coursePresenceConfig": "(2026-05-11 추가, 선택) Rules 게이트가 무거우면 별도 캐시 문서로 분리",
  "courseLifecycleEvents": "(2026-05-11 추가) 코스 상태 전이 불변 로그 (감사·복원·디버그)",
  "activities": "(Phase 4) 사용자 실제 주행 기록 (rides 후속)",
  "rankings": "(Phase 4) 코스 기반 경쟁 데이터",
  "events": "(Phase 4) 기간성 이벤트"
}
```

도메인 정의의 단일 진실은 [RTW 마스터 §5](260511-RTW-마스터-비전-및-종합계획.md). 이 문서는 그 도메인의 **Firestore 필드 형태**만 다룬다.

---

## 3) 문서 스키마 초안 (JSON)

### 3.1 `users/{userId}`

```json
{
  "id": "uid-string",
  "displayName": "string|null",
  "email": "string|null",
  "photoURL": "string|null",
  "provider": "google",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

설명:
- `id`를 문서 내부에도 중복 저장(이전 스크립트 단순화).
- 이메일은 변경 가능 필드로 취급, docId에는 불변 `uid`만 사용.

### 3.2 `rooms/{roomId}`

```json
{
  "id": "room-id",
  "title": "string|null",
  "visibility": "public|private",
  "createdBy": "userId",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

설명:
- 현재는 멤버 하위 컬렉션만 사용해도 되나, 상위 문서 메타를 두면 관리/UI 확장에 유리.

### 3.3 `rooms/{roomId}/members/{userId}`

```json
{
  "userId": "uid-string",
  "displayName": "string|null",
  "photoURL": "string|null",
  "state": "online|idle|riding|offline",
  "lastSeenAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

설명:
- 현재 코드의 `lastSeenAt` heartbeat와 호환.
- presence 고빈도 쓰기는 최소 필드만 갱신.

### 3.4 `rides/{rideId}`

```json
{
  "id": "ride-id",
  "userId": "uid-string",
  "roomId": "room-id|null",
  "courseId": "course-id|null",
  "profile": "cycling|driving|walking",
  "startedAt": "Timestamp",
  "endedAt": "Timestamp",
  "elapsedSec": 0,
  "distanceMeters": 0,
  "avgSpeedKmh": 0,
  "caloriesEstimate": 0,
  "routeDistanceMeters": 0,
  "routeDurationSec": 0,
  "source": "web",
  "status": "completed|aborted",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

설명:
- 현재 `localStorage` 구조(`StoredRideSession`)를 거의 그대로 수용.
- 샘플 포인트(초당 위치)는 `rides` 문서 배열에 넣지 말고 별도 컬렉션/서브컬렉션으로 분리.

### 3.5 `courses/{courseId}` (2026-05-11 v2 — 수명·visibility·geometry 분리)

```json
{
  "id": "course-id",
  "creatorUserId": "uid-string|null",
  "category": "basic|public|recommended|challenge",
  "type": "starter|curated|ugc",
  "title": "string",
  "description": "string|null",
  "profile": "cycling|driving|walking",
  "distanceMeters": 0,
  "durationSec": 0,
  "bounds": {
    "minLng": 0,
    "minLat": 0,
    "maxLng": 0,
    "maxLat": 0
  },
  "geometry": {
    "type": "LineString",
    "coordinates": [[127.0, 37.0], [127.1, 37.1]]
  },
  "geometryRef": null,

  "lifecycleStage": "temporary|active|public_candidate|public_approved|inactive|archived|deleted",
  "visibility": "public|unlisted|private",
  "ownerKind": "personal|public",
  "presenceEnabled": false,
  "isInConquestCollection": false,
  "isPinnedByOwner": false,

  "lastActivityAt": "Timestamp",
  "score": 0,
  "ridesCount": 0,
  "favoritesCount": 0,
  "likesCount": 0,
  "completionRate": 0,
  "reportsCount": 0,

  "isPublic": true,
  "status": "draft|published|archived",

  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

설명:
- `basic` 카테고리에는 필수 코스(예: 0.5km / 1.0km / 1.5km / 스위스 그린델발트 5km 등)를 저장한다.
- 확장 카테고리로 `public`, `recommended`, `challenge`를 동일 필드에서 관리한다.
- **Geometry 저장 정책 ([저장 계층화](260511-경로저장-계층화-Frozen-Route-Segment.md) §1·§2):**
  - 입문 허브(좌표 ≤ 50개) → `geometry` 본문 그대로 유지, `geometryRef: null`.
  - 사용자 코스(임의 길이) → `geometry: null`, `geometryRef: { storagePath: "routes/{id}/v1.polyline", encoding: "polyline6", version: 1, sizeBytes: number }`.
- **수명 필드 ([코스 수명·UGC 품질 정책 §7](260511-코스-수명-UGC-품질-정책.md)):** `lifecycleStage`, `lastActivityAt`, `score`, `ownerKind`, `isInConquestCollection`, `isPinnedByOwner`.
- **공개·게이트 필드 ([Firestore Rules 일반화](260511-Firestore-Rules-일반화-방안.md)):** `visibility`, `presenceEnabled`. Rules는 이 필드를 `get()` 으로 검증한다.
- **집계 캐시 필드 (`*Count`, `completionRate`):** Cloud Function 일배치 또는 트리거로 갱신. **단일 문서에 고빈도 패치 ❌** ([Firestore→Postgres 체크리스트](260509-Firestore-Postgres-이전-체크리스트.md) "쓰기 패턴" 절).

**v1 → v2 마이그레이션 표:**

| v1 필드 | v2 정책 |
|---------|---------|
| `isPublic: boolean` | `visibility: "public"\|"unlisted"\|"private"` 로 대체. v2 도입 후에도 1~2 Phase 동안은 둘 다 쓰기·읽기 호환 유지. 신규 코드는 `visibility`만 신뢰. |
| `status: "draft\|published\|archived"` | `lifecycleStage`로 흡수. `published` ≈ `public_approved`, `archived` ≈ `archived`, `draft` ≈ `temporary`. |
| `geometry: LineString` (사용자 코스) | `geometryRef`로 분리. 기존 시드(입문 허브)는 그대로 유지. |

### 3.6 `sessions/{sessionId}` (2026-05-11 신설)

```json
{
  "id": "session-id",
  "linkedCourseId": "course-id",
  "mode": "public|private|event",
  "visibility": "public|unlisted|private",
  "maxPlayers": 30,
  "createdBy": "uid-string",
  "createdAt": "Timestamp",
  "closedAt": "Timestamp|null",
  "presenceEnabled": true
}
```

설명:
- `linkedCourseId`로 정적 코스에 연결. 같은 코스에서 여러 세션이 동시 가능 ([RTW 마스터 §2.1](260511-RTW-마스터-비전-및-종합계획.md)).
- `presenceEnabled`는 코스 문서에서 복제 — Rules `get()` 비용 절감 ([Rules 일반화 §4.3](260511-Firestore-Rules-일반화-방안.md)). 세션 시작 시 1회 복사.
- `mode`/`visibility`는 독립 — 예: 친구 비공개 세션(`mode: private`, `visibility: unlisted`).

### 3.7 `presence/{sessionId}/members/{userId}` (2026-05-11 신설)

```json
{
  "userId": "uid-string",
  "displayName": "string|null",
  "photoURL": "string|null",
  "lat": 37.5512,
  "lng": 126.9882,
  "speed": 28.4,
  "heading": 91,
  "lastSeenAt": "Timestamp"
}
```

설명:
- 기존 `coursePresence/{courseId}/members/{uid}` ([apps/web/src/lib/firestoreCoursePresence.ts](../apps/web/src/lib/firestoreCoursePresence.ts))를 **이름·구조 정렬**한 버전.
- Phase 1-D에서 `coursePresence` → `presence` 이전 + Rules·코드 정리.
- 고빈도 쓰기(2초 간격) → 단일 문서에 큰 배열 X, 멤버별 작은 문서 유지.

**현재 `coursePresence` ↔ 신규 `presence` 이관 표:**

| 기존 (`coursePresence`) | 신규 (`presence`) | 비고 |
|-------------------------|-------------------|------|
| `coursePresence/{courseId}/members/{uid}` 경로 | `presence/{sessionId}/members/{uid}` 경로 | 입문 허브는 1차로 `sessionId = courseId` 임시 매핑 (Phase 1-C) |
| `liveLng`, `liveLat`, `liveGeo(GeoPoint)` 혼재 | `lat`, `lng` 단일 형태 | GeoPoint 타입은 유지 가능하나 검색 쿼리 단순화를 위해 number 권장 |
| `displayName`, `photoURL`, `memberType`, `lastSeenAt` | 동일(필드명 유지) | — |

---

## 4) 쿼리 패턴 기준 인덱스 제안

- `rides`: `(userId ASC, endedAt DESC)`
- `rides`: `(roomId ASC, endedAt DESC)` (필요 시)
- `courses`: `(isPublic ASC, status ASC, updatedAt DESC)` *(v1)*
- `courses`: `(visibility ASC, lifecycleStage ASC, score DESC)` *(2026-05-11 v2 — 공개 검색·인기순)*
- `courses`: `(lifecycleStage ASC, lastActivityAt ASC)` *(2026-05-11 v2 — archive 일배치 스캔)*
- `rooms/{roomId}/members`: `(lastSeenAt DESC)` (활성 사용자 정렬용)
- `sessions`: `(linkedCourseId ASC, createdAt DESC)` *(2026-05-11 v2)*
- `presence/{sessionId}/members`: `(lastSeenAt DESC)` *(2026-05-11 v2)*

주의:
- Firestore 복합 인덱스는 실제 쿼리 패턴이 확정될 때 최소한으로 생성.

---

## 5) 보안 규칙 초안 원칙

- `users/{userId}`: 본인 읽기/쓰기 기본, 운영자 확장 별도.
- `rooms/{roomId}/members/{userId}`:
  - 본인 문서만 upsert/delete 가능
  - `lastSeenAt`/`state`만 갱신 허용(필드 화이트리스트)
- `rides/{rideId}`:
  - 작성자(`userId == request.auth.uid`)만 생성/조회
  - 수정은 종료 전/직후 제한 정책 명시
- `courses/{courseId}`:
  - 공개 코스 읽기 허용
  - UGC 생성은 인증 사용자만, publish 전환은 별도 검증 경로

---

## 6) 지금 코드에 바로 연결할 마이그레이션 단계

1. `localStorage` 종료 세션 저장 시점에 `rides` 동시 저장 추가  
2. 로그인 후 최초 1회:
   - `localStorage` 기록 존재 + Firestore 미존재면 백필 업로드
3. `recentSessions` 조회 소스를 점진적으로 `rides`로 전환
4. 안정화 후 `localStorage`는 캐시/오프라인 임시 저장 용도로 축소

---

## 7) Postgres 이전 매핑 (요약)

- `users` -> `users`
- `rooms` -> `rooms`
- `rooms/{roomId}/members` -> `room_members`
- `rides` -> `rides`
- `courses` -> `courses` (+ `route_geom` PostGIS 변환)

핵심:
- 모든 문서에 `id`, FK(`userId`, `roomId`, `courseId`)를 명시해 ETL 단순화.

---

## 8) 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-09 | 최초 작성 |
| 2026-05-11 | v2 — `sessions`/`presence`/`coursePresenceConfig`/`courseLifecycleEvents`/`activities`/`rankings`/`events` 컬렉션 추가, `courses` 수명·visibility·geometryRef 필드 추가, v1→v2 마이그레이션 표 |
