import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { mergeUserAuthMeta } from "./userTierCore.js";
import { adminPromoteSavedRoute } from "./adminPromoteSavedRoute.js";
import { autoReviewPublicRouteRequest } from "./autoReviewPublicRouteRequest.js";
import {
  ensureRouteTokenOnboarding,
  loadRouteTokenEconomy,
  refundRouteGenerateToken,
  spendRouteGenerateToken,
} from "./routeTokenCore.js";
import { fetchHarnessFakeDirections, isHarnessFakeMapboxActive } from "./harnessFakeMapbox.js";
import {
  executeDistanceAutoRoute,
  parseDistanceAutoRouteBody,
  type FetchDirectionsFn,
} from "./distanceAutoRouteHttp.js";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { REGION } from "./region.js";
import {
  guestLifecycleBlockedHttpsError,
  permanentAuthHttpsError,
  transientStoreHttpsError,
  verifyUidForAdminHttp,
} from "./guestLifecycleHttp.js";

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

function parseRequestId(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new HttpsError("invalid-argument", "requestId 가 필요합니다.");
  }
  const id = raw.trim();
  if (id.length < 8 || id.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new HttpsError("invalid-argument", "requestId 형식이 올바르지 않습니다.");
  }
  return id;
}

function parseBody(data: unknown): {
  start: LngLat;
  end: LngLat;
  profile: RouteProfile;
  waypoints: LngLat[];
  requestId: string;
} {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "요청 본문이 올바르지 않습니다.");
  }
  const o = data as Record<string, unknown>;
  const { start, end, profile, waypoints, requestId } = o;
  if (!isLngLat(start) || !isLngLat(end)) {
    throw new HttpsError("invalid-argument", "start·end 는 [lng,lat] 숫자 배열이어야 합니다.");
  }
  if (profile !== "cycling" && profile !== "driving" && profile !== "walking") {
    throw new HttpsError("invalid-argument", "profile 은 cycling | driving | walking 만 허용됩니다.");
  }
  return { start, end, profile, waypoints: parseWaypoints(waypoints), requestId: parseRequestId(requestId) };
}

function isWarmRequest(rawBody: unknown): boolean {
  return (rawBody as { data?: { warm?: unknown } } | null)?.data?.warm === true;
}

/**
 * 미리 깨우기(`{ data: { warm: true } }`) — 새 인스턴스의 첫 실요청이 치르는 지연 초기화
 * (Firestore 채널·Admin 액세스 토큰·Auth 공개키)를 사용자가 End·방향을 고르는 사이에 먼저 치른다.
 * 읽기만 하고 토큰·문서는 건드리지 않는다. GET 만으로는 컨테이너만 뜨고 이 초기화는 남는다(실측 2026-10-07).
 */
async function warmRouteServerClients(uid: string): Promise<void> {
  await Promise.all([loadRouteTokenEconomy(), getAuth().getUser(uid)]);
}

async function respondWarm(res: Response, uid: string): Promise<void> {
  try {
    await warmRouteServerClients(uid);
  } catch (e) {
    console.warn("route warm failed", e);
  }
  res.status(200).json({ result: { warm: true } });
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
    region: REGION,
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

    /*
     * 공용 게이트 — verifyIdToken(token, true) 영구/일시 분류 + guestLifecycle tombstone
     * 차단(null 이면 이미 응답됨). deletionScheduled·deleted 게스트의 기존 토큰은
     * mergeUserAuthMeta·ensureRouteTokenOnboarding.users 원장을 (재)생성하지 못하게 여기서 끊는다.
     */
    const uid = await verifyUidForAdminHttp(res, tokenMatch[1]);
    if (!uid) return;

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

    if (isWarmRequest(rawBody)) {
      await respondWarm(res, uid);
      return;
    }

    try {
      const dataField = (rawBody as { data?: unknown } | null)?.data;
      const { start, end, profile, waypoints, requestId } = parseBody(dataField);
      const economy = await loadRouteTokenEconomy();
      /*
       * users 메타 merge 실패는 삼키지 않는다(02-task-12 §1 — Task09 검수잔여). 여기서
       * 실패하면 다음 온보딩·토큰 소모·외부 Mapbox 비용·원장 생성이 아예 시작되지 않고
       * outer catch 로 넘어간다(삭제경합 user-not-found 401 / guard 403 / 일시 503 / 그 외 500).
       */
      await mergeUserAuthMeta(uid);
      await ensureRouteTokenOnboarding(uid);
      const routeTokenBalance = await spendRouteGenerateToken(uid, requestId);
      const generateCost = Math.max(0, Math.floor(economy.generateCostBase));

      let route: {
        geometry: { type: string; coordinates: number[][] };
        distance: number;
        duration: number;
      };

      if (isHarnessFakeMapboxActive()) {
        try {
          route = await fetchHarnessFakeDirections(profile, start, end, waypoints);
        } catch (e) {
          if (generateCost > 0) {
            await refundRouteGenerateToken(uid, requestId, generateCost);
          }
          console.error("harness fake mapbox failure", e);
          throw new HttpsError("internal", "Directions API 요청이 거부되었습니다.");
        }
      } else {
        const token = mapboxAccessToken.value();
        if (!token?.trim()) {
          if (generateCost > 0) {
            await refundRouteGenerateToken(uid, requestId, generateCost);
          }
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
          if (generateCost > 0) {
            await refundRouteGenerateToken(uid, requestId, generateCost);
          }
          throw new HttpsError("unavailable", "Directions API 연결에 실패했습니다.");
        }

        if (!mapResponse.ok) {
          const body = await mapResponse.text().catch(() => "");
          console.error("Mapbox Directions HTTP error", mapResponse.status, body.slice(0, 500));
          if (generateCost > 0) {
            await refundRouteGenerateToken(uid, requestId, generateCost);
          }
          throw new HttpsError("internal", "Directions API 요청이 거부되었습니다.");
        }

        const mapJson = (await mapResponse.json()) as {
          code?: string;
          message?: string;
          routes?: { geometry: { type: string; coordinates: number[][] }; distance: number; duration: number }[];
        };

        if (mapJson.code && mapJson.code !== "Ok") {
          console.error("Mapbox Directions error body", mapJson.code, mapJson.message);
          if (generateCost > 0) {
            await refundRouteGenerateToken(uid, requestId, generateCost);
          }
          throw new HttpsError("invalid-argument", mapJson.message ?? "경로를 계산할 수 없습니다.");
        }

        const mapRoute = mapJson.routes?.[0];
        if (
          !mapRoute?.geometry ||
          mapRoute.geometry.type !== "LineString" ||
          !Array.isArray(mapRoute.geometry.coordinates)
        ) {
          if (generateCost > 0) {
            await refundRouteGenerateToken(uid, requestId, generateCost);
          }
          throw new HttpsError("not-found", "경로를 찾지 못했습니다.");
        }
        route = mapRoute;
      }

      if (route.geometry.type !== "LineString" || !Array.isArray(route.geometry.coordinates)) {
        if (generateCost > 0) {
          await refundRouteGenerateToken(uid, requestId, generateCost);
        }
        throw new HttpsError("not-found", "경로를 찾지 못했습니다.");
      }

      res.status(200).json({
        result: {
          geometry: route.geometry as { type: "LineString"; coordinates: [number, number][] },
          distance: route.distance,
          duration: route.duration,
          routeTokenBalance,
        },
      });
    } catch (e: unknown) {
      if (e instanceof HttpsError) {
        res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
        return;
      }
      // guestLifecycle guard 차단은 403, 일시적 store 장애는 503 — 정상/500으로 삼키지 않는다.
      const blocked = guestLifecycleBlockedHttpsError(e);
      if (blocked) {
        console.warn("[route] tombstone 차단으로 요청을 종료한다", e);
        res.status(blocked.httpErrorCode.status).json({ error: blocked.toJSON() });
        return;
      }
      const transient = transientStoreHttpsError(e);
      if (transient) {
        console.warn("[route] 일시 장애 — 503 재시도 응답", e);
        res.status(transient.httpErrorCode.status).json({ error: transient.toJSON() });
        return;
      }
      // mergeUserAuthMeta 의 영구 Auth 오류(삭제경합 user-not-found 등)는 500 으로 줄이지 않는다.
      const authGone = permanentAuthHttpsError(e);
      if (authGone) {
        console.warn("[route] 계정이 Auth 에서 사라져 요청을 끊는다", e);
        res.status(authGone.httpErrorCode.status).json({ error: authGone.toJSON() });
        return;
      }
      console.error(e);
      const err = new HttpsError("internal", "서버 오류가 발생했습니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
    }
  },
);

async function fetchDirectionsRoute(
  profile: RouteProfile,
  start: LngLat,
  end: LngLat,
  waypoints: LngLat[] = [],
): Promise<{
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distance: number;
  duration: number;
  snappedEnd?: [number, number];
  endSnapDistanceMeters?: number;
}> {
  if (isHarnessFakeMapboxActive()) {
    return fetchHarnessFakeDirections(profile, start, end, waypoints);
  }

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
    routes?: {
      geometry: { type: string; coordinates: number[][] };
      distance: number;
      duration: number;
    }[];
    waypoints?: { location?: [number, number]; distance?: number }[];
  };

  if (mapJson.code && mapJson.code !== "Ok") {
    console.error("Mapbox Directions error body", mapJson.code, mapJson.message);
    throw new HttpsError("invalid-argument", mapJson.message ?? "경로를 계산할 수 없습니다.");
  }

  const route = mapJson.routes?.[0];
  if (!route?.geometry || route.geometry.type !== "LineString" || !Array.isArray(route.geometry.coordinates)) {
    throw new HttpsError("not-found", "경로를 찾지 못했습니다.");
  }

  const lastWaypoint = mapJson.waypoints?.[mapJson.waypoints.length - 1];
  let snappedEnd: [number, number] | undefined;
  let endSnapDistanceMeters: number | undefined;
  if (
    lastWaypoint?.location &&
    Array.isArray(lastWaypoint.location) &&
    lastWaypoint.location.length === 2 &&
    typeof lastWaypoint.location[0] === "number" &&
    typeof lastWaypoint.location[1] === "number" &&
    Number.isFinite(lastWaypoint.location[0]) &&
    Number.isFinite(lastWaypoint.location[1])
  ) {
    snappedEnd = [lastWaypoint.location[0], lastWaypoint.location[1]];
    if (typeof lastWaypoint.distance === "number" && Number.isFinite(lastWaypoint.distance)) {
      endSnapDistanceMeters = lastWaypoint.distance;
    }
  }

  return {
    geometry: route.geometry as { type: "LineString"; coordinates: [number, number][] },
    distance: route.distance,
    duration: route.duration,
    snappedEnd,
    endSnapDistanceMeters,
  };
}

/**
 * 거리·방향 자동 Route — 사용자 행동 1회당 Token 1개·서버 transaction 1건.
 * 후보 Directions 호출은 서버 내부에서만 수행한다.
 */
export const getDistanceAutoRoute = onRequest(
  {
    region: REGION,
    secrets: [mapboxAccessToken],
    timeoutSeconds: 120,
    memory: "512MiB",
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

    // 공용 게이트 — verifyIdToken(token, true) + tombstone 차단(null 이면 이미 응답됨).
    const uid = await verifyUidForAdminHttp(res, tokenMatch[1]);
    if (!uid) return;

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

    if (isWarmRequest(rawBody)) {
      await respondWarm(res, uid);
      return;
    }

    try {
      const dataField = (rawBody as { data?: unknown } | null)?.data;
      const { start, targetRoadPoint, profile, targetDistanceMeters, bearingDeg, closeLoop, excludeStartBearingDeg, requestId, readyOneway } =
        parseDistanceAutoRouteBody(dataField);
      /*
       * users 메타 merge 실패는 삼키지 않는다(02-task-12 §1). 실패하면 자동 Route 후보·
       * 온보딩·토큰 소모·원장 생성 앞에서 outer catch 로 끊긴다.
       */
      await mergeUserAuthMeta(uid);
      await ensureRouteTokenOnboarding(uid);

      const fetchDirections: FetchDirectionsFn = (routeProfile, waypoints) =>
        fetchDirectionsRoute(
          routeProfile,
          waypoints[0]!,
          waypoints[waypoints.length - 1]!,
          waypoints.slice(1, -1),
        );

      const result = await executeDistanceAutoRoute({
        userId: uid,
        start,
        targetRoadPoint,
        profile,
        targetDistanceMeters,
        bearingDeg,
        closeLoop,
        readyOneway,
        excludeStartBearingDeg,
        requestId,
        fetchDirections,
      });

      res.status(200).json({ result });
    } catch (e: unknown) {
      if (e instanceof HttpsError) {
        res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
        return;
      }
      // guestLifecycle guard 차단은 403, 일시적 store 장애는 503 — 정상/500으로 삼키지 않는다.
      const blocked = guestLifecycleBlockedHttpsError(e);
      if (blocked) {
        console.warn("[route] tombstone 차단으로 요청을 종료한다", e);
        res.status(blocked.httpErrorCode.status).json({ error: blocked.toJSON() });
        return;
      }
      const transient = transientStoreHttpsError(e);
      if (transient) {
        console.warn("[route] 일시 장애 — 503 재시도 응답", e);
        res.status(transient.httpErrorCode.status).json({ error: transient.toJSON() });
        return;
      }
      // mergeUserAuthMeta 의 영구 Auth 오류(삭제경합 user-not-found 등)는 500 으로 줄이지 않는다.
      const authGone = permanentAuthHttpsError(e);
      if (authGone) {
        console.warn("[route] 계정이 Auth 에서 사라져 요청을 끊는다", e);
        res.status(authGone.httpErrorCode.status).json({ error: authGone.toJSON() });
        return;
      }
      console.error(e);
      const err = new HttpsError("internal", "서버 오류가 발생했습니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
    }
  },
);

export { adminPromoteSavedRoute };
export { getAdminDashboard } from "./adminDashboard.js";
export { getLeaderboard } from "./leaderboard.js";
export { autoReviewPublicRouteRequest };
export { routeActivityOnRideCreated } from "./routeActivityOnRideCreated.js";
export { routeActivityOnLivePublicationRideWritten } from "./routeActivityOnLivePublicationRideWritten.js";
export { routeActivityScheduledReconcile } from "./routeActivityScheduledReconcile.js";
export { routeActivityHeatReconcile } from "./routeActivityHeatReconcile.js";
export { routeTokenOnRideCreated } from "./routeTokenOnRideCreated.js";
export { conquestOnRideCreated } from "./conquestOnRideCreated.js";
export { mileageOnRideCreated } from "./mileageOnRideCreated.js";
export { ensureRouteTokenOnboardingHttp } from "./routeTokenEnsureOnboarding.js";
export { assertTierQuotaHttp } from "./tierQuotaHttp.js";
export {
  savedRoutesTierQuotaGuard,
  publicRouteRequestsTierQuotaGuard,
} from "./tierQuotaEnforcement.js";
export {
  getSubscriptionMeHttp,
  createSubscriptionCheckoutHttp,
  createSubscriptionPortalHttp,
} from "./subscriptionHttp.js";
export { stripeSubscriptionWebhookHttp } from "./stripeWebhookHttp.js";
export { deleteAccountHttp, resetGuestHttp } from "./accountDeletionHttp.js";
export { guestActivityHttp, guestLinkHttp } from "./guestLifecycleHttp.js";
export { guestLifecycleSweep } from "./guestLifecycleScheduled.js";
export { subscriptionExpireSweep } from "./subscriptionScheduled.js";
export { subscriptionDevApplyHttp } from "./subscriptionDevHttp.js";
export { backfillRoutePublicationsHttp } from "./backfillRoutePublications.js";
export { backfillRouteActivityLastCompletedRideAtHttp } from "./backfillRouteActivityLastCompletedRideAt.js";
export { trailInstanceLifecycle } from "./trailInstanceLifecycle.js";
export {
  openTrailListingOnTrailWritten,
  openTrailListingOnMemberCreated,
  openTrailListingOnMemberDeleted,
  openTrailListingOnLiveCourseRideCreated,
  openTrailListingOnLiveCourseRideDeleted,
} from "./openTrailListingProjection.js";
export { openTrailListingsSweep } from "./openTrailListingsSweep.js";
