import { createHash } from "node:crypto";

export type RouteProfile = "cycling" | "driving" | "walking";
export type LngLat = [number, number];

const PRECISION = 5;
/** 거리 버킷 크기(m) — 클라 routeFingerprint.ts 와 반드시 동일하게 유지. */
const DISTANCE_BUCKET_METERS = 100;

/** 두 좌표 간 거리(m) — 클라 getDistanceMeters 와 동일한 haversine. */
function distanceMeters(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * "같은 경로" 판정 지문 — 출발·도착 좌표 + 거리 버킷 + 이동 수단.
 * ⚠️ 클라 apps/web/src/lib/routeFingerprint.ts 와 규칙이 반드시 일치해야 한다
 * (한쪽만 바꾸면 클라·서버 중복 판정이 어긋난다).
 */
export function encodeCanonicalRouteGeometryProfile(
  coordinates: readonly LngLat[],
  profile: RouteProfile,
): string {
  const first = coordinates[0] ?? [0, 0];
  const last = coordinates[coordinates.length - 1] ?? [0, 0];
  const at = ([lng, lat]: LngLat) => `${lng.toFixed(PRECISION)},${lat.toFixed(PRECISION)}`;
  let meters = 0;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    meters += distanceMeters(coordinates[i], coordinates[i + 1]);
  }
  const distBucket = Math.round(meters / DISTANCE_BUCKET_METERS);
  return `${at(first)}>${at(last)}|${distBucket}|${profile}`;
}

export function computeRouteFingerprintHex(
  coordinates: readonly LngLat[],
  profile: RouteProfile,
): string {
  const canonical = encodeCanonicalRouteGeometryProfile(coordinates, profile);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function encodeGeometryCoordsJson(coordinates: readonly LngLat[]): string {
  return JSON.stringify(coordinates);
}

export function resolveRouteProfile(raw: unknown): RouteProfile {
  return raw === "driving" || raw === "walking" ? raw : "cycling";
}
