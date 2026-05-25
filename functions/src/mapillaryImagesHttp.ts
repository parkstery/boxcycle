import { getAuth } from "firebase-admin/auth";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";

const mapillaryAccessToken = defineSecret("MAPILLARY_ACCESS_TOKEN");

const GRAPH_IMAGES = "https://graph.mapillary.com/images";
const FIELDS = "id,geometry,compass_angle,computed_compass_angle,sequence,is_pano,width,height";
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 400;

type CacheEntry = { expiresAt: number; json: { data?: unknown[] } };
const responseCache = new Map<string, CacheEntry>();

function pruneCache(): void {
  if (responseCache.size <= MAX_CACHE_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of responseCache) {
    if (v.expiresAt <= now) responseCache.delete(k);
  }
  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const first = responseCache.keys().next().value;
    if (first == null) break;
    responseCache.delete(first);
  }
}

function cacheKey(lat: number, lng: number, radius: number, limit: number): string {
  return `${lat.toFixed(4)}:${lng.toFixed(4)}:${Math.round(radius)}:${limit}`;
}

function parseImagesBody(data: unknown): { lat: number; lng: number; radius: number; limit: number } {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "요청 본문이 올바르지 않습니다.");
  }
  const o = data as Record<string, unknown>;
  const lat = o.lat;
  const lng = o.lng;
  const radius = o.radius;
  const limit = o.limit ?? 12;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new HttpsError("invalid-argument", "lat·lng 가 필요합니다.");
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new HttpsError("invalid-argument", "lat·lng 범위가 올바르지 않습니다.");
  }
  if (typeof radius !== "number" || !Number.isFinite(radius) || radius < 1 || radius > 120) {
    throw new HttpsError("invalid-argument", "radius 는 1~120(m) 이어야 합니다.");
  }
  const lim = typeof limit === "number" && Number.isFinite(limit) ? Math.floor(limit) : 12;
  return { lat, lng, radius, limit: Math.min(20, Math.max(1, lim)) };
}

/**
 * Mapillary Graph `images` — 브라우저 CORS·429 완화용 서버 프록시.
 * 시크릿: `MAPILLARY_ACCESS_TOKEN` (Mapillary Client token 과 동일 값 가능).
 */
export const getMapillaryImages = onRequest(
  {
    region: "asia-northeast3",
    secrets: [mapillaryAccessToken],
    timeoutSeconds: 20,
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
      const err = new HttpsError("unauthenticated", "Mapillary 조회는 로그인(게스트 포함) 후에 사용할 수 있습니다.");
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
      const { lat, lng, radius, limit } = parseImagesBody(dataField);

      const token = mapillaryAccessToken.value()?.trim();
      if (!token) {
        throw new HttpsError("failed-precondition", "서버에 MAPILLARY_ACCESS_TOKEN 이 설정되지 않았습니다.");
      }

      const key = cacheKey(lat, lng, radius, limit);
      const now = Date.now();
      const hit = responseCache.get(key);
      if (hit && hit.expiresAt > now) {
        res.status(200).json({ result: hit.json });
        return;
      }

      const u = new URL(GRAPH_IMAGES);
      u.searchParams.set("access_token", token);
      u.searchParams.set("fields", FIELDS);
      u.searchParams.set("lat", String(lat));
      u.searchParams.set("lng", String(lng));
      u.searchParams.set("radius", String(Math.round(radius)));
      u.searchParams.set("limit", String(limit));

      let upstream: globalThis.Response;
      try {
        upstream = await fetch(u.toString());
      } catch {
        throw new HttpsError("unavailable", "Mapillary API 연결에 실패했습니다.");
      }

      if (upstream.status === 429) {
        throw new HttpsError("resource-exhausted", "Mapillary 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.");
      }

      if (!upstream.ok) {
        const body = await upstream.text().catch(() => "");
        console.warn("[getMapillaryImages] upstream", upstream.status, body.slice(0, 300));
        throw new HttpsError("internal", "Mapillary API 요청이 거부되었습니다.");
      }

      const json = (await upstream.json()) as { data?: unknown[] };
      responseCache.set(key, { expiresAt: now + CACHE_TTL_MS, json });
      pruneCache();
      res.status(200).json({ result: json });
    } catch (e) {
      if (e instanceof HttpsError) {
        res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
        return;
      }
      console.error("[getMapillaryImages]", e);
      const err = new HttpsError("internal", "Mapillary 프록시 처리 중 오류가 발생했습니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
    }
  },
);
