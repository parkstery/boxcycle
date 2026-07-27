/**
 * Rider Body — 인체 치수 SSoT(riderAnthropometry.json) → 골격·외형 파생 (순수 JS).
 *
 * ⚠ 계층 분리 (사용자 지시 2026-07-25):
 *   ① 치수 SSoT (riderAnthropometry.json, cm)
 *   ② 골격/파생 (이 파일) — cm→m 변환, 관절 중심·뼈 길이·좌우 폭. IK skeleton.
 *   ③ 외형 메시 (generate-rider-prototype-glb.mjs) — ②의 골격 위에 girth 로 살.
 *   IK 뼈 길이(②)와 화면 메시 두께(③ girth)를 직접 동일시하지 않는다.
 *
 * ⚠ 자전거 접촉점에서 역산하지 않는다. 이 파일은 자전거 geometry 를 import 하지 않는다.
 *   자전거 fit(안장·스템 조절)은 별도 단계에서, 사람 뼈는 고정.
 *
 * 좌표계: m, +x 전진(동), +y 위, +z 왼쪽. 중립 자세 = 차렷에 가까운 서있는 포즈.
 *
 * ── 파생 근거 (인체공학) ──────────────────────────────────────────────────
 *  세그먼트 길이는 신장 비율(Drillis & Contini 1966, NASA-STD-3000)과 인심 실측을
 *  교차검증해 SSoT 에 박았다. 여기선 cm→m 변환과 관절 위치 조립만 한다.
 *  - 다리뼈 합(thigh+shank) = 82cm ≈ 인심 82cm (고관절이 회음부보다 살짝 위라 근사 일치).
 *  - 서있는 스택(발높이+다리+몸통+목+머리) ≈ 173.5cm ≈ 신장 175cm.
 */
import A from "./riderAnthropometry.json" with { type: "json" };

const cm = (v) => v / 100; // cm → m
const S = A.segments;
const W = A.widths;
const G = A.girths;

// ── 뼈 길이 (m) ──────────────────────────────────────────────────────────
export const HEAD_HEIGHT = cm(S.headHeight);
export const NECK_LEN = cm(S.neckLength);
export const TORSO_LEN = cm(S.torsoHip2Shoulder); // 골반중심(고관절선) → 견봉선
export const UPPER_ARM_LEN = cm(S.upperArm);
export const FOREARM_LEN = cm(S.forearm);
export const HAND_LEN = cm(S.handLength);
export const THIGH_LEN = cm(S.thigh);
export const SHANK_LEN = cm(S.shank);
export const FOOT_LEN = cm(S.footLength);
export const FOOT_HEIGHT = cm(S.footHeight);

// ── 좌우/앞뒤 폭 (m) ─────────────────────────────────────────────────────
export const SHOULDER_HALF_Z = cm(W.shoulderWidth) / 2; // 견봉 반폭
export const HIP_HALF_Z = cm(W.hipWidth) / 2; // 고관절 반폭
export const CHEST_HALF_Z = cm(W.chestWidth) / 2;
export const CHEST_HALF_X = cm(W.chestDepth) / 2; // 흉곽 앞뒤 반깊이
export const PELVIS_HALF_Z = cm(W.pelvisWidth) / 2;
export const PELVIS_HALF_X = cm(W.pelvisDepth) / 2;

// ── 외형 메시 girth 반경 (m) — ③ 메시 전용 ───────────────────────────────
export const GIRTH = Object.fromEntries(
  Object.entries(G).filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, cm(v)]),
);

// ── 중립 자세 관절 중심 (m, 서있는 포즈) ──────────────────────────────────
// 지면 y=0. 발바닥이 지면. 위로 쌓아 올린다.
const groundToHip = FOOT_HEIGHT + SHANK_LEN + THIGH_LEN; // 고관절선 높이
/** 골반 중심(고관절선) — 다리 root, 몸통 하단 */
export const PELVIS_ROOT = [0, groundToHip, 0];
/** 좌우 고관절 pivot */
export const HIP_L = [0, groundToHip, +HIP_HALF_Z];
export const HIP_R = [0, groundToHip, -HIP_HALF_Z];

// 몸통: 골반중심 → 어깨선(견봉). 중립 자세는 수직(전경사는 자전거 fit 단계에서).
const shoulderY = groundToHip + TORSO_LEN;
/** 견봉선 중앙 */
export const SHOULDER_C = [0, shoulderY, 0];
export const SHOULDER_L = [0, shoulderY, +SHOULDER_HALF_Z];
export const SHOULDER_R = [0, shoulderY, -SHOULDER_HALF_Z];

// 목·머리 — 어깨 위로 수직(중립). 목은 대부분 승모근·칼라에 묻히므로 노출은 짧다.
const neckTopY = shoulderY + NECK_LEN;
export const NECK_TOP = [0, neckTopY, 0];
/** 머리 중심 */
export const HEAD_C = [0, neckTopY + HEAD_HEIGHT / 2, 0];

// ── 흉곽/복부/골반 3덩어리 중심 (외형 메시가 참조) ────────────────────────
// 몸통을 하나의 원뿔이 아니라 세 덩어리로 읽히게. 골반중심→어깨 사이 배치.
export const PELVIS_MASS = [0, groundToHip + TORSO_LEN * 0.08, 0]; // 골반(넓음)
export const WAIST_MASS = [0, groundToHip + TORSO_LEN * 0.42, 0]; // 복부(잘록)
export const CHEST_MASS = [0, groundToHip + TORSO_LEN * 0.78, 0]; // 흉곽(넓고 깊음)

/** 중립 자세에서 팔은 몸 옆으로 약간 벌려 내림(관절·비율 확인용). rest = -Y. */
export const ARM_NEUTRAL_ABDUCT_DEG = 6; // 겨드랑이에서 살짝 벌림
/** 중립 자세에서 다리는 거의 수직(좌우 분리는 골반폭으로 충분). */
export const LEG_NEUTRAL_ABDUCT_DEG = 0;

/** 디버그·검증·측정표용 — 모든 파생값 */
export const RIDER_BODY = {
  heightCm: A.heightCm,
  inseamCm: A.inseamCm,
  HEAD_HEIGHT, NECK_LEN, TORSO_LEN,
  UPPER_ARM_LEN, FOREARM_LEN, HAND_LEN,
  THIGH_LEN, SHANK_LEN, FOOT_LEN, FOOT_HEIGHT,
  SHOULDER_HALF_Z, HIP_HALF_Z, PELVIS_HALF_Z, PELVIS_HALF_X, CHEST_HALF_Z, CHEST_HALF_X,
  PELVIS_ROOT, HIP_L, HIP_R, SHOULDER_C, SHOULDER_L, SHOULDER_R, NECK_TOP, HEAD_C,
  groundToHip, shoulderY,
};

/** 측정표 — 단독 인체 프리뷰에 표로 제출. 신장/인심 대비 비율 포함. */
export function bodyMetricsTable() {
  const totalHeight = FOOT_HEIGHT + THIGH_LEN + SHANK_LEN + TORSO_LEN + NECK_LEN + HEAD_HEIGHT;
  const legLen = THIGH_LEN + SHANK_LEN;
  return {
    heightCm: A.heightCm,
    inseamCm: A.inseamCm,
    computedStandingHeightCm: +(totalHeight * 100).toFixed(1),
    headToHeightRatio: +(A.heightCm / S.headHeight).toFixed(2), // n-head
    shoulderWidthCm: W.shoulderWidth,
    hipJointWidthCm: W.hipWidth, // 고관절 pivot 간격(IK anchor)
    pelvisWidthCm: W.pelvisWidth, // 골반 외형 폭(메시)
    torsoHip2ShoulderCm: S.torsoHip2Shoulder,
    upperArmCm: S.upperArm,
    forearmCm: S.forearm,
    thighCm: S.thigh,
    shankCm: S.shank,
    legLenCm: +(legLen * 100).toFixed(1),
    legToInseamRatio: +((legLen * 100) / A.inseamCm).toFixed(3), // 다리뼈/인심 (≈1.0 정상, >1.2 사마귀)
    neckExposedCm: S.neckLength, // 노출은 이보다 짧음(승모근 묻힘)
    shoulderToPelvisWidthRatio: +(W.shoulderWidth / W.pelvisWidth).toFixed(2), // 외형 폭 비(성인 ~1.3)
  };
}
