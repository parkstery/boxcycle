import type { LngLat } from "../geo/geo";
import { getDistanceMeters, offsetLngLatByBearingMeters } from "../geo/geo";
import type { DirectionsRoute } from "../../services/mapboxDirections";

/** 클릭 방향 기준 허용 각도(°) — §10 */
export const DIRECTION_TOLERANCE_DEG = 30;

/** 목표 거리 대비 최대 허용 오차 비율 — §12 */
export const MAX_DISTANCE_ERROR_RATIO = 0.2;

/** 직선 거리 후보 배율 — §7.2 */
export const AUTO_ROUTE_DISTANCE_FACTORS = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3] as const;

/** 방위 미세 조정(°) — ±DIRECTION_TOLERANCE_DEG 범위 */
export const AUTO_ROUTE_BEARING_OFFSETS_DEG = [-30, -15, 0, 15, 30] as const;

/** 참고 원 안내 문구 — 도넛 아님, 눈금 역할 */
export const DISTANCE_AUTO_ROUTE_REFERENCE_CIRCLE_HINT =
  "참고 — 실제 도로 거리는 방향에 따라 다릅니다";

/** 지도 클릭 지점 기준 출발→클릭 방위각(0=북, 시계방향) */
export function bearingFromOriginToPoint(origin: LngLat, point: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const lat1 = toRad(origin[1]);
  const lat2 = toRad(point[1]);
  const dLng = toRad(point[0] - origin[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/** 목표 거리 참고 원 — GeoJSON LineString(지도 stroke용) */
export function circleLineString(
  center: LngLat,
  radiusMeters: number,
  segments = 72,
): { type: "LineString"; coordinates: [number, number][] } {
  const coords: [number, number][] = [];
  for (let i = 0; i <= segments; i += 1) {
    const bearing = (360 * i) / segments;
    coords.push(offsetLngLatByBearingMeters(center, bearing, radiusMeters));
  }
  return { type: "LineString", coordinates: coords };
}

/** 거리 안내 원 위 방사 화살표 개수(30° 간격) */
export const CIRCLE_RADIAL_ARROW_COUNT = 12;

const CIRCLE_RADIAL_ARROW_BEARING_STEP_DEG = 360 / CIRCLE_RADIAL_ARROW_COUNT;
/** 몸통 시작·끝 — 원 둘레 바로 안쪽에서 바깥(둘레) 방향 */
const ARROW_SHAFT_INNER_RADIUS_RATIO = 0.88;
const ARROW_SHAFT_OUTER_RADIUS_RATIO = 1;
/** 거리와 무관하게 원에 맞춰 표시되도록 날개도 반경 비율을 쓴다. */
const ARROW_WING_LENGTH_RADIUS_RATIO = 0.055;
const ARROW_WING_SPREAD_DEG = 32;

export type CircleLineMetrics = { center: LngLat; radiusMeters: number };

/** 참고 원 LineString 에서 중심·평균 반경 추정(출발·반경 변경 시에만 호출). */
export function inferCircleLineMetrics(circle: {
  coordinates: [number, number][];
}): CircleLineMetrics | null {
  const coords = circle.coordinates;
  if (coords.length < 3) return null;
  // 닫힘점 중복은 북쪽 편향을 만든다. 경도 평균 대신 구면 벡터를 평균해 날짜변경선도 처리.
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  const unique = Math.abs(first[0] - last[0]) < 1e-8 && Math.abs(first[1] - last[1]) < 1e-8
    ? coords.slice(0, -1) : coords;
  let x = 0, y = 0, z = 0;
  for (const [lng, lat] of unique) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    const longitude = lng * Math.PI / 180;
    const latitude = lat * Math.PI / 180;
    x += Math.cos(latitude) * Math.cos(longitude);
    y += Math.cos(latitude) * Math.sin(longitude);
    z += Math.sin(latitude);
  }
  const center: LngLat = [Math.atan2(y, x) * 180 / Math.PI,
    Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI];
  let radiusSum = 0;
  for (const c of coords) {
    radiusSum += getDistanceMeters(center, c);
  }
  const radiusMeters = radiusSum / coords.length;
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return null;
  return { center, radiusMeters };
}

export type CircleRadialArrowFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, never>;
    geometry: {
      type: "MultiLineString";
      coordinates: [number, number][][];
    };
  }>;
};

/** 중심·반경으로 12개 방사 화살표(몸통+날개 2) GeoJSON */
export function buildCircleRadialArrowFeatureCollection(
  center: LngLat,
  radiusMeters: number,
): CircleRadialArrowFeatureCollection {
  const wingLen = radiusMeters * ARROW_WING_LENGTH_RADIUS_RATIO;
  const features: CircleRadialArrowFeatureCollection["features"] = [];

  for (let i = 0; i < CIRCLE_RADIAL_ARROW_COUNT; i += 1) {
    const bearing = i * CIRCLE_RADIAL_ARROW_BEARING_STEP_DEG;
    const inner = offsetLngLatByBearingMeters(
      center,
      bearing,
      radiusMeters * ARROW_SHAFT_INNER_RADIUS_RATIO,
    );
    const tip = offsetLngLatByBearingMeters(
      center,
      bearing,
      radiusMeters * ARROW_SHAFT_OUTER_RADIUS_RATIO,
    );
    const back = (bearing + 180) % 360;
    const wingLeft = offsetLngLatByBearingMeters(
      tip,
      (back - ARROW_WING_SPREAD_DEG + 360) % 360,
      wingLen,
    );
    const wingRight = offsetLngLatByBearingMeters(
      tip,
      (back + ARROW_WING_SPREAD_DEG) % 360,
      wingLen,
    );
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiLineString",
        coordinates: [[inner, tip], [tip, wingLeft], [tip, wingRight]],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function buildCircleRadialArrowsFromLineString(circle: {
  type: "LineString";
  coordinates: [number, number][];
}): CircleRadialArrowFeatureCollection | null {
  const metrics = inferCircleLineMetrics(circle);
  if (!metrics) return null;
  return buildCircleRadialArrowFeatureCollection(metrics.center, metrics.radiusMeters);
}

export type AutoRouteCandidate = {
  end: LngLat;
  bearingDeg: number;
  straightLineMeters: number;
};

/**
 * 방향·목표 거리로 후보 종점 생성.
 * 직선 거리 스윕 × 방위 미세 조정 — Directions 가 도로 스냅·실거리를 계산한다.
 */
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

/** 두 방위각 차이(0~180°) */
export function angularBearingDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export type ScoredAutoRoute = {
  candidate: AutoRouteCandidate;
  route: DirectionsRoute;
  errorMeters: number;
};

/** Directions geometry 마지막 점 = 도로 스냅된 종점 */
export function snappedEndFromRoute(route: DirectionsRoute): LngLat {
  const coords = route.geometry.coordinates;
  const last = coords[coords.length - 1]!;
  return [last[0], last[1]];
}

/**
 * 목표 거리에 가장 가까운 경로 선택.
 * 1순위: 거리 오차 최소 · 2순위: 클릭 방향과의 방위 일치 — §11
 */
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

/** 후보 종점이 출발과 너무 가깝지 않은지 */
export function isValidAutoRouteEnd(origin: LngLat, end: LngLat, minMeters = 200): boolean {
  return getDistanceMeters(origin, end) >= minMeters;
}
