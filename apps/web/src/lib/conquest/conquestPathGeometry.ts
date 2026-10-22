import type { LineStringGeometry } from "../geo/geo";

/**
 * Conquest 문서의 `{ path: [lng, lat, lng, lat, …] }` 한 항목 → LineString.
 * 항목이 객체가 아니거나 path 가 짝수 길이 4 이상이 아니거나 좌표 범위를 벗어나면 null.
 */
export function parseConquestPathItem(item: unknown): LineStringGeometry | null {
  if (!item || typeof item !== "object") return null;
  const path = (item as { path?: unknown }).path;
  if (!Array.isArray(path) || path.length < 4 || path.length % 2 !== 0) return null;
  const coordinates: [number, number][] = [];
  for (let i = 0; i < path.length; i += 2) {
    const lng = path[i];
    const lat = path[i + 1];
    if (
      typeof lng !== "number" ||
      typeof lat !== "number" ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      lng < -180 ||
      lng > 180 ||
      lat < -90 ||
      lat > 90
    ) {
      return null;
    }
    coordinates.push([lng, lat]);
  }
  return coordinates.length >= 2 ? { type: "LineString", coordinates } : null;
}
