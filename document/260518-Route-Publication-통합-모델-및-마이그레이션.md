# Route · Publication 통합 모델 및 마이그레이션

| 항목 | 내용 |
|------|------|
| 문서 유형 | architecture — 경로 정체성·퍼블릭 출판·주행 연결 |
| 작성 | 2026-05-18 |
| 상태 | **진행 중** — Phase A~B 클라이언트 반영, `courses` 레거시 병행 |
| 연결 | [코스 수명 UGC 정책](260511-코스-수명-UGC-품질-정책.md), [경로 저장 계층화](260511-경로저장-계층화-Frozen-Route-Segment.md) |

---

## 1. 목표

- **경로 정체성(`routeId`)은 하나** — 현재 `savedRoutes/{id}` 가 원본(작업본).
- **퍼블릭은 별도 “경로 복제”가 아니라 출판(Publication) 리비전** — geometry·공개 제목은 승인 시점 스냅샷 고정.
- **주행(`rides`)은 항상 `routeId` 중심** — 입구(내 경로 / 퍼블릭 탭)는 `routeEntry`·`publicationId` 메타로만 구분.
- **소유자가 작업본 geometry·`ownerTitle`을 수정해도 기존 Publication은 자동 갱신되지 않음** — 반영은 “새 revision 발행”(향후).

---

## 2. 목표 스키마 (필드)

### 2.1 `savedRoutes/{routeId}` → 장기 `routes/{routeId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `userId` | string | 소유자 |
| `name` | string | **개인 라벨** (`ownerTitle`) |
| `geometry` / `geometryCoordsJson` | LineString | 작업본(수정 가능) |
| `profile` | string | cycling / driving / walking |
| `routeFingerprint` | string? | SHA-256 hex (향후 백필) |
| `completed` | 0 \| 1 | 완주 격상 |
| `expiresAt` | timestamp? | 미완주 TTL |

### 2.2 `routePublications/{publicationId}` (신규)

| 필드 | 타입 | 설명 |
|------|------|------|
| `routeId` | string | **원본** `savedRoutes` 문서 ID |
| `courseId` | string | 레거시 카탈로그·`courseActivity` 키 (`courses/{courseId}`) |
| `publicTitle` | string | 공개 제목 (커뮤니티 지명) |
| `publicSummary` | string? | 소개 |
| `status` | string | `published` \| `archived` … |
| `revision` | number | 1부터, 업데이트 발행 시 증가 |
| `routeFingerprint` | string | 승인 시점 지문 |
| `geometryCoordsJson` | string | **불변 스냅샷** |
| `snapshotProfile` | string | |
| `snapshotDistanceMeters` | number | |
| `snapshotDurationSec` | number | |
| `applicantUid` | string | |
| `sourcePublicRouteRequestId` | string? | |

**마이그레이션:** 신규 승인 시 `publicationId === courseId` 로 동일 ID 사용(단순화). 기존 `courses` 만 있는 문서는 조회 시 `courses` 폴백.

### 2.3 `courses/{courseId}` (레거시 카탈로그, 점진 퇴역)

- 당분간 카탈로그 쿼리·`courseActivity`·입문 허브와 호환.
- UGC 승인 시 **기존과 동일하게 생성** + `routePublications` **듀얼 라이트**.
- `sourceSavedRouteId` = `routeId`.

### 2.4 `rides/{rideId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `userId` | string | |
| `routeId` | string? | **통합 정체성** (`savedRoutes` id; ad-hoc는 null) |
| `userRouteId` | string? | **레거시** — `routeId` 와 동일 값 유지(하위 호환) |
| `courseId` | string? | Activity·heat용 (`courses` id) |
| `publicationId` | string? | `routePublications` id (통상 `courseId` 와 동일) |
| `routeEntry` | string? | `owner_library` \| `public_catalog` |
| `routeName` | string? | 주행 시점 **개인 라벨** 스냅샷 |
| `publicTitleSnap` | string? | (선택) 주행 시점 공개 제목 스냅샷 |

---

## 3. 현재 → 목표 매핑

| 현재 | 목표 역할 |
|------|-----------|
| `savedRoutes/{id}` | `routeId` (작업본) |
| `courses/{id}` + geometry 복제 | 카탈로그·activity 레거리; 출판 스냅샷은 `routePublications` |
| `publicRouteRequests` | 승인 워크플로 (유지) |
| `rides.userRouteId` | `rides.routeId` (+ 동일 값 `userRouteId`) |
| `rides.courseId` null (내 경로 입구) | **Phase A:** 지문·`routeId`로 publication 조회 후 `courseId` 자동 부착 |

---

## 4. 구현 단계

| 단계 | 내용 | 상태 |
|------|------|------|
| **A** | 주행 종료·내 경로 로드 시 `resolvePublishedRouteLink` → `courseId`·`publicationId`·`routeId` 통합 | **이번 PR** |
| **B** | 승인 시 `routePublications` 듀얼 라이트, Rules·인덱스 | **이번 PR** |
| **C** | 카탈로그 UI를 publication 조인으로 전환 | 예정 |
| **D** | 레거시 `courses` UGC read 경로 축소, revision 발행 UI | 예정 |
| **E** | geometry 서브컬렉션·맵 LOD | 예정 |

---

## 5. 해석 규칙 (`resolvePublishedRouteLink`)

1. (선택) 메모리 카탈로그: `sourceSavedRouteId === routeId`
2. `routePublications` where `routeId` + `status==published`
3. `courses` where `sourceSavedRouteId` + public published (레거시)
4. `routeFingerprint` 로 `routePublications` / `courses` 조회

**내 경로에서 주행:** `routeEntry=owner_library`, `userRouteId` 유지, 매칭되면 `courseId`·`publicationId`도 채움 → Activity World 분리 최소화.

**퍼블릭 탭에서 주행:** `routeEntry=public_catalog`, `courseId` 설정, `routeId`는 publication에서 역조회.

---

## 6. 원본 수정 vs 퍼블릭

| 동작 | 작업본 `savedRoutes` | `routePublications` |
|------|----------------------|---------------------|
| 소유자 rename `name` | ✅ 변경 | ❌ 변경 없음 |
| 소유자 geometry 수정 | ✅ (정책 허용 시) | ❌ 스냅샷 고정 |
| 퍼블릭 반영 | — | **새 revision 신청** (미구현) |

---

## 7. 운영·백필 (수동)

- 기존 `courses`(UGC)에 대해 `routePublications` 문서를 Functions/스크립트로 1회 생성 가능 (`routeId=sourceSavedRouteId`, `courseId=course.id`).
- 인덱스: `routePublications` — `(routeId, status)`, `(routeFingerprint, status)`; `courses` — `(sourceSavedRouteId, category, status)`.

---

## 8. 제품 고지 (퍼블릭 신청 모달, 별도 UX 티켓)

- 공개 제목은 승인 후 커뮤니티 명칭이며 등록자가 임의 변경 불가.
- 권장 형식: `{닉네임} · {지역/랜드마크} · {거리·특성}`.
- 내 경로 개인 이름과 공개 제목은 별개.
