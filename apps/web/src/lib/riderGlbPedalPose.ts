/** Mapbox model-rotation — [pitch, roll, yaw] degrees */
export type GlbNodeRotationDeg = [number, number, number];

export type RiderGlbPedalPose = {
  crankRotationDeg: number;
  legLRotationDeg: GlbNodeRotationDeg;
  legRRotationDeg: GlbNodeRotationDeg;
  legLShinRotationDeg: GlbNodeRotationDeg;
  legRShinRotationDeg: GlbNodeRotationDeg;
};

/**
 * `generate-rider-prototype-glb.mjs` legAssembly() 와 동기.
 * 좌표: +X 전진, +Y 위. hip→knee→발바닥(페달 접촉점) 2D IK.
 */
const PELVIS: Vec2 = { x: -0.12, y: 0.8 };
const LEG_HIP_OFFSET = { x: 0.02, y: -0.08 };

const BB: Vec2 = { x: -0.04, y: 0.4 };
const CRANK_ARM_M = 0.14;

/** 허벅지 끝(무릎 pivot) — leg 로컬 */
const KNEE_LOCAL = { x: 0.05, y: -0.26 };
/** 무릎→발바닥(페달 접촉) — shin 로컬, `ankle` + pad */
const FOOT_FROM_KNEE = { x: 0.065, y: -0.234 };

const THIGH_LEN_M = Math.hypot(KNEE_LOCAL.x, KNEE_LOCAL.y);
const SHIN_LEN_M = Math.hypot(FOOT_FROM_KNEE.x, FOOT_FROM_KNEE.y);

const REST_THIGH_DIR = Math.atan2(KNEE_LOCAL.y, KNEE_LOCAL.x);
const REST_SHIN_REL =
  Math.atan2(FOOT_FROM_KNEE.y, FOOT_FROM_KNEE.x) - REST_THIGH_DIR;

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

function hipWorld(crankRad: number): Vec2 {
  /** 실제 주행처럼 골반 소폭 상하·전후 — TDC에서 hip↔페달 거리 확보 */
  const bobY = 0.032 * Math.sin(crankRad);
  const bobX = 0.014 * Math.cos(crankRad);
  return {
    x: PELVIS.x + LEG_HIP_OFFSET.x + bobX,
    y: PELVIS.y + LEG_HIP_OFFSET.y + bobY,
  };
}

function crankRadFromPhase(phase: number): number {
  return -phase * Math.PI * 2;
}

/**
 * 크랭크 Z축 회전(θ) 시 팔 끝 — THREE/Mapbox right-hand rule.
 * +Y arm(오른발): (-R·sin θ, R·cos θ), -Y arm(왼발): (R·sin θ, -R·cos θ)
 */
function pedalWorld(side: "l" | "r", crankRad: number): Vec2 {
  const s = Math.sin(crankRad);
  const c = Math.cos(crankRad);
  if (side === "r") {
    return { x: BB.x - CRANK_ARM_M * s, y: BB.y + CRANK_ARM_M * c };
  }
  return { x: BB.x + CRANK_ARM_M * s, y: BB.y - CRANK_ARM_M * c };
}

function kneeInternalDeg(thighDir: number, shinDir: number): number {
  const between = Math.acos(clamp(Math.cos(thighDir - shinDir), -1, 1));
  return radToDeg(Math.PI - between);
}

function evaluateIkSolution(hip: Vec2, pedal: Vec2, thighDir: number): IkSolution {
  const kneeX = hip.x + THIGH_LEN_M * Math.cos(thighDir);
  const kneeY = hip.y + THIGH_LEN_M * Math.sin(thighDir);
  const shinDir = Math.atan2(pedal.y - kneeY, pedal.x - kneeX);
  const kneeDeg = kneeInternalDeg(thighDir, shinDir);

  const kneeForward = kneeX - hip.x;
  const kneeBelow = hip.y - kneeY;
  const flexMid = 1 - Math.abs(kneeDeg - 128) / 52;
  const flexPenalty =
    kneeDeg < 88 ? (88 - kneeDeg) * 0.15 : kneeDeg > 176 ? (kneeDeg - 176) * 0.2 : 0;

  const score = kneeForward * 6 + kneeBelow * 1.5 + flexMid * 2 - flexPenalty;

  return { thighDir, shinDir, kneeDeg, score };
}

/** 2-bone IK — 발바닥을 페달 좌표에 고정 */
function solveLegIk(hip: Vec2, pedal: Vec2): { thighZ: number; shinZ: number; kneeDeg: number } {
  const dx = pedal.x - hip.x;
  const dy = pedal.y - hip.y;
  const d = Math.hypot(dx, dy);
  const maxReach = THIGH_LEN_M + SHIN_LEN_M - 0.004;

  const toPedal = Math.atan2(dy, dx);
  const cosHip =
    d >= maxReach
      ? -1
      : (THIGH_LEN_M * THIGH_LEN_M + d * d - SHIN_LEN_M * SHIN_LEN_M) / (2 * THIGH_LEN_M * d);
  const hipOffset = Math.acos(clamp(cosHip, -1, 1));

  const candidates = [toPedal + hipOffset, toPedal - hipOffset];
  let best = evaluateIkSolution(hip, pedal, candidates[0]);
  for (let i = 1; i < candidates.length; i += 1) {
    const sol = evaluateIkSolution(hip, pedal, candidates[i]);
    if (sol.score > best.score) best = sol;
  }

  const thighZ = radToDeg(best.thighDir - REST_THIGH_DIR);
  const shinZ = radToDeg(best.shinDir - best.thighDir - REST_SHIN_REL);
  return { thighZ, shinZ, kneeDeg: best.kneeDeg };
}

function legPose(side: "l" | "r", crankRad: number): { thighZ: number; shinZ: number } {
  const hip = hipWorld(crankRad);
  const ik = solveLegIk(hip, pedalWorld(side, crankRad));
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
  const hip = hipWorld(crankRad);
  return {
    left: solveLegIk(hip, pedalWorld("l", crankRad)).kneeDeg,
    right: solveLegIk(hip, pedalWorld("r", crankRad)).kneeDeg,
  };
}

export const RIDER_GLB_LEG_IK = {
  thighLenM: THIGH_LEN_M,
  shinLenM: SHIN_LEN_M,
  crankArmM: CRANK_ARM_M,
  maxReachM: THIGH_LEN_M + SHIN_LEN_M,
} as const;
