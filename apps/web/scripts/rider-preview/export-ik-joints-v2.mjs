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
// SHIN_REST(4번째 인자, mm): 정강이 rest 길이. 미지정 시 350(실측). 20%↑ 실험 = 420.
const SHIN_REST = (Number(argv[3]) || 350) / 1000;
const phaseArg = argv.slice(4).map(Number).filter((x) => !Number.isNaN(x));
const phases = phaseArg.length ? phaseArg : [0, 0.25, 0.5, 0.75];

// ── V2 본 길이(m, 스케일 반영). Blender 실측(reachscan): 다리858 팔609 몸통(시상)607 ──
const V2 = {
  thigh: 0.430 * SCALE,
  shin: SHIN_REST * SCALE,
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
// F12: 라이더를 BDC 발바닥 기준으로 10° 뒤로 회전 → 몸통각 42° → 52°(사용자 지시).
// ⚠ 이 값은 **joints 가 어깨를 놓는 각도**일 뿐이며, Blender 렌더의 실제 몸통각은
//   `fit_ik.py` 의 스파인 굽힘(LEAN_DEG)이 정한다. 두 층이 다른 방식으로 상체를 만들고
//   fit_ik.py 는 이 shoulder 값을 쓰지 않아 그동안 불일치가 드러나지 않았다
//   (F12 실측: joints 42° vs 렌더 34.66°). 실제 회전은 PELVIS 를 10° 뒤로 눕혀 만든다.
const TA = (52 * Math.PI) / 180;
const shoulderXY = [hipX + TORSO_LEN * Math.cos(TA), hipY + TORSO_LEN * Math.sin(TA)];
const shoulderOfV2 = (side) => [shoulderXY[0], shoulderXY[1], side === "l" ? +V2.shoulderHalfZ : -V2.shoulderHalfZ];

// 발목 ≠ 페달축. 라이딩에서 페달축 위에 오는 것은 **발볼**이고, 발목은 그보다 뒤·위에 있다.
//   발 메시 실측(rest, 발목 기준): 발볼까지 앞 169.8mm, 발바닥까지 아래 75mm.
//   ×SCALE → 앞 149.4mm, 아래 66.0mm. 밑창+클릿 두께 15mm 를 더해 클릿은 발목 아래 81mm.
//   역으로 **발목 = 페달축에서 뒤 149.4mm · 위 81.0mm** → 발 기울기 28.5°(발끝이 아래).
//   ⚠ 수직 성분만 주면(과거 x=0,y=100.5) 발목이 페달축 바로 위에 놓여 **발이 수직으로 곤두선다**.
//     그 상태에서는 발 메시가 x폭 80mm·z높이 252mm 로 서서 렌더에서 다리가 끊긴 것처럼 보인다.
//     scale 에 비례하는 건 발 치수뿐이므로 클릿 두께 15mm 만 상수로 둔다.
// ── F8 메시 실측값(추정 아님). F9 에서 적용 ────────────────────────────────
// 측정: measure-assumptions.py — 라이더 GLB 를 **rest 자세**(pose_position="REST")로 두고
//   FOOT_R 정점(weight>0.5, 432개)에서 직접 실측했다.
//     ANKLE_BACK = 발목(SHIN_R tail) → 발볼 전방 거리
//        발볼 = 전방 x 상위 25% 중 z 하위 25% 의 좌표별 median(단일 정점 노이즈 배제)
//        실측 217.94mm (×0.88 적용값) / rest 247.66mm
//     ANKLE_UP   = 발목 → 발바닥 최하점 수직 22.0mm + 밑창·클릿 15.0mm = 37.0mm
//        ⚠ 15mm 는 여전히 가정이다 — GLB 에 클릿·밑창 메시가 없어 실측 불가.
//        실물 로드 클릿(3~5mm)+밑창(10~12mm) 근거값.
//   구값 149.4 / 81.0 은 근거 없는 가정이었고 F9 에서 폐기했다.
// ── F11: 페달축을 발끝 밑에서 **발 중심** 밑으로 (사용자 확정) ─────────────
// F10-R1 까지의 217.94 는 F8 정의(전방 25% 중 하부 25% median)로 잰 값인데, 실측하면
// 그 지점은 발볼이 아니라 **발끝 바로 뒤**였다 — 페달축이 발길이의 99% 지점에 있었다.
//   rest 발 메시 실측(scale 0.88 후, 발목 기준): 뒤 35.20 ~ 앞 221.25, 길이 256.45
//   발 중심 = (−35.20 + 221.25) / 2 = **발목 앞 93.03mm**  (감리 예측 93.0 과 일치)
// 사용자 지시: "페달은 발끝 아래가 아닌 발 중심부 아래에 놓여야 한다."
// 이 값을 바꾸면 라이더 전체가 +x 로 124.9mm 평행이동한다(HIP_XOFF 로 hip 을 같이 옮긴다).
// ⚠ hip 과 발목이 같은 거리만큼 이동하므로 hip~발목 거리·무릎각은 보존된다.
// ── 접점 = 발 중심 (F11 확정, F14 에서 복원) ────────────────────────────────
//   rest 발 메시 실측(scale 0.88 후, 발목 기준): 뒤 35.20 ~ 앞 221.25, 길이 256.45
//   발 중심 = (−35.20 + 221.25) / 2 = **발목 앞 93.03mm**
// ⚠ F13 에서 신발을 −10% 축소하며 80.20 으로 내렸다가 **F14 에서 전면 취소**했다.
//   발이 짧아지면 발 중심이 발목 쪽으로 당겨져 발목→접점 축이 13.31° → 15.34° 로
//   가팔라지고, 뒤꿈치가 들려 **사용자가 지시하지 않은 신발 각도 변화**가 생긴다.
//   이 값을 다시 내리려면 그 각도 변화까지 함께 결정해야 한다.
const ANKLE_BACK = 0.09303;                   // m, F11 실측(발 중심) — F14 복원값
const ANKLE_UP = 0.037;                       // m, F8 실측(발바닥 22.0 + 클릿 15.0)
function legJoint(side, crankRad) {
  const hip = hipOfV2(side);
  const pedalAxle = pedalWorld(side, crankRad);
  // IK 가 겨냥할 발목 목표 = 페달축에서 뒤·위로 물린 지점.
  const pedal = [pedalAxle[0] - ANKLE_BACK, pedalAxle[1] + ANKLE_UP, pedalAxle[2]];
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
  // err 는 '발목이 발목 목표에 닿았나'(IK 도달). 접점 판정은 렌더로(→ fit_ik.py measure 의 클릿).
  return { hip, pedal: pedalAxle, ankleTarget: pedal, knee: ik.joint, foot, kneeDeg: ik.jointDeg, err: dist(foot, pedal) };
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
  torsoAngleDeg: +((TA * 180) / Math.PI).toFixed(2), // TA 파생 — 하드코딩 금지(F12 에서 42 가 박혀 있었다)
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
    // foot* = **발목** 목표(페달축 위 ANKLE_ABOVE_AXLE). pedalAxle* = 페달축 자체(클릿 목표).
    //   둘을 섞지 말 것 — 발목을 페달축에 맞추면 발 메시가 페달을 관통한다.
    footL: mm(lL.ankleTarget), footR: mm(lR.ankleTarget),
    pedalAxleL: mm(lL.pedal), pedalAxleR: mm(lR.pedal),
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
