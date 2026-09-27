/**
 * `TrailLiveRideSink` 의 Firestore 구현 — **Trail 도메인이 제공한다** (Phase 5 D6).
 *
 * 전송 계층(`peerMotion`)은 이 계약만 알고 Trail 저장소를 모른다.
 * 조립은 주행(`publishLiveLocationFanout`)이 한다.
 */
import type { User } from "firebase/auth";
import type { TrailLiveRideSink } from "../peerMotion/trailLiveRidePort";
import { touchTrailInstanceActivity } from "./repo/firestoreTrailInstance";
import {
  deleteTrailLivePublicationRide,
  mergeTrailLivePublicationRideSnapshot,
  type TrailLivePublicationRideSnapshotInput,
} from "./repo/firestoreTrailLivePublicationRides";

export const firestoreTrailLiveRideSink: TrailLiveRideSink = {
  publish: (user, trailId, input) =>
    mergeTrailLivePublicationRideSnapshot(user, trailId, input),
  // 사유는 Trail 의 어휘다 — 구현이 채운다.
  touchActivity: (trailId) => touchTrailInstanceActivity(trailId, "routePublish"),
};

/*
 * ── 주행(ride)에게 여는 좁은 창구 ────────────────────────────────────────────────
 *
 * 2026-09-26 (Phase 6-③): 주행의 「합류 버스트」와 「정리」가 Trail **저장소 함수를
 * 직접** 불렀다. 남의 저장소를 직접 찌르면 Trail 이 저장 방식을 바꿀 때 주행이 깨지고,
 * Trail 은 자기 데이터에 무엇이 일어나는지 통제하지 못한다(D1·repoAccess).
 *
 * 여기 있는 셋이 **주행이 Trail 에 할 수 있는 일의 전부**다. Trail 이 소유하고,
 * 늘릴지 말지도 Trail 이 정한다. 사유(`joinBurst`) 같은 Trail 의 어휘는 여기서 채운다 —
 * 주행이 알 이유가 없고, 종전 계측 값도 그대로 유지된다.
 */

/** 합류 직후 1회 — 이 주행의 진행을 Trail 라이브 주행 문서에 올린다 */
export function mergeRideLiveProgress(
  user: User,
  trailId: string,
  input: TrailLivePublicationRideSnapshotInput,
): Promise<void> {
  return mergeTrailLivePublicationRideSnapshot(user, trailId, input);
}

/** 합류로 인한 Trail 활동 갱신. 사유는 Trail 의 어휘라 여기서 채운다 */
export function touchTrailActivityForRideJoin(trailId: string): Promise<void> {
  return touchTrailInstanceActivity(trailId, "joinBurst");
}

/** 주행이 끝났을 때 이 사용자의 라이브 주행 행을 치운다 */
export function deleteRideLiveRow(uid: string, trailId: string): Promise<void> {
  return deleteTrailLivePublicationRide(uid, trailId);
}
