import type { LineStringGeometry, LngLat } from "../lib/geo";

export type RouteProfile = "cycling" | "driving" | "walking";

export type DirectionsRoute = {
  geometry: LineStringGeometry;
  distance: number;
  duration: number;
};

export async function fetchRouteByProfile(
  token: string,
  start: LngLat,
  end: LngLat,
  profile: RouteProfile,
): Promise<DirectionsRoute> {
  const coords = `${start[0]},${start[1]};${end[0]},${end[1]}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token)}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Directions API 요청 실패");
  const data = (await response.json()) as {
    routes?: { geometry: LineStringGeometry; distance: number; duration: number }[];
  };
  if (!data.routes?.length) throw new Error("경로를 찾지 못했습니다.");
  const r = data.routes[0];
  return {
    geometry: r.geometry,
    distance: r.distance,
    duration: r.duration,
  };
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
