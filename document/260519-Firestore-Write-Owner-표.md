# Firestore Write Owner 표

| 컬렉션 / 경로 | 클라이언트 write | Cloud Functions write | 비고 |
|---------------|------------------|------------------------|------|
| `openTrailListings/{trailId}` | **임시 허용** (CF 미배포·전환 중) | `openTrailListingProjection`, `openTrailListingsSweep` | CF 배포 후 Rules `write: false`, 클라이언트 upsert 제거 |
| `publicationPresence/{id}` | 금지 | `publicationPresenceCore`, `courseActivityOnLiveCourseRideWritten`, reconcile | 월드 맵 dot 단일 진실 |
| `courseActivity/{courseId}` | 금지 | `courseActivityAggregateCore`, live ride triggers, reconcile | Activity World aggregate |
| `trails/{id}` | 호스트 create/update (Rules) | `trailInstanceLifecycle` | listing 은 CF projection |
| `trails/{id}/members`, `liveCourseRides` | 참가자 (Rules) | activity·presence bump | heartbeat CF 는 의미 변화만 |

## 배포 순서 (listing·presence)

1. **Functions** (projection / bump) 배포
2. **Rules** 잠금 (`openTrailListings` client write false)
3. **Hosting** (클라이언트 write 제거 반영)

Rules 를 CF 보다 먼저 잠그면 목록·dot 갱신이 멈춘다.

## openTrailListings 전환 상태 (2026-05)

- 코드: CF projection + 클라이언트 fallback 병행 (`02eab51` hotfix)
- 배포: CF `STRIPE_*` 시크릿 해결 후 Functions deploy 필요
