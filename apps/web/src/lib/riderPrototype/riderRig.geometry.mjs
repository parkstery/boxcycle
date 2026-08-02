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
/** ⚠ **유물 — 판정에 쓰지 마라.** `coords.seatTop`(560×sin STA = BB y 536.9)은 F4-2 이전
 *  시트튜브를 560 까지 그리던 시절의 기준점이다. **지금 시트튜브는 junction 에서 끝나고**
 *  그 위는 전부 노출 시트포스트다(`generate-rider-prototype-glb.mjs` 의 `void seatTop`).
 *
 *  F12~F16 이 이 유물과 안장을 비교해 "안장이 시트튜브보다 76.9mm 아래라 물리적으로
 *  불가능하다"고 **다섯 단계에 걸쳐 오판**했다. 실제 시트튜브 끝은
 *  `(seatTubeLength − 150) × sin STA` = BB y **393.1** 이고, 안장(460.0)은 그보다
 *  **66.9mm 위**다 — 처음부터 정상이었다.
 *
 *  높이 판정에는 아래 `SEAT_TUBE_JUNCTION_Y_MM` 을 써라. */
export const SEAT_TOP = coordM("seatTop");
/** 시트튜브가 **실제로 끝나는** 지점(BB 원점 y, mm). 탑튜브·시트스테이 접합부.
 *  단축량 150 은 감리 확정값(F4-2). 이 위로 노출된 것이 시트포스트다. */
export const SEAT_TUBE_JUNCTION_Y_MM =
  (SEAT_TUBE_LENGTH_MM - 150) * Math.sin((SEAT_TUBE_ANGLE_DEG * Math.PI) / 180);
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
/** 브레이크 후드 중앙(xy) — 좌우 z 는 HOOD_L/HOOD_R 에서.
 *  ⚠ 실제 파생값은 **[0.54736, 0.83558]**(headTube 85 기준). 이전 주석의 `≈[0.524, 0.912]`
 *  는 headTube 를 줄이기 전(F3)의 낡은 값이었고, 그걸 그대로 인용한 F20 감리 진단이
 *  어깨→후드 거리를 486.6mm 로 오산했다(실측 545.69mm). 값이 필요하면 주석이 아니라
 *  이 모듈을 import 해서 읽어라. */
const BAR_HOOD_XY = _add2(_stemEnd, _stemDir, BAR_REACH * 0.6);
/** 후드 좌우 반폭 — 드롭바 폭보다 살짝 안쪽(후드는 바 끝이 아님) */
export const HOOD_HALF_Z = (toM(geometry.handlebarWidth) / 2) * 0.9; // 0.189
/** 왼손/오른손 고정점 (3D) */
export const HOOD_L = [BAR_HOOD_XY[0], BAR_HOOD_XY[1], +HOOD_HALF_Z];
export const HOOD_R = [BAR_HOOD_XY[0], BAR_HOOD_XY[1], -HOOD_HALF_Z];
/** 하위호환 — 중앙 후드(xy). z=0. */
export const BAR_HOOD = [BAR_HOOD_XY[0], BAR_HOOD_XY[1]];

// ── 라이더 인체 측정 (175cm · inseam 82cm, relaxed race) ─────────────────
/** 고관절 반폭(HIP_L/R.z = ±) — **V2 본 실측**(THIGH head 좌우 ±81.4mm, scale 0.88 후). */
export const PELVIS_HALF_Z = 0.0814;
/** 견봉 반폭(SHOULDER_L/R.z = ±) — **V2 본 실측**(`arm_l`/`arm_r` 노드 z = ±180.40mm).
 *  옛 값 0.2 는 절차적 라이더의 어깨너비 가정이었다. F20 정합. */
export const SHOULDER_HALF_Z = 0.18040;

// ── 사지 길이 — **V2 라이더 본 실측**(scale 0.88 적용 후, F18 정합) ─────────
// 예전 값(대퇴=정강=0.493 / 상완 0.304 · 전완 0.281)은 **옛 절차적 라이더**의 것이었다.
// 앱에 올리는 모델이 V2 로 바뀌었으므로 여기를 맞춰야 앱 IK 가 F14 렌더를 재현한다.
// 안 맞추면 **앱에서 발이 페달에서 떨어지고 손이 후드에서 뜬다**(F16 §5-1).
//
// ⚠ `riderGlbPedalPose.pose.mjs` 가 이 파일을 import 하므로 **여기 한 곳만** 고친다.
//   하드코딩 복제 금지.
//
//   허벅지 430 rest × 0.88 = 378.40      정강이 400 rest × 0.88 = 352.00
//   상완 380.49 rest × 0.88 = 334.83     전완 241.86 rest × 0.88 = 212.84
//   (상완은 F13-B 에서 팔꿈치 10° 굽힘을 만들려고 연장한 값이다)
export const THIGH_LEN = 0.37840;
export const SHIN_LEN = 0.35200;
export const UPPER_ARM_LEN = 0.33483;
export const FOREARM_LEN = 0.21284;

// ── 발목 오프셋 — **V2 는 정강이 끝이 발목이고 발이 별도 세그먼트다** (F18) ──
// 옛 절차적 라이더는 정강이 끝이 곧 페달 접점이라 IK 가 페달축을 직접 겨냥했다.
// V2 는 다르다: 정강이 끝 = 발목, 그 앞·아래에 발이 붙는다. 그래서 다리 IK 는
// **발목 목표**(페달축 뒤 ANKLE_BACK · 위 ANKLE_UP)를 겨냥해야 한다.
// 안 고치면 hip→페달축 768.5mm > 다리합 730.4mm 라 **다리가 물리적으로 안 닿는다**(F18 실측).
/** 발목 → 발 중심(페달축 위) 전방 거리(m). F13 실측 = 발길이 256.45 의 50% 지점. */
export const ANKLE_BACK = 0.09303;
/** 발목 → 페달축 수직 거리(m). 발바닥 22.0 + 밑창·클릿 15.0. */
export const ANKLE_UP = 0.037;
/** 페달축 → **발목 IK 목표**. 다리 IK 는 페달축이 아니라 이 점을 겨냥한다. */
export function ankleTargetWorld(side, crankRad) {
  const p = pedalWorld(side, crankRad);
  return [p[0] - ANKLE_BACK, p[1] + ANKLE_UP, p[2]];
}

// ── PELVIS 3분리 · 【F17-R1】 파생 방향을 뒤집었다 ─────────────────────────
//
//   예전:  안장(geometry.json) → PELVIS_ROOT → HIP      ← 사람이 자전거에 맞춰졌다
//   지금:  HIP → 좌골 → 안장 접촉점 → saddleHeight       ← 자전거가 사람에 맞춰진다
//
// 사용자 지시(F17): "힙 높이를 정하고 그 높이에 맞춰서 안장이 놓이도록 시트포스트 길이를
// 조절하는 게 기본적인 자전거 높이 조절 컨셉인데 그걸 사람이 자전거에 맞춘다는 게 말이 되나!"
//
// ⚠ 이 전환은 **값을 바꾸지 않는다** — 역방향 파생이 현재 geometry.json 과 일치함을
//   아래 SADDLE_HEIGHT_DERIVED_MM 로 검산할 수 있다(479.78 ≈ 저장값 479.8).
//   F16 §5-2 의 "hip 이 안장 파생이라 F14 와 70mm 어긋난다"는 충돌도 이걸로 해소된다.

/** 【1차 입력】 고관절 world(지면, m). 라이더 자세가 정한다 — **안장과 독립**.
 *  F12 확정: BDC 발바닥 피벗 기준 10° 후방 회전의 결과 (−211.28, 836.88). */
export const HIP_GROUND = [-0.14966, 0.84452];
/** 고관절 → 좌골 수직 하강(m). **메시 실측**(F12: PELVIS 후방 45%·하부 20% 밴드 centroid).
 *  836.88 − 730.52 = 106.36mm. 가정값 아님 — 자세가 바뀌면 다시 재야 한다. */
export const HIP_TO_ISCHIAL_M = 0.10636;
/** 골반 중심 = 고관절 높이. 다리·몸통 IK 의 공통 root. */
export const PELVIS_ROOT = [HIP_GROUND[0], HIP_GROUND[1], 0];
/** 좌골 높이(지면, m) = **안장 상면이 와야 할 높이**. */
export const ISCHIAL_Y_M = HIP_GROUND[1] - HIP_TO_ISCHIAL_M;
const _staRad = (SEAT_TUBE_ANGLE_DEG * Math.PI) / 180;
/** 시트포스트 길이(= `saddleHeight`, mm) — 좌골 높이에서 **역산**한 파생값.
 *  `geometry.json.saddleHeight` 는 이 값의 기록이며, 어긋나면 verify-fit 이 잡는다. */
export const SADDLE_HEIGHT_DERIVED_MM =
  (ISCHIAL_Y_M * 1000 - BB_HEIGHT_MM) / Math.sin(_staRad);
/** 엉덩이(좌골)가 안장에 닿는 지점 — HIP 에서 파생. seatTubeAngle·setback 은 불변 입력. */
export const SADDLE_CONTACT = [
  -(SADDLE_HEIGHT_DERIVED_MM * Math.cos(_staRad)) / 1000 - toM(geometry.saddleSetback),
  ISCHIAL_Y_M,
  0,
];
/** 노출 시트포스트 길이(mm) — 안장 상면 − 시트튜브 junction.
 *  **음수면** 시트포스트를 다 넣어도 도달 불가 = 진짜 물리적 불가능이다.
 *  유물 `SEAT_TOP` 과 비교하지 마라(F12~F16 오판의 원인). */
export const SEATPOST_EXPOSED_MM =
  ISCHIAL_Y_M * 1000 - BB_HEIGHT_MM - SEAT_TUBE_JUNCTION_Y_MM;
/** 좌우 고관절 pivot — PELVIS_ROOT 에서 ±PELVIS_HALF_Z. 다리 root. */
export const HIP_L = [PELVIS_ROOT[0], PELVIS_ROOT[1], +PELVIS_HALF_Z];
export const HIP_R = [PELVIS_ROOT[0], PELVIS_ROOT[1], -PELVIS_HALF_Z];

// ── Torso: 어깨는 **V2 실측 상수**다. 합성하지 마라 (F20) ──────────────────
//
// ⚠ **계약**: `SHOULDER_L/R` 은 GLB 의 `arm_l`/`arm_r` **노드 피벗과 반드시 동일**해야 한다.
//   `riderGlbPedalPose.pose.mjs:10` 이 요구하는 그 계약이다 — 앱 IK 는 이 점을 root 로
//   회전각을 풀고, Mapbox 는 그 회전을 GLB 노드에 그대로 적용한다. 둘이 어긋나면
//   **각도가 맞아도 팔 전체가 통째로 밀려 몸에서 떨어진다.**
//
//   V2 실측(제품 GLB 파싱): `arm_l` t = [92.78, 1137.35, +180.40] mm (지면원점)
//                          `arm_r` t = [92.78, 1137.35, −180.40] mm
//
// F18 이 사지 길이 5개를 V2 로 정합하면서 **체인 root 인 어깨를 빠뜨렸고**, 그것이
// "앱에서 팔이 떠 있다"의 원인이었다(합성값과 106.70mm 차이). 길이를 맞췄으면 root 도 맞춘다.
//
// 예전에는 `PELVIS_ROOT + TORSO_LEN(0.53) × [cos42°, sin42°]` 로 합성했다. 그것은
// **옛 절차적 라이더의 몸통 가정**이고 V2 아마추어의 UPPER_ARM head 와 무관하다.
//
// 정방향 검산: 이 어깨 → HOOD_L(547.36, 835.58, 189.0) 거리 545.69mm,
//   팔 합 334.83 + 212.84 = 547.67mm → 도달 가능, 팔꿈치 내각 170.0°(굽힘 10°).
//   상완 334.83 은 F13-B 가 **바로 이 굽힘 10°를 만들려고** 역산한 값이라 서로 일치한다.
/** 견봉 중앙(xy) — **V2 실측**. GLB `arm_l`/`arm_r` 노드 피벗과 동일해야 한다. */
const SHOULDER_XY = [0.12860, 1.16910];

/** 등 수평 대비 전경사(deg). ⚠ 어깨는 더 이상 이 값에서 파생되지 않는다 —
 *  자세 기술·검증 리포트용으로만 남는다(`export-ik-joints.mjs` 등이 기록한다). */
export const TORSO_ANGLE_DEG = 42;

/** 몸통 노드(`torso`) 회전 오버라이드 — Mapbox model-rotation `[x, y, z]`.
 *
 *  몸통 메시는 GLB 에 **44.66° 전경사**로 구워져 있다. 라이더 전체를 발목 피벗으로
 *  회전시키면(F23) 그 각도가 달라져야 하므로 여기서 보정한다.
 *
 *  ⚠ **부호 규약**: 시상면 회전은 **z 성분**이고, `Rz(θ)·[0,1,0] = [−sinθ, cosθ, 0]`
 *  이므로 **z 가 음수일 때 상단이 +x(전방)로 숙는다.** 즉 앞으로 더 숙이려면 음수다.
 *  (F22 에서 확정한 `R = Ry(e[1])·Rz(e[2])·Rx(e[0])` 규약을 따른다.) */
export const TORSO_ROTATION_DEG = [0, 0, 4.73];
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
