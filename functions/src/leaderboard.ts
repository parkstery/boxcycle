import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { parseBearerToken } from "./adminDashboard.js";
import {
  LEADERBOARD_BOARDS,
  LEADERBOARD_PERIODS,
  LEADERBOARD_SCOPE_TYPES,
  type LeaderboardScopeType,
  loadLiveTrailsMemo,
  loadNicknames,
  renderLeaderboard,
  type LeaderboardBoard,
  type LeaderboardPeriod,
} from "./leaderboardCore.js";
import { loadLeaderboardLayoutFromScores } from "./leaderboardScoresStore.js";
import { homeScoreScopes, WORLD_SCOPE, type ScoreScope } from "./leaderboardScoresCore.js";
import { continentOfCountry } from "./geoRegion/geoRegionData.js";
import { REGION } from "./region.js";

/** 로그인(게스트 포함) Bearer ID 토큰 검증. 게스트 여부는 토큰의 sign_in_provider 로 판정한다. */
async function assertBearerSignedIn(req: Request): Promise<{ uid: string; isAnonymous: boolean }> {
  const token = parseBearerToken(req.get("Authorization"));
  if (!token) throw new HttpsError("unauthenticated", "Authorization: Bearer 가 필요합니다.");
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, isAnonymous: decoded.firebase?.sign_in_provider === "anonymous" };
  } catch {
    throw new HttpsError("unauthenticated", "유효하지 않은 인증 토큰입니다.");
  }
}

function parseQuery(req: Request): { board: LeaderboardBoard; period: LeaderboardPeriod } {
  const board = String(req.query.board ?? "");
  const period = String(req.query.period ?? "");
  if (!(LEADERBOARD_BOARDS as readonly string[]).includes(board)) {
    throw new HttpsError("invalid-argument", "board 는 distance 또는 pioneer 여야 합니다.");
  }
  if (!(LEADERBOARD_PERIODS as readonly string[]).includes(period)) {
    throw new HttpsError("invalid-argument", "period 는 week, month, all 중 하나여야 합니다.");
  }
  return { board: board as LeaderboardBoard, period: period as LeaderboardPeriod };
}

const CONTINENT_CODES = new Set(["AS", "EU", "AF", "NA", "SA", "OC", "AN"]);

/**
 * 범위(G3-2) — `scopeType=world|continent|country`, `scopeCode` 는 생략하면 요청자의 대표 국가로 정한다.
 * 범위를 보내지 않으면 전세계(옛 앱 호환). 대표 국가가 없는데 생략하면 400.
 */
export async function resolveRequestScope(
  rawType: unknown,
  rawCode: unknown,
  loadHomeCountry: () => Promise<string | null>,
): Promise<{ scopeType: LeaderboardScopeType; scope: ScoreScope }> {
  const type = rawType == null || rawType === "" ? "world" : String(rawType);
  if (!(LEADERBOARD_SCOPE_TYPES as readonly string[]).includes(type)) {
    throw new HttpsError("invalid-argument", "scopeType 은 world, continent, country 중 하나여야 합니다.");
  }
  const scopeType = type as LeaderboardScopeType;
  if (scopeType === "world") return { scopeType, scope: WORLD_SCOPE };
  let code = rawCode == null || rawCode === "" ? null : String(rawCode).toUpperCase();
  if (code == null) {
    const own = homeScoreScopes(await loadHomeCountry(), continentOfCountry).find((s) => s.scopeType === scopeType);
    code = own?.scopeCode ?? null;
    if (code == null) throw new HttpsError("invalid-argument", "대표 국가를 정하지 않았습니다.");
  }
  const valid = scopeType === "continent" ? CONTINENT_CODES.has(code) : /^[A-Z]{2}$/.test(code);
  if (!valid) throw new HttpsError("invalid-argument", "scopeCode 형식이 올바르지 않습니다.");
  return { scopeType, scope: { scopeType, scopeCode: code } };
}

async function handleGetLeaderboard(req: Request, res: Response): Promise<void> {
  if (req.method !== "GET") {
    res.set("Allow", "GET");
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const requester = await assertBearerSignedIn(req);
    const { board, period } = parseQuery(req);

    const db = getFirestore();
    const nowMs = Date.now();
    const { scopeType, scope } = await resolveRequestScope(req.query.scopeType, req.query.scopeCode, async () => {
      const hc = (await db.doc(`users/${requester.uid}`).get()).get("homeCountry");
      return typeof hc === "string" ? hc : null;
    });
    const layout = await loadLeaderboardLayoutFromScores(db, { board, period, requester, nowMs, scope });
    const [nicknames, liveByUid] = await Promise.all([
      loadNicknames(db, layout.displayUids),
      loadLiveTrailsMemo(db, nowMs),
    ]);

    res.set("Cache-Control", "no-store");
    res.status(200).json(renderLeaderboard(layout, { nicknames, liveByUid }, { scopeType, scopeCode: scope.scopeCode }));
  } catch (e: unknown) {
    if (e instanceof HttpsError) {
      res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
      return;
    }
    console.error(e);
    const err = new HttpsError("internal", "서버 오류가 발생했습니다.");
    res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
  }
}

/**
 * 리더보드(주행 거리·개척) — 읽기 전용. 계약은 document/ops/20261023-leaderboard/01-plan.md.
 * 호출: GET `?board=distance|pioneer&period=week|month|all[&scopeType=world|continent|country[&scopeCode=KR]]`,
 * `Authorization: Bearer <ID 토큰>`(게스트 포함). 범위 생략 = 전세계.
 * 응답에 uid 를 싣지 않는다. 순위는 주행 종료 때 쌓는 누적 점수(`leaderboardScores`, leaderboardScoresStore.ts)에서 상위 N·내 순위만 읽는다 — rides 전체 훑기는 없다(G3-1).
 * 접근 로그는 남기지 않는다(일반 사용자 기능).
 */
export const getLeaderboard = onRequest(
  {
    region: REGION,
    cors: true,
    invoker: "public",
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  handleGetLeaderboard,
);
