import type { User } from "firebase/auth";
import { httpsCallable, type Functions } from "firebase/functions";
import type { LineStringGeometry, LngLat } from "../lib/geo";

export type RouteProfile = "cycling" | "driving" | "walking";

export type DirectionsRoute = {
  geometry: LineStringGeometry;
  distance: number;
  duration: number;
};

/**
 * Mapbox Directions는 Cloud Functions Callable(`getMapboxDirections`)만 사용합니다.
 * 브라우저 네트워크에 Mapbox REST `access_token` 이 노출되지 않습니다.
 * 지도 타일(Mapbox GL)용 pk. 토큰은 별도(`VITE_MAPBOX_ACCESS_TOKEN`)입니다.
 */
export async function fetchRouteByProfile(
  functions: Functions,
  _user: User,
  start: LngLat,
  end: LngLat,
  profile: RouteProfile,
): Promise<DirectionsRoute> {
  void _user;
  const callable = httpsCallable<
    { start: LngLat; end: LngLat; profile: RouteProfile },
    DirectionsRoute
  >(functions, "getMapboxDirections");

  const result = await callable({ start, end, profile });
  const data = result.data;
  if (
    !data?.geometry ||
    data.geometry.type !== "LineString" ||
    !Array.isArray(data.geometry.coordinates) ||
    data.geometry.coordinates.length < 2
  ) {
    throw new Error("경로 응답이 올바르지 않습니다.");
  }
  if (typeof data.distance !== "number" || typeof data.duration !== "number") {
    throw new Error("경로 거리·시간 응답이 올바르지 않습니다.");
  }
  return {
    geometry: data.geometry,
    distance: data.distance,
    duration: data.duration,
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
