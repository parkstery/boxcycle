import { lngLatAlongPolyline, type LngLat } from "./courseGeometryAnchor.js";

export type { LngLat };

/** polyline 누적 거리 50% 지점 — World Activity Presence 대표 좌표 */
export function distanceMidpointLngLat(coords: readonly LngLat[]): LngLat | null {
  return lngLatAlongPolyline(coords, 0.5);
}
