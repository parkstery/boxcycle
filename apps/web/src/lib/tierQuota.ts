import type { User } from "firebase/auth";

export type TierQuotaAction = "save_route" | "public_route_request" | "create_event";

export type TierQuotaCheckResult = {
  allowed: boolean;
  tier: string;
  action: TierQuotaAction;
  usage: {
    saveRouteCreatedThisMonth: number;
    saveRouteActiveTotal: number;
    publicRouteRequestToday: number;
    publicRouteRequestThisMonth: number;
    createEventThisMonth: number;
  };
  limits: {
    saveRoutePerMonth: number | null;
    saveRouteMaxActive: number | null;
    publicRouteRequestPerDay: number | null;
    publicRouteRequestPerMonth: number | null;
    createEventPerMonth: number | null;
  };
};

function parseErrorMessage(json: unknown, fallback: string): string {
  if (typeof json === "object" && json !== null && "error" in json) {
    const err = (json as { error?: { message?: string } }).error;
    if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
  }
  return fallback;
}

/** 저장·공개 신청 전 서버 quota 검증 */
export async function assertTierQuotaClient(
  user: User,
  action: TierQuotaAction,
): Promise<TierQuotaCheckResult> {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const region = import.meta.env.VITE_FUNCTIONS_REGION?.trim() || "asia-northeast3";
  if (!projectId) {
    throw new Error("Firebase 프로젝트가 설정되지 않았습니다.");
  }

  const url = `https://${region}-${projectId}.cloudfunctions.net/assertTierQuotaHttp`;
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
    throw new Error(parseErrorMessage(json, "quota 한도에 도달했습니다."));
  }
  if (!json.result?.allowed) {
    throw new Error("quota 한도에 도달했습니다.");
  }
  return json.result;
}
