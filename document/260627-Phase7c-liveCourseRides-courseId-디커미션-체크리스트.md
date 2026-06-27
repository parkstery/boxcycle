# Phase 7c — `liveCourseRides` 경로·`courseId` 필드 디커미션 체크리스트

| 항목 | 내용 |
|------|------|
| 문서 유형 | **execution** — Phase 7(필드 purge)·7b(코드 rename) 이후 잔여 데이터 결합 폐기 |
| 작성 | 2026-06-27 |
| 상태 | **완료** — 양 트랙 배포·purge 완료(사후 audit courseId 0). F3.1 backfill writer 수정은 deploy functions 권장(현재 무해) |
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
| C1 | **Audit** | `auditTerminologyWithAdminSdk` 에 `liveRides` 섹션 추가. 실행: `npm run admin:audit-terminology` | — | ✅ 완료 — **legacyTotal=0** (§7) |
| C2 | (선택) 데이터 보존 복사 | C1 fresh=0 이면 생략 | 가역 | ⏭️ 생략 (legacyTotal=0) |
| C3 | **읽기 컷오버** | `LIVE_RIDE_SUBCOLLECTIONS` → `[livePublicationRides]` 단일 ([trailPaths.ts](../functions/src/trailPaths.ts)). 영향: `publicationPresenceCore`·`routeActivityScheduledReconcile` | 가역(revert) | ✅ **배포 완료** (2026-06-27) |
| C4 | **Rules 축소** | `liveCourseRides` match 3블록 제거 ([firestore.rules](../firestore.rules)). client 미사용 → 영향 없음 | 가역 | ✅ **배포 완료** (rules compiled·released) |
| C5 | **데이터 삭제** | 레거시 문서 제거 | **비가역** | ⏭️ 불필요 (legacyTotal=0) |
| C6 | **코드 정리** | client `TRAIL_LIVE_COURSE_RIDES_SUBCOLLECTION`(dead)·`worldMapOverlayCore` `liveCourseRides?` alias 제거. functions 상수·migration CLI는 이력 보존 | 가역 | ✅ 완료 |

### C1 Gate (2026-06-27 실측)
| 확인 | 기대 | 실측 |
|------|------|------|
| `liveRides.legacyTotal` | — | **0** |
| `liveRides.legacyFreshUnder180s` | **0** | **0** ✅ → C2·C5 생략, C3·C4 즉시 안전 |
| `liveRides.legacyPublicationIdMissing` | 0 | **0** ✅ |
| `liveRides.publicationTotal` | (참고) | 18 |

---

## 3. 트랙 2 — `courseId` 필드 폐기

| # | 단계 | 내용 | 비가역 | 상태 |
|---|------|------|--------|------|
| F1 | **Audit** | `auditTerminologyWithAdminSdk` (이미 구현됨) | — | ✅ 완료 — `routePublicationsWithCourseIdField=2`, trails/listings courseId-only=0 (§7) |
| F2 | **Backfill** | `trailsWithCourseIdOnly=0`·`openTrailListingsWithCourseIdOnly=0` → trail/listing **불필요**. routePublications 2건은 `courseId == doc.id` 이므로 backfill 불필요 | 가역 | ⏭️ 불필요 |
| F3 | **Purge** | `admin:phase7-terminology-purge` 실행 — routePublications 2건 `courseId` 제거 | **비가역** | ✅ **완료** — `routePublications.courseIdRemoved=2`, 사후 audit `routePublicationsWithCourseIdField=0` (2026-06-27) |
| F3.1 | **재유입 벡터 차단** | backfill payload 의 `courseId` write 제거 ([backfillRoutePublications.ts:106](../functions/src/backfillRoutePublications.ts)·[Core:42](../functions/src/backfillRoutePublicationsCore.ts)). doc.id=publicationId 라 불필요. 현재 `courses` 컬렉션 0건이라 무해하나 latent 부활 위험 차단 | 가역 | ✅ 구현 — **deploy functions 권장** |
| F4 | **Rules** | `trailHasPublicationId` 의 `courseId` 분기 제거 → `publicationId` 단일 ([firestore.rules](../firestore.rules)) | 가역 | ✅ 구현 — **deploy rules 대기** |
| F5 | **Client 폴백 제거** | `resolvePublicationIdFromDoc` 의 `data.courseId` 폴백 삭제 ([resolvePublicationIdFromDoc.ts](../apps/web/src/lib/resolvePublicationIdFromDoc.ts)). trails/listings/liveRides courseId-only=0 → 안전 | 가역 | ✅ 완료 |

> **C6 후속(미용·무위험):** CF export `openTrailListingOnLiveCourseRideWritten` 는 이름만 레거시 — 트리거 경로는 이미 `…/livePublicationRides/{uid}` ([openTrailListingProjection.ts:55](../functions/src/openTrailListingProjection.ts)). rename 시 함수 삭제+생성 재배포 필요 → 별도 처리.

> **별도 데이터 이슈(terminology 무관):** `trailsOpenMissingPublicationId=5` — 공개 Trail 5건이 `publicationId`·`courseId` 둘 다 없음. F3 backfill 도 `publicationIdSet=0` (파생 소스 ID 없음)으로 미해결. 이 5건은 courseId 도 없으므로 **F4 전후 모두 `trailHasPublicationId` 실패**(F4 가 악화시키지 않음). Phase 7c 범위 밖 — 별 이슈로 트래킹(원인: stale 공개 Trail 추정 → 조사·정리 또는 visibility 강등 필요).

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

## 7. Audit baseline (2026-06-27, `boxcycle-dc2df`)

```
collections: trails 175, rides 543, courses 0, routePublications 27,
             routeActivity 25, publicationPresence 23, rooms 0
coursesVsPublications: coursesCollectionRemaining 0,
             routePublicationsWithCourseIdField 2,    ← F3 대상
             trailsWithCourseIdOnly 0, openTrailListingsWithCourseIdOnly 0,
             trailsOpenMissingPublicationId 5          ← 별도 이슈
liveRides:   legacyTotal 0, legacyFreshUnder180s 0,
             legacyPublicationIdMissing 0, legacyCourseIdOnly 0,
             publicationTotal 18                       ← 트랙 1 데이터 0 확정
```

## 8. 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-06-27 | 최초 작성 — 두 트랙 분리, C1 audit 착수 |
| 2026-06-27 | C1 실측(legacyTotal=0) — 트랙 1 C3·C4·C6 구현, C2·C5 생략. 트랙 2 F1 실측(routePublications 2건)·별도 open-trail 5건 이슈 |
| 2026-06-27 | 트랙 1 배포(functions·rules). 트랙 2 F3 purge 적용(routePublications 2건 제거)·F4 구현·F5 완료. F4 rules deploy 잔여 |
| 2026-06-27 | F4 rules deploy 완료(사후 audit courseId 필드 0). F3.1 — backfill payload 의 courseId write 제거(재유입 벡터 차단), deploy functions 권장 |
