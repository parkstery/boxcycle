import type { LineStringGeometry, LngLat } from "../geo/geo";
import { getPointOnRouteByDistance, lineStringLengthMeters } from "../geo/geo";

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

/**
 * 공유 저장소(경로당 1회 저장)용 키.
 *
 * `routeElevationSignature` 는 「좌표 수 + 시점 + 종점」만 본다. 한 탭 안에서는 충분하지만,
 * **모든 사용자가 공유하는** 저장소의 키로 쓰면 시종점과 꼭짓점 수가 같은 다른 경로가
 * 남의 표고를 받아간다. 그래서 전체 좌표를 FNV-1a 로 접어 별도 키를 만든다.
 */
export function routeElevationCacheKey(geometry: LineStringGeometry | null): string {
  if (!geometry || geometry.coordinates.length < 2) return "";
  const MASK = 0xffffffffffffffffn;
  const PRIME = 0x100000001b3n;
  let hash = 0xcbf29ce484222325n;
  for (const [lng, lat] of geometry.coordinates as LngLat[]) {
    const token = `${lng.toFixed(6)},${lat.toFixed(6)};`;
    for (let i = 0; i < token.length; i += 1) {
      hash = ((hash ^ BigInt(token.charCodeAt(i))) * PRIME) & MASK;
    }
  }
  return `v1-${geometry.coordinates.length}-${hash.toString(16).padStart(16, "0")}`;
}

/**
 * 경로 표고의 영구 저장소(Firestore 어댑터를 호출부가 주입한다).
 *
 * 도로의 고도는 변하지 않는다 — 같은 경로를 누가 몇 번 달리든 질의는 **평생 한 번**이면 된다.
 * 이 계층이 있으면 호출량이 「주행 수」가 아니라 「경로 수」로 떨어지고, 나중에 공급원을
 * 무엇으로 바꾸든(유료 Open-Meteo·Mapbox·자체 DEM) 갈아끼울 지점이 여기 하나로 모인다.
 * 라이브러리를 순수하게 두려고 구현이 아니라 인터페이스만 받는다.
 */
export type SharedElevationStore = {
  /** 값만 돌려준다 — 샘플 좌표는 기하에서 다시 계산한다(원격 좌표를 믿지 않는다). */
  read(key: string): Promise<number[] | null>;
  write(key: string, values: number[]): Promise<void>;
};

export async function fetchRouteElevationProfile(
  geometry: LineStringGeometry,
  store?: SharedElevationStore,
): Promise<RouteElevationProfile> {
  // ① 이 탭에서 이미 받은 경로 — 아무 데도 묻지 않는다.
  const routeSig = routeElevationSignature(geometry);
  const cached = readRouteElevationCache(routeSig);
  if (cached) return cached;

  // ② 다른 사람이 이미 받아 둔 경로 — Open-Meteo 대신 저장소에서 읽는다(72콜 → 0콜).
  const sharedKey = routeElevationCacheKey(geometry);
  if (store && sharedKey) {
    const shared = await store.read(sharedKey).catch(() => null);
    if (shared && shared.length >= 2) {
      const profile: RouteElevationProfile = {
        values: shared,
        sampledCoords: sampleRouteCoordinatesByArcLength(geometry, shared.length),
      };
      writeRouteElevationCache(routeSig, profile);
      return profile;
    }
  }

  // ③ 아무도 받은 적 없는 경로 — 이때만 실제로 질의하고, 다음 사람을 위해 남긴다.
  const sampled = sampleRouteCoordinatesByArcLength(geometry, ROUTE_ELEVATION_SAMPLE_COUNT);
  const values = await fetchElevationsForCoords(sampled);
  const profile: RouteElevationProfile = { values, sampledCoords: sampled };
  writeRouteElevationCache(routeSig, profile);
  if (store && sharedKey) {
    // 저장 실패는 다음 사람이 한 번 더 묻는 것일 뿐 — 이번 주행을 막지 않는다.
    void store.write(sharedKey, values).catch(() => undefined);
  }
  return profile;
}
