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

/** Mapbox model orientation 3번째 값(요) — 모델 +X(동) 기준 */
export function bearingToModelYawDeg(bearing: number): number {
  const b = ((bearing % 360) + 360) % 360;
  return b - 90;
}
