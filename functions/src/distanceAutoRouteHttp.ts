import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  AUTO_ROUTE_ALGORITHM_VERSION,
  bearingFromOriginToPoint,
  searchDistanceAutoRoute,
  type AutoRouteOutcome,
  type DirectionsRouteLike,
  type FetchDirectionsFn,
  type LngLat,
  type RouteProfile,
} from "./distanceAutoRouteCore.js";
import {
  loadRouteTokenEconomy,
  refundRouteGenerateToken,
  spendRouteGenerateToken,
} from "./routeTokenCore.js";

export type { FetchDirectionsFn, RouteProfile } from "./distanceAutoRouteCore.js";

const ROUTE_AUTO_CACHE = "routeAutoRouteCache";

export type DistanceAutoRouteFound = {
  status: "found";
  geometry: DirectionsRouteLike["geometry"];
  distance: number;
  duration: number;
  end: LngLat;
  targetDistanceMeters: number;
  summary: string;
  routeTokenBalance: number;
  endMissMeters?: number;
  algorithmVersion?: string;
  outcome?: AutoRouteOutcome;
  directRoadMeters?: number;
  detourCalls?: number;
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
  targetRoadPoint?: LngLat;
  algorithmVersion?: string;
  endMissMeters?: number;
  snappedEnd?: LngLat;
  outcome?: AutoRouteOutcome;
  directRoadMeters?: number;
  detourCalls?: number;
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
      endMissMeters: doc.endMissMeters,
      algorithmVersion: doc.algorithmVersion,
      outcome: doc.outcome,
      directRoadMeters: doc.directRoadMeters,
      detourCalls: doc.detourCalls,
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
  targetRoadPoint: LngLat;
  profile: RouteProfile;
  targetDistanceMeters: number;
  bearingDeg: number;
  requestId: string;
} {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "요청 본문이 올바르지 않습니다.");
  }
  const o = data as Record<string, unknown>;
  const { start, targetRoadPoint, profile, targetDistanceMeters, requestId } = o;
  if (!isLngLat(start)) {
    throw new HttpsError("invalid-argument", "start 는 [lng,lat] 숫자 배열이어야 합니다.");
  }
  if (!isLngLat(targetRoadPoint)) {
    throw new HttpsError("invalid-argument", "targetRoadPoint 는 [lng,lat] 숫자 배열이어야 합니다.");
  }
  if (targetRoadPoint[0] < -180 || targetRoadPoint[0] > 180 || targetRoadPoint[1] < -90 || targetRoadPoint[1] > 90) {
    throw new HttpsError("invalid-argument", "targetRoadPoint 좌표 범위가 올바르지 않습니다.");
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
  if (typeof requestId !== "string") {
    throw new HttpsError("invalid-argument", "requestId 가 필요합니다.");
  }
  const id = requestId.trim();
  if (id.length < 8 || id.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new HttpsError("invalid-argument", "requestId 형식이 올바르지 않습니다.");
  }
  return {
    start,
    targetRoadPoint,
    profile,
    targetDistanceMeters,
    bearingDeg: bearingFromOriginToPoint(start, targetRoadPoint),
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
  targetRoadPoint: LngLat;
  profile: RouteProfile;
  targetDistanceMeters: number;
  bearingDeg: number;
  requestId: string;
  fetchDirections: FetchDirectionsFn;
}): Promise<DistanceAutoRouteResult> {
  const {
    userId,
    start,
    targetRoadPoint,
    profile,
    targetDistanceMeters,
    bearingDeg,
    requestId,
    fetchDirections,
  } = input;

  const cached = await readCache(userId, requestId);
  if (cached) {
    return cacheToResult(cached);
  }

  const economy = await loadRouteTokenEconomy();
  const generateCost = Math.max(0, Math.floor(economy.generateCostBase));
  const tokenRequestId = spendRequestId(requestId);

  // 「거리 조정 재탐색 1회 무료」 정책은 제거했다(5A-R2 §3.2) — 재탐색 기능 자체가 없어졌다.
  let routeTokenBalance: number;
  {
    try {
      routeTokenBalance = await spendRouteGenerateToken(userId, tokenRequestId);
    } catch (e) {
      if (e instanceof HttpsError && e.code === "resource-exhausted") {
        throw e;
      }
      throw e;
    }
  }

  const searched = await searchDistanceAutoRoute({
    start,
    targetRoadPoint,
    profile,
    targetDistanceMeters,
    bearingDeg,
    fetchDirections,
  });

  if (searched.status === "failed") {
    if (generateCost > 0) {
      await refundRouteGenerateToken(userId, tokenRequestId, generateCost);
      routeTokenBalance += generateCost;
    }
    const failed: DistanceAutoRouteFailed = {
      status: "failed",
      message: searched.message,
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

  const { diagnostics, outcome, directRoadMeters, endMissMeters, detourCalls } = searched;
  const targetLabel = (targetDistanceMeters / 1000).toFixed(1);
  const actualLabel = (searched.distance / 1000).toFixed(2);
  const summary =
    outcome === "shortfall"
      ? (() => {
          const deficitM = Math.max(0, Math.round(targetDistanceMeters - searched.distance));
          return `목표 ${targetLabel} km 에 ${deficitM} m 모자란 ${actualLabel} km 로 만들었습니다.`;
        })()
      : `목표 ${targetLabel} km · 연장 ${actualLabel} km / 예상 ${formatDuration(searched.duration)}`;
  console.info(
    JSON.stringify({
      kind: "distanceAutoRouteDiagnostics",
      requestId,
      algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
      outcome,
      directRoadMeters,
      endMissMeters,
      detourCalls,
      ...diagnostics,
    }),
  );

  const found: DistanceAutoRouteFound = {
    status: "found",
    geometry: searched.geometry,
    distance: searched.distance,
    duration: searched.duration,
    end: searched.end,
    targetDistanceMeters,
    summary,
    routeTokenBalance,
    endMissMeters: diagnostics.rawClickMissMeters,
    algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
    outcome,
    directRoadMeters,
    detourCalls,
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
    targetRoadPoint,
    algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
    endMissMeters: diagnostics.rawClickMissMeters,
    snappedEnd: diagnostics.snappedClickPoint ?? undefined,
    outcome,
    directRoadMeters,
    detourCalls,
  });

  return found;
}
