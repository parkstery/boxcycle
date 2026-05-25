import type { User } from "firebase/auth";
import { FUNCTIONS_REGION } from "../app/env";

const GRAPH_IMAGES = "https://graph.mapillary.com/images";
const FIELDS =
  "id,geometry,compass_angle,computed_compass_angle,sequence,is_pano,width,height";

const DIRECT_MAPILLARY = (() => {
  const raw = (import.meta.env.VITE_MAPILLARY_DIRECT ?? "").toString().trim().toLowerCase();
  return raw === "1" || raw === "true";
})();

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

type CacheRow = { at: number; rows: unknown[] };
const cache = new Map<string, CacheRow>();
const inflight = new Map<string, Promise<unknown[]>>();

function requestKey(lat: number, lng: number, radiusM: number, limit: number): string {
  return `${lat.toFixed(4)}:${lng.toFixed(4)}:${Math.round(radiusM)}:${limit}`;
}

function pruneCache(): void {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.at > CACHE_TTL_MS) cache.delete(k);
  }
  while (cache.size > MAX_CACHE_ENTRIES) {
    const first = cache.keys().next().value;
    if (first == null) break;
    cache.delete(first);
  }
}

async function fetchRowsDirect(
  accessToken: string,
  lat: number,
  lng: number,
  radiusM: number,
  limit: number,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const u = new URL(GRAPH_IMAGES);
  u.searchParams.set("access_token", accessToken);
  u.searchParams.set("fields", FIELDS);
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lng", String(lng));
  u.searchParams.set("radius", String(Math.round(radiusM)));
  u.searchParams.set("limit", String(limit));
  const res = await fetch(u.toString(), { signal });
  if (!res.ok) {
    if (res.status === 429) console.warn("[mapillary] rate limited (direct)");
    return [];
  }
  const json = (await res.json()) as { data?: unknown[] };
  return Array.isArray(json.data) ? json.data : [];
}

async function fetchRowsProxy(
  user: User,
  lat: number,
  lng: number,
  radiusM: number,
  limit: number,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) return [];
  const url = `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net/getMapillaryImages`;
  const idToken = await user.getIdToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      data: { lat, lng, radius: radiusM, limit },
    }),
    signal,
  });
  let json: { result?: { data?: unknown[] }; error?: { message?: string } };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return [];
  }
  if (!res.ok || json.error) {
    if (res.status === 429) console.warn("[mapillary] rate limited (proxy)");
    return [];
  }
  const data = json.result?.data;
  return Array.isArray(data) ? data : [];
}

/** Graph API raw rows — dedupe·캐시·in-flight guard·프록시(기본) */
export async function fetchMapillaryImageRows(input: {
  user: User | null;
  accessToken: string;
  lat: number;
  lng: number;
  radiusM: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<unknown[]> {
  const limit = input.limit ?? 12;
  const key = requestKey(input.lat, input.lng, input.radiusM, limit);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.rows;

  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      if (DIRECT_MAPILLARY && input.accessToken.trim()) {
        return fetchRowsDirect(
          input.accessToken.trim(),
          input.lat,
          input.lng,
          input.radiusM,
          limit,
          input.signal,
        );
      }
      if (!input.user) return [];
      return fetchRowsProxy(input.user, input.lat, input.lng, input.radiusM, limit, input.signal);
    })().finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, pending);
  }

  try {
    const rows = await pending;
    cache.set(key, { at: Date.now(), rows });
    pruneCache();
    return rows;
  } catch {
    return [];
  }
}
