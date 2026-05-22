import { getAuth } from "firebase-admin/auth";
import { HttpsError, onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { assertTierQuota, type TierQuotaAction } from "./tierQuotaCore.js";
import { mergeUserAuthMeta } from "./userTierCore.js";

const ACTIONS: TierQuotaAction[] = ["save_route", "public_route_request", "create_event"];

function parseAction(body: unknown): TierQuotaAction {
  const raw =
    typeof body === "object" && body !== null && "action" in body
      ? (body as { action?: unknown }).action
      : undefined;
  if (typeof raw !== "string" || !ACTIONS.includes(raw as TierQuotaAction)) {
    throw new HttpsError(
      "invalid-argument",
      `action 은 ${ACTIONS.join(" | ")} 중 하나여야 합니다.`,
    );
  }
  return raw as TierQuotaAction;
}

/**
 * tier quota 선검사 — 저장·공개 신청 전 클라이언트 호출.
 * POST + Bearer, 본문 `{ "action": "save_route" | "public_route_request" | "create_event" }`
 */
export const assertTierQuotaHttp = onRequest(
  {
    region: "asia-northeast3",
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
      const err = new HttpsError("unauthenticated", "로그인 후에 사용할 수 있습니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
      return;
    }

    let uid: string;
    try {
      const decoded = await getAuth().verifyIdToken(tokenMatch[1]);
      uid = decoded.uid;
    } catch {
      const err = new HttpsError("unauthenticated", "유효하지 않은 인증 토큰입니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
      return;
    }

    try {
      const action = parseAction(req.body);
      try {
        await mergeUserAuthMeta(uid);
      } catch {
        /* noop */
      }
      const result = await assertTierQuota(uid, action);
      res.status(200).json({ result });
    } catch (e: unknown) {
      if (e instanceof HttpsError) {
        res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
        return;
      }
      console.error(e);
      const err = new HttpsError("internal", "서버 오류가 발생했습니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
    }
  },
);
