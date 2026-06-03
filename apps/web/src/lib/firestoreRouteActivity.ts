import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import type { LngLat } from "./geo";
import { ROUTE_ACTIVITY_COLLECTION } from "./firestoreCollections";
import { lastSeenAtToMillis } from "./firestoreTrail";

/** `routeActivity/{catalogRouteId}` — 경로 단위 aggregate(클라이언트 write 없음) */
export type RouteActivitySnapshot = {
  catalogRouteId: string;
  activeRiderCount: number;
  recentRideCount7d: number;
  recentLikeCount: number;
  liveNow: boolean;
  pulseLevel: number;
  updatedAtMs: number | null;
  liveAnchorLngLat: LngLat | null;
  liveAnchorProgressRatio: number | null;
};

const COLLECTION = ROUTE_ACTIVITY_COLLECTION;

function clampPulseLevel(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(3, Math.round(raw)));
}

function parseLiveAnchorLngLat(raw: unknown): LngLat | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const lng = raw[0];
  const lat = raw[1];
  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  return [lng, lat];
}

function parseRouteActivityDoc(
  catalogRouteId: string,
  data: Record<string, unknown>,
): RouteActivitySnapshot {
  const activeRiderCount =
    typeof data.activeRiderCount === "number" && Number.isFinite(data.activeRiderCount)
      ? Math.max(0, Math.floor(data.activeRiderCount))
      : 0;
  const recentRideCount7d =
    typeof data.recentRideCount7d === "number" && Number.isFinite(data.recentRideCount7d)
      ? Math.max(0, Math.floor(data.recentRideCount7d))
      : 0;
  const recentLikeCount =
    typeof data.recentLikeCount === "number" && Number.isFinite(data.recentLikeCount)
      ? Math.max(0, Math.floor(data.recentLikeCount))
      : 0;
  const liveNow = data.liveNow === true;
  const pulseLevel = clampPulseLevel(data.pulseLevel);
  const liveAnchorLngLat = parseLiveAnchorLngLat(data.liveAnchorLngLat);
  const liveAnchorProgressRatio =
    typeof data.liveAnchorProgressRatio === "number" && Number.isFinite(data.liveAnchorProgressRatio)
      ? Math.max(0, Math.min(1, data.liveAnchorProgressRatio))
      : null;
  return {
    catalogRouteId,
    activeRiderCount,
    recentRideCount7d,
    recentLikeCount,
    liveNow,
    pulseLevel: liveNow && pulseLevel === 0 ? 1 : liveNow ? pulseLevel : 0,
    updatedAtMs: lastSeenAtToMillis(data.updatedAt),
    liveAnchorLngLat,
    liveAnchorProgressRatio,
  };
}

const memoryCache = new Map<string, RouteActivitySnapshot | null>();
const inflight = new Map<string, Promise<RouteActivitySnapshot | null>>();
const rideCompletedOptimistic = new Map<string, RouteActivitySnapshot>();

function mergeRideCompletedOptimistic(
  catalogRouteId: string,
  server: RouteActivitySnapshot | null,
): RouteActivitySnapshot | null {
  const opt = rideCompletedOptimistic.get(catalogRouteId);
  if (!opt) return server;
  if (!server) return opt;

  const server7d = server.recentRideCount7d;
  const liveStuck = server.liveNow && server.activeRiderCount > 0;
  const staleLiveWithoutHeat =
    server.liveNow && server.activeRiderCount === 0 && server7d < opt.recentRideCount7d;
  const serverCaughtUp = server7d >= opt.recentRideCount7d && !liveStuck && !staleLiveWithoutHeat;

  if (serverCaughtUp) {
    rideCompletedOptimistic.delete(catalogRouteId);
    return server;
  }

  return {
    ...server,
    liveNow: false,
    activeRiderCount: 0,
    pulseLevel: 0,
    liveAnchorLngLat: null,
    liveAnchorProgressRatio: null,
    recentRideCount7d: Math.max(server7d, opt.recentRideCount7d),
  };
}

export function markRouteActivityRideCompletedOptimistic(
  catalogRouteId: string,
): RouteActivitySnapshot | null {
  const id = catalogRouteId.trim();
  if (!id) return null;
  const prev = memoryCache.get(id) ?? rideCompletedOptimistic.get(id) ?? null;
  const next: RouteActivitySnapshot = {
    catalogRouteId: id,
    activeRiderCount: 0,
    recentRideCount7d: (prev?.recentRideCount7d ?? 0) + 1,
    recentLikeCount: prev?.recentLikeCount ?? 0,
    liveNow: false,
    pulseLevel: 0,
    updatedAtMs: Date.now(),
    liveAnchorLngLat: null,
    liveAnchorProgressRatio: null,
  };
  rideCompletedOptimistic.set(id, next);
  memoryCache.set(id, next);
  return next;
}

export async function fetchRouteActivity(catalogRouteId: string): Promise<RouteActivitySnapshot | null> {
  const id = catalogRouteId.trim();
  if (!id) return null;
  if (memoryCache.has(id)) return memoryCache.get(id)!;

  let pending = inflight.get(id);
  if (!pending) {
    pending = (async () => {
      const db = getFirestore(getFirebaseApp());
      const snap = await getDoc(doc(db, COLLECTION, id));
      const parsed = snap.exists()
        ? parseRouteActivityDoc(id, snap.data() as Record<string, unknown>)
        : null;
      const merged = mergeRideCompletedOptimistic(id, parsed);
      memoryCache.set(id, merged);
      inflight.delete(id);
      return merged;
    })().catch((e) => {
      inflight.delete(id);
      throw e;
    });
    inflight.set(id, pending);
  }
  return pending;
}

export function isRouteActivityLive(activity: RouteActivitySnapshot): boolean {
  return activity.liveNow && activity.activeRiderCount > 0;
}

export function isRouteActivityHeat(activity: RouteActivitySnapshot): boolean {
  if (isRouteActivityLive(activity)) return false;
  return activity.recentRideCount7d > 0;
}

export function heatVisualWeight(recentRideCount7d: number): number {
  if (!Number.isFinite(recentRideCount7d) || recentRideCount7d <= 0) return 1;
  return Math.min(5, Math.max(1, Math.round(recentRideCount7d)));
}

export function formatRouteActivityListBadge(activity: RouteActivitySnapshot | null): string | null {
  if (!activity) return null;
  if (activity.liveNow) {
    return activity.activeRiderCount > 0 ? `라이브 ${activity.activeRiderCount}` : "라이브";
  }
  if (activity.recentRideCount7d > 0) return `7일 ${activity.recentRideCount7d}회`;
  if (activity.recentLikeCount > 0) return `♥ ${activity.recentLikeCount}`;
  return null;
}

export function invalidateRouteActivityCache(catalogRouteIds?: readonly string[]): void {
  if (!catalogRouteIds?.length) {
    memoryCache.clear();
    invalidateLiveRouteActivityIdsCache();
    return;
  }
  for (const id of catalogRouteIds) {
    const key = id.trim();
    if (key) memoryCache.delete(key);
  }
  invalidateLiveRouteActivityIdsCache();
}

const LIVE_ROUTE_IDS_QUERY_MAX = 32;

let liveRouteIdsCache: { ids: string[]; at: number } | null = null;
const LIVE_ROUTE_IDS_CACHE_MS = 45_000;

export async function fetchLiveRouteActivityIds(
  max = LIVE_ROUTE_IDS_QUERY_MAX,
): Promise<string[]> {
  const cap = Math.max(1, Math.min(max, LIVE_ROUTE_IDS_QUERY_MAX));
  const now = Date.now();
  if (liveRouteIdsCache && now - liveRouteIdsCache.at < LIVE_ROUTE_IDS_CACHE_MS) {
    return liveRouteIdsCache.ids;
  }

  const db = getFirestore(getFirebaseApp());
  const col = collection(db, COLLECTION);

  const runQuery = async (ordered: boolean) => {
    const q = ordered
      ? query(col, where("liveNow", "==", true), orderBy("activeRiderCount", "desc"), limit(cap))
      : query(col, where("liveNow", "==", true), limit(cap));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.id.trim()).filter(Boolean);
  };

  try {
    const ids = await runQuery(true);
    liveRouteIdsCache = { ids, at: now };
    return ids;
  } catch {
    try {
      const ids = await runQuery(false);
      liveRouteIdsCache = { ids, at: now };
      return ids;
    } catch {
      return liveRouteIdsCache?.ids ?? [];
    }
  }
}

export function invalidateLiveRouteActivityIdsCache(): void {
  liveRouteIdsCache = null;
}

export async function fetchRouteActivitiesBatch(
  catalogRouteIds: readonly string[],
  options?: { refresh?: boolean },
): Promise<Map<string, RouteActivitySnapshot | null>> {
  const uniq = [...new Set(catalogRouteIds.map((id) => id.trim()).filter(Boolean))];
  if (options?.refresh) invalidateRouteActivityCache(uniq);
  const pairs = await Promise.all(
    uniq.map(async (id) => [id, await fetchRouteActivity(id)] as const),
  );
  return new Map(pairs);
}

export function formatActivityWorldPinPopup(
  activity: RouteActivitySnapshot | null,
  kind: "pulse" | "heat",
): string {
  const title = kind === "pulse" ? "라이브 경로" : "최근 활동";
  const detail = formatRouteActivityHudLine(activity);
  if (detail) return `${title}\n${detail}`;
  if (kind === "pulse") return `${title}\n지금 이 경로에서 주행 중`;
  return `${title}\n최근 7일 내 주행 흔적`;
}

export function formatRouteActivityHudLine(activity: RouteActivitySnapshot | null): string | null {
  if (!activity) return null;
  const parts: string[] = [];
  if (activity.liveNow) {
    parts.push(
      activity.activeRiderCount > 0
        ? `지금 ${activity.activeRiderCount}명 주행`
        : "지금 활동 중",
    );
  } else if (activity.recentRideCount7d > 0) {
    parts.push(`최근 7일 ${activity.recentRideCount7d}회`);
  }
  if (activity.recentLikeCount > 0) parts.push(`좋아요 ${activity.recentLikeCount}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
