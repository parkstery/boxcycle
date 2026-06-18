import { createHash } from "node:crypto";

export type RouteProfile = "cycling" | "driving" | "walking";
export type LngLat = [number, number];

const PRECISION = 5;

export function encodeCanonicalRouteGeometryProfile(
  coordinates: readonly LngLat[],
  profile: RouteProfile,
): string {
  const parts = coordinates.map(
    ([lng, lat]) => `${lng.toFixed(PRECISION)},${lat.toFixed(PRECISION)}`,
  );
  return `${parts.join(";")}|${profile}`;
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
