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

/** LineString 좌표로부터 코스 bounds 계산 */
export function boundsFromLineCoordinates(coords: [number, number][]): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return { minLng, minLat, maxLng, maxLat };
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

/** Web Mercator (EPSG:3857) 구면 반경 — Mapbox 경로선 세그먼트와 동일한 직선 보간에 사용 */
const WEB_MERCATOR_R = 6378137;

function lngLatToMercatorMeters(lngLat: LngLat): { x: number; y: number } {
  const λ = (lngLat[0] * Math.PI) / 180;
  const φ = (lngLat[1] * Math.PI) / 180;
  return {
    x: WEB_MERCATOR_R * λ,
    y: WEB_MERCATOR_R * Math.log(Math.tan(Math.PI / 4 + φ / 2)),
  };
}

function mercatorMetersToLngLat(x: number, y: number): LngLat {
  const lng = ((x / WEB_MERCATOR_R) * 180) / Math.PI;
  const lat = ((2 * Math.atan(Math.exp(y / WEB_MERCATOR_R)) - Math.PI / 2) * 180) / Math.PI;
  return [lng, lat];
}

/**
 * 두 지점을 Mapbox `line` 레이어와 같이 **머캐토 평면에서 직선**으로 잇는 가정 하의 보간.
 * (경도·위도 선형 보간은 같은 세그먼트에서 화면상 선에서 벗어날 수 있음)
 */
export function interpolateLngLatAlongMercatorChord(a: LngLat, b: LngLat, ratio: number): LngLat {
  const t = Math.min(1, Math.max(0, ratio));
  const pa = lngLatToMercatorMeters(a);
  const pb = lngLatToMercatorMeters(b);
  return mercatorMetersToLngLat(pa.x + (pb.x - pa.x) * t, pa.y + (pb.y - pa.y) * t);
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
      return interpolateLngLatAlongMercatorChord(segmentStart, segmentEnd, ratio);
    }
    remaining -= segmentDistance;
  }
  return coords[coords.length - 1];
}

/** LineString 꼭짓점마다 시작점부터의 누적 거리(m). `cum[0] === 0`. */
export function buildVertexCumulativeMeters(geometry: LineStringGeometry): number[] {
  const coords = geometry.coordinates as LngLat[];
  if (!coords.length) return [];
  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i += 1) {
    const d = getDistanceMeters(coords[i - 1], coords[i]);
    cum.push(cum[i - 1] + d);
  }
  return cum;
}

/** 경로 전장(m). */
export function lineStringLengthMeters(geometry: LineStringGeometry): number {
  const cum = buildVertexCumulativeMeters(geometry);
  return cum.length ? cum[cum.length - 1] : 0;
}

/**
 * 경로를 `intervalMeters` 간격으로 재샘플한 LineString(시종점 유지).
 * Mapillary Graph 샘플링 등 “경로상 촘촘한 질의용”에 사용.
 */
export function densifyLineStringByIntervalM(
  geometry: LineStringGeometry,
  intervalMeters: number,
): LineStringGeometry {
  const coords = geometry.coordinates as LngLat[];
  if (coords.length < 2) {
    return { type: "LineString", coordinates: [...coords] };
  }
  const total = lineStringLengthMeters(geometry);
  if (total <= 0) {
    return { type: "LineString", coordinates: [...coords] };
  }
  const step = Math.max(1, intervalMeters);
  const out: LngLat[] = [];
  for (let d = 0; d < total; d += step) {
    const p = getPointOnRouteByDistance(geometry, d);
    if (p) out.push(p);
  }
  const end = coords[coords.length - 1];
  const last = out[out.length - 1];
  if (!last || getDistanceMeters(last, end) > 0.5) {
    out.push(end);
  }
  return { type: "LineString", coordinates: out };
}

/**
 * `distanceMeters`가 위치하는 정점 구간에서, 시작점 기준 거리가 `distanceMeters` 이하인
 * **가장 큰 정점 인덱스**(이진 탐색). `cum`은 `buildVertexCumulativeMeters` 결과.
 */
export function distanceMetersToVertexIndexAtOrBefore(cum: readonly number[], distanceMeters: number): number {
  if (cum.length === 0) return 0;
  const d = Math.max(0, distanceMeters);
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (cum[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** 북 기준 시계방위각(0~360). */
export function bearingDegrees(from: LngLat, to: LngLat): number {
  const φ1 = (from[1] * Math.PI) / 180;
  const φ2 = (to[1] * Math.PI) / 180;
  const Δλ = ((to[0] - from[0]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/** 경로상 `distanceMeters`에서 소량 전방 구간의 진행 방위(도). */
export function driveHeadingAtDistanceMeters(
  geometry: LineStringGeometry,
  distanceMeters: number,
  lookaheadMeters = 14,
): number | null {
  const total = lineStringLengthMeters(geometry);
  if (total <= 0) return null;
  const a = getPointOnRouteByDistance(geometry, Math.min(distanceMeters, total));
  const b = getPointOnRouteByDistance(geometry, Math.min(distanceMeters + lookaheadMeters, total));
  if (!a || !b) return null;
  if (getDistanceMeters(a, b) < 1) return null;
  return bearingDegrees(a, b);
}

/** 경로를 따라 `startDistanceMeters`에서 `aheadMeters`만큼 앞 지점(캡). */
export function pathPointAheadAlongLineString(
  geometry: LineStringGeometry,
  startDistanceMeters: number,
  aheadMeters: number,
): LngLat | null {
  const total = lineStringLengthMeters(geometry);
  if (total <= 0) return null;
  return getPointOnRouteByDistance(geometry, Math.min(total, startDistanceMeters + aheadMeters));
}
