import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  AUTO_ROUTE_ALGORITHM_VERSION,
  bearingFromOriginToPoint,
  offsetLngLatByBearingMeters,
  searchDistanceAutoRoute,
  searchReadyLoopRoute,
  searchReadyOnewayRoute,
  type AutoRouteOutcome,
  type ClaimReader,
  type DirectionsRouteLike,
  type FetchDirectionsFn,
  type LngLat,
  type RouteProfile,
} from "./distanceAutoRouteCore.js";
// 이 파일이 **조립 지점(composition root)** 이다 — 코어가 선언한 `ClaimReader` 포트에
// Conquest 의 Firestore 구현을 끼운다(Phase 5 D2). 코어는 Conquest 를 모른다.
import { loadClaimedCellsNearStart } from "./conquestClaimRead.js";
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
  /** Ready Ride(폐합) 결과에서만 채워진다. */
  closeLoop?: boolean;
  /**
   * closeLoop 요청의 실제 결과 — true 면 폐합(출발=도착), false 면 폐합에 실패해
   * `searchDistanceAutoRoute` 로 만든 편도 대안이다(지시03 §B2·§B3). closeLoop 가 아닌
   * 클릭 기반 응답에는 없다.
   */
  closed?: boolean;
  selfOverlapRatio?: number;
  startBearingSampleDeg?: number;
  startSnapMeters?: number;
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
  closeLoop?: boolean;
  closed?: boolean;
  selfOverlapRatio?: number;
  startBearingSampleDeg?: number;
  startSnapMeters?: number;
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
      closeLoop: doc.closeLoop,
      closed: doc.closed,
      selfOverlapRatio: doc.selfOverlapRatio,
      startBearingSampleDeg: doc.startBearingSampleDeg,
      startSnapMeters: doc.startSnapMeters,
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
  /**
   * 클릭 기반은 필수. Ready Ride(closeLoop 또는 지시05 단순 경로)는 클릭이 없어 null.
   */
  targetRoadPoint: LngLat | null;
  profile: RouteProfile;
  targetDistanceMeters: number;
  bearingDeg: number | undefined;
  closeLoop: boolean;
  /**
   * Ready Ride 「다른 경로」— closeLoop·단순 경로 모두에서 직전 시작 방위를 제외한다.
   */
  excludeStartBearingDeg: number | undefined;
  requestId: string;
  /** 지시05 — closeLoop 없이 target 없이 온 Ready Ride 단순 경로 요청 */
  readyOneway: boolean;
} {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "요청 본문이 올바르지 않습니다.");
  }
  const o = data as Record<string, unknown>;
  const { start, targetRoadPoint, profile, targetDistanceMeters, requestId, closeLoop, excludeStartBearingDeg } = o;
  if (!isLngLat(start)) {
    throw new HttpsError("invalid-argument", "start 는 [lng,lat] 숫자 배열이어야 합니다.");
  }
  const isCloseLoop = closeLoop === true;
  let parsedTargetRoadPoint: LngLat | null = null;
  const hasTarget = isLngLat(targetRoadPoint);
  /** Ready Ride 단순 경로(지시05): closeLoop 아님 + target 없음 */
  const readyOneway = !isCloseLoop && !hasTarget;

  if (!isCloseLoop && !readyOneway) {
    if (!hasTarget) {
      throw new HttpsError("invalid-argument", "targetRoadPoint 는 [lng,lat] 숫자 배열이어야 합니다.");
    }
    if (targetRoadPoint[0] < -180 || targetRoadPoint[0] > 180 || targetRoadPoint[1] < -90 || targetRoadPoint[1] > 90) {
      throw new HttpsError("invalid-argument", "targetRoadPoint 좌표 범위가 올바르지 않습니다.");
    }
    parsedTargetRoadPoint = targetRoadPoint as LngLat;
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
  let parsedExcludeStartBearingDeg: number | undefined;
  if (
    (isCloseLoop || readyOneway) &&
    typeof excludeStartBearingDeg === "number" &&
    Number.isFinite(excludeStartBearingDeg)
  ) {
    parsedExcludeStartBearingDeg = excludeStartBearingDeg;
  }

  return {
    start,
    targetRoadPoint: parsedTargetRoadPoint,
    profile,
    targetDistanceMeters,
    bearingDeg: parsedTargetRoadPoint ? bearingFromOriginToPoint(start, parsedTargetRoadPoint) : undefined,
    closeLoop: isCloseLoop,
    excludeStartBearingDeg: parsedExcludeStartBearingDeg,
    requestId: id,
    readyOneway,
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
  targetRoadPoint: LngLat | null;
  profile: RouteProfile;
  targetDistanceMeters: number;
  bearingDeg: number | undefined;
  closeLoop: boolean;
  /** Ready Ride 단순 경로(지시05) — closeLoop 없이 방위 자동 표본 */
  readyOneway?: boolean;
  /** 「다른 경로」(지시03 §B3) — Ready Ride(폐합·단순)에서 직전 시작 방위 제외 */
  excludeStartBearingDeg?: number;
  requestId: string;
  fetchDirections: FetchDirectionsFn;
  /**
   * 출발점 주변 Claim 읽기. 생략하면 Firestore 구현을 쓴다.
   * 시험에서 가짜를 주입해 Firestore 없이 순위 동작을 고정한다.
   */
  loadClaimedCells?: ClaimReader;
}): Promise<DistanceAutoRouteResult> {
  const {
    userId,
    start,
    targetRoadPoint,
    profile,
    targetDistanceMeters,
    bearingDeg,
    closeLoop,
    readyOneway = false,
    excludeStartBearingDeg,
    requestId,
    fetchDirections,
    loadClaimedCells = loadClaimedCellsNearStart,
  } = input;

  const cached = await readCache(userId, requestId);
  if (cached) {
    return cacheToResult(cached);
  }

  const economy = await loadRouteTokenEconomy();
  const generateCost = Math.max(0, Math.floor(economy.generateCostBase));
  const tokenRequestId = spendRequestId(requestId);

  // 「거리 조정 재탐색 1회 무료」 정책은 제거했다(5A-R2 §3.2) — 재탐색 기능 자체가 없어졌다.
  // Ready Ride(closeLoop) 도 같은 Token 규칙을 그대로 쓴다 — 토큰은 이 라운드에서 건드리지 않는다
  // (⚠【정정·Chief 2026-09-24】 — 무료·차감 분기 신설 금지).
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

  if (closeLoop) {
    const loopSearched = await searchReadyLoopRoute({
      start,
      profile,
      targetDistanceMeters,
      fetchDirections,
      excludeBearingsDeg:
        excludeStartBearingDeg !== undefined ? [excludeStartBearingDeg] : undefined,
    });

    if (loopSearched.status === "found") {
      const targetLabel = (targetDistanceMeters / 1000).toFixed(1);
      const actualLabel = (loopSearched.distance / 1000).toFixed(2);
      const summary = `목표 ${targetLabel} km 순환 · 연장 ${actualLabel} km / 예상 ${formatDuration(loopSearched.duration)}`;

      console.info(
        JSON.stringify({
          kind: "readyLoopRouteDiagnostics",
          requestId,
          algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
          status: "found",
          closed: true,
          startBearingSampleDeg: loopSearched.startBearingSampleDeg,
          selfOverlapRatio: loopSearched.selfOverlapRatio,
          providerCallCount: loopSearched.providerCallCount,
          searchElapsedMs: loopSearched.searchElapsedMs,
          distance: loopSearched.distance,
          startSnapMeters: loopSearched.startSnapMeters,
        }),
      );

      const found: DistanceAutoRouteFound = {
        status: "found",
        geometry: loopSearched.geometry,
        distance: loopSearched.distance,
        duration: loopSearched.duration,
        end: loopSearched.end,
        targetDistanceMeters,
        summary,
        routeTokenBalance,
        algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
        closeLoop: true,
        closed: true,
        selfOverlapRatio: loopSearched.selfOverlapRatio,
        startBearingSampleDeg: loopSearched.startBearingSampleDeg,
        startSnapMeters: loopSearched.startSnapMeters,
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
        algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
        closeLoop: true,
        closed: true,
        selfOverlapRatio: loopSearched.selfOverlapRatio,
        startBearingSampleDeg: loopSearched.startBearingSampleDeg,
        startSnapMeters: loopSearched.startSnapMeters,
      });

      return found;
    }

    console.info(
      JSON.stringify({
        kind: "readyLoopRouteDiagnostics",
        requestId,
        algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
        status: "failed",
        reason: loopSearched.reason,
        providerCallCount: loopSearched.providerCallCount,
        searchElapsedMs: loopSearched.searchElapsedMs,
        closestCandidate: loopSearched.closestCandidate,
      }),
    );

    /**
     * 지시03 §B2 정정 — 폐합 실패 시 조용히 편도로 낙하하지 않되(사실을 말해 준다),
     * 결과 없이 되묻지도 않는다. `closestCandidate` 가 있으면(=도로 자체는 있었다) 그
     * 방위로 `searchDistanceAutoRoute` 를 1회 더 시도한다. 후보가 아예 없었다면
     * (reason: no_road/budget_exceeded) 편도도 같은 이유로 실패할 것이 확실하므로
     * 호출을 아끼고 바로 실패로 내려보낸다("편도조차 못 만들면 그때는 실패다").
     */
    const fallbackBearingDeg = loopSearched.closestCandidate?.bearingDeg;
    if (fallbackBearingDeg !== undefined) {
      const fallbackTargetRoadPoint = offsetLngLatByBearingMeters(
        start,
        fallbackBearingDeg,
        targetDistanceMeters,
      );
      const onewaySearched = await searchDistanceAutoRoute({
        start,
        targetRoadPoint: fallbackTargetRoadPoint,
        profile,
        targetDistanceMeters,
        bearingDeg: fallbackBearingDeg,
        fetchDirections,
      });

      const onewayProviderCallCount =
        onewaySearched.status === "found"
          ? onewaySearched.diagnostics.providerCallCount
          : onewaySearched.providerCallCount;
      console.info(
        JSON.stringify({
          kind: "readyLoopRouteOnewayFallbackDiagnostics",
          requestId,
          algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
          status: onewaySearched.status,
          fallbackBearingDeg,
          loopProviderCallCount: loopSearched.providerCallCount,
          onewayProviderCallCount,
          totalProviderCallCount: loopSearched.providerCallCount + onewayProviderCallCount,
        }),
      );

      if (onewaySearched.status === "found") {
        const targetLabel = (targetDistanceMeters / 1000).toFixed(1);
        const actualLabel = (onewaySearched.distance / 1000).toFixed(2);
        const summary =
          `순환 경로를 찾지 못해 편도 경로를 만들었어요 — 목표 ${targetLabel} km · ` +
          `연장 ${actualLabel} km / 예상 ${formatDuration(onewaySearched.duration)}`;

        const found: DistanceAutoRouteFound = {
          status: "found",
          geometry: onewaySearched.geometry,
          distance: onewaySearched.distance,
          duration: onewaySearched.duration,
          end: onewaySearched.end,
          targetDistanceMeters,
          summary,
          routeTokenBalance,
          algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
          closeLoop: true,
          closed: false,
          startBearingSampleDeg: fallbackBearingDeg,
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
          algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
          closeLoop: true,
          closed: false,
          startBearingSampleDeg: fallbackBearingDeg,
        });

        return found;
      }
    }

    // 편도조차 못 만들었다(도로 없음 등) — 진짜 실패.
    if (generateCost > 0) {
      await refundRouteGenerateToken(userId, tokenRequestId, generateCost);
      routeTokenBalance += generateCost;
    }
    const failed: DistanceAutoRouteFailed = {
      status: "failed",
      message: loopSearched.message,
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

  // 지시05 — Ready Ride 기본 = 단순 경로(방위 자동 표본 + searchDistanceAutoRoute)
  // 지시08 — 출발점 주변 Claim만 읽어 신규도로·자기중복으로 순위(탈락 아님)
  if (readyOneway) {
    const claimLoad = await loadClaimedCells({
      userId,
      start,
      radiusMeters: targetDistanceMeters * 1.5,
    });
    const onewaySearched = await searchReadyOnewayRoute({
      start,
      profile,
      targetDistanceMeters,
      fetchDirections,
      excludeBearingsDeg:
        excludeStartBearingDeg !== undefined ? [excludeStartBearingDeg] : undefined,
      claimedCellIds: claimLoad.claimedCellIds,
    });

    if (onewaySearched.status === "failed") {
      if (generateCost > 0) {
        await refundRouteGenerateToken(userId, tokenRequestId, generateCost);
        routeTokenBalance += generateCost;
      }
      console.info(
        JSON.stringify({
          kind: "readyOnewayRouteDiagnostics",
          requestId,
          algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
          status: "failed",
          reason: onewaySearched.reason,
          providerCallCount: onewaySearched.providerCallCount,
          searchElapsedMs: onewaySearched.searchElapsedMs,
          claimReadMs: claimLoad.readMs,
          claimChunksHit: claimLoad.chunksHit,
          claimCells: claimLoad.claimedCellIds.size,
        }),
      );
      const failed: DistanceAutoRouteFailed = {
        status: "failed",
        message: onewaySearched.message,
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

    const targetLabel = (targetDistanceMeters / 1000).toFixed(1);
    const actualLabel = (onewaySearched.distance / 1000).toFixed(2);
    const summary =
      onewaySearched.outcome === "shortfall"
        ? (() => {
            const deficitM = Math.max(0, Math.round(targetDistanceMeters - onewaySearched.distance));
            return `목표 ${targetLabel} km 에 ${deficitM} m 모자란 ${actualLabel} km 로 만들었습니다.`;
          })()
        : `목표 ${targetLabel} km · 연장 ${actualLabel} km / 예상 ${formatDuration(onewaySearched.duration)}`;

    console.info(
      JSON.stringify({
        kind: "readyOnewayRouteDiagnostics",
        requestId,
        algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
        status: "found",
        closed: false,
        startBearingSampleDeg: onewaySearched.startBearingSampleDeg,
        providerCallCount: onewaySearched.providerCallCount,
        searchElapsedMs: onewaySearched.searchElapsedMs,
        distance: onewaySearched.distance,
        outcome: onewaySearched.outcome,
        newRoadRatio: onewaySearched.newRoadRatio,
        selfOverlapRatio: onewaySearched.selfOverlapRatio,
        rankScore: onewaySearched.rankScore,
        claimReadMs: claimLoad.readMs,
        claimChunksHit: claimLoad.chunksHit,
        claimCells: claimLoad.claimedCellIds.size,
      }),
    );

    const found: DistanceAutoRouteFound = {
      status: "found",
      geometry: onewaySearched.geometry,
      distance: onewaySearched.distance,
      duration: onewaySearched.duration,
      end: onewaySearched.end,
      targetDistanceMeters,
      summary,
      routeTokenBalance,
      algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
      closeLoop: false,
      closed: false,
      outcome: onewaySearched.outcome,
      startBearingSampleDeg: onewaySearched.startBearingSampleDeg,
      selfOverlapRatio: onewaySearched.selfOverlapRatio,
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
      algorithmVersion: AUTO_ROUTE_ALGORITHM_VERSION,
      closeLoop: false,
      closed: false,
      startBearingSampleDeg: onewaySearched.startBearingSampleDeg,
    });

    return found;
  }

  if (!targetRoadPoint || bearingDeg === undefined) {
    throw new HttpsError("invalid-argument", "targetRoadPoint 가 필요합니다.");
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
