/**
 * IK 관절 world 좌표 export — V2(Blender) 본 피팅용 브릿지.
 *
 * 검증된 RTW 3D IK(sampleRiderMetrics, 발/손 0.0mm)가 계산한 관절 world 위치를
 * crank 위상별로 JSON 출력한다. Blender fit 스크립트가 이를 읽어 V2 본의 IK
 * target·pole 로 공급 → Blender solver 가 우리 해를 재현(내장 IK 219mm 오차 회피).
 *
 * 좌표계: RTW IK = glTF 규약(mm, x전방, y상, +z 왼쪽). Blender 변환은 소비 측에서
 *   g2b(gx,gy,gz)=(gx/1000, -gz/1000, gy/1000) 로 수행(fit_place 와 동일).
 *
 * 실행: node scripts/rider-preview/export-ik-joints.mjs [phases...]
 */
import {
  RIDER_RIG,
  pedalWorld,
  hoodOf,
  hipOf,
  shoulderOf,
} from "../../src/lib/riderPrototype/riderRig.geometry.mjs";
import { sampleRiderMetrics } from "../../src/lib/riderGlbPedalPose.pose.mjs";

const crankRadFromPhase = (phase) => -phase * Math.PI * 2;
const mm = (v) => v.map((x) => +(x * 1000).toFixed(2));

const phasesArg = process.argv.slice(2).map(Number).filter((x) => !Number.isNaN(x));
const phases = phasesArg.length ? phasesArg : [0, 0.25, 0.5, 0.75];

const out = {
  $note: "RTW IK 관절 world (mm, glTF 규약 x전방/y상/+z왼쪽). Blender: g2b(x,y,z)=(x/1000,-z/1000,y/1000).",
  anchors: {
    BB: mm(RIDER_RIG.BB),
    SADDLE_CONTACT: mm(RIDER_RIG.SADDLE_CONTACT),
    PELVIS_ROOT: mm(RIDER_RIG.PELVIS_ROOT),
    HIP_L: mm(hipOf("l")),
    HIP_R: mm(hipOf("r")),
    SHOULDER_L: mm(shoulderOf("l")),
    SHOULDER_R: mm(shoulderOf("r")),
    HOOD_L: mm(hoodOf("l")),
    HOOD_R: mm(hoodOf("r")),
    HEAD_C: mm(RIDER_RIG.HEAD_C.length === 3 ? RIDER_RIG.HEAD_C : [...RIDER_RIG.HEAD_C, 0]),
  },
  boneLengths: {
    thigh: RIDER_RIG.THIGH_LEN,
    shin: RIDER_RIG.SHIN_LEN,
    upperArm: RIDER_RIG.UPPER_ARM_LEN,
    forearm: RIDER_RIG.FOREARM_LEN,
  },
  torsoAngleDeg: RIDER_RIG.TORSO_ANGLE_DEG,
  phases: {},
};

for (const p of phases) {
  const crankRad = crankRadFromPhase(p);
  const m = sampleRiderMetrics(p);
  out.phases[p.toFixed(3)] = {
    crankDeg: -p * 360,
    footL: mm(pedalWorld("l", crankRad)),
    footR: mm(pedalWorld("r", crankRad)),
    kneeL: mm(m.kneeL),
    kneeR: mm(m.kneeR),
    handL: mm(hoodOf("l")),
    handR: mm(hoodOf("r")),
    elbowL: mm(m.elbowL),
    elbowR: mm(m.elbowR),
    kneeDegL: +m.kneeDegL.toFixed(1),
    kneeDegR: +m.kneeDegR.toFixed(1),
    elbowDegL: +m.elbowDegL.toFixed(1),
    elbowDegR: +m.elbowDegR.toFixed(1),
    footErrL: +(m.footErrL * 1000).toFixed(2),
    footErrR: +(m.footErrR * 1000).toFixed(2),
    handErrL: +(m.handErrL * 1000).toFixed(2),
    handErrR: +(m.handErrR * 1000).toFixed(2),
  };
}

process.stdout.write(JSON.stringify(out, null, 2));
