/**
 * Rider GLB Pedal/Arm Pose (TS 파사드) — 실제 IK 계산은 `riderGlbPedalPose.pose.mjs`(순수 JS).
 * 프리뷰 뷰어(브라우저)·정적 검증(node)이 TS 를 import 할 수 없으므로 계산부는 .mjs 에 두고,
 * 앱 코드는 이 파사드로 타입과 함께 쓴다. IK 의 단일 진실은 .mjs.
 */
// @ts-expect-error — .mjs 순수 모듈(타입 선언 없음).
import * as pose from "./riderGlbPedalPose.pose.mjs";

/** Mapbox model-rotation — [pitch, roll, yaw] degrees */
export type GlbNodeRotationDeg = [number, number, number];

export type RiderGlbPedalPose = {
  crankRotationDeg: number;
  legLRotationDeg: GlbNodeRotationDeg;
  legRRotationDeg: GlbNodeRotationDeg;
  legLShinRotationDeg: GlbNodeRotationDeg;
  legRShinRotationDeg: GlbNodeRotationDeg;
  /** 팔 — 어깨(상완) Z축 회전. Hand@Hood 2-Bone IK 결과. */
  armLRotationDeg: GlbNodeRotationDeg;
  armRRotationDeg: GlbNodeRotationDeg;
  /** 팔 — 팔꿈치(전완) Z축 상대 회전. */
  armLForeRotationDeg: GlbNodeRotationDeg;
  armRForeRotationDeg: GlbNodeRotationDeg;
  /** 상체 스웨이 — 페달 1회전당 좌우 1회 록킹(로컬 X축 롤) */
  torsoRotationDeg: GlbNodeRotationDeg;
};

/** phaseRev 0~1 — 크랭크 → 페달/후드 IK → GLB 노드 회전각 */
export function resolveGlbPedalPose(phaseRev: number): RiderGlbPedalPose {
  return pose.resolveGlbPedalPose(phaseRev) as RiderGlbPedalPose;
}

/** 디버그 — 무릎 내각(도) 좌/우 */
export function sampleKneeAnglesForPhase(phaseRev: number): { left: number; right: number } {
  return pose.sampleKneeAnglesForPhase(phaseRev) as { left: number; right: number };
}

/** 디버그 — 팔꿈치 내각(도) */
export function sampleElbowAngleForPhase(phaseRev: number): number {
  return pose.sampleElbowAngleForPhase(phaseRev) as number;
}

export const RIDER_GLB_LEG_IK = pose.RIDER_GLB_LEG_IK as {
  thighLenM: number;
  shinLenM: number;
  upperArmLenM: number;
  forearmLenM: number;
  crankArmM: number;
  maxLegReachM: number;
  maxArmReachM: number;
};
