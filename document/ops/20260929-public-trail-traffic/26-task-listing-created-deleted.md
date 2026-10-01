# TASK-26 — listing triggers Created/Deleted

Owner: Developer (Supervisor). Scope: `functions/src/openTrailListingProjection.ts`, `.test.ts`, `functions/src/index.ts` exports, ops docs in this folder. No apps/web HUD, functional E2E, deploy, merge.

Goal: members·livePublicationRides listing CF 는 `onDocumentWritten` 대신 `onDocumentCreated` + `onDocumentDeleted` — update 시 CF invocation 0. Trail `onDocumentWritten`, `runRecompute` default guard, error swallow, immediate create/delete semantics 유지.

Deployment hazard: 배포 승인 시 **레거시** `openTrailListingOnMemberWritten`, `openTrailListingOnLiveCourseRideWritten` 를 Firebase 에서 **명시 삭제**해야 이중 트리거·잔존 Written 호출이 없다.
