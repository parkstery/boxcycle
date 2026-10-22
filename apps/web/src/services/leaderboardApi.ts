import type { User } from "firebase/auth";
import { functionsHttpUrl } from "../lib/firebase/functionsEmulatorUrl";

export type LeaderboardBoard = "distance" | "pioneer";
export type LeaderboardPeriod = "week" | "month" | "all";
type LeaderboardScope = "world";

export type LeaderboardEntry = {
  rank: number;
  nickname: string;
  valueKm: number;
  uses: { riders: number; km: number } | null;
  liveTrailId: string | null;
  isMe: boolean;
};

type LeaderboardMeStatus = "ranked" | "unranked" | "guest";

type LeaderboardMe = {
  status: LeaderboardMeStatus;
  rank: number | null;
  valueKm: number;
  gapToNextKm: number | null;
  projectedRank: number | null;
  uses: { riders: number; km: number } | null;
  around: LeaderboardEntry[];
};

export type LeaderboardResponse = {
  generatedAt: string;
  board: LeaderboardBoard;
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
  periodStartKst: string;
  rule: { sensorOnly: boolean };
  top: LeaderboardEntry[];
  me: LeaderboardMe;
};

function isLeaderboardEntry(v: unknown): v is LeaderboardEntry {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.rank === "number" &&
    typeof o.nickname === "string" &&
    typeof o.valueKm === "number" &&
    (o.uses === null || (typeof o.uses === "object" && o.uses !== null && typeof (o.uses as Record<string, unknown>).riders === "number" && typeof (o.uses as Record<string, unknown>).km === "number")) &&
    (o.liveTrailId === null || typeof o.liveTrailId === "string") &&
    typeof o.isMe === "boolean"
  );
}

function isLeaderboardMe(v: unknown): v is LeaderboardMe {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (!["ranked", "unranked", "guest"].includes(o.status as string)) return false;
  if (o.rank !== null && typeof o.rank !== "number") return false;
  if (typeof o.valueKm !== "number") return false;
  if (o.gapToNextKm !== null && typeof o.gapToNextKm !== "number") return false;
  if (o.projectedRank !== null && typeof o.projectedRank !== "number") return false;
  if (o.uses !== null && (typeof o.uses !== "object" || o.uses === null || typeof (o.uses as Record<string, unknown>).riders !== "number" || typeof (o.uses as Record<string, unknown>).km !== "number")) return false;
  if (!Array.isArray(o.around)) return false;
  return o.around.every(isLeaderboardEntry);
}

function isLeaderboardResponse(v: unknown): v is LeaderboardResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const rule = o.rule as Record<string, unknown> | undefined;
  return (
    typeof o.generatedAt === "string" &&
    ["distance", "pioneer"].includes(o.board as string) &&
    ["week", "month", "all"].includes(o.period as string) &&
    o.scope === "world" &&
    typeof o.periodStartKst === "string" &&
    rule != null && typeof rule.sensorOnly === "boolean" &&
    Array.isArray(o.top) && o.top.every(isLeaderboardEntry) &&
    isLeaderboardMe(o.me)
  );
}

/** 현재 사용자 ID 토큰으로 리더보드를 읽는다. 실패는 한국어 문구의 Error. */
export async function fetchLeaderboard(
  user: User,
  board: LeaderboardBoard,
  period: LeaderboardPeriod,
): Promise<LeaderboardResponse> {
  let res: Response;
  try {
    const idToken = await user.getIdToken();
    const url = new URL(functionsHttpUrl("getLeaderboard"));
    url.searchParams.set("board", board);
    url.searchParams.set("period", period);
    res = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch {
    throw new Error("네트워크 오류 — 연결을 확인하고 다시 시도하세요.");
  }
  if (res.status === 401) throw new Error("로그인 확인에 실패했습니다. 다시 로그인하세요.");
  if (res.status === 403) throw new Error("리더보드를 볼 권한이 없습니다.");
  if (!res.ok) throw new Error(`리더보드를 불러오지 못했습니다 (${res.status}).`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("리더보드 응답을 읽을 수 없습니다.");
  }
  if (!isLeaderboardResponse(json)) throw new Error("리더보드 응답 형식이 올바르지 않습니다.");
  return json;
}