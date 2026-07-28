/**
 * V2 본길이 IK 관절 world export — V2(Blender) 라이더 전용.
 *
 * 우리 IK 관절 world 를 그대로 이식하면 V2 사지 길이(우리와 다름)와 안 맞아 발이
 * 못 닿는다(우리 다리986 vs V2 858mm). 해법: 우리 IK 수학(solveIk3D)에 **V2 본 길이**를
 * 넣어 다시 풀면 V2 다리로 정확히 도달하는 관절 world 가 나온다(발 오차 0mm 확인).
 *
 * 고정점은 자전거가 정하는 절대 위치(pedal, hood)라 라이더 무관. HIP/SHOULDER 만 V2 에
 * 맞춘 위치를 쓴다. 좌표: glTF mm(x전방,y상,+z왼쪽). Blender: g2b(x,y,z)=(x/1000,-z/1000,y/1000).
 *
 * 실행: node scripts/rider-preview/export-ik-joints-v2.mjs <scale> <hipDropMm> [phases...]
 */
import { pedalWorld, hoodOf, SADDLE_CONTACT } from "../../src/lib/riderPrototype/riderRig.geometry.mjs";
import { solveIk3D } from "../../src/lib/riderPrototype/riderIk.mjs";

const argv = process.argv.slice(2);
const SCALE = Number(argv[0] ?? 1.10);
const HIP_DROP = Number(argv[1] ?? 160) / 1000; // 안장 착좌점→고관절 수직 하강(m)
const phaseArg = argv.slice(2).map(Number).filter((x) => !Number.isNaN(x));
const phases = phaseArg.length ? phaseArg : [0, 0.25, 0.5, 0.75];

// ── V2 본 길이(m, 스케일 반영). bone_diag 실측: THIGH430 SHIN350 UPPER312 FORE242 ──
const V2 = {
  thigh: 0.430 * SCALE,
  shin: 0.350 * SCALE,
  upper: 0.312 * SCALE,
  fore: 0.242 * SCALE,
  hipHalfZ: 0.0925 * SCALE, // ±92.5mm
  shoulderHalfZ: 0.205 * SCALE, // CLAVICLE 끝 ±205
};

const crankRadFromPhase = (p) => -p * Math.PI * 2;
const mm = (v) => v.map((x) => +(x * 1000).toFixed(2));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// HIP: 안장 착좌점(SADDLE_CONTACT) 아래 HIP_DROP, 좌우 ±hipHalfZ.
const saddle = SADDLE_CONTACT; // [-0.226, 0.966, 0]
const hipY = saddle[1] - HIP_DROP;
const hipX = saddle[0] + 0.015; // 골반 살짝 앞
const hipOfV2 = (side) => [hipX, hipY, side === "l" ? +V2.hipHalfZ : -V2.hipHalfZ];

// SHOULDER: 전경사 42°로 HIP 에서 몸통 세움. V2 몸통 길이(PELVIS~CHEST 실측 ≈ 0.58*SCALE).
const TORSO_LEN = 0.58 * SCALE;
const TA = (42 * Math.PI) / 180;
const shoulderXY = [hipX + TORSO_LEN * Math.cos(TA), hipY + TORSO_LEN * Math.sin(TA)];
const shoulderOfV2 = (side) => [shoulderXY[0], shoulderXY[1], side === "l" ? +V2.shoulderHalfZ : -V2.shoulderHalfZ];

function legJoint(side, crankRad) {
  const hip = hipOfV2(side);
  const pedal = pedalWorld(side, crankRad);
  const pole = [hip[0] + 0.35, hip[1] - 0.5, hip[2]];
  const ik = solveIk3D(hip, pedal, pole, V2.thigh, V2.shin);
  const foot = [
    ik.joint[0] + ik.boneBDir[0] * V2.shin,
    ik.joint[1] + ik.boneBDir[1] * V2.shin,
    ik.joint[2] + ik.boneBDir[2] * V2.shin,
  ];
  return { hip, pedal, knee: ik.joint, foot, kneeDeg: ik.jointDeg, err: dist(foot, pedal) };
}

function armJoint(side) {
  const shoulder = shoulderOfV2(side);
  const hood = hoodOf(side);
  const pole = [shoulder[0] + 0.12, shoulder[1] - 0.6, shoulder[2] + (side === "l" ? 0.06 : -0.06)];
  const ik = solveIk3D(shoulder, hood, pole, V2.upper, V2.fore);
  const hand = [
    ik.joint[0] + ik.boneBDir[0] * V2.fore,
    ik.joint[1] + ik.boneBDir[1] * V2.fore,
    ik.joint[2] + ik.boneBDir[2] * V2.fore,
  ];
  return { shoulder, hood, elbow: ik.joint, hand, elbowDeg: ik.jointDeg, err: dist(hand, hood) };
}

const out = {
  $note: "V2 본길이 IK 관절 world(mm, glTF x전방/y상/+z왼쪽). Blender: g2b=(x/1000,-z/1000,y/1000).",
  scale: SCALE,
  hipDropMm: HIP_DROP * 1000,
  v2Bones: V2,
  saddleContact: mm(saddle),
  hipL: mm(hipOfV2("l")),
  hipR: mm(hipOfV2("r")),
  shoulderL: mm(shoulderOfV2("l")),
  shoulderR: mm(shoulderOfV2("r")),
  torsoAngleDeg: 42,
  phases: {},
};

let worstFoot = 0, worstHand = 0;
for (const p of phases) {
  const cr = crankRadFromPhase(p);
  const lL = legJoint("l", cr), lR = legJoint("r", cr);
  const aL = armJoint("l"), aR = armJoint("r");
  worstFoot = Math.max(worstFoot, lL.err, lR.err);
  worstHand = Math.max(worstHand, aL.err, aR.err);
  out.phases[p.toFixed(3)] = {
    crankDeg: -p * 360,
    footL: mm(lL.pedal), footR: mm(lR.pedal),
    kneeL: mm(lL.knee), kneeR: mm(lR.knee),
    handL: mm(aL.hood), handR: mm(aR.hood),
    elbowL: mm(aL.elbow), elbowR: mm(aR.elbow),
    kneeDegL: +lL.kneeDeg.toFixed(1), kneeDegR: +lR.kneeDeg.toFixed(1),
    elbowDegL: +aL.elbowDeg.toFixed(1), elbowDegR: +aR.elbowDeg.toFixed(1),
    footErrL: +(lL.err * 1000).toFixed(2), footErrR: +(lR.err * 1000).toFixed(2),
    handErrL: +(aL.err * 1000).toFixed(2), handErrR: +(aR.err * 1000).toFixed(2),
  };
}
out.worstFootErrMm = +(worstFoot * 1000).toFixed(2);
out.worstHandErrMm = +(worstHand * 1000).toFixed(2);

process.stdout.write(JSON.stringify(out, null, 2));
