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
import {
  solveIk3D,
  restToDirRotationDeg,
  childRotationDeg,
  mat3ToMapboxEulerDeg,
  mapboxEulerDegToMat3,
  mat3Mul,
  mat3Transpose,
  _vec,
} from "./riderPrototype/riderIk.mjs";

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

/**
 * 발목 로컬 회전 — **발바닥을 항상 세계 수평으로 유지한다** (F26).
 *
 * ── 왜 ─────────────────────────────────────────────────────────────────────
 * F25 §4-1 실측: 접점 오프셋(`ANKLE_BACK` 93.03 · `ANKLE_UP` 37.0)은 2.8mm·1.3mm 로
 * 이미 맞다. 그런데도 발이 페달에서 따로 논 것은 **발바닥 면의 각도** 때문이었다 —
 * 발이 정강이에 강체로 붙어 있어 정강이가 기울면 발도 통째로 기울었다.
 * F26 에서 `ankle_l`/`ankle_r` 를 별도 노드로 분리했다.
 *
 * ── 유도 ───────────────────────────────────────────────────────────────────
 * `ankle` 은 `leg_*_shin` 의 자식이고 Mapbox 는 회전을 **누적**한다(F21 확정).
 * 라이더 노드는 rest 가 제거돼 순수 translation 이므로(F21) 회전만 곱해진다:
 * ```
 *   global(ankle) = R_leg · R_shin · R_ankle
 * ```
 * 메시는 **분해 시점(phase 0.000)** 의 자세로 구워졌고, 그때 `fit_ik` 가 발을 페달에
 * 맞춰뒀다 — 즉 **phase 0 의 world 자세에서 발바닥이 페달면과 평행**하다.
 * 페달은 이제 항상 수평이므로(F25), 발도 그 자세를 유지하면 된다:
 * ```
 *   목표    global(ankle) = R_leg0 · R_shin0          (0 = phase 0.000)
 *   따라서  R_ankle = (R_leg · R_shin)⁻¹ · (R_leg0 · R_shin0)
 * ```
 * 회전행렬은 직교이므로 역행렬 = 전치다. 조립·분해는 F22 에서 확정한 Mapbox 규약
 * `R = Ry(e[1])·Rz(e[2])·Rx(e[0])` 을 그대로 쓴다.
 *
 * ⚠ 부호를 추측하지 마라 — `verify-rider-pose-gate` 8·9 항이 발바닥 법선과 접지를
 *   수치로 판정한다. 그 게이트가 정오의 기준이다.
 */
/** 밑창 법선(발 로컬) — **F31 부터 (0,−1,0) 로 고정**이다.
 *  분해가 밑창 법선을 로컬 −Y 로 정렬하므로(decompose-v2-rider.py )
 *  좌우 모두 정확히 (0,−1,0) 이다. 예전에는 발이 SHIN 축으로 정렬돼 좌우가 24.00°/8.23°
 *  로 달랐고, 그래서 side 별 실측 상수를 하드코딩해야 했다. 이제 필요 없다. */
const SOLE_NORMAL_LOCAL = [0, -1, 0];

/** 정규직교 기저 [f s n] 을 열로 갖는 회전행렬(행 우선) */
function basisMat(f, s, n) {
  return [
    [f[0], s[0], n[0]],
    [f[1], s[1], n[1]],
    [f[2], s[2], n[2]],
  ];
}
const _n3 = (v) => {
  const L = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / L, v[1] / L, v[2] / L];
};
const _cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const _sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const _dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** 축·각으로 회전행렬 (Rodrigues) */
function axisAngleMat3(axis, ang) {
  const [x, y, z] = _n3(axis);
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

/**
 * 발목 로컬 회전 — **밑창 법선이 세계 +Y** (F27→F28).
 *
 * ⚠ **구속은 하나뿐이다.** F27 은 밑창 법선(+Y)과 발끝(+x)을 **동시에** 고정했는데,
 *   다리가 z 로도 기울어(무릎 안쪽 track) `R_leg·R_shin` 의 yaw 가 위상마다 달라
 *   두 구속이 충돌해 잔차 0~10.5° 가 남았다. **yaw 는 다리를 따라가야 자연스럽다.**
 *
 * ```
 *   R_cur    = R_leg · R_shin              (발목 회전 전 누적)
 *   n_world  = R_cur · n_local             (n_local = 실측 밑창 법선)
 *   R_swing  = n_world → +Y 로 보내는 **측지 최소 회전**(축 = n_world × +Y)
 *   R_ankle  = R_curᵀ · (R_swing · R_cur)
 * ```
 * 최소 회전이라 축 둘레 여분 회전이 없다 → **법선이 전 위상에서 정확히 +Y.**
 */
function ankleRotation(side, crankRad) {
  const cur = legPose(side, crankRad);
  const Rcur = mat3Mul(mapboxEulerDegToMat3(cur.thigh), mapboxEulerDegToMat3(cur.shin));
  // 밑창 "바깥쪽"(지면을 향하는) 법선의 반대 = 위를 향해야 할 방향
  const up = [0, 1, 0]; // = −SOLE_NORMAL_LOCAL (밑창 반대 = 위)
  const nWorld = _n3([
    Rcur[0][0] * up[0] + Rcur[0][1] * up[1] + Rcur[0][2] * up[2],
    Rcur[1][0] * up[0] + Rcur[1][1] * up[1] + Rcur[1][2] * up[2],
    Rcur[2][0] * up[0] + Rcur[2][1] * up[1] + Rcur[2][2] * up[2],
  ]);
  const target = [0, 1, 0];
  const axis = _cross(nWorld, target);
  const sinA = Math.hypot(axis[0], axis[1], axis[2]);
  const cosA = _dot(nWorld, target);
  const Rswing =
    sinA < 1e-9
      ? cosA > 0
        ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        : axisAngleMat3([1, 0, 0], Math.PI) // 정반대 — 임의 수직축 180°
      : axisAngleMat3(axis, Math.atan2(sinA, cosA));
  return mat3ToMapboxEulerDeg(mat3Mul(mat3Transpose(Rcur), mat3Mul(Rswing, Rcur)));
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
  // ⚠ **+90° 는 GLB 크랭크 rest 를 상쇄한다** (F27).
  //   생성기가 `crank.rotation.z = π/2` 로 rest 를 "3시-9시 수평"에 두는데,
  //   Mapbox 는 override 를 **누적**하므로 그 rest 가 살아 있다. 그래서 렌더되는 페달이
  //   앱 IK 가 겨냥하는 `pedalWorld()` 와 **정확히 90° 어긋나 있었다**(8건 전부 244.0mm
  //   = 172.5 × √2 = 크랭크 반경의 90° 현). 발이 "페달을 따라 도는데 위치만 어긋나"
  //   보인 것이 이것이다 — F18 crank 병합 이후 아홉 단계를 그대로 통과했다.
  //
  //   유도: crank world = Rz(90 + θ). GLB pedal_l = (−C·cos θ, BB.y − C·sin θ) 이고
  //         앱 pedalWorld(l) = (C·sin cr, BB.y − C·cos cr) 이므로 **θ = cr + 90°**.
  //         검산: 4위상 × 좌우 8건 전부 0.000mm(게이트 10).
  const crankRotationDeg = -phase * 360 + 90;

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
    // 페달은 스핀들 베어링으로 자유회전해 **항상 수평**이다. `pedal_*` 는 `crank` 의
    // 자식이라 부모 회전을 물려받는데, Mapbox 는 노드 override 를 **누적**하므로
    // (globalMatrix = parent × local × R_override) 부모와 같은 축에 부호만 반대인
    // 회전을 주면 정확히 상쇄된다. crank 는 `[0, 0, crankRotationDeg]` 로 돌므로
    // 페달은 `[0, 0, −crankRotationDeg]` 다. 좌·우 크랭크암은 180° 위상차가 있지만
    // **같은 `crank` 노드 하나가 둘을 함께 돌리므로** 상쇄값도 동일하다.
    // ⚠ **−90 이 crank 노드의 rest 를 상쇄한다** (F29). `−crankRotationDeg` 만으로는
    //   override 만 지워지고 `crank` matrix 의 `Rz(+90°)` rest 가 남아 **판이 서 버린다**:
    //     판 월드 법선 = Rz(90 + crankDeg + pedalDeg) · (0,1,0)   ← 판 로컬 법선 실측값
    //     현행 pedalDeg = −crankDeg → 합계 90° → (−1,0,0) **수직** ✘
    //     수정 pedalDeg = −crankDeg − 90 → 합계 0° → (0,1,0) **수평** ✔
    //   F25 가 "페달면이 지면과 평행"이라 판정한 것은 작은 스크린샷에서의 오독이었고,
    //   게이트 10 은 **위치만** 재고 자세를 안 봤다 → 게이트 11 신설.
    pedalLRotationDeg: [0, 0, -crankRotationDeg - 90],
    pedalRRotationDeg: [0, 0, -crankRotationDeg - 90],
    // 발목 — 발바닥을 세계 수평으로(위 ankleRotation 주석에 유도 과정)
    ankleLRotationDeg: ankleRotation("l", crankRad),
    ankleRRotationDeg: ankleRotation("r", crankRad),
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
