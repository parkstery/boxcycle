import type { User } from "firebase/auth";
import type { Functions } from "firebase/functions";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { assertDirectionsServerOnly } from "../lib/directionsDirectGuard";
import {
  getRouteTokenInsufficient,
  reportRouteTokenSpend,
} from "../lib/routeTokenSpendBridge";
import { ROUTE_TOKEN_INSUFFICIENT_HINT } from "../lib/routeTokenUiCopy";
import { formatDistanceAutoRouteClientError } from "../lib/distanceAutoRouteErrors";
import { functionsHttpUrl } from "../lib/firebase/functionsEmulatorUrl";
import type { RouteProfile } from "./mapboxDirections";

export type RouteOutcome = "exact" | "detoured" | "offered" | "shortfall";

export type DistanceAutoRouteResponse =
  | {
      status: "found";
      geometry: LineStringGeometry;
      distance: number;
      duration: number;
      end: LngLat;
      targetDistanceMeters: number;
      summary: string;
      routeTokenBalance: number;
      endMissMeters?: number;
      algorithmVersion?: string;
      outcome?: RouteOutcome;
      directRoadMeters?: number;
      detourCalls?: number;
      /** Ready Ride(closeLoop) 요청 결과에서만 채워진다. */
      closeLoop?: boolean;
      /** closeLoop 요청의 실제 결과 — false 면 폐합 실패 후 편도 대안(지시03 §B2·§B3). */
      closed?: boolean;
      selfOverlapRatio?: number;
      startBearingSampleDeg?: number;
      startSnapMeters?: number;
    }
  | {
      status: "failed";
      message: string;
      routeTokenBalance: number;
    };

function wireStatusToFunctionsCode(status: string | undefined): string | undefined {
  if (!status) return undefined;
  const map: Record<string, string> = {
    UNAUTHENTICATED: "functions/unauthenticated",
    NOT_FOUND: "functions/not-found",
    INVALID_ARGUMENT: "functions/invalid-argument",
    INTERNAL: "functions/internal",
    FAILED_PRECONDITION: "functions/failed-precondition",
    UNAVAILABLE: "functions/unavailable",
    PERMISSION_DENIED: "functions/permission-denied",
    RESOURCE_EXHAUSTED: "functions/resource-exhausted",
  };
  return map[status] ?? "functions/internal";
}

let lastSpendFeedbackRequestId: string | null = null;

function maybeReportRouteTokenSpend(uid: string, balance: number, requestId: string): void {
  if (lastSpendFeedbackRequestId === requestId) return;
  lastSpendFeedbackRequestId = requestId;
  reportRouteTokenSpend(uid, balance, requestId);
}

export async function fetchDistanceAutoRoute(
  functions: Functions,
  user: User,
  input: {
    start: LngLat;
    /** Ready Ride(closeLoop) 요청은 클릭이 없어 생략한다. */
    targetRoadPoint?: LngLat;
    profile: RouteProfile;
    targetDistanceMeters: number;
    bearingDeg?: number;
    /** 방위 자동 표본 + 폐합(출발=도착) — 지시02 */
    closeLoop?: boolean;
    /** 「다른 경로」(지시03 §B3) — 직전에 쓴 시작 방위를 제외한다. closeLoop 요청에서만 의미 있다. */
    excludeStartBearingDeg?: number;
    requestId: string;
    signal?: AbortSignal;
  },
): Promise<DistanceAutoRouteResponse> {
  assertDirectionsServerOnly();
  void functions;
  if (!user?.uid) {
    throw new Error("경로 계산은 로그인(임시 라이더) 후에 사용할 수 있습니다.");
  }
  if (getRouteTokenInsufficient(user.uid)) {
    const err = new Error(ROUTE_TOKEN_INSUFFICIENT_HINT);
    (err as { code?: string }).code = "functions/resource-exhausted";
    throw err;
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error(
      "VITE_FIREBASE_PROJECT_ID 가 비어 있어 getDistanceAutoRoute URL 을 만들 수 없습니다. apps/web/.env 를 확인하세요.",
    );
  }
  const url = functionsHttpUrl("getDistanceAutoRoute");
  const idToken = await user.getIdToken();
  const { signal, ...body } = input;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ data: body }),
      signal,
    });
  } catch (error) {
    throw new Error(formatDistanceAutoRouteClientError(error), { cause: error });
  }
  let json: {
    result?: DistanceAutoRouteResponse;
    error?: { message?: string; status?: string };
  };
  try {
    json = (await res.json()) as {
      result?: DistanceAutoRouteResponse;
      error?: { message?: string; status?: string };
    };
  } catch {
    throw new Error(`자동 경로 응답을 해석할 수 없습니다. (HTTP ${res.status})`);
  }
  if (json.error) {
    const err = new Error(json.error.message ?? "자동 경로 탐색에 실패했습니다.");
    (err as { code?: string }).code = wireStatusToFunctionsCode(json.error.status);
    throw err;
  }
  if (!res.ok) {
    throw new Error(`자동 경로 요청이 거부되었습니다. (HTTP ${res.status})`);
  }
  const result = json.result;
  if (!result || (result.status !== "found" && result.status !== "failed")) {
    throw new Error("자동 경로 응답이 올바르지 않습니다.");
  }
  if (
    typeof result.routeTokenBalance !== "number" ||
    !Number.isFinite(result.routeTokenBalance)
  ) {
    throw new Error("자동 경로는 완료됐지만 Route Token 잔액 응답이 없습니다.");
  }
  if (result.status === "found") {
    maybeReportRouteTokenSpend(user.uid, result.routeTokenBalance, input.requestId);
  }
  return result;
}
