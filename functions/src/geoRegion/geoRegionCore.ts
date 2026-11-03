/**
 * 위치 판정 — 좌표 하나 → 지역 표시(geoRegion). **순수 계산**(파일·Firestore 접근 없음).
 *
 * 계획: document/ops/20261103-global-geo-data/00-plan.md §3
 *
 * 왜 서버 한 곳인가 — `geoTiles.ts` 주석의 사고(같은 칸 계산이 세 군데에 있어 어긋나면
 * 에러 없이 기능만 사라짐)를 반복하지 않기 위해, 국가·행정구역 판정은 **이 모듈만** 한다.
 * 클라이언트는 판정하지 않고 저장된 결과를 읽는다.
 *
 * 판정 순서
 *   1. 국가: 국경 다각형 안에 있는가 → 없으면 가장 가까운 국경 COUNTRY_FALLBACK_METERS 이내
 *      (해안 도로·작은 섬처럼 단순화 오차로 바다에 떨어진 점을 구한다). 그래도 없으면 null.
 *   2. 행정구역: **1의 나라 안에서만** 같은 방식(최대 ADMIN1_FALLBACK_METERS).
 *      독도처럼 행정구역 데이터에 없는 섬은 가장 가까운 같은 나라 행정구역(울릉도→KR-47)이 된다.
 *   3. 대륙: 국가 데이터에 붙은 값.
 *   4. quadkey: 웹 지도 타일(z16) — Conquest 셀과 같은 `lngLatToTileXY` 를 쓴다(D6).
 */
import { lngLatToTileXY, type LngLat } from "../geoTiles.js";

/** 저장하는 타일 단계. 앞 n 글자 = z(n) 상위 타일이므로 범위 검색은 앞부분 일치로 한다. */
export const GEO_QUADKEY_ZOOM = 16;
/** 국경 밖 점을 가장 가까운 나라로 붙여 주는 최대 거리. */
export const COUNTRY_FALLBACK_METERS = 30_000;
/** 같은 나라 안에서 행정구역 경계 밖 점을 붙여 주는 최대 거리(독도↔울릉도 약 87km). */
export const ADMIN1_FALLBACK_METERS = 150_000;

export type ContinentCode = "AS" | "EU" | "AF" | "NA" | "SA" | "OC" | "AN";

export type GeoRegion = {
  geoQuadkey: string;
  geoContinent: ContinentCode | null;
  geoCountry: string | null;
  geoAdmin1: string | null;
  geoResolverVersion: number;
};

/** 해독된 다각형. 고리는 [x0, y0, x1, y1, ...] 절대 경위도. 첫 고리 = 바깥, 나머지 = 구멍. */
export type GeoPolygon = {
  bbox: readonly [number, number, number, number];
  rings: readonly Float64Array[];
};
export type GeoArea = { code: string; polygons: readonly GeoPolygon[] };
export type GeoCountry = GeoArea & { continent: ContinentCode | null };

export interface GeoRegionDataset {
  readonly version: number;
  readonly countries: readonly GeoCountry[];
  /** 그 나라의 행정구역. 없으면 빈 배열. */
  admin1Of(country: string): readonly GeoArea[];
}

const METERS_PER_DEG = 111_320;

/** 타일 → quadkey(Bing 방식, 한 글자 = 한 단계). */
export function tileQuadkey(x: number, y: number, zoom: number): string {
  let out = "";
  for (let i = zoom; i > 0; i -= 1) {
    const mask = 1 << (i - 1);
    let digit = 0;
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    out += String(digit);
  }
  return out;
}

export function geoQuadkeyAt(lngLat: LngLat, zoom = GEO_QUADKEY_ZOOM): string {
  const { x, y } = lngLatToTileXY(lngLat[0], lngLat[1], zoom);
  return tileQuadkey(x, y, zoom);
}

function ringContains(ring: Float64Array, x: number, y: number): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = ring[i];
    const yi = ring[i + 1];
    const xj = ring[j];
    const yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonContains(poly: GeoPolygon, x: number, y: number): boolean {
  const [minX, minY, maxX, maxY] = poly.bbox;
  if (x < minX || x > maxX || y < minY || y > maxY) return false;
  if (!ringContains(poly.rings[0], x, y)) return false;
  for (let h = 1; h < poly.rings.length; h += 1) {
    if (ringContains(poly.rings[h], x, y)) return false;
  }
  return true;
}

/** 점 ↔ 다각형 테두리 최단 거리(m). 점 위도의 등장방형 근사 — 수백 km 이내 판정용. */
function distanceToPolygonMeters(poly: GeoPolygon, x: number, y: number): number {
  const kx = Math.cos((y * Math.PI) / 180) * METERS_PER_DEG;
  const ky = METERS_PER_DEG;
  let best = Infinity;
  for (const ring of poly.rings) {
    const n = ring.length;
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
      const ax = (ring[j] - x) * kx;
      const ay = (ring[j + 1] - y) * ky;
      const bx = (ring[i] - x) * kx;
      const by = (ring[i + 1] - y) * ky;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best) best = d;
    }
  }
  return best;
}

function bboxGapMeters(poly: GeoPolygon, x: number, y: number): number {
  const [minX, minY, maxX, maxY] = poly.bbox;
  const gx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
  const gy = y < minY ? minY - y : y > maxY ? y - maxY : 0;
  return Math.hypot(gx * Math.cos((y * Math.PI) / 180) * METERS_PER_DEG, gy * METERS_PER_DEG);
}

export type AreaHit<T extends GeoArea> = { area: T; fallbackMeters: number | null };

/**
 * 점을 담는 구역 → 없으면 maxFallbackMeters 안의 가장 가까운 구역.
 * 단순화로 이웃 경계가 조금 겹치면 둘 다 담을 수 있다 — 그때는 입력 순서(코드순)의 첫 것.
 */
export function findArea<T extends GeoArea>(
  areas: readonly T[],
  lngLat: LngLat,
  maxFallbackMeters: number,
): AreaHit<T> | null {
  const [x, y] = lngLat;
  for (const area of areas) {
    for (const poly of area.polygons) {
      if (polygonContains(poly, x, y)) return { area, fallbackMeters: null };
    }
  }
  let best: T | null = null;
  let bestD = maxFallbackMeters;
  for (const area of areas) {
    for (const poly of area.polygons) {
      if (bboxGapMeters(poly, x, y) > bestD) continue;
      const d = distanceToPolygonMeters(poly, x, y);
      if (d <= bestD) {
        bestD = d;
        best = area;
      }
    }
  }
  return best ? { area: best, fallbackMeters: Math.round(bestD) } : null;
}

function normalizeLngLat(lngLat: LngLat): LngLat | null {
  const [lng, lat] = lngLat;
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  return [wrapped, lat];
}

export function resolveGeoRegionWith(dataset: GeoRegionDataset, lngLat: LngLat): GeoRegion | null {
  const point = normalizeLngLat(lngLat);
  if (!point) return null;
  const countryHit = findArea(dataset.countries, point, COUNTRY_FALLBACK_METERS);
  const country = countryHit?.area ?? null;
  const admin1Hit = country ? findArea(dataset.admin1Of(country.code), point, ADMIN1_FALLBACK_METERS) : null;
  return {
    geoQuadkey: geoQuadkeyAt(point),
    geoContinent: country?.continent ?? null,
    geoCountry: country?.code ?? null,
    geoAdmin1: admin1Hit?.area.code ?? null,
    geoResolverVersion: dataset.version,
  };
}
