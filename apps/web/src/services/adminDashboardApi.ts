import type { User } from "firebase/auth";
import { functionsHttpUrl } from "../lib/firebase/functionsEmulatorUrl";

/** 계정 묶음(전체·게스트·Google) 하나의 지표 — 비율은 분모 0 이면 null. */
export type AdminMetricsBlock = {
  accounts: number;
  accountsWithValidRide: number;
  firstRideCompletionRatePct: number | null;
  secondRideWithin72hRatePct: number | null;
  otherDayReuseRatePct: number | null;
  /** 0~1 비율(화면에서 % 로 바꾼다) */
  newRoadClaimRatio: number | null;
  validRides: number;
  totalDistanceKm: number;
};

export type AdminRecentBlock = { signups: number; rides: number; distanceKm: number };

/** `getAdminDashboard` 200 응답 — 계약: document/ops/20261023-admin-dashboard/01-plan.md */
export type AdminDashboardResponse = {
  generatedAt: string;
  excludedAccounts: number;
  rule: { minRideDistanceMeters: number; minRideDurationSec: number };
  metrics: { all: AdminMetricsBlock; guest: AdminMetricsBlock; provider: AdminMetricsBlock };
  recent: { today: AdminRecentBlock; last7Days: AdminRecentBlock };
  health: { pendingPublicRouteRequests: number };
};

function isDashboardShape(v: unknown): v is AdminDashboardResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const metrics = o.metrics as Record<string, unknown> | undefined;
  const recent = o.recent as Record<string, unknown> | undefined;
  return Boolean(
    typeof o.generatedAt === "string" &&
      o.rule &&
      o.health &&
      metrics?.all &&
      metrics.guest &&
      metrics.provider &&
      recent?.today &&
      recent.last7Days,
  );
}

/** 현재 사용자 ID 토큰으로 관리자 지표를 읽는다. 실패는 한국어 문구의 Error. */
export async function fetchAdminDashboard(user: User): Promise<AdminDashboardResponse> {
  let res: Response;
  try {
    const idToken = await user.getIdToken();
    res = await fetch(functionsHttpUrl("getAdminDashboard"), {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch {
    throw new Error("네트워크 오류 — 연결을 확인하고 다시 시도하세요.");
  }
  if (res.status === 401) throw new Error("로그인 확인에 실패했습니다. 다시 로그인하세요.");
  if (res.status === 403) throw new Error("관리자 권한이 없습니다.");
  if (!res.ok) throw new Error(`지표를 불러오지 못했습니다 (${res.status}).`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("지표 응답을 읽을 수 없습니다.");
  }
  if (!isDashboardShape(json)) throw new Error("지표 응답 형식이 올바르지 않습니다.");
  return json;
}
