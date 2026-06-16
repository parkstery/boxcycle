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
export const RIDER_GLB_LEG_L_STATE_KEY = "leg-l-rotation";
export const RIDER_GLB_LEG_L_SHIN_STATE_KEY = "leg-l-shin-rotation";
export const RIDER_GLB_LEG_R_STATE_KEY = "leg-r-rotation";
export const RIDER_GLB_LEG_R_SHIN_STATE_KEY = "leg-r-shin-rotation";

export const RIDER_GLB_NODE_OVERRIDE_NAMES = [
  "crank",
  "leg_l",
  "leg_l_shin",
  "leg_r",
  "leg_r_shin",
] as const;

/** Mapbox model orientation 3번째 값(요) — 모델 +X(동) 기준 */
export function bearingToModelYawDeg(bearing: number): number {
  const b = ((bearing % 360) + 360) % 360;
  return b - 90;
}
