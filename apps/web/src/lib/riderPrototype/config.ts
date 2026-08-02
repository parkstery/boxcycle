/** `legacy` | `iso2d` | `glb` — `.env` `VITE_RIDER_PROTOTYPE` */
export type RiderPrototypeMode = "legacy" | "iso2d" | "glb";

export function getRiderPrototypeMode(): RiderPrototypeMode {
  const raw = import.meta.env.VITE_RIDER_PROTOTYPE?.trim().toLowerCase();
  if (raw === "iso2d" || raw === "glb") return raw;
  return "legacy";
}

export function riderPrototypeGlbUrl(): string {
  const baseRaw = import.meta.env.BASE_URL ?? "/";
  const base = baseRaw.endsWith("/") ? baseRaw : `${baseRaw}/`;
  return `${base}rider/prototype/rider-lowpoly.glb`;
}

export const RIDER_GLB_MODEL_SOURCE_ID = "boxcycle-rider-prototype-source";
export const RIDER_GLB_MODEL_LAYER_ID = "boxcycle-rider-prototype-layer";
/** Mapbox model-rotation feature-state — GLB 노드 `crank` */
export const RIDER_GLB_CRANK_STATE_KEY = "crank-rotation";
/** 상체 스웨이(페달 록킹) — GLB 노드 `torso`, 로컬 X축 롤 */
export const RIDER_GLB_TORSO_STATE_KEY = "torso-rotation";
export const RIDER_GLB_LEG_L_STATE_KEY = "leg-l-rotation";
export const RIDER_GLB_LEG_L_SHIN_STATE_KEY = "leg-l-shin-rotation";
export const RIDER_GLB_LEG_R_STATE_KEY = "leg-r-rotation";
export const RIDER_GLB_LEG_R_SHIN_STATE_KEY = "leg-r-shin-rotation";
/** 팔 — 어깨(상완)·팔꿈치(전완) Z축 회전. Hand@Hood 2-Bone IK. */
export const RIDER_GLB_ARM_L_STATE_KEY = "arm-l-rotation";
export const RIDER_GLB_ARM_L_FORE_STATE_KEY = "arm-l-fore-rotation";
export const RIDER_GLB_ARM_R_STATE_KEY = "arm-r-rotation";
export const RIDER_GLB_ARM_R_FORE_STATE_KEY = "arm-r-fore-rotation";
/** 페달 플랫폼 — 실제 페달은 스핀들 베어링으로 자유회전해 **항상 수평**이다.
 *  `crank` 의 자식이라 부모 회전을 물려받으므로, Mapbox 가 회전을 **누적**하는 성질을
 *  이용해 `−crankRotationDeg` 를 주어 상쇄한다(F25). */
export const RIDER_GLB_PEDAL_L_STATE_KEY = "pedal-l-rotation";
export const RIDER_GLB_PEDAL_R_STATE_KEY = "pedal-r-rotation";

export const RIDER_GLB_NODE_OVERRIDE_NAMES = [
  "crank",
  "leg_l",
  "leg_l_shin",
  "leg_r",
  "leg_r_shin",
  "arm_l",
  "arm_l_fore",
  "arm_r",
  "arm_r_fore",
  "torso",
  "pedal_l",
  "pedal_r",
] as const;

/** Mapbox model orientation 3번째 값(요) — 모델 +X(동) 기준 */
export function bearingToModelYawDeg(bearing: number): number {
  const b = ((bearing % 360) + 360) % 360;
  return b - 90;
}
