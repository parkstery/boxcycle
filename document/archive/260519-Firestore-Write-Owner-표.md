# Firestore Write Owner 표

| 컬렉션 / 경로 | 클라이언트 write | Cloud Functions write | 비고 |
|---------------|------------------|------------------------|------|
| `openTrailListings/{trailId}` | **임시 허용** (CF 미배포·전환 중) | `openTrailListingProjection`, `openTrailListingsSweep` | CF 배포 후 Rules `write: false`, 클라이언트 upsert 제거 |
| `publicationPresence/{id}` | 금지 | `publicationPresenceCore`, `courseActivityOnLiveCourseRideWritten`, reconcile | 월드 맵 dot 단일 진실 |
| `courseActivity/{courseId}` | 금지 | `courseActivityAggregateCore`, live ride triggers, reconcile | Activity World aggregate |
| `trails/{id}` | 호스트 create/update (Rules) | `trailInstanceLifecycle` | listing 은 CF projection |
| `trails/{id}/members`, `livePublicationRides` | 참가자 (Rules) | `openTrailListingOnLiveCourseRideWritten` 등 | heartbeat 시 listing 재계산(2026-06) |

## 배포 순서 (listing·presence)

1. **Functions** (projection / bump) 배포
2. **Rules** 잠금 (`openTrailListings` client write false)
3. **Hosting** (클라이언트 write 제거 반영)

Rules 를 CF 보다 먼저 잠그면 목록·dot 갱신이 멈춘다.

## openTrailListings 전환 상태 (2026-06)

| 항목 | 상태 |
|------|------|
| CF `recomputeOpenTrailListing` | `riderCount <= 0` → listing **삭제** |
| CF `openTrailListingOnLiveCourseRideWritten` | create/delete **뿐 아니라** 하트비트 update 시 재계산 (2026-06) |
| 클라이언트 `refreshOpenTrailListingFromTrail` | 0명이면 삭제, 호스트만 신규 create |
| 클라이언트 `useOpenTrails` | listing + `livePublicationRides` CG 병합 — CF 미동기화 보완 |
| MENU 표시 | **활성 라이더 1명 이상**만 — [스키마 §3.2.3](260509-Firestore-컬렉션-스키마-초안.md) |
| 배포 | Functions deploy 필요 (`openTrailListingProjection` 변경 반영) |

- 코드: CF projection + 클라이언트 fallback 병행
- 배포: CF `STRIPE_*` 시크릿 해결 후 Functions deploy 필요
