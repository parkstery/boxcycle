import { HttpsError, onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { applySubscriptionState, type SubscriptionStatus } from "./subscriptionCore.js";

const STATUSES: SubscriptionStatus[] = ["none", "active", "past_due", "canceled"];

/**
 * 에뮬레이터 전용 — Stripe 없이 tier·subscription 시뮬레이션.
 * POST `{ uid, status, expiresAtIso? }` (uid 는 테스트 대상)
 */
export const subscriptionDevApplyHttp = onRequest(
  {
    region: "asia-northeast3",
    cors: true,
    invoker: "public",
  },
  async (req: Request, res: Response) => {
    if (process.env.FUNCTIONS_EMULATOR !== "true") {
      res.status(404).send("Not Found");
      return;
    }
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      res.status(405).send("Method Not Allowed");
      return;
    }
    try {
      const body = req.body as Record<string, unknown>;
      const uid = typeof body.uid === "string" ? body.uid.trim() : "";
      const status = body.status;
      if (!uid) {
        throw new HttpsError("invalid-argument", "uid 가 필요합니다.");
      }
      if (typeof status !== "string" || !STATUSES.includes(status as SubscriptionStatus)) {
        throw new HttpsError("invalid-argument", `status 는 ${STATUSES.join(" | ")} 입니다.`);
      }
      let expiresAt: Date | null = null;
      if (typeof body.expiresAtIso === "string" && body.expiresAtIso.trim()) {
        expiresAt = new Date(body.expiresAtIso.trim());
        if (Number.isNaN(expiresAt.getTime())) {
          throw new HttpsError("invalid-argument", "expiresAtIso 형식이 올바르지 않습니다.");
        }
      } else if (status === "active" || status === "past_due") {
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
      const result = await applySubscriptionState(uid, {
        status: status as SubscriptionStatus,
        expiresAt,
        stripeCustomerId: "dev_customer",
        stripeSubscriptionId: status === "active" ? "dev_sub" : null,
      });
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
