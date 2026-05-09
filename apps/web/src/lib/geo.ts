/** GeoJSON LineString (좌표만 사용) */
export type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

export type LngLat = [number, number];

export function parseLngLat(raw: string): LngLat | null {
  const parts = raw.split(",").map((v) => Number(v.trim()));
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return [parts[0], parts[1]];
}

export function formatLngLat(lngLat: LngLat): string {
  return `${lngLat[0].toFixed(6)},${lngLat[1].toFixed(6)}`;
}

export function getDistanceMeters(a: LngLat, b: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function interpolatePoint(a: LngLat, b: LngLat, ratio: number): LngLat {
  return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
}

/** LineString `coordinates` 기준 누적 거리만큼 떨어진 점 */
export function getPointOnRouteByDistance(
  geometry: LineStringGeometry,
  distanceMeters: number,
): LngLat | null {
  const coords = geometry.coordinates as LngLat[];
  if (!coords.length) return null;
  if (coords.length === 1) return coords[0];

  let remaining = Math.max(0, distanceMeters);
  for (let i = 0; i < coords.length - 1; i += 1) {
    const segmentStart = coords[i];
    const segmentEnd = coords[i + 1];
    const segmentDistance = getDistanceMeters(segmentStart, segmentEnd);
    if (segmentDistance <= 0) continue;
    if (remaining <= segmentDistance) {
      const ratio = remaining / segmentDistance;
      return interpolatePoint(segmentStart, segmentEnd, ratio);
    }
    remaining -= segmentDistance;
  }
  return coords[coords.length - 1];
}
