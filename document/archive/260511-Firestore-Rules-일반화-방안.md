# RTW — Firestore Rules 일반화 방안

| 항목 | 내용 |
|------|------|
| 문서 유형 | **architecture** — Rules 데이터 기반 일반화의 단일 진실 |
| 최초 작성 | 2026-05-11 |
| 상태 | **초안** — 자문 1단계(2.2 운영형 플랫폼) 결론. 단계적 마이그레이션 권장. |
| 연결 문서 | [RTW 마스터](../260511-RTW-마스터-비전-및-종합계획.md), [코스 수명·UGC 품질 정책](260511-코스-수명-UGC-품질-정책.md), [경로 저장 계층화](260511-경로저장-계층화-Frozen-Route-Segment.md), [Phase별 실행 체크리스트](260511-Phase별-실행-체크리스트-Course-Session-Presence.md), [Firestore 스키마 초안](260509-Firestore-컬렉션-스키마-초안.md) |

---

## 0. 본 문서의 위치

- 본 문서는 **Firestore Security Rules의 데이터 기반 일반화 방안**의 단일 진실이다.
- 코스 수명 필드(`lifecycleStage` 등)·visibility 정의는 [코스 수명·UGC 품질 정책 §7](260511-코스-수명-UGC-품질-정책.md)이 단일 진실이다. 본 문서는 그 필드를 **Rules에서 어떻게 검증할지**만 다룬다.

---

## 1. 현재 갭

### 1.1 하드코딩된 Rules (과거 예시)

> **2026-05-11 반영:** 저장소 [`firestore.rules`](../firestore.rules) 는 아래 패턴을 제거하고 `courses/{id}.presenceEnabled` 기반으로 교체되었다.

[`firestore.rules`](../firestore.rules) 에서 이전에 쓰이던 형태(참고용):

```javascript
match /courses/{courseId} {
  allow read: if isSignedIn() || courseId == 'basic-alps-grindelwald-5km';
  allow create: if isSignedIn();
  allow update, delete: if false;
}

match /coursePresence/{courseId}/members/{userId} {
  allow read: if isSignedIn() && courseId == 'basic-alps-grindelwald-5km';
  allow create, update: if isSelf(userId) && courseId == 'basic-alps-grindelwald-5km';
  allow delete: if isSelf(userId) && courseId == 'basic-alps-grindelwald-5km';
}
```

### 1.2 문제점

| # | 문제 |
|---|------|
| 1 | 새 입문 허브 코스를 추가할 때마다 **Rules 수정 + 배포** 필요 |
| 2 | `BASIC_HUB_COURSE_2_ID = "basic-iceland-ring-road-5km"` 가 코드에는 등록됐지만 Rules에는 누락 — **불일치 위험** |
| 3 | Public 코스 검색 등을 추가하면 `||` 조건이 무한 증식 |
| 4 | [RTW 마스터 §2.2](../260511-RTW-마스터-비전-및-종합계획.md) "데이터 등록만으로 운영" 원칙 위배 |

### 1.3 코드와 Rules의 실제 불일치 사례

`apps/web/src/lib/firestoreCourses.ts`:

- `BASIC_SHARED_HUB_IDS = [BASIC_HUB_COURSE_1_ID, BASIC_HUB_COURSE_2_ID]` — 2개
- Rules는 `'basic-alps-grindelwald-5km'` 하나만 허용

→ 두 번째 입문 허브에서 동시 주행 presence가 **Rules 거부**될 가능성. 즉시 §5 마이그레이션 1단계 대상.

---

## 2. 목표 패턴

### 2.1 데이터 기반 검증

```javascript
function isCourseSharedPresenceAllowed(courseId) {
  return get(/databases/$(database)/documents/courses/$(courseId))
           .data.presenceEnabled == true;
}
```

이렇게 하면:

- 새 입문 허브 추가 = `courses/{newId}` 문서에 `presenceEnabled: true` 한 줄만 추가.
- Rules 수정·배포 불필요.
- 코드와 Rules의 **단일 진실은 Firestore 데이터**.

**운영 참고:** `courses` 에 대해 `update: false` 인 프로젝트에서는 클라이언트 `merge` 로 `presenceEnabled` 만 보강할 수 없다. 이때 Rules 에 **`isSharedStartHub == true` 와 동등 허용**(하위 호환)을 두거나, 콘솔·Admin SDK 로 필드를 넣는다.

### 2.2 게이트 헬퍼 함수(설계)

```javascript
service cloud.firestore {
  match /databases/{database}/documents {

    // -------- 기본 헬퍼 --------
    function isSignedIn() {
      return request.auth != null;
    }

    function isSelf(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function courseDoc(courseId) {
      return get(/databases/$(database)/documents/courses/$(courseId)).data;
    }

    // -------- 도메인 게이트 --------
    function isCoursePubliclyReadable(courseId) {
      // public 으로 승격된 코스 또는 명시적 presenceEnabled
      return courseDoc(courseId).visibility == "public"
          || courseDoc(courseId).presenceEnabled == true;
    }

    function isCourseSharedPresenceAllowed(courseId) {
      // presence 허용은 데이터로 결정. lifecycleStage 가 archived/deleted 면 차단.
      return courseDoc(courseId).presenceEnabled == true
          && courseDoc(courseId).lifecycleStage in ["temporary","active","public_candidate","public_approved"];
    }

    function isSessionJoinable(sessionId) {
      let s = get(/databases/$(database)/documents/sessions/$(sessionId)).data;
      // public 세션이거나 본인이 멤버이면 허용 (멤버 검증은 별도)
      return s.visibility == "public" || isSelf(s.createdBy);
    }

    // -------- 컬렉션 매칭 --------
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create, update: if isSelf(userId);
      allow delete: if false;
    }

    match /rooms/{roomId}/members/{userId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isSelf(userId);
    }

    match /rides/{rideId} {
      allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if false;
    }

    match /courses/{courseId} {
      allow read: if isSignedIn() || isCoursePubliclyReadable(courseId);
      allow create: if isSignedIn();
      // owner 검증·lifecycleStage 전이는 Cloud Function 만 (Phase 2 도입)
      allow update, delete: if false;
    }

    // 새 컬렉션: presence/{sessionId}/members/{uid}  (Phase 1)
    match /presence/{sessionId}/members/{userId} {
      allow read: if isSignedIn() && isSessionJoinable(sessionId);
      allow create, update: if isSelf(userId) && isSessionJoinable(sessionId);
      allow delete: if isSelf(userId);
    }

    // 호환 보존: 기존 coursePresence (Phase 1 마이그레이션 전까지 유지)
    match /coursePresence/{courseId}/members/{userId} {
      allow read: if isSignedIn() && isCourseSharedPresenceAllowed(courseId);
      allow create, update: if isSelf(userId) && isCourseSharedPresenceAllowed(courseId);
      allow delete: if isSelf(userId);
    }
  }
}
```

> 위 코드는 **목표 형태의 설계 예시**다. 실제 적용은 §5 단계적 마이그레이션을 따른다.

### 2.3 핵심 변화 요약

| Before | After |
|--------|-------|
| `courseId == 'basic-alps-grindelwald-5km'` 하드코딩 | `courses/{courseId}.presenceEnabled == true` 데이터 검증 |
| 새 코스마다 Rules 수정 | Firestore 문서 한 줄 추가 |
| 코드(`BASIC_SHARED_HUB_IDS`) ↔ Rules 이중 진실 | Firestore 단일 진실 |

---

## 3. 권한 게이트 매트릭스

| 작업 | 비로그인 | 로그인(본인 X) | 로그인(본인 O) | 추가 조건 |
|------|----------|----------------|----------------|-----------|
| `users/{uid}` 읽기 | ❌ | ✅ | ✅ | — |
| `users/{uid}` 쓰기 | ❌ | ❌ | ✅ | — |
| `courses/{cid}` 읽기 | `isCoursePubliclyReadable(cid)` 시 ✅ | ✅ | ✅ | — |
| `courses/{cid}` 생성 | ❌ | ✅ | — | `temporary` 기본값 |
| `courses/{cid}` 수정·삭제 | ❌ | ❌ | ❌ | Cloud Function 만 |
| `presence/{sid}/members/{uid}` 읽기 | ❌ | `isSessionJoinable(sid)` ✅ | ✅ | — |
| `presence/{sid}/members/{uid}` 쓰기 | ❌ | ❌ | `isSessionJoinable(sid)` ✅ | — |
| `rides/{rideId}` 읽기 | ❌ | ❌ | ✅(작성자만) | — |
| `rides/{rideId}` 생성 | ❌ | — | ✅(`userId == uid`) | — |
| `rides/{rideId}` 수정·삭제 | ❌ | ❌ | ❌ | 종료 후 불변 |

---

## 4. Rules `get()` 비용 주의

### 4.1 비용 모델

- `get()` 1번 = Firestore 읽기 1번 과금. 
- 한 요청에 `get()` 호출 한도(2024 기준 10번/요청).

### 4.2 절약 원칙

| 원칙 | 설명 |
|------|------|
| **메타는 얕고 평탄하게** | `presenceEnabled`, `visibility`, `lifecycleStage` 같은 게이트 필드는 `courses/{cid}` 문서 **루트**에 둔다. nested map 안에 두지 않는다. |
| **자주 쓰는 게이트 묶기** | 하나의 `get()` 결과를 변수에 담아 여러 조건에 재사용 |
| **고빈도 presence 쓰기는 주의** | presence 1초마다 갱신 시 `get(courses)` 호출이 누적됨 → §4.3 캐시 패턴 |

### 4.3 고빈도 presence 패턴

presence 쓰기 1초마다 = `get(courses)` 1초마다 = 비용 폭증.

**대안:**

- 첫 쓰기 시점에만 게이트 검증, 이후 client-side 자율(서버는 허용 범위 신뢰).
- 또는 **session 문서**에 `presenceEnabled` 를 복제해 두고(course → session 시작 시 1회 복사) `sessions/{sid}` 한 번만 `get()`.

→ 후자가 권장. session 모델 도입 후 적용.

---

## 5. 단계적 마이그레이션 체크리스트

본 절은 [Phase별 실행 체크리스트](260511-Phase별-실행-체크리스트-Course-Session-Presence.md) Phase 1·2의 Rules 작업을 추적한다.

### 5.1 Phase 1-Rules-A — 즉시 적용 (입문 허브 2종 일치)

**목적:** 코드와 Rules의 입문 허브 ID 불일치 즉시 해소.

- [ ] `apps/web/src/lib/firestoreCourses.ts` 시드 시 `presenceEnabled: true` 필드 추가 (입문 허브 2종)
- [ ] `firestore.rules` 의 `coursePresence` 매칭에서 하드코딩된 `'basic-alps-grindelwald-5km'` 를 `isCourseSharedPresenceAllowed(courseId)` 로 교체
- [ ] `courses/{courseId}` 매칭의 read 조건도 마찬가지 일반화
- [ ] 회귀 테스트: 입문 허브 1·2 모두 동시 주행 presence 동작 확인

**완료 기준:** 입문 허브 2종 모두 Rules 거부 없이 동시 주행 가능. 새 입문 허브 추가 시 Rules 변경 불필요.

### 5.2 Phase 1-Rules-B — sessions/presence 신설

**목적:** Course/Session/Presence 3분할 ([RTW 마스터 §2.1](../260511-RTW-마스터-비전-및-종합계획.md)) 정착.

- [ ] `sessions/{sessionId}` 매칭 추가
- [ ] `presence/{sessionId}/members/{userId}` 매칭 추가 (위 §2.2 설계 적용)
- [ ] 기존 `coursePresence` 매칭은 호환 유지 (Phase 1-D 이전·삭제는 Phase 2)

### 5.3 Phase 2-Rules — visibility·lifecycleStage 게이트

**목적:** UGC 코스 도입에 따른 권한 정교화.

- [ ] `isCoursePubliclyReadable()` 헬퍼에 `visibility == "public" && lifecycleStage in [...]` 조건 추가
- [ ] `archived`/`deleted` 코스 read 차단(본인 제외)
- [ ] 회귀 테스트: archive 후 검색 결과에 노출되지 않음

### 5.4 Phase 3+ Rules

- [ ] Storage Rules: `routes/{routeId}/{version}.polyline` 읽기 게이트 (`courses/{routeId}.visibility == "public"` 또는 본인)
- [ ] Cloud Function 전용 컬렉션(`courseLifecycleEvents`)은 client write 금지

---

## 6. 회귀 테스트 시나리오

각 Phase 적용 후 다음 시나리오를 통과해야 한다.

| # | 시나리오 | 기대 |
|---|----------|------|
| T1 | 입문 허브 1로 들어가 동시 주행 시작 | presence 정상 |
| T2 | 입문 허브 2로 들어가 동시 주행 시작 | presence 정상 (현재 갭 해소 검증) |
| T3 | 새 입문 허브 3을 Firestore에 직접 추가(presenceEnabled: true) | Rules 변경 없이 presence 동작 |
| T4 | 익명 사용자가 public 코스 읽기 | 허용 |
| T5 | 익명 사용자가 private 코스 읽기 | 거부 |
| T6 | 본인이 자신의 archived 코스 읽기 | 허용 |
| T7 | 타인이 archived 코스 검색 | 결과에 없음(또는 거부) |
| T8 | presence 매 1초 쓰기 1분간 | 비용 증가가 §4.3 패턴 적용 후 절감 확인 |

테스트 도구: Firebase Emulator + 자동화 스크립트 또는 콘솔 수동.

---

## 7. 핵심 결론

- **Rules에서 코스 ID 하드코딩 제거** → `presenceEnabled`/`visibility`/`lifecycleStage` 데이터 기반 검증.
- **즉시 갭 해소:** 입문 허브 2종 ID 불일치 → Phase 1-Rules-A.
- **장기 비용 관리:** presence 고빈도 쓰기는 session 문서에 게이트 복제로 `get()` 절감.
- **단일 진실은 Firestore 데이터**. 코드·Rules 이중 진실 금지.

---

## 8. 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-11 | 최초 작성 — 자문 1단계(2.2 운영형 플랫폼 구조) 결론 반영. 현재 코드 갭 명시. |
