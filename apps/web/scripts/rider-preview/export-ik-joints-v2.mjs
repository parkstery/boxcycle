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
const HIP_DROP = Number(argv[1] ?? 166) / 1000; // 안장 966→고관절 하강
const HIP_XOFF = Number(argv[2] ?? 15) / 1000; // 안장 setback 기준 고관절 전방 이동(+x)
const phaseArg = argv.slice(3).map(Number).filter((x) => !Number.isNaN(x));
const phases = phaseArg.length ? phaseArg : [0, 0.25, 0.5, 0.75];

// ── V2 본 길이(m, 스케일 반영). Blender 실측(reachscan): 다리858 팔609 몸통(시상)607 ──
const V2 = {
  thigh: 0.430 * SCALE,
  shin: 0.350 * SCALE,
  upper: 0.312 * SCALE,
  fore: 0.242 * SCALE,
  hipHalfZ: 0.0925 * SCALE, // ±92.5mm (rest THIGH head 좌우)
  shoulderHalfZ: 0.205 * SCALE, // rest UPPER_ARM head 좌우 ±205
  torsoSagittal: 0.5518 * SCALE, // rest 고관절→어깨 시상면 607mm/1.1 (스케일 곱해 복원)
};

const crankRadFromPhase = (p) => -p * Math.PI * 2;
const mm = (v) => v.map((x) => +(x * 1000).toFixed(2));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// HIP: 안장 착좌점(SADDLE_CONTACT) 아래 HIP_DROP, 좌우 ±hipHalfZ.
const saddle = SADDLE_CONTACT; // [-0.226, 0.966, 0]
const hipY = saddle[1] - HIP_DROP;
const hipX = saddle[0] + HIP_XOFF; // 안장 setback 기준 고관절 전방(Hip Hinge 시 어깨 도달 위해)
const hipOfV2 = (side) => [hipX, hipY, side === "l" ? +V2.hipHalfZ : -V2.hipHalfZ];

// SHOULDER: 전경사 42°로 HIP 에서 몸통 세움. V2 실측 시상 몸통(고관절→어깨).
const TORSO_LEN = V2.torsoSagittal;
const TA = (42 * Math.PI) / 180;
const shoulderXY = [hipX + TORSO_LEN * Math.cos(TA), hipY + TORSO_LEN * Math.sin(TA)];
const shoulderOfV2 = (side) => [shoulderXY[0], shoulderXY[1], side === "l" ? +V2.shoulderHalfZ : -V2.shoulderHalfZ];

function legJoint(side, crankRad) {
  const hip = hipOfV2(side);
  const pedal = pedalWorld(side, crankRad);
  // 무릎 pole: 다리평면(hip~pedal 의 z 중간) 앞쪽(+x 진행). z를 다리평면에 두면 무릎이
  //   주행방향과 평행하게 굽는다(옆으로 안 벌어짐). 무릎 z벌어짐 <7mm 확인.
  const midZ = (hip[2] + pedal[2]) / 2;
  const pole = [Math.max(hip[0], pedal[0]) + 0.4, (hip[1] + pedal[1]) / 2, midZ];
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
  // 팔꿈치 pole: 어깨·후드 아래(y 낮게) → 팔꿈치가 아래로 접혀 어깨-팔꿈치-손이 'ㄴ'자.
  //   z는 팔 평면(어깨~후드 중간)에 두어 팔이 옆으로 안 벌어지게.
  const pole = [(shoulder[0] + hood[0]) / 2, Math.min(shoulder[1], hood[1]) - 0.4, (shoulder[2] + hood[2]) / 2];
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
