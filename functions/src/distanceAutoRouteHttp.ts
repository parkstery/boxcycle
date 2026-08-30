import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  buildAutoRouteCandidates,
  isDistanceErrorWithinMax,
  isValidAutoRouteEnd,
  mapWithConcurrency,
  pickBestAutoRoute,
  scoreRouteDistanceError,
  snappedEndFromRoute,
  type DirectionsRouteLike,
  type LngLat,
  type ScoredAutoRoute,
} from "./distanceAutoRouteCore.js";
import {
  loadRouteTokenEconomy,
  refundRouteGenerateToken,
  spendRouteGenerateToken,
} from "./routeTokenCore.js";

export type RouteProfile = "cycling" | "driving" | "walking";

const MAX_ROUTE_STRAIGHT_LINE_METERS = 120_000;
const AUTO_ROUTE_PROVIDER_CONCURRENCY = 5;
const ROUTE_AUTO_CACHE = "routeAutoRouteCache";

export type FetchDirectionsFn = (
  profile: RouteProfile,
  start: LngLat,
  end: LngLat,
) => Promise<DirectionsRouteLike>;

export type DistanceAutoRouteFound = {
  status: "found";
  geometry: DirectionsRouteLike["geometry"];
  distance: number;
  duration: number;
  end: LngLat;
  targetDistanceMeters: number;
  summary: string;
  routeTokenBalance: number;
};

export type DistanceAutoRouteFailed = {
  status: "failed";
  message: string;
  routeTokenBalance: number;
};

export type DistanceAutoRouteResult = DistanceAutoRouteFound | DistanceAutoRouteFailed;

type CacheDoc = {
  userId: string;
  requestId: string;
  status: "found" | "failed";
  message?: string;
  routeTokenBalance: number;
  geometryJson?: string;
  distance?: number;
  duration?: number;
  end?: LngLat;
  targetDistanceMeters?: number;
  summary?: string;
};

function cacheToResult(doc: CacheDoc): DistanceAutoRouteResult {
  if (doc.status === "found") {
    let geometry: DirectionsRouteLike["geometry"] | null = null;
    if (doc.geometryJson) {
      try {
        geometry = JSON.parse(doc.geometryJson) as DirectionsRouteLike["geometry"];
      } catch {
        geometry = null;
      }
    }
    if (
      !geometry ||
      typeof doc.distance !== "number" ||
      typeof doc.duration !== "number" ||
      !doc.end ||
      typeof doc.targetDistanceMeters !== "number" ||
      typeof doc.summary !== "string"
    ) {
      throw new HttpsError("internal", "캐시된 자동 경로 결과가 손상되었습니다.");
    }
    return {
      status: "found",
      geometry,
      distance: doc.distance,
      duration: doc.duration,
      end: doc.end,
      targetDistanceMeters: doc.targetDistanceMeters,
      summary: doc.summary,
      routeTokenBalance: doc.routeTokenBalance,
    };
  }
  return {
    status: "failed",
    message: doc.message ?? "목표거리와 적합한 경로를 찾지 못했습니다.",
    routeTokenBalance: doc.routeTokenBalance,
  };
}

function cacheDocId(userId: string, requestId: string): string {
  return `${userId}_${requestId}`.replace(/\//g, "_").slice(0, 1500);
}

function spendRequestId(requestId: string): string {
  return `auto_${requestId}`;
}

function isLngLat(v: unknown): v is LngLat {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1])
  );
}

export function parseDistanceAutoRouteBody(data: unknown): {
  start: LngLat;
  profile: RouteProfile;
  targetDistanceMeters: number;
  bearingDeg: number;
  requestId: string;
} {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "요청 본문이 올바르지 않습니다.");
  }
  const o = data as Record<string, unknown>;
  const { start, profile, targetDistanceMeters, bearingDeg, requestId } = o;
  if (!isLngLat(start)) {
    throw new HttpsError("invalid-argument", "start 는 [lng,lat] 숫자 배열이어야 합니다.");
  }
  if (profile !== "cycling" && profile !== "driving" && profile !== "walking") {
    throw new HttpsError("invalid-argument", "profile 은 cycling | driving | walking 만 허용됩니다.");
  }
  if (typeof targetDistanceMeters !== "number" || !Number.isFinite(targetDistanceMeters)) {
    throw new HttpsError("invalid-argument", "targetDistanceMeters 가 필요합니다.");
  }
  if (targetDistanceMeters < 500 || targetDistanceMeters > 120_000) {
    throw new HttpsError("invalid-argument", "목표 거리는 0.5~120 km 입니다.");
  }
  if (typeof bearingDeg !== "number" || !Number.isFinite(bearingDeg)) {
    throw new HttpsError("invalid-argument", "bearingDeg 가 필요합니다.");
  }
  if (typeof requestId !== "string") {
    throw new HttpsError("invalid-argument", "requestId 가 필요합니다.");
  }
  const id = requestId.trim();
  if (id.length < 8 || id.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new HttpsError("invalid-argument", "requestId 형식이 올바르지 않습니다.");
  }
  return {
    start,
    profile,
    targetDistanceMeters,
    bearingDeg: ((bearingDeg % 360) + 360) % 360,
    requestId: id,
  };
}

async function readCache(userId: string, requestId: string): Promise<CacheDoc | null> {
  const snap = await getFirestore()
    .doc(`${ROUTE_AUTO_CACHE}/${cacheDocId(userId, requestId)}`)
    .get();
  if (!snap.exists) return null;
  const data = snap.data() as CacheDoc;
  if (data.userId !== userId || data.requestId !== requestId) return null;
  return data;
}

async function writeCache(userId: string, requestId: string, doc: CacheDoc): Promise<void> {
  await getFirestore()
    .doc(`${ROUTE_AUTO_CACHE}/${cacheDocId(userId, requestId)}`)
    .set({
      ...doc,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export async function executeDistanceAutoRoute(input: {
  userId: string;
  start: LngLat;
  profile: RouteProfile;
  targetDistanceMeters: number;
  bearingDeg: number;
  requestId: string;
  fetchDirections: FetchDirectionsFn;
}): Promise<DistanceAutoRouteResult> {
  const { userId, start, profile, targetDistanceMeters, bearingDeg, requestId, fetchDirections } =
    input;

  const cached = await readCache(userId, requestId);
  if (cached) {
    return cacheToResult(cached);
  }

  const economy = await loadRouteTokenEconomy();
  const generateCost = Math.max(0, Math.floor(economy.generateCostBase));
  const tokenRequestId = spendRequestId(requestId);

  let routeTokenBalance: number;
  try {
    routeTokenBalance = await spendRouteGenerateToken(userId, tokenRequestId);
  } catch (e) {
    if (e instanceof HttpsError && e.code === "resource-exhausted") {
      throw e;
    }
    throw e;
  }

  const candidates = buildAutoRouteCandidates(start, bearingDeg, targetDistanceMeters).filter((c) =>
    isValidAutoRouteEnd(start, c.end),
  );

  if (candidates.length === 0) {
    if (generateCost > 0) {
      await refundRouteGenerateToken(userId, tokenRequestId, generateCost);
      routeTokenBalance += generateCost;
    }
    const failed: DistanceAutoRouteFailed = {
      status: "failed",
      message: "후보 종점을 만들 수 없습니다. 거리를 조정해 보세요.",
      routeTokenBalance,
    };
    await writeCache(userId, requestId, {
      userId,
      requestId,
      status: "failed",
      message: failed.message,
      routeTokenBalance,
    });
    return failed;
  }

  const scored = await mapWithConcurrency(candidates, AUTO_ROUTE_PROVIDER_CONCURRENCY, async (candidate) => {
    if (candidate.straightLineMeters > MAX_ROUTE_STRAIGHT_LINE_METERS) return null;
    try {
      const route = await fetchDirections(profile, start, candidate.end);
      return {
        candidate,
        route,
        errorMeters: scoreRouteDistanceError(route.distance, targetDistanceMeters),
      } satisfies ScoredAutoRoute;
    } catch {
      return null;
    }
  });

  const best = pickBestAutoRoute(scored, bearingDeg);
  if (!best || !isDistanceErrorWithinMax(best.errorMeters, targetDistanceMeters)) {
    if (generateCost > 0) {
      await refundRouteGenerateToken(userId, tokenRequestId, generateCost);
      routeTokenBalance += generateCost;
    }
    const km = best ? (best.route.distance / 1000).toFixed(1) : null;
    const targetLabel = (targetDistanceMeters / 1000).toFixed(1);
    const message =
      km != null
        ? `목표거리와 적합한 경로를 찾지 못했습니다. (가장 가까운 결과: ${km} km / 목표 ${targetLabel} km)`
        : "목표거리와 적합한 경로를 찾지 못했습니다. 방향이나 거리를 바꿔 보세요.";
    const failed: DistanceAutoRouteFailed = {
      status: "failed",
      message,
      routeTokenBalance,
    };
    await writeCache(userId, requestId, {
      userId,
      requestId,
      status: "failed",
      message: failed.message,
      routeTokenBalance,
    });
    return failed;
  }

  const snappedEnd = snappedEndFromRoute(best.route);
  const km = (best.route.distance / 1000).toFixed(1);
  const targetLabel = (targetDistanceMeters / 1000).toFixed(1);
  const summary = `목표 ${targetLabel} km · 실제 ${km} km / 예상 ${formatDuration(best.route.duration)}`;

  const found: DistanceAutoRouteFound = {
    status: "found",
    geometry: best.route.geometry,
    distance: best.route.distance,
    duration: best.route.duration,
    end: snappedEnd,
    targetDistanceMeters,
    summary,
    routeTokenBalance,
  };

  await writeCache(userId, requestId, {
    userId,
    requestId,
    status: "found",
    geometryJson: JSON.stringify(found.geometry),
    distance: found.distance,
    duration: found.duration,
    end: found.end,
    targetDistanceMeters: found.targetDistanceMeters,
    summary: found.summary,
    routeTokenBalance,
  });

  return found;
}
