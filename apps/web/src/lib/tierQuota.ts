import type { User } from "firebase/auth";
import { functionsHttpUrl } from "./functionsEmulatorUrl";

export type TierQuotaAction = "save_route" | "public_route_request" | "create_event";

export type TierQuotaCheckResult = {
  allowed: boolean;
  tier: string;
  action: TierQuotaAction;
  usage: {
    saveRouteCreatedThisMonth: number;
    saveRouteActiveTotal: number;
    /** 현재 미완료(completed=0) Route 수 */
    saveRouteIncompleteTotal: number;
    publicRouteRequestToday: number;
    publicRouteRequestThisMonth: number;
    createEventThisMonth: number;
  };
  limits: {
    saveRoutePerMonth: number | null;
    saveRouteMaxActive: number | null;
    /** 미완료(completed=0) Route 동시 보유 상한. null=무제한 */
    saveRouteMaxIncomplete: number | null;
    publicRouteRequestPerDay: number | null;
    publicRouteRequestPerMonth: number | null;
    createEventPerMonth: number | null;
  };
};

/** quota 초과 사유 — 서버 HttpsError.details.reason 과 1:1. UI 유도 분기용. */
export type TierQuotaReason =
  | "save_route_incomplete_over"
  | "save_route_active_over"
  | "save_route_monthly_over"
  | "unknown";

/**
 * tier quota 초과로 서버가 거부했을 때 던지는 에러.
 * `code` 규약은 SavedRouteDuplicateError 와 동일하게 진입점 catch 에서 분기하는 데 쓴다.
 */
export class TierQuotaExceededError extends Error {
  readonly code = "tier-quota-exceeded" as const;
  readonly reason: TierQuotaReason;
  constructor(message: string, reason: TierQuotaReason = "unknown") {
    super(message);
    this.name = "TierQuotaExceededError";
    this.reason = reason;
  }
}

/** 미완료(진행 중) 경로 슬롯이 가득 차 저장이 막힌 경우인지. UI 는 이때 「내 경로」 대기 탭으로 유도한다. */
export function isIncompleteQuotaError(e: unknown): e is TierQuotaExceededError {
  return e instanceof TierQuotaExceededError && e.reason === "save_route_incomplete_over";
}

function parseErrorMessage(json: unknown, fallback: string): string {
  if (typeof json === "object" && json !== null && "error" in json) {
    const err = (json as { error?: { message?: string } }).error;
    if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
  }
  return fallback;
}

/**
 * 서버 응답에서 초과 사유를 뽑는다. HttpsError.toJSON() 의 `details.reason` 을 우선 사용하고,
 * 서버가 아직 details 를 안 싣는 환경(구버전 배포)에서는 메시지 문자열로 폴백한다.
 */
function parseQuotaReason(json: unknown, message: string): TierQuotaReason {
  const details =
    typeof json === "object" && json !== null && "error" in json
      ? (json as { error?: { details?: unknown } }).error?.details
      : undefined;
  const raw =
    details && typeof details === "object" && "reason" in details
      ? (details as { reason?: unknown }).reason
      : undefined;
  if (
    raw === "save_route_incomplete_over" ||
    raw === "save_route_active_over" ||
    raw === "save_route_monthly_over"
  ) {
    return raw;
  }
  if (message.includes("진행 중인(미완주)")) return "save_route_incomplete_over";
  return "unknown";
}

/** 저장·공개 신청 전 서버 quota 검증 */
export async function assertTierQuotaClient(
  user: User,
  action: TierQuotaAction,
): Promise<TierQuotaCheckResult> {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error("Firebase 프로젝트가 설정되지 않았습니다.");
  }

  const url = functionsHttpUrl("assertTierQuotaHttp");
  const idToken = await user.getIdToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action }),
  });

  let json: { result?: TierQuotaCheckResult; error?: { message?: string } };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new Error("quota 검증 응답을 읽을 수 없습니다.");
  }

  if (!res.ok || json.error) {
    const message = parseErrorMessage(json, "quota 한도에 도달했습니다.");
    throw new TierQuotaExceededError(message, parseQuotaReason(json, message));
  }
  if (!json.result?.allowed) {
    throw new TierQuotaExceededError("quota 한도에 도달했습니다.");
  }
  return json.result;
}
