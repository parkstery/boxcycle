import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { ensureRouteTokenOnboarding } from "./routeTokenCore.js";

/**
 * 로그인 직후 클라이언트가 1회 호출 — 온보딩 토큰 지급·잔액 표시.
 * POST + Bearer ID token, 응답 `{ result: { routeTokenBalance } }`.
 */
export const ensureRouteTokenOnboardingHttp = onRequest(
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
      try {
        const userRecord = await getAuth().getUser(uid);
        const isAnonymous = userRecord.providerData.length === 0;
        await getFirestore()
          .doc(`users/${uid}`)
          .set(
            {
              isAnonymous,
              ...(isAnonymous ? { tier: "anonymous" } : {}),
            },
            { merge: true },
          );
      } catch {
        /* noop */
      }
      const routeTokenBalance = await ensureRouteTokenOnboarding(uid);
      res.status(200).json({ result: { routeTokenBalance } });
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
