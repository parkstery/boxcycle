import { getDistanceMeters, type LngLat } from "./geo";

const COORD_DECIMALS = 3;
function roundCoord(n: number): number {
  const f = 10 ** COORD_DECIMALS;
  return Math.round(n * f) / f;
}

/** polyline 누적 거리 비율(0..1) 지점 — Functions `lngLatAlongPolyline` 과 동일 정책 */
export function lngLatAlongPolyline(coords: readonly LngLat[], progressRatio: number): LngLat | null {
  if (coords.length < 2) return null;
  const r = Math.max(0, Math.min(1, progressRatio));

  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const len = getDistanceMeters(coords[i - 1]!, coords[i]!);
    segLens.push(len);
    total += len;
  }
  if (total <= 0) {
    const [lng, lat] = coords[0]!;
    return [roundCoord(lng), roundCoord(lat)];
  }

  let target = r * total;
  for (let i = 0; i < segLens.length; i++) {
    const len = segLens[i]!;
    if (target <= len || i === segLens.length - 1) {
      const t = len > 0 ? Math.min(1, target / len) : 0;
      const a = coords[i]!;
      const b = coords[i + 1]!;
      const lng = a[0] + (b[0] - a[0]) * t;
      const lat = a[1] + (b[1] - a[1]) * t;
      return [roundCoord(lng), roundCoord(lat)];
    }
    target -= len;
  }
  const last = coords[coords.length - 1]!;
  return [roundCoord(last[0]), roundCoord(last[1])];
}

/** World Activity Presence 대표 좌표 — 총 거리 50% */
export function distanceMidpointLngLat(coords: readonly LngLat[]): LngLat | null {
  return lngLatAlongPolyline(coords, 0.5);
}
