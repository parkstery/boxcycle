/**
 * Rider Rig — geometry.json(SSoT) → 라이딩 IK 앵커·뼈길이 파생 (순수 JS, 3D).
 *
 * ⚠ 이 파일이 Rider IK 의 유일한 진실이다. TS(riderRig.ts)·gen 스크립트·프리뷰 뷰어가 모두
 *   이 모듈을 import 해 **동일 파생값**을 쓴다. → geometry.json 을 바꾸면 자세가 자동 재계산.
 *
 * 좌표계: m, 지면 y=0, +x 진행(동), +z = 왼쪽(라이더 왼쪽), -z = 오른쪽. 바퀴 축 = z.
 *
 * ── 자세 원칙(승인 스펙) ──────────────────────────────────────────────────
 *  1. Saddle ≠ Pelvis: SADDLE_CONTACT(엉덩이 접촉) → PELVIS_ROOT(그보다 위 골반중심)
 *     → HIP_L/HIP_R(좌우로 벌어진 실제 고관절 pivot). 셋을 구분한다.
 *  2. z=0 중앙평면 금지: 팔·다리 좌우 앵커는 실제 3D 폭(shoulder/pelvis half-width,
 *     handlebar width, Q-factor)에서 온다.
 *  3. Torso 먼저: PELVIS_ROOT 에서 전경사 42°로 SHOULDER 를 세운다. Shoulder→Hood 거리에
 *     맞춰 Shoulder 를 억지로 옮기지 않는다(팔 IK 가 도달). 도달 불가면 bone/geometry 검증.
 */
import geometry from "./geometry.json" with { type: "json" };

const BB_HEIGHT_MM = geometry.bbHeight; // 270.5 — 지면에서 BB까지
const toM = (mm) => mm / 1000;
const yM = (mm) => (mm + BB_HEIGHT_MM) / 1000;
const coordM = (key) => {
  const c = geometry.coords[key];
  return [toM(c[0]), yM(c[1])];
};
/** 시트튜브 축 각도(deg, 수평 기준 후상방) — geometry.json SSoT */
export const SEAT_TUBE_ANGLE_DEG = geometry.seatTubeAngle;
/** 시트튜브 길이(mm, BB→시트튜브 상단=안장 클램프) — geometry.json SSoT */
export const SEAT_TUBE_LENGTH_MM = geometry.seatTubeLength;

// ── 자전거 고정 앵커 (geometry.json 파생) ────────────────────────────────
/** 크랭크축(페달 회전 중심), z=0 */
export const BB = [...coordM("bb"), 0]; // [0, 0.2705, 0]
export const SEAT_TOP = coordM("seatTop");
export const HEAD_TOP = coordM("headTop");
export const HEAD_BOT = coordM("headBot");
/** 크랭크암 길이(m) — 페달 원 반경 */
export const CRANK_ARM_M = toM(geometry.crankLength); // 0.1725
/** 페달 좌우 오프셋(Q-factor/2) — 왼발 +z, 오른발 -z */
export const PEDAL_HALF_Z = toM(geometry.pedalOffset); // 0.074
/** BB 스핀들 반폭 — 크랭크암이 BB 밖으로 드러나 시작하는 z. 크랭크 간 거리의 근본. */
export const BB_SPINDLE_HALF = toM(geometry.bbSpindleHalf ?? geometry.pedalOffset); // 0.058
/** 페달축 오프셋 — 크랭크 끝 → 페달(부수적). BB_SPINDLE_HALF + PEDAL_AXLE = PEDAL_HALF_Z. */
export const PEDAL_AXLE_OFFSET = toM(geometry.pedalAxleOffset ?? 0); // 0.016

// 드롭바 후드(손 고정점) — gen cockpitAssembly 와 동일 계산.
const STEER = (() => {
  const headTop = coordM("headTop");
  const headBot = coordM("headBot");
  const v = [headTop[0] - headBot[0], headTop[1] - headBot[1]];
  const L = Math.hypot(v[0], v[1]) || 1;
  return { up: [v[0] / L, v[1] / L], headTop };
})();
const SPACER_STACK = 0.035;
const STEM_CLAMP_H = 0.04;
const STEM_LENGTH = 0.105;
const STEM_ANGLE = (6 * Math.PI) / 180;
const BAR_REACH = toM(geometry.handlebarReach); // 0.080
const _add2 = (p, v, s) => [p[0] + v[0] * s, p[1] + v[1] * s];
const _stemBottom = _add2(STEER.headTop, STEER.up, SPACER_STACK);
const _stemMid = _add2(_stemBottom, STEER.up, STEM_CLAMP_H * 0.5);
const _stemDir = [Math.cos(STEM_ANGLE), Math.sin(STEM_ANGLE)];
const _stemEnd = _add2(_stemMid, _stemDir, STEM_LENGTH);
/** 브레이크 후드 중앙(xy) — 좌우 z 는 HOOD_L/HOOD_R 에서 */
const BAR_HOOD_XY = _add2(_stemEnd, _stemDir, BAR_REACH * 0.6); // ≈[0.524, 0.912]
/** 후드 좌우 반폭 — 드롭바 폭보다 살짝 안쪽(후드는 바 끝이 아님) */
export const HOOD_HALF_Z = (toM(geometry.handlebarWidth) / 2) * 0.9; // 0.189
/** 왼손/오른손 고정점 (3D) */
export const HOOD_L = [BAR_HOOD_XY[0], BAR_HOOD_XY[1], +HOOD_HALF_Z];
export const HOOD_R = [BAR_HOOD_XY[0], BAR_HOOD_XY[1], -HOOD_HALF_Z];
/** 하위호환 — 중앙 후드(xy). z=0. */
export const BAR_HOOD = [BAR_HOOD_XY[0], BAR_HOOD_XY[1]];

// ── 라이더 인체 측정 (175cm · inseam 82cm, relaxed race) ─────────────────
/** 고관절 반폭(HIP_L/R.z = ±) */
export const PELVIS_HALF_Z = 0.09;
/** 견봉 반폭(SHOULDER_L/R.z = ±) — 어깨너비 ~0.40 */
export const SHOULDER_HALF_Z = 0.2;

// 다리: BDC 에서 무릎 ~30° 굽힘으로 닿도록 역산. HIP_L→BDC 3D 거리 0.952m 기준(고관절이
// 안장접촉점보다 6cm 위). 다리길이 = 거리/0.966 ≈ 0.986, 대퇴=정강=0.493.
export const THIGH_LEN = 0.493;
export const SHIN_LEN = 0.493;

// 팔: 어깨→후드 3D 거리(≈0.579)에서 elbow 150~165° 목표 → 팔길이 ≈0.585. 상완:전완 = 0.52:0.48.
export const UPPER_ARM_LEN = 0.585 * 0.52; // 0.304
export const FOREARM_LEN = 0.585 * 0.48; // 0.281

// ── PELVIS 3분리 ─────────────────────────────────────────────────────────
/** 엉덩이가 안장에 닿는 지점(안장 좌표) */
export const SADDLE_CONTACT = [...coordM("saddle"), 0]; // [-0.226, 0.966, 0]
/** 골반 중심 — 안장 접촉점보다 위(6cm)·살짝 앞. 다리·몸통 IK 의 공통 root. */
export const PELVIS_ROOT = [
  SADDLE_CONTACT[0] + 0.015,
  SADDLE_CONTACT[1] + 0.06,
  0,
];
/** 좌우 고관절 pivot — PELVIS_ROOT 에서 ±PELVIS_HALF_Z. 다리 root. */
export const HIP_L = [PELVIS_ROOT[0], PELVIS_ROOT[1], +PELVIS_HALF_Z];
export const HIP_R = [PELVIS_ROOT[0], PELVIS_ROOT[1], -PELVIS_HALF_Z];

// ── Torso: PELVIS_ROOT 에서 전경사로 SHOULDER 를 세운다(팔길이 역산 금지) ──
/** 등 수평 대비 전경사(요구 40~45°) */
export const TORSO_ANGLE_DEG = 42;
const TORSO_LEN = 0.53; // 고관절→견봉선
const _ta = (TORSO_ANGLE_DEG * Math.PI) / 180;
/** 견봉 중앙(xy) */
const SHOULDER_XY = [
  PELVIS_ROOT[0] + TORSO_LEN * Math.cos(_ta),
  PELVIS_ROOT[1] + TORSO_LEN * Math.sin(_ta),
];
/** 좌우 어깨(상완 root) */
export const SHOULDER_L = [SHOULDER_XY[0], SHOULDER_XY[1], +SHOULDER_HALF_Z];
export const SHOULDER_R = [SHOULDER_XY[0], SHOULDER_XY[1], -SHOULDER_HALF_Z];
/** 하위호환 — 어깨 중앙(xy) */
export const SHOULDER = [SHOULDER_XY[0], SHOULDER_XY[1]];

// 목·머리 — 어깨 연장선에 박지 말고 neck 에서 다시 세워 전방 주시.
const NECK_LEN = 0.11;
const HEAD_LEN = 0.13;
const _neckAng = (58 * Math.PI) / 180; // 목은 몸통(42°)보다 세움
const _neckTop = [
  SHOULDER_XY[0] + NECK_LEN * Math.cos(_neckAng),
  SHOULDER_XY[1] + NECK_LEN * Math.sin(_neckAng),
];
const _headAng = (72 * Math.PI) / 180; // 머리는 더 세워 전방 주시(수직에 가깝게)
/** 머리 중심 */
export const HEAD_C = [
  _neckTop[0] + HEAD_LEN * Math.cos(_headAng),
  _neckTop[1] + HEAD_LEN * Math.sin(_headAng),
];
export const NECK_BASE = SHOULDER_XY;

/** 페달 원주 위 한 점 (3D) — side, crankRad. z 는 PEDAL_HALF_Z 좌우. */
export function pedalWorld(side, crankRad) {
  const s = Math.sin(crankRad);
  const c = Math.cos(crankRad);
  const z = side === "l" ? +PEDAL_HALF_Z : -PEDAL_HALF_Z;
  if (side === "r") return [BB[0] - CRANK_ARM_M * s, BB[1] + CRANK_ARM_M * c, z];
  return [BB[0] + CRANK_ARM_M * s, BB[1] - CRANK_ARM_M * c, z];
}

/** side 별 고관절/어깨/후드 앵커 */
export const hipOf = (side) => (side === "l" ? HIP_L : HIP_R);
export const shoulderOf = (side) => (side === "l" ? SHOULDER_L : SHOULDER_R);
export const hoodOf = (side) => (side === "l" ? HOOD_L : HOOD_R);

/** 디버그·검증용 — 모든 파생 앵커 */
export const RIDER_RIG = {
  BB,
  SADDLE_CONTACT,
  PELVIS_ROOT,
  HIP_L,
  HIP_R,
  SHOULDER_L,
  SHOULDER_R,
  HOOD_L,
  HOOD_R,
  HEAD_C,
  CRANK_ARM_M,
  PEDAL_HALF_Z,
  HOOD_HALF_Z,
  PELVIS_HALF_Z,
  SHOULDER_HALF_Z,
  THIGH_LEN,
  SHIN_LEN,
  UPPER_ARM_LEN,
  FOREARM_LEN,
  TORSO_ANGLE_DEG,
};
