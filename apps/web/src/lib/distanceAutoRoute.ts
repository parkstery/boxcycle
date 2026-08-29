import type { LngLat } from "./geo";
import { getDistanceMeters, offsetLngLatByBearingMeters } from "./geo";
import type { DirectionsRoute } from "../services/mapboxDirections";

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
  const distanceFactors = [0.88, 0.94, 1.0, 1.06, 1.12];
  const bearingOffsets = [-12, -6, 0, 6, 12];
  const out: AutoRouteCandidate[] = [];
  const seen = new Set<string>();

  for (const bf of bearingOffsets) {
    for (const df of distanceFactors) {
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

export type ScoredAutoRoute = {
  candidate: AutoRouteCandidate;
  route: DirectionsRoute;
  errorMeters: number;
};

/** 목표 거리에 가장 가까운 경로 선택 */
export function pickBestAutoRoute(scored: ScoredAutoRoute[]): ScoredAutoRoute | null {
  if (scored.length === 0) return null;
  let best = scored[0];
  for (let i = 1; i < scored.length; i += 1) {
    if (scored[i].errorMeters < best.errorMeters) best = scored[i];
  }
  return best;
}

/** 후보 종점이 출발과 너무 가깝지 않은지 */
export function isValidAutoRouteEnd(origin: LngLat, end: LngLat, minMeters = 200): boolean {
  return getDistanceMeters(origin, end) >= minMeters;
}
