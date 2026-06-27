# Phase 7c — `liveCourseRides` 경로·`courseId` 필드 디커미션 체크리스트

| 항목 | 내용 |
|------|------|
| 문서 유형 | **execution** — Phase 7(필드 purge)·7b(코드 rename) 이후 잔여 데이터 결합 폐기 |
| 작성 | 2026-06-27 |
| 상태 | **착수** — 트랙 1 C1(audit) 구현 완료, Admin 실행 대기 |
| 선행 | Phase 7 (`courseId` write 중단·purge) · Phase 7b-3a/3b/3c (`liveCourseRide` 코드 정리) **완료** |
| 연결 | [Phase 7 체크리스트](260616-Phase7-Firestore-필드-terminology-체크리스트.md), [Route·Publication 통합](260518-Route-Publication-통합-모델-및-마이그레이션.md), [World Activity Presence](260523-World-Activity-Presence-설계.md) |

---

## 0. 목표·범위

Phase 7b까지 **코드 식별자**의 `course*` 를 정리했다. 남은 것은 **실제 Firestore 데이터/경로와 결합**되어 마이그레이션·배포 시퀀스가 필요한 두 항목이다. 서로 **독립 트랙**이며 같이 묶지 않는다.

| 트랙 | 대상 | 성격 |
|------|------|------|
| **1** | `trails/{id}/liveCourseRides/{uid}` 서브컬렉션 | 라이브 presence — 휘발성(180s TTL) |
| **2** | 문서 `courseId` 필드 (`trails`·`openTrailListings` 등) | 영속 필드 |

**원칙 — Expand → Migrate → Contract.** 모든 단계 reversible, **비가역은 데이터 삭제(C5·F3)뿐**이며 audit 0 + 수일 관측을 게이트로 둔다. 각 단계 후 audit 재실행 + `tsc -b`(web·functions) + rules 에뮬레이터 테스트.

---

## 1. 현재 상태 (코드 확인 — 2026-06-27)

| 대상 | Writer | Reader | Rules | Index |
|------|--------|--------|-------|-------|
| `liveCourseRides` 서브컬렉션 | **없음** (client는 `livePublicationRides`만, rules `write:false`) | functions `scanAllLiveRideDocs` (`LIVE_RIDE_SUBCOLLECTIONS`) + rules read-only ×3 | read-only ×3 (`{path=**}`·`trails`·`rooms`) | **이미 없음** |
| `courseId` 필드 | 없음 (Phase 7-1 write 중단) | client `resolvePublicationIdFromDoc` 폴백 | `trailHasPublicationId` 가 `courseId` 수락(rules L129-131) — trail 루트 한정 | — |

**기존 도구(신규 구현 최소):** `migrateLivePublicationRidesWithAdminSdk`(복사+`courseId→publicationId`+`deleteLegacy`), `auditTerminologyWithAdminSdk`, `purgePhase7CourseIdFieldsCore`, `backfillTrailsPublicationIdCore`.

---

## 2. 트랙 1 — `liveCourseRides` 서브컬렉션 폐기

> 리스크 핵심: 데이터가 휘발성이라 컷오버 순간 fresh(<180s) 레거시 문서가 있으면 presence/heat 일시 누락. 활성 주행은 전부 `livePublicationRides`에 쓰므로 fresh 레거시는 사실상 0이어야 한다 — **이를 audit로 증명하는 것이 C1.**

| # | 단계 | 내용 | 비가역 | 상태 |
|---|------|------|--------|------|
| C1 | **Audit** | `auditTerminologyWithAdminSdk` 에 `liveRides` 섹션 추가 — `legacyTotal`·`legacyPublicationIdMissing`·`legacyCourseIdOnly`·`legacyFreshUnder180s`·`publicationTotal`. 실행: `npm run admin:audit-terminology` | — | ✅ 구현 (Admin 실행 대기) |
| C2 | (선택) 데이터 보존 복사 | `migrate…({dryRun:true})` → `{dryRun:false, deleteLegacy:false}`. C1 fresh=0 이면 생략 | 가역 | ⬜ |
| C3 | **읽기 컷오버** | `LIVE_RIDE_SUBCOLLECTIONS` → `[livePublicationRides]` 단일. 영향: `publicationPresenceCore`·`routeActivityScheduledReconcile`. deploy functions | 가역(revert) | ⬜ |
| C4 | **Rules 축소** | `liveCourseRides` match 3블록 제거. client 미사용 → 영향 없음. deploy rules | 가역 | ⬜ |
| C5 | **데이터 삭제** | C3/C4 관측 후 `migrate…({deleteLegacy:true})` | **비가역** | ⬜ |
| C6 | **코드 정리** | client `TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION`(dead)·functions 상수·`worldMapOverlayCore` `liveCourseRides?` alias 제거. migration CLI는 이력 보존 | 가역 | ⬜ |

### C1 Gate 통과 기준
| 확인 | 기대 |
|------|------|
| `liveRides.legacyTotal` | (관측값 기록) |
| `liveRides.legacyFreshUnder180s` | **0** — 아니면 트래픽 낮은 시간대 + C2 선행 |
| `liveRides.legacyPublicationIdMissing` | 0 권장 (C2 복사 시 `courseId` 폴백으로 보존됨) |

---

## 3. 트랙 2 — `courseId` 필드 폐기

| # | 단계 | 내용 | 비가역 | 상태 |
|---|------|------|--------|------|
| F1 | **Audit** | `auditTerminologyWithAdminSdk` — `trailsWithCourseIdOnly`·`openTrailListingsWithCourseIdOnly`·`routePublicationsWithCourseIdField` (이미 구현됨) | — | ⬜ |
| F2 | **Backfill** | 결측 있으면 `backfillTrailsPublicationIdCore` 등으로 `publicationId` 채움 → audit 0 | 가역 | ⬜ |
| F3 | **Purge** | `purgePhase7CourseIdFieldsCore` 로 `courseId` 필드 제거 | **비가역** | ⬜ |
| F4 | **Rules** | `trailHasPublicationId` 의 `courseId` 분기 제거(L129-131) → `publicationId` 단일. deploy rules | 가역 | ⬜ |
| F5 | **Client 폴백 제거** | audit 0 확인 후 `resolvePublicationIdFromDoc` 의 `data.courseId` 폴백 삭제 | 가역 | ⬜ |

---

## 4. 순서·롤백

- 두 트랙 병행 가능. 트랙 내부는 순서 엄수.
- 공통 규칙: **읽기/검증을 줄이기 전에 신규 형태 데이터가 audit로 증명**되어야 한다. Rules deploy(C4·F4)는 reader 컷오버(C3)/purge(F3) **이후**.
- 가역 단계: git revert + redeploy 로 즉시 복구. 비가역(C5·F3): audit 0 + 수일 관측이 게이트.

## 5. 검증 체크리스트 (각 deploy 후)

- [ ] audit 카운터 재측정 (트랙별 Gate 기대값)
- [ ] `tsc -b` (web·functions)
- [ ] rules 에뮬레이터 테스트
- [ ] Trailhead 활성 Trail 목록·관전 스모크 ([수동 스모크](260516-수동-스모크-체크리스트.md))

## 6. 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-06-27 | 최초 작성 — 두 트랙 분리, C1 audit 착수 |
