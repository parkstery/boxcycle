import type { LngLat } from "../lib/geo/geo";
import { shortPlaceLabel } from "../lib/route/repo/firestoreSavedRoutes";

/**
 * Mapbox Geocoding reverse — 선택 좌표를 포함하는 대표 주소(한국어 `place_name`).
 * 마커·Directions 계산용 좌표는 그대로 두고 UI 표시에만 사용한다.
 */
export async function fetchMapboxReverseGeocodePlaceName(
  lngLat: LngLat,
  accessToken: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const token = accessToken.trim();
  if (!token) return null;
  const [lng, lat] = lngLat;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?limit=1&language=ko&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) return null;
  const data = (await res.json()) as { features?: { place_name?: string }[] };
  const name = data.features?.[0]?.place_name?.trim();
  return name && name.length > 0 ? name : null;
}

/**
 * Local First Recognition 용 — 도시/행정구역 단위 지명만.
 * `types=place,locality,neighborhood,district` 로 번지·도로명 상세를 피한다.
 */
export async function fetchMapboxReverseGeocodeRegionLabel(
  lngLat: LngLat,
  accessToken: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const token = accessToken.trim();
  if (!token) return null;
  const [lng, lat] = lngLat;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?types=place,locality,neighborhood,district&limit=1&language=ko` +
    `&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features?: { text?: string; place_name?: string }[];
  };
  const f0 = data.features?.[0];
  const text = f0?.text?.trim();
  if (text) return text;
  return shortPlaceLabel(f0?.place_name ?? null);
}
