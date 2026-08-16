import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "./firebase";
import { isActivityLodDebugPanelEnabled } from "./mapDebugPhase";
import type { LngLat } from "./geo";
import { isWithinActivityTraceHeatWindow } from "./activityWorldTraceStyle";
import { lastSeenAtToMillis } from "./firestoreTrail";
import { recordRouteActivityAccess } from "./hudCompanionDiag";

/**
 * Activity World invariant
 * - Heat dot: last completed ride within 24h via lastCompletedRideAtMs
 * - Live pulse: liveNow and activeRiderCount greater than zero
 * - updatedAtMs is server metadata only — never used for heat visibility
 */
export type RouteActivitySnapshot = {
  publicationId: string;
  activeRiderCount: number;
  /** 배지·heat 강도용 — 24h 윈도우 ride 횟수 근사 increment */
  recentRideCount7d: number;
  recentLikeCount: number;
  liveNow: boolean;
  pulseLevel: number;
  /** 서버 merge 시각 — heat 표시에 사용하지 않음 */
  updatedAtMs: number | null;
  /** 마지막 completed ride endedAt — heat dot 유일 시계 */
  lastCompletedRideAtMs: number | null;
  liveAnchorLngLat: LngLat | null;
  liveAnchorProgressRatio: number | null;
};

const ROUTE_ACTIVITY_COLLECTION = "routeActivity";

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

function parseRouteActivityDoc(publicationId: string, data: Record<string, unknown>): RouteActivitySnapshot {
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
  const lastCompletedRideAtMs = lastSeenAtToMillis(data.lastCompletedRideAt);
  return {
    publicationId,
    activeRiderCount,
    recentRideCount7d,
    recentLikeCount,
    liveNow,
    pulseLevel: liveNow && pulseLevel === 0 ? 1 : liveNow ? pulseLevel : 0,
    updatedAtMs: lastSeenAtToMillis(data.updatedAt),
    lastCompletedRideAtMs,
    liveAnchorLngLat,
    liveAnchorProgressRatio,
  };
}

const memoryCache = new Map<string, RouteActivitySnapshot | null>();
const inflight = new Map<string, Promise<RouteActivitySnapshot | null>>();

/** 저빈도 `getDoc` — 세션 캐시·in-flight 공유 */
export async function fetchRouteActivity(publicationId: string): Promise<RouteActivitySnapshot | null> {
  const id = publicationId.trim();
  if (!id) return null;
  if (memoryCache.has(id)) {
    const cached = memoryCache.get(id)!;
    recordRouteActivityAccess({
      kind: "cache",
      publicationId: id,
      activeRiderCount: cached?.activeRiderCount ?? null,
      liveNow: cached?.liveNow ?? null,
    });
    return cached;
  }

  let pending = inflight.get(id);
  if (!pending) {
    pending = (async () => {
      const db = getFirebaseFirestore();
      const routeSnap = await getDoc(doc(db, ROUTE_ACTIVITY_COLLECTION, id));
      const parsed = routeSnap.exists()
        ? parseRouteActivityDoc(id, routeSnap.data() as Record<string, unknown>)
        : null;
      recordRouteActivityAccess({
        kind: "getDoc",
        publicationId: id,
        activeRiderCount: parsed?.activeRiderCount ?? null,
        liveNow: parsed?.liveNow ?? null,
      });
      memoryCache.set(id, parsed);
      inflight.delete(id);
      return parsed;
    })().catch((e) => {
      inflight.delete(id);
      throw e;
    });
    inflight.set(id, pending);
  } else {
    recordRouteActivityAccess({ kind: "inflight", publicationId: id });
  }
  return pending;
}

export function routeActivityHeatAnchorMs(activity: RouteActivitySnapshot): number | null {
  return activity.lastCompletedRideAtMs;
}

/** 지도 라이브 펄스 — 실제 주행자가 있을 때만 */
export function isRouteActivityLive(activity: RouteActivitySnapshot): boolean {
  return activity.liveNow && activity.activeRiderCount > 0;
}

/** 지도 heat — lastCompletedRideAt 24h 이내만 */
export function isRouteActivityHeat(activity: RouteActivitySnapshot): boolean {
  if (isRouteActivityLive(activity)) return false;
  return isWithinActivityTraceHeatWindow(activity.lastCompletedRideAtMs);
}

/** heat 점·선 시각 강도 1..5 */
export function heatVisualWeight(recentRideCount7d: number): number {
  if (!Number.isFinite(recentRideCount7d) || recentRideCount7d <= 0) return 1;
  return Math.min(5, Math.max(1, Math.round(recentRideCount7d)));
}

/** 코스 목록 행용 짧은 배지 */
export function formatRouteActivityListBadge(activity: RouteActivitySnapshot | null): string | null {
  if (!activity) return null;
  if (activity.liveNow) {
    return activity.activeRiderCount > 0 ? `라이브 ${activity.activeRiderCount}` : "라이브";
  }
  if (isRouteActivityHeat(activity) && activity.recentRideCount7d > 0) {
    return `24시간 ${activity.recentRideCount7d}회`;
  }
  if (activity.recentLikeCount > 0) return `♥ ${activity.recentLikeCount}`;
  return null;
}

/** 맵 오버레이 폴링 시 aggregate 재조회 */
export function invalidateRouteActivityCache(publicationIds?: readonly string[]): void {
  if (!publicationIds?.length) {
    memoryCache.clear();
    invalidateLiveRouteActivityIdsCache();
    return;
  }
  for (const id of publicationIds) {
    const key = id.trim();
    if (key) memoryCache.delete(key);
  }
  invalidateLiveRouteActivityIdsCache();
}

/** @deprecated 낙관 heat 제거 — 캐시 무효화만 */
export function markRouteActivityRideCompletedOptimistic(publicationId: string): void {
  const id = publicationId.trim();
  if (!id) return;
  memoryCache.delete(id);
}

const LIVE_ROUTE_IDS_QUERY_MAX = 32;

let liveRouteIdsCache: { ids: string[]; at: number } | null = null;
const LIVE_ROUTE_IDS_CACHE_MS = 45_000;

/** `liveNow` publication ID — Activity World 조회용 */
export async function fetchLiveRouteActivityIds(
  max = LIVE_ROUTE_IDS_QUERY_MAX,
): Promise<string[]> {
  const cap = Math.max(1, Math.min(max, LIVE_ROUTE_IDS_QUERY_MAX));
  const now = Date.now();
  const cacheMs = isActivityLodDebugPanelEnabled() ? 10_000 : LIVE_ROUTE_IDS_CACHE_MS;
  if (liveRouteIdsCache && now - liveRouteIdsCache.at < cacheMs) {
    return liveRouteIdsCache.ids;
  }

  const db = getFirebaseFirestore();

  const runQuery = async (collectionId: string, ordered: boolean) => {
    const col = collection(db, collectionId);
    const q = ordered
      ? query(col, where("liveNow", "==", true), orderBy("activeRiderCount", "desc"), limit(cap))
      : query(col, where("liveNow", "==", true), limit(cap));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.id.trim()).filter(Boolean);
  };

  try {
    const ids = await runQuery(ROUTE_ACTIVITY_COLLECTION, true);
    liveRouteIdsCache = { ids, at: now };
    return ids;
  } catch {
    try {
      const ids = await runQuery(ROUTE_ACTIVITY_COLLECTION, false);
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
  publicationIds: readonly string[],
  options?: { refresh?: boolean },
): Promise<Map<string, RouteActivitySnapshot | null>> {
  const uniq = [...new Set(publicationIds.map((id) => id.trim()).filter(Boolean))];
  if (options?.refresh) invalidateRouteActivityCache(uniq);
  const pairs = await Promise.all(
    uniq.map(async (id) => [id, await fetchRouteActivity(id)] as const),
  );
  return new Map(pairs);
}

/** Activity World 지도 핀 탭 팝업 */
export function formatActivityWorldPinPopup(
  activity: RouteActivitySnapshot | null,
  kind: "pulse" | "heat",
): string {
  const title = kind === "pulse" ? "라이브 경로" : "최근 활동";
  const detail = formatRouteActivityHudLine(activity);
  if (detail) return `${title}\n${detail}`;
  if (kind === "pulse") return `${title}\n지금 주행 중`;
  return `${title}\n최근 24시간 내 주행 흔적`;
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
  } else if (isRouteActivityHeat(activity) && activity.recentRideCount7d > 0) {
    parts.push(`최근 24시간 ${activity.recentRideCount7d}회`);
  }
  if (activity.recentLikeCount > 0) parts.push(`좋아요 ${activity.recentLikeCount}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
