/** Mapbox model-rotation — [pitch, roll, yaw] degrees */
export type GlbNodeRotationDeg = [number, number, number];

export type RiderGlbPedalPose = {
  crankRotationDeg: number;
  legLRotationDeg: GlbNodeRotationDeg;
  legRRotationDeg: GlbNodeRotationDeg;
  legLShinRotationDeg: GlbNodeRotationDeg;
  legRShinRotationDeg: GlbNodeRotationDeg;
};

/** `generate-rider-prototype-glb.mjs` legAssembly() 와 동일 */
const PELVIS: Vec2 = { x: -0.12, y: 0.8 };
const LEG_HIP_OFFSET_Y = -0.06;

const BB: Vec2 = { x: -0.04, y: 0.4 };
const CRANK_ARM_M = 0.14;

const KNEE_LOCAL = { x: 0.03, y: -0.17 };
const FOOT_LOCAL = { x: 0.035, y: -0.15 };
const THIGH_LEN_M = Math.hypot(KNEE_LOCAL.x, KNEE_LOCAL.y);
const SHIN_LEN_M = Math.hypot(FOOT_LOCAL.x, FOOT_LOCAL.y);

const REST_THIGH_DIR = Math.atan2(KNEE_LOCAL.y, KNEE_LOCAL.x);
const REST_SHIN_DIR = Math.atan2(FOOT_LOCAL.y, FOOT_LOCAL.x);
const REST_SHIN_REL = REST_SHIN_DIR - REST_THIGH_DIR;

const KNEE_MIN_DEG = 92;
const KNEE_MAX_DEG = 178;

type Vec2 = { x: number; y: number };

type IkSolution = {
  thighDir: number;
  shinDir: number;
  kneeDeg: number;
  score: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}

function hipWorld(): Vec2 {
  return { x: PELVIS.x, y: PELVIS.y + LEG_HIP_OFFSET_Y };
}

function crankRadFromPhase(phase: number): number {
  return -phase * Math.PI * 2;
}

function pedalWorld(side: "l" | "r", crankRad: number): Vec2 {
  const sign = side === "l" ? -1 : 1;
  return {
    x: BB.x + sign * CRANK_ARM_M * Math.sin(crankRad),
    y: BB.y + sign * CRANK_ARM_M * Math.cos(crankRad),
  };
}

/** TDC 등 hip–페달 거리가 너무 짧을 때 거의 펴진 다리가 되도록 목표 보정 */
function footIkTarget(hip: Vec2, pedal: Vec2): Vec2 {
  const dx = pedal.x - hip.x;
  const dy = pedal.y - hip.y;
  const d = Math.hypot(dx, dy);
  const maxReach = THIGH_LEN_M + SHIN_LEN_M - 0.006;
  const minTarget = maxReach * 0.93;
  if (d >= minTarget) return pedal;
  const scale = minTarget / Math.max(d, 1e-5);
  return { x: hip.x + dx * scale, y: hip.y + dy * scale };
}

function kneeInternalDeg(thighDir: number, shinDir: number): number {
  const between = Math.acos(clamp(Math.cos(thighDir - shinDir), -1, 1));
  return radToDeg(Math.PI - between);
}

function evaluateIkSolution(
  hip: Vec2,
  foot: Vec2,
  thighDir: number,
): IkSolution | null {
  const kneeX = hip.x + THIGH_LEN_M * Math.cos(thighDir);
  const kneeY = hip.y + THIGH_LEN_M * Math.sin(thighDir);
  const shinDir = Math.atan2(foot.y - kneeY, foot.x - kneeX);
  const kneeDeg = kneeInternalDeg(thighDir, shinDir);

  if (kneeDeg < KNEE_MIN_DEG - 2 || kneeDeg > KNEE_MAX_DEG + 1) return null;

  const midFlexBonus = 1 - Math.abs(kneeDeg - 132) / 48;
  const score =
    (kneeX - hip.x) * 5 +
    (hip.y - kneeY) * 1.2 +
    midFlexBonus * 2 +
    (kneeDeg >= KNEE_MIN_DEG && kneeDeg <= KNEE_MAX_DEG ? 3 : 0);

  return { thighDir, shinDir, kneeDeg, score };
}

/** 2-bone IK — 페달(발) 목표에서 허벅지·정강이 Z 회전(무릎 90~178°) */
function solveLegIk(hip: Vec2, foot: Vec2): { thighZ: number; shinZ: number; kneeDeg: number } {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  let d = Math.hypot(dx, dy);
  const minD = Math.abs(THIGH_LEN_M - SHIN_LEN_M) + 0.002;
  const maxD = THIGH_LEN_M + SHIN_LEN_M - 0.002;
  d = clamp(d, minD, maxD);

  const toFoot = Math.atan2(dy, dx);
  const cosHip = (THIGH_LEN_M * THIGH_LEN_M + d * d - SHIN_LEN_M * SHIN_LEN_M) / (2 * THIGH_LEN_M * d);
  const hipOffset = Math.acos(clamp(cosHip, -1, 1));

  const candidates = [toFoot + hipOffset, toFoot - hipOffset];
  let best: IkSolution | null = null;
  for (const thighDir of candidates) {
    const sol = evaluateIkSolution(hip, foot, thighDir);
    if (!sol) continue;
    if (!best || sol.score > best.score) best = sol;
  }

  if (!best) {
    const thighDir = toFoot + hipOffset;
    const kneeX = hip.x + THIGH_LEN_M * Math.cos(thighDir);
    const kneeY = hip.y + THIGH_LEN_M * Math.sin(thighDir);
    const shinDir = Math.atan2(foot.y - kneeY, foot.x - kneeX);
    const kneeDeg = kneeInternalDeg(thighDir, shinDir);
    const thighZ = radToDeg(thighDir - REST_THIGH_DIR);
    const shinZ = radToDeg(shinDir - thighDir - REST_SHIN_REL);
    return { thighZ, shinZ, kneeDeg };
  }

  const thighZ = radToDeg(best.thighDir - REST_THIGH_DIR);
  const shinZ = radToDeg(best.shinDir - best.thighDir - REST_SHIN_REL);
  return { thighZ, shinZ, kneeDeg: best.kneeDeg };
}

function legPose(side: "l" | "r", crankRad: number): { thighZ: number; shinZ: number } {
  const hip = hipWorld();
  const foot = footIkTarget(hip, pedalWorld(side, crankRad));
  const ik = solveLegIk(hip, foot);
  return { thighZ: ik.thighZ, shinZ: ik.shinZ };
}

/** phaseRev 0~1 — 크랭크 → 페달 IK → 허벅지·정강이(상대각) */
export function resolveGlbPedalPose(phaseRev: number): RiderGlbPedalPose {
  const phase = ((phaseRev % 1) + 1) % 1;
  const crankRad = crankRadFromPhase(phase);
  const crankRotationDeg = -phase * 360;

  const left = legPose("l", crankRad);
  const right = legPose("r", crankRad);

  return {
    crankRotationDeg,
    legLRotationDeg: [0, 0, left.thighZ],
    legRRotationDeg: [0, 0, right.thighZ],
    legLShinRotationDeg: [0, 0, left.shinZ],
    legRShinRotationDeg: [0, 0, right.shinZ],
  };
}

/** 디버그 — 무릎 내각(도) */
export function sampleKneeAnglesForPhase(phaseRev: number): { left: number; right: number } {
  const phase = ((phaseRev % 1) + 1) % 1;
  const crankRad = crankRadFromPhase(phase);
  const hip = hipWorld();
  return {
    left: solveLegIk(hip, footIkTarget(hip, pedalWorld("l", crankRad))).kneeDeg,
    right: solveLegIk(hip, footIkTarget(hip, pedalWorld("r", crankRad))).kneeDeg,
  };
}

export const RIDER_GLB_LEG_IK = {
  thighLenM: THIGH_LEN_M,
  shinLenM: SHIN_LEN_M,
  crankArmM: CRANK_ARM_M,
} as const;
