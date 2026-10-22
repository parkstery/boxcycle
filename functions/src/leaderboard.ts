import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { parseBearerToken } from "./adminDashboard.js";
import {
  LEADERBOARD_BOARDS,
  LEADERBOARD_PERIODS,
  getBoardSnapshot,
  layoutLeaderboard,
  loadLiveTrails,
  loadNicknames,
  renderLeaderboard,
  type LeaderboardBoard,
  type LeaderboardPeriod,
} from "./leaderboardCore.js";
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
    const snapshot = await getBoardSnapshot(db, board, period, nowMs, (msg, err) =>
      logger.warn(msg, { error: String(err) }),
    );
    const layout = layoutLeaderboard(snapshot, requester);
    const [nicknames, liveByUid] = await Promise.all([
      loadNicknames(db, layout.displayUids),
      loadLiveTrails(db, nowMs),
    ]);

    res.set("Cache-Control", "no-store");
    res.status(200).json(renderLeaderboard(layout, { nicknames, liveByUid }));
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
 * 호출: GET `?board=distance|pioneer&period=week|month|all`, `Authorization: Bearer <ID 토큰>`(게스트 포함).
 * 응답에 uid 를 싣지 않는다. 전체 순위는 `leaderboardCache/{board}_{period}` 에 5분 캐시(클라이언트 접근 불가).
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
