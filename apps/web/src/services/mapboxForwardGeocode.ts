import type { LngLat } from "../lib/geo";

/** Mapbox Geocoding `bbox`: [west, south, east, north] */
export type MapboxGeocodeBbox = [number, number, number, number];

export type MapboxGeocodeSuggestion = {
  id: string;
  placeName: string;
  center: LngLat;
  /** 있으면 지명 선택 시 `fitBounds` 로 프레이밍(도시 단위 등) */
  bbox: MapboxGeocodeBbox | null;
};

function parseMapboxBbox(raw: unknown): MapboxGeocodeBbox | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const [w, s, e, n] = raw;
  if (![w, s, e, n].every((x) => typeof x === "number" && Number.isFinite(x))) return null;
  if (e <= w || n <= s) return null;
  return [w, s, e, n];
}

/** 자동완성 응답의 `id` — Retrieve API 에 넣을 수 있는지(Mapbox 타입 접두어). */
export function isMapboxGeocodeFeatureId(id: string): boolean {
  return /^(country|region|postcode|district|place|locality|neighborhood|address|poi)\./i.test(id.trim());
}

export type MapboxPlacePickDetail = {
  center: LngLat;
  bbox: MapboxGeocodeBbox | null;
};

/**
 * Geocoding Retrieve — center·bbox (도시 `fitBounds` 용).
 * @see https://docs.mapbox.com/api/search/geocoding/#retrieve-a-place
 */
export async function fetchMapboxPlacePickDetail(
  featureId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<MapboxPlacePickDetail | null> {
  const token = accessToken.trim();
  const id = featureId.trim();
  if (!id || !token) return null;

  const path = encodeURIComponent(id);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${path}.json?access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    features?: { center?: [number, number]; bbox?: number[] }[];
  };
  const f0 = data.features?.[0];
  const c = f0?.center;
  if (!c || c.length < 2 || Number.isNaN(c[0]) || Number.isNaN(c[1])) return null;
  return {
    center: [c[0], c[1]],
    bbox: parseMapboxBbox(f0?.bbox),
  };
}

/** @deprecated `fetchMapboxPlacePickDetail` 사용 */
export async function fetchMapboxPlaceFeatureCenter(
  featureId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<LngLat | null> {
  const d = await fetchMapboxPlacePickDetail(featureId, accessToken, signal);
  return d?.center ?? null;
}

/**
 * Mapbox Geocoding forward — 자동완성 후보(`autocomplete=true`).
 */
export async function fetchMapboxForwardGeocodeSuggestions(
  query: string,
  accessToken: string,
  signal?: AbortSignal,
  limit = 8,
): Promise<MapboxGeocodeSuggestion[]> {
  const q = query.trim();
  const token = accessToken.trim();
  if (q.length < 2 || !token) return [];

  const encoded = encodeURIComponent(q);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?autocomplete=true&limit=${limit}&language=ko&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) return [];

  const data = (await res.json()) as {
    features?: { id?: string; place_name?: string; center?: [number, number]; bbox?: number[] }[];
  };

  const out: MapboxGeocodeSuggestion[] = [];
  for (const f of data.features ?? []) {
    const placeName = f.place_name?.trim();
    const c = f.center;
    if (!placeName || !c || c.length < 2 || Number.isNaN(c[0]) || Number.isNaN(c[1])) continue;
    const id = typeof f.id === "string" && f.id.length > 0 ? f.id : `${c[0]},${c[1]},${placeName}`;
    out.push({ id, placeName, center: [c[0], c[1]], bbox: parseMapboxBbox(f.bbox) });
  }
  return out;
}
