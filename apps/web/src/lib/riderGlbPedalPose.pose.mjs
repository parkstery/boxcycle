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
  ankleTargetWorld,
  THIGH_LEN,
  SHIN_LEN,
  UPPER_ARM_LEN,
  FOREARM_LEN,
  CRANK_ARM_M,
  PELVIS_HALF_Z,
  SHOULDER_HALF_Z,
  TORSO_ROTATION_DEG,
} from "./riderPrototype/riderRig.geometry.mjs";
import { solveIk3D, restToDirRotationDeg, childRotationDeg, _vec } from "./riderPrototype/riderIk.mjs";

const { add, scale } = _vec;

const crankRadFromPhase = (phase) => -phase * Math.PI * 2;

/**
 * 다리 pole — 무릎이 향할 방향점. hip 아래·전방(+x), 좌우로는 **안쪽**(−zSign).
 *
 * ⚠ 무릎은 고관절–발목선보다 **안쪽**으로 track 한다(인체 가동범위).
 *   **바깥으로 꺾이면 해부학적으로 불가능한 자세**이고, 정면·후방 렌더에서 즉시 보인다.
 *   F22 까지 `+0.02`(바깥)이라 무릎이 고관절보다 최대 74.8mm 바깥으로 끌렸다 —
 *   `HIP_L.z 81.4` · 페달 `z 74.0` 인데 pole 이 `101.4` 였으니 발보다도 바깥이다.
 *   부호만 뒤집으면 4위상 전부 고관절 안쪽으로 들어온다(최대 −8.3mm). 크기는 유지한다.
 */
function kneePole(side, hip) {
  const zSign = side === "l" ? +1 : -1;
  return [hip[0] + 0.35, hip[1] - 0.5, hip[2] - 0.02 * zSign];
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

/** ⚠ **검증 하네스 전용 export.** 게이트는 pole 을 재현하지 말고 **이것을 import** 하라 —
 *  복제하면 pose 와 게이트가 갈라져 **거짓 PASS** 를 준다. F22 교훈("계측이 보는 장면과
 *  렌더가 보는 장면이 다르다")이 검증 코드에서 그대로 재발한다.
 *  `verify-rider-pose-gate.mjs` 가 이 값을 쓴다. */
export const _poles = { kneePole, elbowPole };

/** 한쪽 다리 IK → { thigh:rotDeg[3], shin:rotDeg[3], kneeDeg, footErr, knee } */
function legPose(side, crankRad) {
  const hip = hipOf(side);
  // ⚠ **페달축이 아니라 발목**을 겨냥한다(F18). V2 라이더는 정강이 끝이 발목이고
  //   발이 별도 세그먼트로 붙는다. 페달축을 직접 겨냥하면 hip→페달축 768.5mm 가
  //   다리합 730.4mm 를 넘어 **다리가 물리적으로 안 닿는다.**
  const pedal = ankleTargetWorld(side, crankRad);
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
    // Static Fit: torso sway OFF. 값은 riderRig 의 상수(라이더 전체 회전 보정).
    torsoRotationDeg: [...TORSO_ROTATION_DEG],
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
