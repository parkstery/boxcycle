/** 거리·방향 자동 Route — 서버 후보·선택 순수 로직(웹 `distanceAutoRoute.ts` 와 동기) */

export type LngLat = [number, number];

export const DIRECTION_TOLERANCE_DEG = 30;
export const MAX_DISTANCE_ERROR_RATIO = 0.2;
export const AUTO_ROUTE_DISTANCE_FACTORS = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3] as const;
export const AUTO_ROUTE_BEARING_OFFSETS_DEG = [-30, -15, 0, 15, 30] as const;

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function getDistanceMeters(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sLat1 = toRad(lat1);
  const sLat2 = toRad(lat2);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(sLat1) * Math.cos(sLat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function offsetLngLatByBearingMeters(origin: LngLat, bearingDeg: number, meters: number): LngLat {
  const brng = toRad(bearingDeg);
  const lat1 = toRad(origin[1]);
  const lng1 = toRad(origin[0]);
  const angDist = meters / EARTH_RADIUS_M;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [toDeg(lng2), toDeg(lat2)];
}

export type AutoRouteCandidate = {
  end: LngLat;
  bearingDeg: number;
  straightLineMeters: number;
};

export function buildAutoRouteCandidates(
  origin: LngLat,
  bearingDeg: number,
  targetDistanceMeters: number,
): AutoRouteCandidate[] {
  const out: AutoRouteCandidate[] = [];
  const seen = new Set<string>();

  for (const bf of AUTO_ROUTE_BEARING_OFFSETS_DEG) {
    for (const df of AUTO_ROUTE_DISTANCE_FACTORS) {
      const straightM = targetDistanceMeters * df;
      const bearing = (bearingDeg + bf + 360) % 360;
      const end = offsetLngLatByBearingMeters(origin, bearing, straightM);
      const key = `${end[0].toFixed(5)},${end[1].toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ end, bearingDeg: bearing, straightLineMeters: straightM });
    }
  }
  return out;
}

export function scoreRouteDistanceError(routeDistanceMeters: number, targetMeters: number): number {
  return Math.abs(routeDistanceMeters - targetMeters);
}

export function isDistanceErrorWithinMax(errorMeters: number, targetMeters: number): boolean {
  if (targetMeters <= 0) return false;
  return errorMeters / targetMeters <= MAX_DISTANCE_ERROR_RATIO;
}

export function angularBearingDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export type DirectionsRouteLike = {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distance: number;
  duration: number;
};

export type ScoredAutoRoute = {
  candidate: AutoRouteCandidate;
  route: DirectionsRouteLike;
  errorMeters: number;
};

export function snappedEndFromRoute(route: DirectionsRouteLike): LngLat {
  const coords = route.geometry.coordinates;
  const last = coords[coords.length - 1]!;
  return [last[0], last[1]];
}

export function pickBestAutoRoute(
  scored: ScoredAutoRoute[],
  clickBearingDeg?: number,
): ScoredAutoRoute | null {
  if (scored.length === 0) return null;
  let best = scored[0]!;
  for (let i = 1; i < scored.length; i += 1) {
    const cur = scored[i]!;
    if (cur.errorMeters < best.errorMeters) {
      best = cur;
      continue;
    }
    if (cur.errorMeters > best.errorMeters) continue;
    if (clickBearingDeg == null) continue;
    const curBear = angularBearingDiffDeg(cur.candidate.bearingDeg, clickBearingDeg);
    const bestBear = angularBearingDiffDeg(best.candidate.bearingDeg, clickBearingDeg);
    if (curBear < bestBear) best = cur;
  }
  return best;
}

export function isValidAutoRouteEnd(origin: LngLat, end: LngLat, minMeters = 200): boolean {
  return getDistanceMeters(origin, end) >= minMeters;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: R[] = [];
  let index = 0;

  async function runOne(): Promise<void> {
    while (index < items.length) {
      const i = index;
      index += 1;
      const result = await worker(items[i]!);
      if (result != null) out.push(result);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => runOne());
  await Promise.all(runners);
  return out;
}
