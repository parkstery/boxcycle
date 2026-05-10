import { initializeApp } from "firebase-admin/app";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";

initializeApp();

const mapboxAccessToken = defineSecret("MAPBOX_ACCESS_TOKEN");

type RouteProfile = "cycling" | "driving" | "walking";

type LngLat = [number, number];

function isLngLat(v: unknown): v is LngLat {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    v[0] >= -180 &&
    v[0] <= 180 &&
    v[1] >= -90 &&
    v[1] <= 90
  );
}

function parseBody(data: unknown): { start: LngLat; end: LngLat; profile: RouteProfile } {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "요청 본문이 올바르지 않습니다.");
  }
  const o = data as Record<string, unknown>;
  const { start, end, profile } = o;
  if (!isLngLat(start) || !isLngLat(end)) {
    throw new HttpsError("invalid-argument", "start·end 는 [lng,lat] 숫자 배열이어야 합니다.");
  }
  if (profile !== "cycling" && profile !== "driving" && profile !== "walking") {
    throw new HttpsError("invalid-argument", "profile 은 cycling | driving | walking 만 허용됩니다.");
  }
  return { start, end, profile };
}

/** Mapbox Directions API → geojson geometry + 거리·시간 */
export const getMapboxDirections = onCall(
  {
    region: "asia-northeast3",
    secrets: [mapboxAccessToken],
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (request: CallableRequest<{ start?: unknown; end?: unknown; profile?: unknown }>) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "경로 계산은 로그인(게스트 포함) 후에 사용할 수 있습니다.");
    }

    const { start, end, profile } = parseBody(request.data);
    const token = mapboxAccessToken.value();
    if (!token?.trim()) {
      throw new HttpsError("failed-precondition", "서버에 Mapbox 토큰이 설정되지 않았습니다.");
    }

    const coords = `${start[0]},${start[1]};${end[0]},${end[1]}`;
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
      `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token.trim())}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new HttpsError("unavailable", "Directions API 연결에 실패했습니다.");
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Mapbox Directions HTTP error", response.status, body.slice(0, 500));
      throw new HttpsError("internal", "Directions API 요청이 거부되었습니다.");
    }

    const data = (await response.json()) as {
      code?: string;
      message?: string;
      routes?: { geometry: { type: string; coordinates: number[][] }; distance: number; duration: number }[];
    };

    if (data.code && data.code !== "Ok") {
      console.error("Mapbox Directions error body", data.code, data.message);
      throw new HttpsError("invalid-argument", data.message ?? "경로를 계산할 수 없습니다.");
    }

    const route = data.routes?.[0];
    if (!route?.geometry || route.geometry.type !== "LineString" || !Array.isArray(route.geometry.coordinates)) {
      throw new HttpsError("not-found", "경로를 찾지 못했습니다.");
    }

    return {
      geometry: route.geometry as { type: "LineString"; coordinates: [number, number][] },
      distance: route.distance,
      duration: route.duration,
    };
  },
);
