import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import Stripe from "stripe";
import {
  deleteAccountData,
  isDeletionConfirmPhrase,
  isRecentSignIn,
} from "./accountDeletionCore.js";
import { REGION } from "./region.js";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

function sendError(res: Response, err: HttpsError): void {
  res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
}

/** 활성 구독이 있으면 즉시 해지. 키가 없는 환경(에뮬레이터)·이미 해지된 구독은 건너뛴다. */
async function cancelStripeSubscription(subscriptionId: unknown): Promise<"canceled" | "skipped"> {
  if (typeof subscriptionId !== "string" || !subscriptionId) return "skipped";
  let secret: string;
  try {
    secret = stripeSecretKey.value();
  } catch {
    secret = "";
  }
  if (!secret) {
    console.warn("[deleteAccount] STRIPE_SECRET_KEY 없음 — 구독 해지 건너뜀", { subscriptionId });
    return "skipped";
  }
  const stripe = new Stripe(secret);
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return "canceled";
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "resource_missing") return "skipped";
    throw e;
  }
}

/**
 * 계정 탈퇴 — POST + Bearer, 본문 `{ "confirmPhrase": "탈퇴" }`.
 * 계획·결정: document/ops/20261006-account-deletion/01-plan.md
 *
 * 조건: Google 등 정식 계정(게스트 아님) · 최근 5분 내 로그인(앱이 재인증 후 호출) · 확인 문구 「탈퇴」.
 * 처리: Stripe 구독 해지 → 데이터 삭제·익명화(accountDeletionCore) → Auth 계정 삭제.
 */
export const deleteAccountHttp = onRequest(
  {
    region: REGION,
    cors: true,
    invoker: "public",
    secrets: [stripeSecretKey],
    timeoutSeconds: 300,
  },
  async (req: Request, res: Response) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      res.status(405).send("Method Not Allowed");
      return;
    }

    const tokenMatch = (req.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      sendError(res, new HttpsError("unauthenticated", "로그인 후에 사용할 수 있습니다."));
      return;
    }

    let uid: string;
    let authTime: number | undefined;
    let signInProvider: string | undefined;
    try {
      const decoded = await getAuth().verifyIdToken(tokenMatch[1], true);
      uid = decoded.uid;
      authTime = decoded.auth_time;
      signInProvider = decoded.firebase?.sign_in_provider;
    } catch {
      sendError(res, new HttpsError("unauthenticated", "유효하지 않은 인증 토큰입니다."));
      return;
    }

    if (signInProvider === "anonymous") {
      sendError(
        res,
        new HttpsError("failed-precondition", "게스트는 탈퇴 대신 「이 기기 데이터 지우기」를 사용하세요."),
      );
      return;
    }
    if (!isRecentSignIn(authTime, Date.now())) {
      sendError(
        res,
        new HttpsError("failed-precondition", "보안을 위해 다시 로그인한 뒤 탈퇴할 수 있습니다.", {
          reason: "requires-recent-login",
        }),
      );
      return;
    }

    const db = getFirestore();
    try {
      const typed =
        typeof req.body === "object" && req.body !== null
          ? (req.body as { confirmPhrase?: unknown }).confirmPhrase
          : undefined;
      if (!isDeletionConfirmPhrase(typed)) {
        sendError(res, new HttpsError("invalid-argument", "확인 문구 「탈퇴」를 정확히 입력하세요."));
        return;
      }
      const userSnap = await db.doc(`users/${uid}`).get();

      const logRef = db.doc(`accountDeletions/${uid}`);
      await logRef.set({ status: "started", startedAt: FieldValue.serverTimestamp() }, { merge: true });

      const stripe = await cancelStripeSubscription(userSnap.get("stripeSubscriptionId"));

      let rtdb = null;
      try {
        rtdb = getDatabase();
      } catch {
        rtdb = null;
      }
      const report = await deleteAccountData(db, rtdb, uid);

      await getAuth().deleteUser(uid);
      await logRef.set({ status: "done", doneAt: FieldValue.serverTimestamp() }, { merge: true });

      console.info("[deleteAccount] done", { ...report, stripe });
      res.status(200).json({ result: { ok: true } });
    } catch (e: unknown) {
      if (e instanceof HttpsError) {
        sendError(res, e);
        return;
      }
      console.error("[deleteAccount] failed", { uid, e });
      sendError(res, new HttpsError("internal", "탈퇴 처리 중 오류가 발생했습니다. 다시 시도해 주세요."));
    }
  },
);
