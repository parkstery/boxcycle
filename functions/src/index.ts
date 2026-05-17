import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { adminPromoteSavedRoute } from "./adminPromoteSavedRoute.js";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";

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

const MAX_WAYPOINTS = 3;

function parseWaypoints(raw: unknown): LngLat[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new HttpsError("invalid-argument", "waypoints 는 배열이어야 합니다.");
  }
  if (raw.length > MAX_WAYPOINTS) {
    throw new HttpsError("invalid-argument", `경과지는 최대 ${MAX_WAYPOINTS}개까지입니다.`);
  }
  const out: LngLat[] = [];
  for (const item of raw) {
    if (!isLngLat(item)) {
      throw new HttpsError("invalid-argument", "waypoints 항목은 [lng,lat] 숫자 배열이어야 합니다.");
    }
    out.push(item);
  }
  return out;
}

function parseBody(data: unknown): { start: LngLat; end: LngLat; profile: RouteProfile; waypoints: LngLat[] } {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "요청 본문이 올바르지 않습니다.");
  }
  const o = data as Record<string, unknown>;
  const { start, end, profile, waypoints } = o;
  if (!isLngLat(start) || !isLngLat(end)) {
    throw new HttpsError("invalid-argument", "start·end 는 [lng,lat] 숫자 배열이어야 합니다.");
  }
  if (profile !== "cycling" && profile !== "driving" && profile !== "walking") {
    throw new HttpsError("invalid-argument", "profile 은 cycling | driving | walking 만 허용됩니다.");
  }
  return { start, end, profile, waypoints: parseWaypoints(waypoints) };
}

/**
 * Mapbox Directions (서버 시크릿).
 *
 * Gen2 `onCall` 은 firebase-functions 가 Cloud Run `invoker` 를 배포 스택에 넣지 않아
 * OPTIONS 프리플라이트가 403 으로 막히는 경우가 있다. `onRequest` + `invoker: "public"` 으로
 * Invoker 를 확실히 연 다음, Callable 과 동일한 JSON 계약(`{ data }` / `{ result|error }`)을 맞춘다.
 */
export const getMapboxDirections = onRequest(
  {
    region: "asia-northeast3",
    secrets: [mapboxAccessToken],
    timeoutSeconds: 30,
    memory: "256MiB",
    cors: true,
    invoker: "public",
  },
  async (req: Request, res: Response) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      res.status(405).send("Method Not Allowed");
      return;
    }

    const authHeader = req.get("Authorization") ?? "";
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      const err = new HttpsError("unauthenticated", "경로 계산은 로그인(게스트 포함) 후에 사용할 수 있습니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
      return;
    }
    try {
      await getAuth().verifyIdToken(tokenMatch[1]);
    } catch {
      const err = new HttpsError("unauthenticated", "유효하지 않은 인증 토큰입니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
      return;
    }

    let rawBody: unknown = req.body;
    if (typeof rawBody === "string") {
      try {
        rawBody = JSON.parse(rawBody) as unknown;
      } catch {
        const err = new HttpsError("invalid-argument", "JSON 본문이 올바르지 않습니다.");
        res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
        return;
      }
    }

    try {
      const dataField = (rawBody as { data?: unknown } | null)?.data;
      const { start, end, profile, waypoints } = parseBody(dataField);
      const token = mapboxAccessToken.value();
      if (!token?.trim()) {
        throw new HttpsError("failed-precondition", "서버에 Mapbox 토큰이 설정되지 않았습니다.");
      }

      const segments: string[] = [`${start[0]},${start[1]}`];
      for (const w of waypoints) {
        segments.push(`${w[0]},${w[1]}`);
      }
      segments.push(`${end[0]},${end[1]}`);
      const coords = segments.join(";");
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
        `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token.trim())}`;

      let mapResponse: globalThis.Response;
      try {
        mapResponse = await fetch(url);
      } catch {
        throw new HttpsError("unavailable", "Directions API 연결에 실패했습니다.");
      }

      if (!mapResponse.ok) {
        const body = await mapResponse.text().catch(() => "");
        console.error("Mapbox Directions HTTP error", mapResponse.status, body.slice(0, 500));
        throw new HttpsError("internal", "Directions API 요청이 거부되었습니다.");
      }

      const mapJson = (await mapResponse.json()) as {
        code?: string;
        message?: string;
        routes?: { geometry: { type: string; coordinates: number[][] }; distance: number; duration: number }[];
      };

      if (mapJson.code && mapJson.code !== "Ok") {
        console.error("Mapbox Directions error body", mapJson.code, mapJson.message);
        throw new HttpsError("invalid-argument", mapJson.message ?? "경로를 계산할 수 없습니다.");
      }

      const route = mapJson.routes?.[0];
      if (!route?.geometry || route.geometry.type !== "LineString" || !Array.isArray(route.geometry.coordinates)) {
        throw new HttpsError("not-found", "경로를 찾지 못했습니다.");
      }

      res.status(200).json({
        result: {
          geometry: route.geometry as { type: "LineString"; coordinates: [number, number][] },
          distance: route.distance,
          duration: route.duration,
        },
      });
    } catch (e: unknown) {
      if (e instanceof HttpsError) {
        res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
        return;
      }
      console.error(e);
      const err = new HttpsError("internal", "서버 오류가 발생했습니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
    }
  },
);

export { adminPromoteSavedRoute };
export { courseActivityOnRideCreated } from "./courseActivityOnRideCreated.js";
export { courseActivityOnLiveCourseRideWritten } from "./courseActivityOnLiveCourseRideWritten.js";
export { courseActivityScheduledReconcile } from "./courseActivityScheduledReconcile.js";
