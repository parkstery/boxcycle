import type { LineStringGeometry, LngLat } from "./geo";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "./geo";

export const ROUTE_ELEVATION_SAMPLE_COUNT = 72;

/**
 * 폴리라인 **꼭짓점 인덱스**를 균등 분할해 샘플링하면, 실제 호장 거리가 불균등해
 * 차트(인덱스=가로축)에서 DEM 잡음이 “수직 톱니”처럼 과대 표시된다.
 * Open-Meteo 질의는 **누적 거리 기준 균등** 위치에서 수행한다.
 */
export function sampleRouteCoordinatesByArcLength(geometry: LineStringGeometry, sampleCount: number): LngLat[] {
  const coords = geometry.coordinates as LngLat[];
  if (coords.length === 0) return [];
  if (coords.length === 1) return Array.from({ length: Math.max(2, sampleCount) }, () => coords[0]);
  const total = lineStringLengthMeters(geometry);
  if (total <= 0 || sampleCount < 2) {
    return [coords[0], coords[coords.length - 1]];
  }
  const sampled: LngLat[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const d = (i / (sampleCount - 1)) * total;
    const p = getPointOnRouteByDistance(geometry, d);
    if (p) sampled.push(p);
  }
  return sampled.length >= 2 ? sampled : [coords[0], coords[coords.length - 1]];
}

/** @deprecated 호장 샘플 `sampleRouteCoordinatesByArcLength` 사용 */
export function sampleRouteCoordinatesForElevation(coords: LngLat[], sampleCount: number): LngLat[] {
  if (coords.length <= sampleCount) return coords;
  const sampled: LngLat[] = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const idx = Math.round((i / (sampleCount - 1)) * (coords.length - 1));
    sampled.push(coords[idx]);
  }
  return sampled;
}

export async function fetchElevationsForCoords(sampledCoords: LngLat[]): Promise<number[]> {
  const latitudes = sampledCoords.map((coord) => coord[1].toFixed(6)).join(",");
  const longitudes = sampledCoords.map((coord) => coord[0].toFixed(6)).join(",");
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("elevation request failed");
  const data = (await response.json()) as { elevation?: number[] };
  if (!data.elevation || data.elevation.length < 2) throw new Error("empty elevation");
  return data.elevation;
}

export function routeElevationSignature(geometry: LineStringGeometry | null): string {
  if (!geometry || geometry.coordinates.length < 2) return "";
  const first = geometry.coordinates[0];
  const last = geometry.coordinates[geometry.coordinates.length - 1];
  return `${geometry.coordinates.length}:${first[0].toFixed(5)},${first[1].toFixed(5)}:${last[0].toFixed(5)},${last[1].toFixed(5)}`;
}

export async function fetchRouteElevationProfile(
  geometry: LineStringGeometry,
): Promise<{ values: number[]; sampledCoords: LngLat[] }> {
  const sampled = sampleRouteCoordinatesByArcLength(geometry, ROUTE_ELEVATION_SAMPLE_COUNT);
  const values = await fetchElevationsForCoords(sampled);
  return { values, sampledCoords: sampled };
}
