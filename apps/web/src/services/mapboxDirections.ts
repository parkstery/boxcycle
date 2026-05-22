import type { User } from "firebase/auth";
import type { Functions } from "firebase/functions";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { MAX_ROUTE_WAYPOINTS } from "../lib/routeWaypoints";

export type RouteProfile = "cycling" | "driving" | "walking";

export type DirectionsRoute = {
  geometry: LineStringGeometry;
  distance: number;
  duration: number;
  routeTokenBalance?: number;
};

/**
 * 개발용 임시 우회 스위치(아키텍처 결정에서 의도적으로 잠시 벗어남).
 *   `apps/web/.env.local` 에 `VITE_DIRECTIONS_DIRECT=1` 을 두면
 *   브라우저가 Mapbox Directions REST 를 직접 호출합니다.
 *
 * 배경: Gen2 `httpsCallable` 은 Cloud Run Invoker 가 비공개일 때 OPTIONS 가 403 으로 막힐 수 있다.
 *       서버는 `onRequest` + `invoker: "public"` 으로 해결하고, 웹은 Callable 과 동일한 JSON 으로 POST 한다.
 *       그래도 막히면 이 플래그로 Mapbox REST 직접 호출(임시 우회)이 가능하다.
 *
 * 기본값(미설정/0/false)은 HTTPS 함수 `getMapboxDirections`(Callable 호환 JSON) 경유.
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
  routeTokenBalance?: unknown;
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
  const route: DirectionsRoute = {
    geometry: data.geometry as LineStringGeometry,
    distance: data.distance,
    duration: data.duration,
  };
  if (typeof data.routeTokenBalance === "number" && Number.isFinite(data.routeTokenBalance)) {
    route.routeTokenBalance = Math.max(0, Math.floor(data.routeTokenBalance));
  }
  return route;
}

/** 서버 `HttpsError.toJSON().status`(대문자 스네이크) → 클라이언트 `FirebaseError.code` 근사치 */
function wireStatusToFunctionsCode(status: string | undefined): string | undefined {
  if (!status) return undefined;
  const map: Record<string, string> = {
    UNAUTHENTICATED: "functions/unauthenticated",
    NOT_FOUND: "functions/not-found",
    INVALID_ARGUMENT: "functions/invalid-argument",
    INTERNAL: "functions/internal",
    FAILED_PRECONDITION: "functions/failed-precondition",
    UNAVAILABLE: "functions/unavailable",
    PERMISSION_DENIED: "functions/permission-denied",
    RESOURCE_EXHAUSTED: "functions/resource-exhausted",
  };
  return map[status] ?? "functions/internal";
}

function buildDirectionsCoordPath(start: LngLat, end: LngLat, waypoints: LngLat[] | null | undefined): string {
  const wps = (waypoints ?? []).slice(0, MAX_ROUTE_WAYPOINTS);
  const parts: string[] = [`${start[0]},${start[1]}`];
  for (const w of wps) {
    parts.push(`${w[0]},${w[1]}`);
  }
  parts.push(`${end[0]},${end[1]}`);
  return parts.join(";");
}

async function fetchRouteCallable(
  functions: Functions,
  user: User,
  start: LngLat,
  end: LngLat,
  profile: RouteProfile,
  waypoints: LngLat[] | null | undefined,
  requestId: string,
): Promise<DirectionsRoute> {
  void functions;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const region = import.meta.env.VITE_FUNCTIONS_REGION?.trim() || "asia-northeast3";
  if (!projectId) {
    throw new Error(
      "VITE_FIREBASE_PROJECT_ID 가 비어 있어 getMapboxDirections URL 을 만들 수 없습니다. apps/web/.env 를 확인하세요.",
    );
  }
  const url = `https://${region}-${projectId}.cloudfunctions.net/getMapboxDirections`;
  const idToken = await user.getIdToken();
  const wps = (waypoints ?? []).slice(0, MAX_ROUTE_WAYPOINTS);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      data: { start, end, profile, waypoints: wps.length ? wps : undefined, requestId },
    }),
  });
  let json: {
    result?: { geometry?: unknown; distance?: unknown; duration?: unknown; routeTokenBalance?: unknown };
    error?: { message?: string; status?: string };
  };
  try {
    json = (await res.json()) as {
      result?: { geometry?: unknown; distance?: unknown; duration?: unknown; routeTokenBalance?: unknown };
      error?: { message?: string; status?: string };
    };
  } catch {
    throw new Error(`경로 계산 응답을 해석할 수 없습니다. (HTTP ${res.status})`);
  }
  if (json.error) {
    const err = new Error(json.error.message ?? "경로 계산에 실패했습니다.");
    (err as { code?: string }).code = wireStatusToFunctionsCode(json.error.status);
    throw err;
  }
  if (!res.ok) {
    throw new Error(`경로 계산 요청이 거부되었습니다. (HTTP ${res.status})`);
  }
  return normalizeRoute(
    (json.result ?? {}) as {
      geometry?: { type?: string; coordinates?: unknown };
      distance?: unknown;
      duration?: unknown;
      routeTokenBalance?: unknown;
    },
  );
}

async function fetchRouteDirect(
  start: LngLat,
  end: LngLat,
  profile: RouteProfile,
  waypoints?: LngLat[] | null,
): Promise<DirectionsRoute> {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "VITE_MAPBOX_ACCESS_TOKEN(pk.) 가 비어 있습니다. apps/web/.env.local 에 설정하세요.",
    );
  }
  const coords = buildDirectionsCoordPath(start, end, waypoints);
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
 * Mapbox Directions 는 기본적으로 Cloud Functions HTTPS `getMapboxDirections`(Callable 호환 JSON) 을 사용합니다.
 * 브라우저 네트워크에 Mapbox REST `access_token` 이 노출되지 않습니다.
 * 지도 타일(Mapbox GL)용 pk. 토큰은 별도(`VITE_MAPBOX_ACCESS_TOKEN`) 입니다.
 *
 * 예외: `VITE_DIRECTIONS_DIRECT=1` 일 때만 브라우저 직접 호출(우회). 위 상수 주석 참고.
 */
export async function fetchRouteByProfile(
  functions: Functions,
  user: User,
  start: LngLat,
  end: LngLat,
  profile: RouteProfile,
  waypoints?: LngLat[] | null,
  requestId?: string,
): Promise<DirectionsRoute> {
  if (DIRECT_DIRECTIONS) {
    if (!user?.uid) {
      throw new Error("경로 계산은 로그인(임시 라이더) 후에 사용할 수 있습니다.");
    }
    return fetchRouteDirect(start, end, profile, waypoints);
  }
  const rid =
    requestId?.trim() ||
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
  return fetchRouteCallable(functions, user, start, end, profile, waypoints, rid);
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
