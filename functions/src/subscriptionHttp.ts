import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import Stripe from "stripe";
import {
  assertUserCanSubscribe,
  loadSubscriptionMe,
} from "./subscriptionCore.js";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripePriceId = defineSecret("STRIPE_PRICE_ID");

function stripeClient(secret: string): Stripe {
  return new Stripe(secret);
}

async function verifyBearerUid(req: Request): Promise<string> {
  const authHeader = req.get("Authorization") ?? "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    throw new HttpsError("unauthenticated", "로그인 후에 사용할 수 있습니다.");
  }
  try {
    const decoded = await getAuth().verifyIdToken(tokenMatch[1]);
    return decoded.uid;
  } catch {
    throw new HttpsError("unauthenticated", "유효하지 않은 인증 토큰입니다.");
  }
}

function parseUrl(raw: unknown, field: string): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new HttpsError("invalid-argument", `${field} 가 필요합니다.`);
  }
  const url = raw.trim();
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      throw new Error("bad protocol");
    }
    return url;
  } catch {
    throw new HttpsError("invalid-argument", `${field} URL 형식이 올바르지 않습니다.`);
  }
}

/**
 * 구독 상태 조회 — GET/POST + Bearer
 */
export const getSubscriptionMeHttp = onRequest(
  {
    region: "asia-northeast3",
    cors: true,
    invoker: "public",
  },
  async (req: Request, res: Response) => {
    if (req.method !== "GET" && req.method !== "POST") {
      res.set("Allow", "GET, POST");
      res.status(405).send("Method Not Allowed");
      return;
    }
    try {
      const uid = await verifyBearerUid(req);
      const result = await loadSubscriptionMe(uid);
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

/**
 * Stripe Checkout(구독) 세션 생성 — POST + Bearer
 * 본문 `{ successUrl, cancelUrl }`
 */
export const createSubscriptionCheckoutHttp = onRequest(
  {
    region: "asia-northeast3",
    cors: true,
    invoker: "public",
    secrets: [stripeSecretKey, stripePriceId],
  },
  async (req: Request, res: Response) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      res.status(405).send("Method Not Allowed");
      return;
    }
    try {
      const uid = await verifyBearerUid(req);
      const body = req.body as Record<string, unknown>;
      const successUrl = parseUrl(body.successUrl, "successUrl");
      const cancelUrl = parseUrl(body.cancelUrl, "cancelUrl");

      const secret = stripeSecretKey.value();
      const price = stripePriceId.value();
      if (!secret?.trim() || !price?.trim()) {
        throw new HttpsError(
          "failed-precondition",
          "결제가 아직 설정되지 않았습니다. STRIPE_SECRET_KEY·STRIPE_PRICE_ID 를 배포하세요.",
        );
      }

      const userDoc = await assertUserCanSubscribe(uid);
      const stripe = stripeClient(secret.trim());
      let customerId =
        typeof userDoc.stripeCustomerId === "string" ? userDoc.stripeCustomerId : null;

      if (!customerId) {
        const customer = await stripe.customers.create({
          metadata: { firebaseUid: uid },
        });
        customerId = customer.id;
        await getFirestore().doc(`users/${uid}`).set(
          { stripeCustomerId: customerId, updatedAt: new Date() },
          { merge: true },
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: uid,
        line_items: [{ price: price.trim(), quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { firebaseUid: uid },
        subscription_data: {
          metadata: { firebaseUid: uid },
        },
      });

      if (!session.url) {
        throw new HttpsError("internal", "Checkout URL 을 만들지 못했습니다.");
      }
      res.status(200).json({ result: { checkoutUrl: session.url } });
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

/**
 * Stripe Customer Portal — POST + Bearer, 본문 `{ returnUrl }`
 */
export const createSubscriptionPortalHttp = onRequest(
  {
    region: "asia-northeast3",
    cors: true,
    invoker: "public",
    secrets: [stripeSecretKey],
  },
  async (req: Request, res: Response) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      res.status(405).send("Method Not Allowed");
      return;
    }
    try {
      const uid = await verifyBearerUid(req);
      const returnUrl = parseUrl(
        (req.body as Record<string, unknown>)?.returnUrl,
        "returnUrl",
      );
      const secret = stripeSecretKey.value();
      if (!secret?.trim()) {
        throw new HttpsError("failed-precondition", "결제가 아직 설정되지 않았습니다.");
      }

      const me = await loadSubscriptionMe(uid);
      if (!me.stripeCustomerId) {
        throw new HttpsError("failed-precondition", "구독 고객 정보가 없습니다.");
      }

      const stripe = stripeClient(secret.trim());
      const portal = await stripe.billingPortal.sessions.create({
        customer: me.stripeCustomerId,
        return_url: returnUrl,
      });
      res.status(200).json({ result: { portalUrl: portal.url } });
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
