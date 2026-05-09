# BOXCYCLE — Firestore 컬렉션 스키마 초안 (현재 코드 기준)

| 항목 | 내용 |
|------|------|
| 문서 유형 | architecture (실행 스키마 초안) |
| 최초 작성 | 2026-05-09 |
| 상태 | 제안 |
| 연결 문서 | `260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤.md`, `260509-Firestore-Postgres-이전-체크리스트.md`, `260509-아키텍쳐-DB설계.md` |

---

## 1) 목표

- 현재 `apps/web` 코드에서 이미 쓰는 데이터(`users`, `rooms/{roomId}/members`)를 기준으로,
- 로컬 주행기록(`localStorage`)을 서버 영속(`rides`)으로 승격 가능한 구조를 먼저 확정한다.
- 이후 Postgres 이전 시 테이블 분해가 쉬운 형태로 유지한다.

---

## 2) 컬렉션 구조 (v1)

```json
{
  "users": "사용자 기본 프로필",
  "rooms": {
    "{roomId}": {
      "members": "실시간 로비 접속자 상태"
    }
  },
  "rides": "주행 세션 요약 기록",
  "courses": "경로/코스 메타 + GeoJSON",
  "presence_events": "선택: 실시간 이벤트 로그(짧은 TTL 운영 권장)"
}
```

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

### 3.5 `courses/{courseId}`

```json
{
  "id": "course-id",
  "creatorUserId": "uid-string|null",
  "category": "basic|public|recommended|challenge",
  "type": "starter|curated|ugc",
  "title": "string",
  "description": "string|null",
  "isPublic": true,
  "status": "draft|published|archived",
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
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

설명:
- `basic` 카테고리에는 필수 코스(예: 0.5km / 1.0km / 1.5km / 스위스 그린델발트 5km 등)를 저장한다.
- 확장 카테고리로 `public`, `recommended`, `challenge`를 동일 필드에서 관리한다.
- GeoJSON은 구조화 객체로 저장.
- `distanceMeters`, `bounds`를 같이 저장해 조회/필터를 단순화.

---

## 4) 쿼리 패턴 기준 인덱스 제안

- `rides`: `(userId ASC, endedAt DESC)`
- `rides`: `(roomId ASC, endedAt DESC)` (필요 시)
- `courses`: `(isPublic ASC, status ASC, updatedAt DESC)`
- `rooms/{roomId}/members`: `(lastSeenAt DESC)` (활성 사용자 정렬용)

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
