/** GeoJSON LineString (좌표만 사용) */
export type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

export type LngLat = [number, number];

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

/** bearing 방향으로 distanceM 이동한 좌표 (구면 근사) */
export function offsetLngLatByBearingMeters(
  origin: LngLat,
  bearingDeg: number,
  distanceMeters: number,
): LngLat {
  if (distanceMeters <= 0) return origin;
  const earthRadiusM = 6378137;
  let bearing = bearingDeg % 360;
  if (bearing < 0) bearing += 360;
  const bearingRad = (bearing * Math.PI) / 180;
  const latRad = (origin[1] * Math.PI) / 180;
  const lngRad = (origin[0] * Math.PI) / 180;
  const angDist = distanceMeters / earthRadiusM;
  const lat2 = Math.asin(
    Math.sin(latRad) * Math.cos(angDist) +
      Math.cos(latRad) * Math.sin(angDist) * Math.cos(bearingRad),
  );
  const lng2 =
    lngRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angDist) * Math.cos(latRad),
      Math.cos(angDist) - Math.sin(latRad) * Math.sin(lat2),
    );
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

/**
 * 진행 방향 기준 좌우 오프셋. `meters` 가 양수면 오른쪽, 음수면 왼쪽.
 * 거리 0 이면 원점을 그대로 돌려준다.
 */
export function offsetLngLatLateral(lngLat: LngLat, headingDeg: number, meters: number): LngLat {
  if (!Number.isFinite(meters) || meters === 0) return lngLat;
  const bearing = headingDeg + (meters > 0 ? 90 : -90);
  return offsetLngLatByBearingMeters(lngLat, bearing, Math.abs(meters));
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
 * 경로 누적거리. `cum[i]` 는 꼭짓점 i 까지의 미터(haversine 합, `cum[0] === 0`).
 * 키는 geometry 객체. 좌표 배열을 갈아끼우면 다시 만든다.
 * 같은 거리 질의 몇 건은 슬롯에 남겨 한 프레임 안의 반복을 다시 훑지 않는다.
 */
type RouteMeterIndex = {
  coords: LngLat[];
  cum: Float64Array;
  pointQ: Array<{ d: number; lng: number; lat: number } | null>;
  pointQi: number;
  smoothQ: Array<{ d: number; span: number; routeLen: number; lng: number; lat: number; heading: number | null } | null>;
  smoothQi: number;
};

const ROUTE_QUERY_SLOTS = 4;
const routeIndexByGeometry = new WeakMap<LineStringGeometry, RouteMeterIndex>();

function emptyQuerySlots<T>(): Array<T | null> {
  return [null, null, null, null];
}

function routeMeterIndex(geometry: LineStringGeometry): RouteMeterIndex {
  const coords = geometry.coordinates as LngLat[];
  const prev = routeIndexByGeometry.get(geometry);
  if (prev && prev.coords === coords && prev.cum.length === coords.length) return prev;
  const cum = new Float64Array(coords.length);
  for (let i = 1; i < coords.length; i += 1) {
    cum[i] = cum[i - 1] + getDistanceMeters(coords[i - 1], coords[i]);
  }
  const created: RouteMeterIndex = {
    coords,
    cum,
    pointQ: emptyQuerySlots(),
    pointQi: 0,
    smoothQ: emptyQuerySlots(),
    smoothQi: 0,
  };
  routeIndexByGeometry.set(geometry, created);
  return created;
}

/** `cum[i] >= d` 인 가장 작은 꼭짓점. */
function lowerBoundCum(cum: Float64Array, d: number): number {
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** `cum[i] > lo` 인 가장 작은 꼭짓점. */
function firstCumGreaterThan(cum: Float64Array, lo: number): number {
  let a = 0;
  let b = cum.length - 1;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (cum[mid] <= lo) a = mid + 1;
    else b = mid;
  }
  return a;
}

type SegmentLocate =
  | { kind: "past" }
  | { kind: "seg"; start: number; ratio: number };

/**
 * 선형 스캔과 같은 선분.
 * 거리가 꼭짓점과 같으면 그 점으로 **끝나는** 선분(비율 1)이다.
 * 0 이면 첫 양수 선분의 비율 0. 전장을 넘으면 past.
 */
function locateRouteSegment(cum: Float64Array, distanceMeters: number): SegmentLocate {
  const n = cum.length;
  if (n < 2) return { kind: "past" };
  if (!Number.isFinite(distanceMeters)) return { kind: "past" };
  const d = Math.max(0, distanceMeters);
  const total = cum[n - 1];
  if (d > total) return { kind: "past" };
  if (d === 0) {
    for (let i = 0; i < n - 1; i += 1) {
      if (cum[i + 1] - cum[i] > 0) return { kind: "seg", start: i, ratio: 0 };
    }
    return { kind: "past" };
  }
  const end = lowerBoundCum(cum, d);
  if (end <= 0) return { kind: "seg", start: 0, ratio: 0 };
  const start = end - 1;
  const seg = cum[end] - cum[start];
  if (!(seg > 0)) return { kind: "past" };
  return { kind: "seg", start, ratio: (d - cum[start]) / seg };
}

function readCachedPoint(idx: RouteMeterIndex, d: number): LngLat | null {
  const q = idx.pointQ;
  for (let i = 0; i < ROUTE_QUERY_SLOTS; i += 1) {
    const hit = q[i];
    if (hit && hit.d === d) return [hit.lng, hit.lat];
  }
  return null;
}

function storeCachedPoint(idx: RouteMeterIndex, d: number, point: LngLat): void {
  idx.pointQ[idx.pointQi] = { d, lng: point[0], lat: point[1] };
  idx.pointQi = (idx.pointQi + 1) % ROUTE_QUERY_SLOTS;
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
  const idx = routeMeterIndex(geometry);
  const coords = idx.coords;
  if (!coords.length) return null;
  if (coords.length === 1) return coords[0];
  if (Number.isFinite(distanceMeters)) {
    const cached = readCachedPoint(idx, distanceMeters);
    if (cached) return cached;
  }
  const loc = locateRouteSegment(idx.cum, distanceMeters);
  const point: LngLat =
    loc.kind === "seg"
      ? interpolateLngLatAlongMercatorChord(coords[loc.start], coords[loc.start + 1], loc.ratio)
      : coords[coords.length - 1];
  if (Number.isFinite(distanceMeters)) storeCachedPoint(idx, distanceMeters, point);
  return point;
}

/** 경로 전장(m). */
export function lineStringLengthMeters(geometry: LineStringGeometry): number {
  const cum = routeMeterIndex(geometry).cum;
  return cum.length ? cum[cum.length - 1] : 0;
}

/** Keep the original vertices and end at the same interpolated point used by the ride marker. */
export function routePrefixAtDistance(geometry: LineStringGeometry, distanceMeters: number): LineStringGeometry | null {
  const { coords, cum } = routeMeterIndex(geometry);
  if (coords.length < 2 || !Number.isFinite(distanceMeters) || distanceMeters <= 0 || cum[cum.length - 1] <= 0) return null;
  if (distanceMeters >= cum[cum.length - 1]) return geometry;
  const endIndex = lowerBoundCum(cum, distanceMeters);
  const end = cum[endIndex] === distanceMeters ? coords[endIndex] : getPointOnRouteByDistance(geometry, distanceMeters);
  return end ? { type: "LineString", coordinates: [...coords.slice(0, endIndex), end] } : null;
}

/** 경로상 투영점까지의 누적 거리(m). */
export function distanceOnRouteByProjectedPoint(
  geometry: LineStringGeometry,
  point: LngLat,
): number | null {
  const idx = routeMeterIndex(geometry);
  const coords = idx.coords;
  const cum = idx.cum;
  if (coords.length < 2) return null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestRouteDistance = 0;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const segLen = cum[i + 1] - cum[i];
    if (segLen <= 0) continue;
    const a = coords[i];
    const b = coords[i + 1];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const apx = point[0] - a[0];
    const apy = point[1] - a[1];
    const denom = abx * abx + aby * aby;
    const rawT = denom > 0 ? (apx * abx + apy * aby) / denom : 0;
    const t = Math.max(0, Math.min(1, rawT));
    const projected: LngLat = [a[0] + abx * t, a[1] + aby * t];
    const d = getDistanceMeters(projected, point);
    if (d < bestDistance) {
      bestDistance = d;
      bestRouteDistance = cum[i] + segLen * t;
    }
  }
  return bestRouteDistance;
}

/** 경로상 distanceMeters 지점 세그먼트의 진행 방위(도) — 코너 직전 선행 꺾임 없음. */
export function headingAtRouteDistanceMeters(
  geometry: LineStringGeometry,
  distanceMeters: number,
): number | null {
  const idx = routeMeterIndex(geometry);
  const coords = idx.coords;
  if (coords.length < 2) return null;
  const loc = locateRouteSegment(idx.cum, distanceMeters);
  if (loc.kind === "seg") return bearingDegrees(coords[loc.start], coords[loc.start + 1]);
  return bearingDegrees(coords[coords.length - 2], coords[coords.length - 1]);
}

/**
 * 경로상 distanceMeters 앞뒤 `halfSpanM` 지점을 잇는 현(chord)의 방위(도).
 * 세그먼트 방위는 꺾임점에서 계단처럼 뛴다 — 이 값은 거리에 대해 연속이라
 * 경로를 따라 움직이는 모델의 yaw·좌우 오프셋이 툭툭 튀지 않는다.
 */
export function smoothedHeadingAtRouteDistanceMeters(
  geometry: LineStringGeometry,
  distanceMeters: number,
  halfSpanM: number,
  routeLenM: number = lineStringLengthMeters(geometry),
): number | null {
  const lo = Math.max(0, distanceMeters - halfSpanM);
  const hi = Math.min(routeLenM, distanceMeters + halfSpanM);
  const a = getPointOnRouteByDistance(geometry, lo);
  const b = getPointOnRouteByDistance(geometry, hi);
  if (a && b && getDistanceMeters(a, b) > 0.05) return bearingDegrees(a, b);
  return headingAtRouteDistanceMeters(geometry, distanceMeters);
}

/**
 * 커브 진입·진출에서 가중치가 0이 되는 포물선 커널(1-u²).
 * 선분별로 정확히 적분하여 위치와 그 도함수(접선)를 함께 구한다.
 * 균등 평균과 달리 직선→커브 경계에서 곡률이 0부터 연속으로 변한다.
 */
function taperedRouteSample(
  geometry: LineStringGeometry,
  distanceMeters: number,
  halfSpanM: number,
  routeLenM: number,
): { lng: number; lat: number; heading: number | null } | null {
  if (![distanceMeters, halfSpanM, routeLenM].every(Number.isFinite)) return null;
  const idx = routeMeterIndex(geometry);
  const fallback = () => {
    const p = getPointOnRouteByDistance(geometry, distanceMeters);
    return p ? { lng: p[0], lat: p[1], heading: headingAtRouteDistanceMeters(geometry, distanceMeters) } : null;
  };
  if (idx.coords.length < 2 || halfSpanM <= 1e-6 || routeLenM <= 0) return fallback();
  for (const hit of idx.smoothQ) {
    if (hit && hit.d === distanceMeters && hit.span === halfSpanM && hit.routeLen === routeLenM) return hit;
  }
  const span = halfSpanM;
  const center = Math.max(0, Math.min(routeLenM, distanceMeters));
  const lo = Math.max(0, center - span);
  const hi = Math.min(routeLenM, center + span);
  const cum = idx.cum;
  const coords = idx.coords;
  const origin = lngLatToMercatorMeters(coords[0]);
  let sumX = 0, sumY = 0, mass = 0;
  let derivativeX = 0, derivativeY = 0, derivativeMass = 0;
  const begin = firstCumGreaterThan(cum, lo);
  const start = cum[begin] <= lo ? coords.length : Math.max(0, begin - 1);
  for (let i = start; i < coords.length - 1; i++) {
    const length = cum[i + 1] - cum[i];
    if (length <= 0 || cum[i + 1] <= lo) continue;
    if (cum[i] >= hi) break;
    const u0 = (Math.max(lo, cum[i]) - center) / span;
    const u1 = (Math.min(hi, cum[i + 1]) - center) / span;
    const d2 = u1 * u1 - u0 * u0;
    const d3 = u1 ** 3 - u0 ** 3;
    const d4 = u1 ** 4 - u0 ** 4;
    const weight = span * (u1 - u0 - d3 / 3);
    const moment = span * span * (d2 / 2 - d4 / 4);
    const a = lngLatToMercatorMeters(coords[i]);
    const b = lngLatToMercatorMeters(coords[i + 1]);
    const vx = (b.x - a.x) / length;
    const vy = (b.y - a.y) / length;
    const x = a.x - origin.x + vx * (center - cum[i]);
    const y = a.y - origin.y + vy * (center - cum[i]);
    sumX += x * weight + vx * moment;
    sumY += y * weight + vy * moment;
    mass += weight;
    derivativeX += x * d2 + vx * span * 2 * d3 / 3;
    derivativeY += y * d2 + vy * span * 2 * d3 / 3;
    derivativeMass += d2;
  }
  if (!(mass > 1e-9)) return fallback();
  const x = sumX / mass, y = sumY / mass;
  const dx = derivativeX - x * derivativeMass;
  const dy = derivativeY - y * derivativeMass;
  const point = mercatorMetersToLngLat(origin.x + x, origin.y + y);
  const heading = Math.hypot(dx, dy) > 1e-10
    ? (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360
    : headingAtRouteDistanceMeters(geometry, center);
  const result = { d: distanceMeters, span, routeLen: routeLenM, lng: point[0], lat: point[1], heading };
  idx.smoothQ[idx.smoothQi] = result;
  idx.smoothQi = (idx.smoothQi + 1) % ROUTE_QUERY_SLOTS;
  return result;
}

/** 테이퍼를 적용한 표시 위치. halfSpanM은 앞뒤 영향 범위(m). */
export function smoothedRoutePoint(
  geometry: LineStringGeometry,
  distanceMeters: number,
  halfSpanM: number,
  routeLenM: number = lineStringLengthMeters(geometry),
): LngLat | null {
  const sample = taperedRouteSample(geometry, distanceMeters, halfSpanM, routeLenM);
  return sample ? [sample.lng, sample.lat] : null;
}

/** 표시 위치와 같은 곡선의 해석적 접선. 위치와 방향의 어긋남을 막는다. */
export function smoothedCurveHeadingAtRouteDistanceMeters(
  geometry: LineStringGeometry,
  distanceMeters: number,
  halfSpanM: number,
  routeLenM: number = lineStringLengthMeters(geometry),
): number | null {
  return taperedRouteSample(geometry, distanceMeters, halfSpanM, routeLenM)?.heading ?? null;
}

/** point 가 올라간 **현재 세그먼트** 방향(도). */
export function headingOnRouteAtPoint(geometry: LineStringGeometry, point: LngLat): number | null {
  const d = distanceOnRouteByProjectedPoint(geometry, point);
  if (d == null) return null;
  return headingAtRouteDistanceMeters(geometry, d);
}

/** 이동 벡터가 충분할 때만 GPS 방향, 아니면 현재 세그먼트 방향. */
export function resolveRiderBearingDeg(
  geometry: LineStringGeometry | null,
  pos: LngLat,
  prev: LngLat | null,
  minMoveMeters = 0.4,
): number {
  if (prev && getDistanceMeters(prev, pos) >= minMoveMeters) {
    return bearingDegrees(prev, pos);
  }
  if (geometry) {
    const h = headingOnRouteAtPoint(geometry, pos);
    if (h != null) return h;
  }
  return 0;
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
