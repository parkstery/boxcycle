import type { LngLat } from "../lib/geo";

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
