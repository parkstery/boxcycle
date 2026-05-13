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
 * 개발용 임시 우회 스위치(아키텍처 결정에서 의도적으로 잠시 벗어남).
 *   `apps/web/.env.local` 에 `VITE_DIRECTIONS_DIRECT=1` 을 두면
 *   브라우저가 Mapbox Directions REST 를 직접 호출합니다.
 *
 * 배경: Cloud Functions Gen2(Cloud Run) 의 Invoker 가 `allUsers` 가 아니면
 *       CORS preflight(OPTIONS) 가 403 으로 막혀 Callable 호출이 실패합니다.
 *       Firebase 측 정상화 전까지 개발 진행을 막지 않기 위한 *임시* 플래그입니다.
 *
 * 기본값(미설정/0/false)은 기존 아키텍처(Callable 경유) 유지.
 * Firebase 가 정상화되면 `.env.local` 에서 이 줄만 지우면 즉시 원복됩니다.
 *
 * 주의: direct 모드는 `VITE_MAPBOX_ACCESS_TOKEN(pk.)` 을 네트워크 탭에 노출합니다.
 *       Mapbox 콘솔에서 해당 토큰에 URL 제한(허용 origin)을 걸어 두세요.
 */
const DIRECT_DIRECTIONS = (() => {
  const raw = (import.meta.env.VITE_DIRECTIONS_DIRECT ?? "").toString().trim().toLowerCase();
  return raw === "1" || raw === "true";
})();

function normalizeRoute(data: {
  geometry?: { type?: string; coordinates?: unknown };
  distance?: unknown;
  duration?: unknown;
}): DirectionsRoute {
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
    geometry: data.geometry as LineStringGeometry,
    distance: data.distance,
    duration: data.duration,
  };
}

async function fetchRouteCallable(
  functions: Functions,
  start: LngLat,
  end: LngLat,
  profile: RouteProfile,
): Promise<DirectionsRoute> {
  const callable = httpsCallable<
    { start: LngLat; end: LngLat; profile: RouteProfile },
    DirectionsRoute
  >(functions, "getMapboxDirections");
  const result = await callable({ start, end, profile });
  return normalizeRoute(result.data ?? {});
}

async function fetchRouteDirect(
  start: LngLat,
  end: LngLat,
  profile: RouteProfile,
): Promise<DirectionsRoute> {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "VITE_MAPBOX_ACCESS_TOKEN(pk.) 가 비어 있습니다. apps/web/.env.local 에 설정하세요.",
    );
  }
  const coords = `${start[0]},${start[1]};${end[0]},${end[1]}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Mapbox Directions 연결에 실패했습니다.");
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Mapbox Directions 요청이 거부되었습니다. (HTTP ${response.status}) ${body.slice(0, 200)}`,
    );
  }
  const data = (await response.json()) as {
    code?: string;
    message?: string;
    routes?: {
      geometry: { type: string; coordinates: number[][] };
      distance: number;
      duration: number;
    }[];
  };
  if (data.code && data.code !== "Ok") {
    throw new Error(data.message ?? "경로를 계산할 수 없습니다.");
  }
  const route = data.routes?.[0];
  if (!route) throw new Error("경로를 찾지 못했습니다.");
  return normalizeRoute(route);
}

/**
 * Mapbox Directions 는 기본적으로 Cloud Functions Callable(`getMapboxDirections`) 을 사용합니다.
 * 브라우저 네트워크에 Mapbox REST `access_token` 이 노출되지 않습니다.
 * 지도 타일(Mapbox GL)용 pk. 토큰은 별도(`VITE_MAPBOX_ACCESS_TOKEN`) 입니다.
 *
 * 예외: `VITE_DIRECTIONS_DIRECT=1` 일 때만 브라우저 직접 호출(우회). 위 상수 주석 참고.
 */
export async function fetchRouteByProfile(
  functions: Functions,
  _user: User,
  start: LngLat,
  end: LngLat,
  profile: RouteProfile,
): Promise<DirectionsRoute> {
  void _user;
  if (DIRECT_DIRECTIONS) {
    return fetchRouteDirect(start, end, profile);
  }
  return fetchRouteCallable(functions, start, end, profile);
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
