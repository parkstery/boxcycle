/**
 * Rider GLB Pose — 3D 2-Bone IK + Pole Vector 로 다리·팔 관절 회전 계산 (순수 JS).
 * TS 파사드·프리뷰 뷰어·정적 검증이 모두 이 모듈을 import 해 **동일 IK**를 쓴다.
 *
 * ⚠ 절대 원칙: Bone 회전을 하드코딩하지 않는다. 고정점(Foot@Pedal, Hand@Hood)과 pole
 *   (elbow/knee 방향)을 riderRig(geometry.json 파생)에서 세우고, 3D IK 가 관절각을 계산한다.
 *
 * ── 현 단계: Static Fit (crank 0°, bob/sway OFF) ──
 *   Base Pose 승인 전엔 pelvis bob·shoulder sway·torso sway 를 넣지 않는다. Solver root 는
 *   GLB node root 와 반드시 동일(HIP_L/R, SHOULDER_L/R 고정) — 그래야 수학과 렌더가 일치한다.
 */
import {
  hipOf,
  shoulderOf,
  hoodOf,
  pedalWorld,
  THIGH_LEN,
  SHIN_LEN,
  UPPER_ARM_LEN,
  FOREARM_LEN,
  CRANK_ARM_M,
  PELVIS_HALF_Z,
  SHOULDER_HALF_Z,
} from "./riderPrototype/riderRig.geometry.mjs";
import { solveIk3D, restToDirRotationDeg, childRotationDeg, _vec } from "./riderPrototype/riderIk.mjs";

const { add, scale } = _vec;

const crankRadFromPhase = (phase) => -phase * Math.PI * 2;

/**
 * 다리 pole — 무릎이 향할 방향점. hip 아래·전방(+x), 좌우 pedal plane 을 따라(같은 z).
 * 반대쪽 다리와 겹치지 않도록 각자 자기 z 를 유지.
 */
function kneePole(side, hip) {
  const zSign = side === "l" ? +1 : -1;
  return [hip[0] + 0.35, hip[1] - 0.5, hip[2] + 0.02 * zSign];
}

/**
 * 팔 pole — 팔꿈치가 향할 방향점. shoulder 아래·약간 바깥. 몸통 안쪽으로 들어가지
 * 않게 바깥(z) 유지하되, 과하면 "닭날개"처럼 튄다 — 순항은 팔꿈치가 살짝만 바깥.
 * LEFT→+z, RIGHT→-z. (아래로 크게, 바깥으론 조금)
 */
function elbowPole(side, shoulder) {
  const zSign = side === "l" ? +1 : -1;
  return [shoulder[0] + 0.12, shoulder[1] - 0.6, shoulder[2] + 0.06 * zSign];
}

/** 한쪽 다리 IK → { thigh:rotDeg[3], shin:rotDeg[3], kneeDeg, footErr, knee } */
function legPose(side, crankRad) {
  const hip = hipOf(side);
  const pedal = pedalWorld(side, crankRad);
  const pole = kneePole(side, hip);
  const ik = solveIk3D(hip, pedal, pole, THIGH_LEN, SHIN_LEN);
  const thigh = restToDirRotationDeg(ik.boneADir);
  const shin = childRotationDeg(ik.boneADir, ik.boneBDir);
  // 순정기구학 발끝 = joint + boneBDir*SHIN_LEN (검증용)
  const foot = add(ik.joint, scale(ik.boneBDir, SHIN_LEN));
  return { thigh, shin, kneeDeg: ik.jointDeg, knee: ik.joint, foot, pedal };
}

/** 한쪽 팔 IK → { upper:rotDeg[3], fore:rotDeg[3], elbowDeg, handErr, elbow } */
function armPose(side) {
  const shoulder = shoulderOf(side);
  const hood = hoodOf(side);
  const pole = elbowPole(side, shoulder);
  const ik = solveIk3D(shoulder, hood, pole, UPPER_ARM_LEN, FOREARM_LEN);
  const upper = restToDirRotationDeg(ik.boneADir);
  const fore = childRotationDeg(ik.boneADir, ik.boneBDir);
  const hand = add(ik.joint, scale(ik.boneBDir, FOREARM_LEN));
  return { upper, fore, elbowDeg: ik.jointDeg, elbow: ik.joint, hand, hood };
}

/** phaseRev 0~1 — 크랭크 위상 → 3D IK → GLB 노드 회전각. Static Fit: 팔은 위상 무관. */
export function resolveGlbPedalPose(phaseRev) {
  const phase = ((phaseRev % 1) + 1) % 1;
  const crankRad = crankRadFromPhase(phase);
  const crankRotationDeg = -phase * 360;

  const legL = legPose("l", crankRad);
  const legR = legPose("r", crankRad);
  const armL = armPose("l");
  const armR = armPose("r");

  return {
    crankRotationDeg,
    legLRotationDeg: legL.thigh,
    legRRotationDeg: legR.thigh,
    legLShinRotationDeg: legL.shin,
    legRShinRotationDeg: legR.shin,
    armLRotationDeg: armL.upper,
    armRRotationDeg: armR.upper,
    armLForeRotationDeg: armL.fore,
    armRForeRotationDeg: armR.fore,
    // Static Fit: torso sway OFF.
    torsoRotationDeg: [0, 0, 0],
  };
}

/** 검증용 — 한 위상의 상세 계측(발/손 오차, 관절각, joint 위치). */
export function sampleRiderMetrics(phaseRev) {
  const phase = ((phaseRev % 1) + 1) % 1;
  const crankRad = crankRadFromPhase(phase);
  const legL = legPose("l", crankRad);
  const legR = legPose("r", crankRad);
  const armL = armPose("l");
  const armR = armPose("r");
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return {
    footErrL: dist(legL.foot, legL.pedal),
    footErrR: dist(legR.foot, legR.pedal),
    handErrL: dist(armL.hand, armL.hood),
    handErrR: dist(armR.hand, armR.hood),
    kneeDegL: legL.kneeDeg,
    kneeDegR: legR.kneeDeg,
    elbowDegL: armL.elbowDeg,
    elbowDegR: armR.elbowDeg,
    kneeL: legL.knee,
    kneeR: legR.knee,
    elbowL: armL.elbow,
    elbowR: armR.elbow,
  };
}

/** 하위호환 — 무릎 내각(도) */
export function sampleKneeAnglesForPhase(phaseRev) {
  const m = sampleRiderMetrics(phaseRev);
  return { left: m.kneeDegL, right: m.kneeDegR };
}
/** 하위호환 — 팔꿈치 내각(도) */
export function sampleElbowAngleForPhase(phaseRev) {
  return sampleRiderMetrics(phaseRev).elbowDegL;
}

export const RIDER_GLB_LEG_IK = {
  thighLenM: THIGH_LEN,
  shinLenM: SHIN_LEN,
  upperArmLenM: UPPER_ARM_LEN,
  forearmLenM: FOREARM_LEN,
  crankArmM: CRANK_ARM_M,
  pelvisHalfZ: PELVIS_HALF_Z,
  shoulderHalfZ: SHOULDER_HALF_Z,
  maxLegReachM: THIGH_LEN + SHIN_LEN,
  maxArmReachM: UPPER_ARM_LEN + FOREARM_LEN,
};
