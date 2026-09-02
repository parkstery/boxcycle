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

export const AUTO_ROUTE_ALGORITHM_VERSION = "3F-C-R1-reach-offer";

export const MAX_AUTO_ROUTE_PROVIDER_CALLS = 12;
export const DETOUR_CALL_BUDGET = 8;

/** 클릭→도로 스냅 거리 초과 시 유일한 실패 (m) */
export const CLICK_SNAP_FAIL_M = 250;
/** direct road > D + 이 값 이면 offered (우회 시도 없이 즉시) (m) */
export const DIRECT_ROAD_EXCESS_TOLERANCE_M = 150;
/** offered 가 아닌데 endMiss 이 이 값 초과 시 offered 로 강등 (m) */
export const END_MISS_DEMOTE_TO_OFFERED_M = 200;

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

/**
 * waypoints[0] = start, waypoints[last] = end.
 * 중간 경과지가 있으면 waypoints[1..last-1] 에 포함.
 */
export type FetchDirectionsFn = (
  profile: RouteProfile,
  waypoints: LngLat[],
) => Promise<DirectionsRouteLike>;

export type AutoRouteOutcome = "exact" | "detoured" | "offered";

export type DistanceAutoRouteSearchFound = {
  status: "found";
  geometry: DirectionsRouteLike["geometry"];
  distance: number;
  duration: number;
  end: LngLat;
  outcome: AutoRouteOutcome;
  directRoadMeters: number;
  endMissMeters: number;
  detourCalls: number;
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

const NO_ROAD_NEAR_CLICK_MESSAGE =
  "선택 지점 가까이에 이 이동수단으로 이용 가능한 도로가 없습니다.";

function midpointLngLat(a: LngLat, b: LngLat): LngLat {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export async function searchDistanceAutoRoute(input: {
  start: LngLat;
  targetRoadPoint: LngLat;
  profile: RouteProfile;
  targetDistanceMeters: number;
  bearingDeg: number;
  fetchDirections: FetchDirectionsFn;
}): Promise<DistanceAutoRouteSearchResult> {
  const { start, targetRoadPoint, profile, targetDistanceMeters, fetchDirections } = input;
  const D = targetDistanceMeters;
  const searchStartedAt = Date.now();
  let providerCallCount = 0;
  let detourCalls = 0;

  // Stage 0 — direct measurement (항상 1회)
  providerCallCount += 1;
  let directRoute: DirectionsRouteLike;
  try {
    directRoute = await fetchDirections(profile, [start, targetRoadPoint]);
  } catch {
    return {
      status: "failed",
      message: "경로 검색 서비스에 연결하지 못했습니다.",
      providerCallCount,
      searchElapsedMs: Date.now() - searchStartedAt,
    };
  }

  const snapMeta0 = parseDirectionsSnapMetadata(directRoute);
  const clickSnapM = snapMeta0?.endSnapDistanceMeters ?? 0;
  const clickRoadPoint: LngLat = snapMeta0?.snappedEnd ?? targetRoadPoint;
  const directRoadM = directRoute.distance;

  if (clickSnapM > CLICK_SNAP_FAIL_M) {
    return {
      status: "failed",
      message: NO_ROAD_NEAR_CLICK_MESSAGE,
      providerCallCount,
      searchElapsedMs: Date.now() - searchStartedAt,
    };
  }

  // 절단 + 결과 조립 헬퍼
  function assembleResult(
    routeToClip: DirectionsRouteLike,
    pendingOutcome: AutoRouteOutcome,
  ): DistanceAutoRouteSearchResult {
    const clipped = clipRouteGeometryToTargetMeters({
      geometry: routeToClip.geometry,
      targetDistanceMeters: D,
      originalDuration: routeToClip.duration,
    });

    // 절단 실패 시 direct offered 로 fallback
    if (!clipped.ok) {
      const directClipped = clipRouteGeometryToTargetMeters({
        geometry: directRoute.geometry,
        targetDistanceMeters: D,
        originalDuration: directRoute.duration,
      });
      if (directClipped.ok) {
        return assembleFromClipped(directClipped, "offered");
      }
      return {
        status: "failed",
        message: "경로 절단에 실패했습니다.",
        providerCallCount,
        searchElapsedMs: Date.now() - searchStartedAt,
      };
    }

    return assembleFromClipped(clipped, pendingOutcome);
  }

  function assembleFromClipped(
    clipped: Extract<ClipRouteGeometryResult, { ok: true }>,
    pendingOutcome: AutoRouteOutcome,
  ): DistanceAutoRouteSearchFound {
    let finalOutcome = pendingOutcome;
    let finalGeometry = clipped.geometry;
    let finalEnd = clipped.end;
    let finalDistance = clipped.distance;
    let finalDuration = clipped.duration;

    const endMissM = getDistanceMeters(clipped.end, clickRoadPoint);

    // Hard gate: outcome != offered && endMiss > 200m → offered from direct
    if (finalOutcome !== "offered" && endMissM > END_MISS_DEMOTE_TO_OFFERED_M) {
      finalOutcome = "offered";
      const directClipped = clipRouteGeometryToTargetMeters({
        geometry: directRoute.geometry,
        targetDistanceMeters: D,
        originalDuration: directRoute.duration,
      });
      if (directClipped.ok) {
        finalGeometry = directClipped.geometry;
        finalEnd = directClipped.end;
        finalDistance = directClipped.distance;
        finalDuration = directClipped.duration;
      }
    }

    const finalEndMissM = getDistanceMeters(finalEnd, clickRoadPoint);
    const searchElapsedMs = Date.now() - searchStartedAt;

    const diagnostics = computeAutoRouteClickDiagnostics({
      start,
      targetRoadPoint,
      clippedEnd: finalEnd,
      targetDistanceMeters: D,
      clippedDistanceMeters: finalDistance,
      snappedClickPoint: clickRoadPoint,
      clickSnapMeters: clickSnapM,
      providerCallCount,
      searchElapsedMs,
    });

    return {
      status: "found",
      geometry: finalGeometry,
      distance: finalDistance,
      duration: finalDuration,
      end: finalEnd,
      outcome: finalOutcome,
      directRoadMeters: directRoadM,
      endMissMeters: finalEndMissM,
      detourCalls,
      diagnostics,
    };
  }

  // Stage 0 조기 종료: offered (road > D+150) 또는 exact (road in [D, D+150])
  if (directRoadM > D + DIRECT_ROAD_EXCESS_TOLERANCE_M) {
    return assembleResult(directRoute, "offered");
  }
  if (directRoadM >= D) {
    return assembleResult(directRoute, "exact");
  }

  // Stage 1 — regula falsi 우회 (Start→clickRoadPoint 축 ±90° 경과지)
  const axisBearing = bearingFromOriginToPoint(start, clickRoadPoint);
  const mid = midpointLngLat(start, clickRoadPoint);

  let bestDetourRoute: DirectionsRouteLike | null = null;
  let bestDetourF = Number.POSITIVE_INFINITY;

  async function trySide(sideSign: 1 | -1, sideBudget: number): Promise<boolean> {
    const sideAngle = (axisBearing + sideSign * 90 + 360) % 360;
    let rLo = 0;
    let fLo = directRoadM;
    let rHi: number | null = null;
    let fHi: number | null = null;
    let r = Math.max(10, (D - directRoadM) / 2);

    for (let i = 0; i < sideBudget; i += 1) {
      if (detourCalls >= DETOUR_CALL_BUDGET) break;

      const W = offsetLngLatByBearingMeters(mid, sideAngle, Math.max(1, r));
      detourCalls += 1;
      providerCallCount += 1;

      let route: DirectionsRouteLike;
      try {
        route = await fetchDirections(profile, [start, W, clickRoadPoint]);
      } catch {
        // provider 오류 → 지수 성장으로 다음 반경 시도
        if (rHi === null) r = r * 2;
        continue;
      }

      const f = route.distance;

      if (f >= D && f <= D + DIRECT_ROAD_EXCESS_TOLERANCE_M) {
        // 목표 범위 내 — 즉시 성공
        bestDetourRoute = route;
        bestDetourF = f;
        return true;
      }

      if (f >= D) {
        // 초과: 최소 초과 후보 갱신
        if (f < bestDetourF) {
          bestDetourRoute = route;
          bestDetourF = f;
        }
        // 새 상한 설정 후 regula falsi
        const prevR = r;
        rHi = r;
        fHi = f;
        const rf = rLo + (rHi - rLo) * (D - fLo) / (fHi - fLo);
        const bisect = (rLo + rHi) / 2;
        // 정체 방지: rf 가 상한에 너무 가까우면 이분 사용
        r = (rHi - rf) < 0.05 * (rHi - rLo) ? bisect : rf;
        if (r <= 0 || r === prevR) r = bisect;
      } else {
        // 부족: 하한 갱신
        const prevR = r;
        rLo = r;
        fLo = f;
        if (rHi === null) {
          r = r * 2; // 상한 미발견 → 지수 증가
        } else {
          const rf = rLo + (rHi - rLo) * (D - fLo) / (fHi! - fLo);
          const bisect = (rLo + rHi) / 2;
          r = (rf - rLo) < 0.05 * (rHi - rLo) ? bisect : rf;
          if (r >= rHi || r === prevR) r = bisect;
        }
      }
    }
    return false;
  }

  // +90° 먼저 4회, 이후 -90° 로 전환
  const plusFound = await trySide(1, 4);
  if (!plusFound && detourCalls < DETOUR_CALL_BUDGET) {
    await trySide(-1, DETOUR_CALL_BUDGET - detourCalls);
  }

  // Stage 2 — 절단·검증·응답
  if (bestDetourRoute !== null) {
    return assembleResult(bestDetourRoute, "detoured");
  }

  // 예산 소진, f≥D 후보 없음 → offered from direct
  return assembleResult(directRoute, "offered");
}
