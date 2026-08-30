import type { LngLat } from "./geo";
import { getDistanceMeters, offsetLngLatByBearingMeters } from "./geo";
import type { DirectionsRoute } from "../services/mapboxDirections";

/** 클릭 방향 기준 허용 각도(°) — §10 */
export const DIRECTION_TOLERANCE_DEG = 30;

/** 목표 거리 대비 최대 허용 오차 비율 — §12 */
export const MAX_DISTANCE_ERROR_RATIO = 0.2;

/** 직선 거리 후보 배율 — §7.2 */
export const AUTO_ROUTE_DISTANCE_FACTORS = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3] as const;

/** 방위 미세 조정(°) — ±DIRECTION_TOLERANCE_DEG 범위 */
export const AUTO_ROUTE_BEARING_OFFSETS_DEG = [-30, -15, 0, 15, 30] as const;

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

/** 목표 거리 원 — GeoJSON LineString(지도 stroke용) */
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
