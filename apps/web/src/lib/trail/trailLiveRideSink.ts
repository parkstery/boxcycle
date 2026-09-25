/**
 * `TrailLiveRideSink` 의 Firestore 구현 — **Trail 도메인이 제공한다** (Phase 5 D6).
 *
 * 전송 계층(`peerMotion`)은 이 계약만 알고 Trail 저장소를 모른다.
 * 조립은 주행(`publishLiveLocationFanout`)이 한다.
 */
import type { TrailLiveRideSink } from "../peerMotion/trailLiveRidePort";
import { touchTrailInstanceActivity } from "./repo/firestoreTrailInstance";
import { mergeTrailLivePublicationRideSnapshot } from "./repo/firestoreTrailLivePublicationRides";

export const firestoreTrailLiveRideSink: TrailLiveRideSink = {
  publish: (user, trailId, input) =>
    mergeTrailLivePublicationRideSnapshot(user, trailId, input),
  // 사유는 Trail 의 어휘다 — 구현이 채운다.
  touchActivity: (trailId) => touchTrailInstanceActivity(trailId, "routePublish"),
};
