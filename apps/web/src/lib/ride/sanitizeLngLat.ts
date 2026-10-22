import type { LngLat } from "../geo/geo";

/** 좌표 유효성 — 비유한·범위 밖이면 null. `[0,0]`(Null Island) 로 추측하지 않는다 */
export function sanitizeLngLat(v: unknown): LngLat | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const lng = Number(v[0]);
  const lat = Number(v[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
}
