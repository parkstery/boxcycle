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
  smoothQ: Array<{ d: number; span: number; routeLen: number; lng: number; lat: number } | null>;
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

/** LineString 꼭짓점마다 시작점부터의 누적 거리(m). `cum[0] === 0`. */
export function buildVertexCumulativeMeters(geometry: LineStringGeometry): number[] {
  return Array.from(routeMeterIndex(geometry).cum);
}

/** 경로 전장(m). */
export function lineStringLengthMeters(geometry: LineStringGeometry): number {
  const cum = routeMeterIndex(geometry).cum;
  return cum.length ? cum[cum.length - 1] : 0;
}

/**
 * 경로를 `intervalMeters` 간격으로 재샘플한 LineString(시종점 유지).
 * 「경로상 촘촘한 질의용」에 사용.
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
 * 경로 위 `[d−halfSpan, d+halfSpan]` 의 연속 평균 위치.
 * 선분마다 `겹친 길이 × 겹친 부분의 중점` 을 더하고, 창 길이(끝에서 잘리면 그 길이)로 나눈다.
 * 직선에서는 선 위에 있고, 코너에서는 안쪽으로 둥글게 돈다. 좌표는 머캐이터.
 */
export function smoothedRoutePoint(
  geometry: LineStringGeometry,
  distanceMeters: number,
  halfSpanM: number,
  routeLenM: number = lineStringLengthMeters(geometry),
): LngLat | null {
  if (!Number.isFinite(distanceMeters) || !Number.isFinite(halfSpanM) || !Number.isFinite(routeLenM)) {
    return null;
  }
  const coords = geometry.coordinates as LngLat[];
  if (!coords.length) return null;
  if (coords.length === 1) return coords[0];

  const span = Math.max(0, halfSpanM);
  const total = Math.max(0, routeLenM);
  const lo = Math.max(0, Math.min(total, distanceMeters - span));
  const hi = Math.max(lo, Math.min(total, distanceMeters + span));
  if (hi - lo <= 1e-9) return getPointOnRouteByDistance(geometry, lo);

  const idx = routeMeterIndex(geometry);
  const q = idx.smoothQ;
  for (let s = 0; s < ROUTE_QUERY_SLOTS; s += 1) {
    const hit = q[s];
    if (hit && hit.d === distanceMeters && hit.span === halfSpanM && hit.routeLen === routeLenM) {
      return [hit.lng, hit.lat];
    }
  }

  const cum = idx.cum;
  const indexed = idx.coords;
  let sumX = 0;
  let sumY = 0;
  let sumLen = 0;
  const begin = firstCumGreaterThan(cum, lo);
  const start = cum[begin] <= lo ? indexed.length : Math.max(0, begin - 1);
  for (let i = start; i < indexed.length - 1; i += 1) {
    const segLen = cum[i + 1] - cum[i];
    if (segLen <= 0) continue;
    const segStart = cum[i];
    const segEnd = cum[i + 1];
    if (segEnd <= lo) continue;
    if (segStart >= hi) break;
    const overlapLo = Math.max(lo, segStart);
    const overlapHi = Math.min(hi, segEnd);
    const overlap = overlapHi - overlapLo;
    if (overlap <= 0) continue;
    const tMid = ((overlapLo + overlapHi) / 2 - segStart) / segLen;
    const a = indexed[i];
    const b = indexed[i + 1];
    const pa = lngLatToMercatorMeters(a);
    const pb = lngLatToMercatorMeters(b);
    sumX += (pa.x + (pb.x - pa.x) * tMid) * overlap;
    sumY += (pa.y + (pb.y - pa.y) * tMid) * overlap;
    sumLen += overlap;
  }
  if (!(sumLen > 0)) return getPointOnRouteByDistance(geometry, lo);
  const point = mercatorMetersToLngLat(sumX / sumLen, sumY / sumLen);
  idx.smoothQ[idx.smoothQi] = {
    d: distanceMeters,
    span: halfSpanM,
    routeLen: routeLenM,
    lng: point[0],
    lat: point[1],
  };
  idx.smoothQi = (idx.smoothQi + 1) % ROUTE_QUERY_SLOTS;
  return point;
}

/**
 * 구간 평균 곡선의 진행 방위(도).
 * 도함수는 `(P(d+h) − P(d−h)) / 2h` 이므로 같은 반경의 끝점 현과 같다.
 */
export function smoothedCurveHeadingAtRouteDistanceMeters(
  geometry: LineStringGeometry,
  distanceMeters: number,
  halfSpanM: number,
  routeLenM: number = lineStringLengthMeters(geometry),
): number | null {
  return smoothedHeadingAtRouteDistanceMeters(geometry, distanceMeters, halfSpanM, routeLenM);
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
