/** 거리·방향 자동 Route — 서버 후보·선택 순수 로직(웹 `distanceAutoRoute.ts` 와 동기) */

export type LngLat = [number, number];

export const DIRECTION_TOLERANCE_DEG = 30;
/** provider 후보 탐색 시 직선 거리 배율 상한(내부). 최종 성공 허용에는 사용하지 않는다. */
export const MAX_DISTANCE_ERROR_RATIO = 0.2;
export const EXACT_TARGET_DISTANCE_TOLERANCE_M = 5;
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

export function bearingFromOriginToPoint(origin: LngLat, point: LngLat): number {
  const lat1 = toRad(origin[1]);
  const lat2 = toRad(point[1]);
  const dLng = toRad(point[0] - origin[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
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

export function scoreRouteExcessMeters(routeLengthMeters: number, targetMeters: number): number {
  if (routeLengthMeters < targetMeters) return Number.POSITIVE_INFINITY;
  return routeLengthMeters - targetMeters;
}

export function isDistanceErrorWithinMax(errorMeters: number, targetMeters: number): boolean {
  if (targetMeters <= 0) return false;
  return errorMeters / targetMeters <= MAX_DISTANCE_ERROR_RATIO;
}

export function isExactTargetDistance(distanceMeters: number, targetMeters: number): boolean {
  return Math.abs(distanceMeters - targetMeters) <= EXACT_TARGET_DISTANCE_TOLERANCE_M;
}

const WEB_MERCATOR_R = 6_378_137;

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

function interpolateLngLatAlongMercatorChord(a: LngLat, b: LngLat, ratio: number): LngLat {
  const t = Math.min(1, Math.max(0, ratio));
  const pa = lngLatToMercatorMeters(a);
  const pb = lngLatToMercatorMeters(b);
  return mercatorMetersToLngLat(pa.x + (pb.x - pa.x) * t, pa.y + (pb.y - pa.y) * t);
}

export function lineStringLengthMeters(geometry: {
  type: "LineString";
  coordinates: LngLat[];
}): number {
  const coords = geometry.coordinates;
  if (coords.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < coords.length; i += 1) {
    sum += getDistanceMeters(coords[i - 1]!, coords[i]!);
  }
  return sum;
}

export type ClipRouteGeometryResult =
  | {
      ok: true;
      geometry: { type: "LineString"; coordinates: LngLat[] };
      end: LngLat;
      distance: number;
      duration: number;
    }
  | { ok: false; reason: string };

export function clipRouteGeometryToTargetMeters(input: {
  geometry: { type: "LineString"; coordinates: LngLat[] };
  targetDistanceMeters: number;
  originalDuration: number;
  vertexToleranceMeters?: number;
}): ClipRouteGeometryResult {
  const coords = input.geometry.coordinates;
  if (!coords.length) return { ok: false, reason: "empty_geometry" };
  if (coords.length === 1) return { ok: false, reason: "single_point" };

  const totalLength = lineStringLengthMeters(input.geometry);
  if (totalLength < input.targetDistanceMeters) {
    return { ok: false, reason: "too_short" };
  }

  const vertexTolerance = input.vertexToleranceMeters ?? 1;
  const clipped: LngLat[] = [coords[0]!];
  let accumulated = 0;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const segStart = coords[i]!;
    const segEnd = coords[i + 1]!;
    const segDist = getDistanceMeters(segStart, segEnd);
    if (segDist <= 0) continue;

    const nextAccum = accumulated + segDist;
    if (nextAccum < input.targetDistanceMeters - vertexTolerance) {
      const last = clipped[clipped.length - 1]!;
      if (getDistanceMeters(last, segEnd) > vertexTolerance) {
        clipped.push(segEnd);
      }
      accumulated = nextAccum;
      continue;
    }

    if (Math.abs(nextAccum - input.targetDistanceMeters) <= vertexTolerance) {
      const last = clipped[clipped.length - 1]!;
      if (getDistanceMeters(last, segEnd) > vertexTolerance) {
        clipped.push(segEnd);
      }
      break;
    }

    const remaining = input.targetDistanceMeters - accumulated;
    const ratio = remaining / segDist;
    const point = interpolateLngLatAlongMercatorChord(segStart, segEnd, ratio);
    const last = clipped[clipped.length - 1]!;
    if (getDistanceMeters(last, point) > vertexTolerance) {
      clipped.push(point);
    }
    break;
  }

  if (clipped.length < 2) return { ok: false, reason: "clip_failed" };

  const clippedGeometry = { type: "LineString" as const, coordinates: clipped };
  const distance = lineStringLengthMeters(clippedGeometry);
  if (!isExactTargetDistance(distance, input.targetDistanceMeters)) {
    return { ok: false, reason: "distance_out_of_tolerance" };
  }

  const durationRatio = totalLength > 0 ? distance / totalLength : 0;
  return {
    ok: true,
    geometry: clippedGeometry,
    end: clipped[clipped.length - 1]!,
    distance,
    duration: input.originalDuration * durationRatio,
  };
}

export function angularBearingDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export type DirectionsRouteLike = {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distance: number;
  duration: number;
  /** Mapbox waypoints[last].location — profile 주행 가능 도로 스냅 종점 */
  snappedEnd?: LngLat | null;
  /** Mapbox waypoints[last].distance — raw endpoint↔snapped road (m) */
  endSnapDistanceMeters?: number | null;
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

/** 목표 이상 geometry만 남기고 초과량이 가장 작은 후보를 선택한다. */
export function pickBestExactDistanceAutoRoute(
  scored: ScoredAutoRoute[],
  targetDistanceMeters: number,
  clickBearingDeg?: number,
): ScoredAutoRoute | null {
  const eligible = scored.filter((item) => {
    const geomLen = lineStringLengthMeters(item.route.geometry);
    return geomLen >= targetDistanceMeters;
  });
  const withExcess = eligible.map((item) => ({
    ...item,
    errorMeters: scoreRouteExcessMeters(
      lineStringLengthMeters(item.route.geometry),
      targetDistanceMeters,
    ),
  }));
  return pickBestAutoRoute(withExcess, clickBearingDeg);
}

export function isValidAutoRouteEnd(origin: LngLat, end: LngLat, minMeters = 200): boolean {
  return getDistanceMeters(origin, end) >= minMeters;
}

export const AUTO_ROUTE_ALGORITHM_VERSION = "3F-B-click-road";

export const CLICK_INTENT_EARLY_SNAP_TOLERANCE_M = 100;
export const CLICK_INTENT_END_MISS_FAIL_M = 250;
export const CLICK_INTENT_SNAP_DEDUPE_M = 10;
export const CLICK_INTENT_CLICK_PROXIMITY_BUCKET_M = 10;
export const CLICK_INTENT_RING_RADII_M = [25, 75] as const;
export const CLICK_INTENT_RING_BEARINGS_DEG = [0, 45, 90, 135, 180, 225, 270, 315] as const;
export const MAX_AUTO_ROUTE_PROVIDER_CALLS = 35;

export function isValidLngLat(v: unknown): v is LngLat {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1])
  );
}

export function parseDirectionsSnapMetadata(
  route: DirectionsRouteLike,
): { snappedEnd: LngLat; endSnapDistanceMeters: number } | null {
  if (!isValidLngLat(route.snappedEnd)) return null;
  const dist = route.endSnapDistanceMeters;
  if (typeof dist !== "number" || !Number.isFinite(dist) || dist < 0) return null;
  return { snappedEnd: route.snappedEnd, endSnapDistanceMeters: dist };
}

export function buildClickSurroundingEndpoints(center: LngLat): LngLat[] {
  const out: LngLat[] = [];
  const seen = new Set<string>();
  for (const radius of CLICK_INTENT_RING_RADII_M) {
    for (const bearing of CLICK_INTENT_RING_BEARINGS_DEG) {
      const point = offsetLngLatByBearingMeters(center, bearing, radius);
      const key = `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(point);
    }
  }
  return out;
}

export type EvaluatedClickRoute = {
  geometry: DirectionsRouteLike["geometry"];
  distance: number;
  duration: number;
  clippedEnd: LngLat;
  snappedEnd: LngLat | null;
  endSnapDistanceMeters: number | null;
  snappedEndMissMeters: number | null;
  rawEndMissMeters: number;
  bearingErrorDeg: number;
  providerCallIndex: number;
  isDirectClick: boolean;
};

export function evaluateClickRouteCandidate(input: {
  route: DirectionsRouteLike;
  targetDistanceMeters: number;
  targetRoadPoint: LngLat;
  start: LngLat;
  clickBearingDeg: number;
  providerCallIndex: number;
  isDirectClick: boolean;
}): EvaluatedClickRoute | null {
  const geomLen = lineStringLengthMeters(input.route.geometry);
  if (geomLen < input.targetDistanceMeters) return null;

  const clipped = clipRouteGeometryToTargetMeters({
    geometry: input.route.geometry,
    targetDistanceMeters: input.targetDistanceMeters,
    originalDuration: input.route.duration,
  });
  if (!clipped.ok) return null;

  const snapMeta = parseDirectionsSnapMetadata(input.route);
  const snappedEnd = snapMeta?.snappedEnd ?? null;
  const endSnapDistanceMeters = snapMeta?.endSnapDistanceMeters ?? null;
  const snappedEndMissMeters =
    snappedEnd != null ? getDistanceMeters(snappedEnd, clipped.end) : null;
  const rawEndMissMeters = getDistanceMeters(input.targetRoadPoint, clipped.end);
  const endBearing = bearingFromOriginToPoint(input.start, clipped.end);

  return {
    geometry: clipped.geometry,
    distance: clipped.distance,
    duration: clipped.duration,
    clippedEnd: clipped.end,
    snappedEnd,
    endSnapDistanceMeters,
    snappedEndMissMeters,
    rawEndMissMeters,
    bearingErrorDeg: angularBearingDiffDeg(input.clickBearingDeg, endBearing),
    providerCallIndex: input.providerCallIndex,
    isDirectClick: input.isDirectClick,
  };
}

export function isClickIntentEarlySuccess(
  evaluated: EvaluatedClickRoute,
  targetDistanceMeters: number,
): boolean {
  if (!isExactTargetDistance(evaluated.distance, targetDistanceMeters)) return false;
  if (
    evaluated.endSnapDistanceMeters == null ||
    evaluated.endSnapDistanceMeters > CLICK_INTENT_EARLY_SNAP_TOLERANCE_M
  ) {
    return false;
  }
  if (
    evaluated.snappedEndMissMeters == null ||
    evaluated.snappedEndMissMeters > CLICK_INTENT_EARLY_SNAP_TOLERANCE_M
  ) {
    return false;
  }
  return true;
}

export function compareClickIntentRoutes(
  a: EvaluatedClickRoute,
  b: EvaluatedClickRoute,
  start: LngLat,
): number {
  const aSnappedMiss = a.snappedEndMissMeters ?? Number.POSITIVE_INFINITY;
  const bSnappedMiss = b.snappedEndMissMeters ?? Number.POSITIVE_INFINITY;
  if (aSnappedMiss !== bSnappedMiss) return aSnappedMiss - bSnappedMiss;

  if (a.rawEndMissMeters !== b.rawEndMissMeters) return a.rawEndMissMeters - b.rawEndMissMeters;

  const aClickSnap = a.endSnapDistanceMeters ?? Number.POSITIVE_INFINITY;
  const bClickSnap = b.endSnapDistanceMeters ?? Number.POSITIVE_INFINITY;
  if (aClickSnap !== bClickSnap) return aClickSnap - bClickSnap;

  const aProx =
    a.endSnapDistanceMeters != null
      ? a.endSnapDistanceMeters
      : a.rawEndMissMeters;
  const bProx =
    b.endSnapDistanceMeters != null
      ? b.endSnapDistanceMeters
      : b.rawEndMissMeters;
  const aBucket = Math.floor(aProx / CLICK_INTENT_CLICK_PROXIMITY_BUCKET_M);
  const bBucket = Math.floor(bProx / CLICK_INTENT_CLICK_PROXIMITY_BUCKET_M);
  if (aBucket === bBucket && a.snappedEnd && b.snappedEnd) {
    const aStartDist = getDistanceMeters(start, a.snappedEnd);
    const bStartDist = getDistanceMeters(start, b.snappedEnd);
    if (aStartDist !== bStartDist) return aStartDist - bStartDist;
  }

  if (a.bearingErrorDeg !== b.bearingErrorDeg) return a.bearingErrorDeg - b.bearingErrorDeg;
  return a.providerCallIndex - b.providerCallIndex;
}

export function pickBestClickIntentRoute(
  candidates: EvaluatedClickRoute[],
  targetDistanceMeters: number,
  start: LngLat,
): EvaluatedClickRoute | null {
  const exact = candidates.filter((item) =>
    isExactTargetDistance(item.distance, targetDistanceMeters),
  );
  if (exact.length === 0) return null;

  let best = exact[0]!;
  for (let i = 1; i < exact.length; i += 1) {
    const cur = exact[i]!;
    if (compareClickIntentRoutes(cur, best, start) < 0) best = cur;
  }
  return best;
}

export function isClickIntentEndMissAcceptable(evaluated: EvaluatedClickRoute): boolean {
  if (
    evaluated.snappedEndMissMeters != null &&
    evaluated.snappedEndMissMeters <= CLICK_INTENT_END_MISS_FAIL_M
  ) {
    return true;
  }
  return evaluated.rawEndMissMeters <= CLICK_INTENT_END_MISS_FAIL_M;
}

const NO_ROAD_NEAR_CLICK_MESSAGE =
  "선택 지점 가까이에 이 이동수단으로 이용 가능한 도로가 없습니다.";

export type AutoRouteClickDiagnostics = {
  rawClickMissMeters: number;
  snappedClickMissMeters: number | null;
  clickSnapMeters: number | null;
  snappedClickPoint: LngLat | null;
  actualEndBearingErrorDeg: number;
  routeDistanceErrorMeters: number;
  providerCallCount: number;
  searchElapsedMs: number;
};

export function computeAutoRouteClickDiagnostics(input: {
  start: LngLat;
  targetRoadPoint: LngLat;
  clippedEnd: LngLat;
  targetDistanceMeters: number;
  clippedDistanceMeters: number;
  snappedClickPoint?: LngLat | null;
  clickSnapMeters?: number | null;
  providerCallCount: number;
  searchElapsedMs: number;
}): AutoRouteClickDiagnostics {
  const rawClickMissMeters = getDistanceMeters(input.targetRoadPoint, input.clippedEnd);
  const hasSnappedClick =
    input.snappedClickPoint != null &&
    Array.isArray(input.snappedClickPoint) &&
    input.snappedClickPoint.length === 2;
  const snappedClickPoint = hasSnappedClick ? input.snappedClickPoint! : null;
  const clickBearing = bearingFromOriginToPoint(input.start, input.targetRoadPoint);
  const endBearing = bearingFromOriginToPoint(input.start, input.clippedEnd);
  const clickSnapFromProvider =
    typeof input.clickSnapMeters === "number" && Number.isFinite(input.clickSnapMeters)
      ? input.clickSnapMeters
      : null;
  return {
    rawClickMissMeters,
    snappedClickMissMeters: snappedClickPoint
      ? getDistanceMeters(snappedClickPoint, input.clippedEnd)
      : null,
    clickSnapMeters:
      clickSnapFromProvider ??
      (snappedClickPoint
        ? getDistanceMeters(input.targetRoadPoint, snappedClickPoint)
        : null),
    snappedClickPoint,
    actualEndBearingErrorDeg: angularBearingDiffDeg(clickBearing, endBearing),
    routeDistanceErrorMeters: Math.abs(input.clippedDistanceMeters - input.targetDistanceMeters),
    providerCallCount: input.providerCallCount,
    searchElapsedMs: input.searchElapsedMs,
  };
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

export type RouteProfile = "cycling" | "driving" | "walking";

export type FetchDirectionsFn = (
  profile: RouteProfile,
  start: LngLat,
  end: LngLat,
) => Promise<DirectionsRouteLike>;

export type DistanceAutoRouteSearchFound = {
  status: "found";
  geometry: DirectionsRouteLike["geometry"];
  distance: number;
  duration: number;
  end: LngLat;
  diagnostics: AutoRouteClickDiagnostics;
};

export type DistanceAutoRouteSearchFailed = {
  status: "failed";
  message: string;
  providerCallCount: number;
  searchElapsedMs: number;
};

export type DistanceAutoRouteSearchResult =
  | DistanceAutoRouteSearchFound
  | DistanceAutoRouteSearchFailed;

export async function searchDistanceAutoRoute(input: {
  start: LngLat;
  targetRoadPoint: LngLat;
  profile: RouteProfile;
  targetDistanceMeters: number;
  bearingDeg: number;
  fetchDirections: FetchDirectionsFn;
}): Promise<DistanceAutoRouteSearchResult> {
  const { start, targetRoadPoint, profile, targetDistanceMeters, bearingDeg, fetchDirections } =
    input;
  const searchStartedAt = Date.now();
  let providerCallCount = 0;
  const evaluated: EvaluatedClickRoute[] = [];
  let directSnappedEnd: LngLat | null = null;
  let directEndSnapDistanceMeters: number | null = null;
  let directTooShort = false;

  const endpoints: LngLat[] = [
    targetRoadPoint,
    ...buildClickSurroundingEndpoints(targetRoadPoint),
  ];

  for (let i = 0; i < endpoints.length && providerCallCount < MAX_AUTO_ROUTE_PROVIDER_CALLS; i += 1) {
    const endpoint = endpoints[i]!;
    const isDirectClick = i === 0;
    providerCallCount += 1;
    try {
      const route = await fetchDirections(profile, start, endpoint);
      const snapMeta = parseDirectionsSnapMetadata(route);

      if (isDirectClick) {
        if (snapMeta) {
          directSnappedEnd = snapMeta.snappedEnd;
          directEndSnapDistanceMeters = snapMeta.endSnapDistanceMeters;
          if (snapMeta.endSnapDistanceMeters > CLICK_INTENT_END_MISS_FAIL_M) {
            return {
              status: "failed",
              message: NO_ROAD_NEAR_CLICK_MESSAGE,
              providerCallCount,
              searchElapsedMs: Date.now() - searchStartedAt,
            };
          }
        }
      }

      if (lineStringLengthMeters(route.geometry) < targetDistanceMeters) {
        if (isDirectClick) directTooShort = true;
        continue;
      }

      const candidate = evaluateClickRouteCandidate({
        route,
        targetDistanceMeters,
        targetRoadPoint,
        start,
        clickBearingDeg: bearingDeg,
        providerCallIndex: providerCallCount,
        isDirectClick,
      });
      if (!candidate) continue;
      evaluated.push(candidate);

      if (isClickIntentEarlySuccess(candidate, targetDistanceMeters)) {
        const searchElapsedMs = Date.now() - searchStartedAt;
        const diagnostics = computeAutoRouteClickDiagnostics({
          start,
          targetRoadPoint,
          clippedEnd: candidate.clippedEnd,
          targetDistanceMeters,
          clippedDistanceMeters: candidate.distance,
          snappedClickPoint: directSnappedEnd,
          clickSnapMeters: directEndSnapDistanceMeters,
          providerCallCount,
          searchElapsedMs,
        });
        return {
          status: "found",
          geometry: candidate.geometry,
          distance: candidate.distance,
          duration: candidate.duration,
          end: candidate.clippedEnd,
          diagnostics,
        };
      }
    } catch {
      // provider 실패 — 다음 endpoint
    }
  }

  const searchElapsedMs = Date.now() - searchStartedAt;
  const best = pickBestClickIntentRoute(evaluated, targetDistanceMeters, start);

  if (!best || !isClickIntentEndMissAcceptable(best)) {
    let message: string;
    if (directEndSnapDistanceMeters != null && directEndSnapDistanceMeters > CLICK_INTENT_END_MISS_FAIL_M) {
      message = NO_ROAD_NEAR_CLICK_MESSAGE;
    } else if (directTooShort && evaluated.length === 0) {
      message = `목표거리(${(targetDistanceMeters / 1000).toFixed(1)} km)까지 도달하는 경로를 찾지 못했습니다. 클릭 지점이 목표 거리보다 가깝습니다.`;
    } else if (evaluated.length === 0) {
      message =
        providerCallCount > 0
          ? `목표거리(${(targetDistanceMeters / 1000).toFixed(1)} km) 이상의 경로를 찾지 못했습니다. 방향이나 거리를 바꿔 보세요.`
          : "목표거리와 적합한 경로를 찾지 못했습니다. 방향이나 거리를 바꿔 보세요.";
    } else {
      message =
        "클릭한 도로 근처에서 목표 연장에 맞는 경로를 찾지 못했습니다. 다른 위치를 클릭해 보세요.";
    }
    return {
      status: "failed",
      message,
      providerCallCount,
      searchElapsedMs,
    };
  }

  const diagnostics = computeAutoRouteClickDiagnostics({
    start,
    targetRoadPoint,
    clippedEnd: best.clippedEnd,
    targetDistanceMeters,
    clippedDistanceMeters: best.distance,
    snappedClickPoint: directSnappedEnd,
    clickSnapMeters: directEndSnapDistanceMeters,
    providerCallCount,
    searchElapsedMs,
  });

  return {
    status: "found",
    geometry: best.geometry,
    distance: best.distance,
    duration: best.duration,
    end: best.clippedEnd,
    diagnostics,
  };
}
