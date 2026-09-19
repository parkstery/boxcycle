import type { LineStringGeometry, LngLat } from "./geo";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "./geo";

export const ROUTE_ELEVATION_SAMPLE_COUNT = 72;

/**
 * 고도 API 일일 한도 초과(HTTP 429).
 *
 * 2026-09-18, Open-Meteo 일일 한도를 태워 429 가 떨어졌는데 네트워크 오류와 같은 에러로
 * 뭉개져 UI 에 「고도 데이터를 불러오지 못했습니다」만 남았고, 코드 회귀로 오인됐다.
 * 같은 오해를 막으려고 한도 초과만 따로 구분한다(`RIDE-ELEVATION-QUOTA-1`).
 */
export class ElevationQuotaError extends Error {
  constructor() {
    super("elevation daily quota exceeded");
    this.name = "ElevationQuotaError";
  }
}

export function isElevationQuotaError(error: unknown): boolean {
  return error instanceof ElevationQuotaError;
}

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
  if (response.status === 429) throw new ElevationQuotaError();
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

export type RouteElevationProfile = { values: number[]; sampledCoords: LngLat[] };

/**
 * 같은 경로를 다시 열 때 재요청하지 않기 위한 세션 캐시.
 * 경로 1회 = 72 콜(ROUTE_ELEVATION_SAMPLE_COUNT)이므로, 개발 중 새로고침만으로도 일일 한도가 빠르게 준다.
 * 키는 `routeElevationSignature` 를 그대로 쓴다. 탭을 닫으면 사라지는 sessionStorage 로 충분하다.
 */
const ELEVATION_CACHE_PREFIX = "rtw.routeElevation.v1:";

function elevationCacheStore(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    // Safari 프라이빗 등 접근 자체가 throw 하는 환경
    return null;
  }
}

/** 축퇴 방어 — 형태가 깨졌거나 좌표 수와 어긋난 캐시는 없는 것으로 친다. */
function isUsableProfile(value: unknown): value is RouteElevationProfile {
  if (!value || typeof value !== "object") return false;
  const { values, sampledCoords } = value as Partial<RouteElevationProfile>;
  if (!Array.isArray(values) || !Array.isArray(sampledCoords)) return false;
  if (values.length < 2 || values.length !== sampledCoords.length) return false;
  if (!values.every((v) => typeof v === "number" && Number.isFinite(v))) return false;
  return sampledCoords.every(
    (c) => Array.isArray(c) && c.length === 2 && c.every((n) => typeof n === "number" && Number.isFinite(n)),
  );
}

export function readRouteElevationCache(routeSig: string): RouteElevationProfile | null {
  if (!routeSig) return null;
  const store = elevationCacheStore();
  if (!store) return null;
  try {
    const raw = store.getItem(ELEVATION_CACHE_PREFIX + routeSig);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isUsableProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeRouteElevationCache(routeSig: string, profile: RouteElevationProfile): void {
  if (!routeSig || !isUsableProfile(profile)) return;
  const store = elevationCacheStore();
  if (!store) return;
  try {
    store.setItem(ELEVATION_CACHE_PREFIX + routeSig, JSON.stringify(profile));
  } catch {
    // 용량 초과 등 — 캐시는 있으면 좋은 것이지 없으면 안 되는 것이 아니다.
  }
}

export function clearRouteElevationCache(): void {
  const store = elevationCacheStore();
  if (!store) return;
  try {
    for (const key of Object.keys(store)) {
      if (key.startsWith(ELEVATION_CACHE_PREFIX)) store.removeItem(key);
    }
  } catch {
    // no-op
  }
}

export async function fetchRouteElevationProfile(
  geometry: LineStringGeometry,
): Promise<RouteElevationProfile> {
  const routeSig = routeElevationSignature(geometry);
  const cached = readRouteElevationCache(routeSig);
  if (cached) return cached;

  const sampled = sampleRouteCoordinatesByArcLength(geometry, ROUTE_ELEVATION_SAMPLE_COUNT);
  const values = await fetchElevationsForCoords(sampled);
  const profile: RouteElevationProfile = { values, sampledCoords: sampled };
  writeRouteElevationCache(routeSig, profile);
  return profile;
}
