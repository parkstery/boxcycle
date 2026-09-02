import type { User } from "firebase/auth";
import type { Functions } from "firebase/functions";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { assertDirectionsServerOnly } from "../lib/directionsDirectGuard";
import {
  getRouteTokenInsufficient,
  reportRouteTokenSpend,
} from "../lib/routeTokenSpendBridge";
import { ROUTE_TOKEN_INSUFFICIENT_HINT } from "../lib/routeTokenUiCopy";
import { functionsHttpUrl } from "../lib/functionsEmulatorUrl";
import { MAX_ROUTE_WAYPOINTS } from "../lib/routeWaypoints";

export type RouteProfile = "cycling" | "driving" | "walking";

export type DirectionsRoute = {
  geometry: LineStringGeometry;
  distance: number;
  duration: number;
  routeTokenBalance: number;
};

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
  if (typeof data.routeTokenBalance !== "number" || !Number.isFinite(data.routeTokenBalance)) {
    throw new Error("경로는 생성됐지만 Route Token 잔액 응답이 없습니다.");
  }
  return {
    geometry: data.geometry as LineStringGeometry,
    distance: data.distance,
    duration: data.duration,
    routeTokenBalance: Math.max(0, Math.floor(data.routeTokenBalance)),
  };
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

let lastSpendFeedbackRequestId: string | null = null;

function maybeReportRouteTokenSpend(uid: string, balance: number, requestId: string): void {
  if (lastSpendFeedbackRequestId === requestId) return;
  lastSpendFeedbackRequestId = requestId;
  reportRouteTokenSpend(uid, balance, requestId);
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
  if (!projectId) {
    throw new Error(
      "VITE_FIREBASE_PROJECT_ID 가 비어 있어 getMapboxDirections URL 을 만들 수 없습니다. apps/web/.env 를 확인하세요.",
    );
  }
  const url = functionsHttpUrl("getMapboxDirections");
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
  const route = normalizeRoute(
    (json.result ?? {}) as {
      geometry?: { type?: string; coordinates?: unknown };
      distance?: unknown;
      duration?: unknown;
      routeTokenBalance?: unknown;
    },
  );
  maybeReportRouteTokenSpend(user.uid, route.routeTokenBalance, requestId);
  return route;
}

/**
 * Mapbox Directions 는 Cloud Functions HTTPS `getMapboxDirections`(Callable 호환 JSON) 만 사용합니다.
 * 브라우저 네트워크에 Mapbox REST `access_token` 이 노출되지 않습니다.
 * 지도 타일(Mapbox GL)용 pk. 토큰은 별도(`VITE_MAPBOX_ACCESS_TOKEN`) 입니다.
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
  assertDirectionsServerOnly();
  if (!user?.uid) {
    throw new Error("경로 계산은 로그인(임시 라이더) 후에 사용할 수 있습니다.");
  }
  if (getRouteTokenInsufficient(user.uid)) {
    const err = new Error(ROUTE_TOKEN_INSUFFICIENT_HINT);
    (err as { code?: string }).code = "functions/resource-exhausted";
    throw err;
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
