import { defineSecret } from "firebase-functions/params";
import { onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import Stripe from "stripe";
import {
  applySubscriptionState,
  mapStripeSubscriptionStatus,
  markWebhookEventProcessed,
} from "./subscriptionCore.js";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

function resolveUidFromMetadata(meta: Stripe.Metadata | null | undefined): string | null {
  const uid = meta?.firebaseUid;
  return typeof uid === "string" && uid.trim() ? uid.trim() : null;
}

async function applyFromStripeSubscription(sub: Stripe.Subscription): Promise<void> {
  const uid = resolveUidFromMetadata(sub.metadata);
  if (!uid) return;

  const status = mapStripeSubscriptionStatus(sub.status);
  const expiresAt = new Date(sub.current_period_end * 1000);
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

  await applySubscriptionState(uid, {
    status,
    expiresAt: status === "active" || status === "past_due" ? expiresAt : null,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
  });
}

/**
 * Stripe Webhook — raw body 서명 검증 후 tier 갱신
 */
export const stripeSubscriptionWebhookHttp = onRequest(
  {
    region: "asia-northeast3",
    cors: false,
    invoker: "public",
    secrets: [stripeSecretKey, stripeWebhookSecret],
  },
  async (req: Request, res: Response) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const secret = stripeSecretKey.value()?.trim();
    const whSecret = stripeWebhookSecret.value()?.trim();
    if (!secret || !whSecret) {
      res.status(503).send("Stripe not configured");
      return;
    }

    const sig = req.get("stripe-signature");
    if (!sig) {
      res.status(400).send("Missing stripe-signature");
      return;
    }

    const stripe = new Stripe(secret);
    let event: Stripe.Event;
    try {
      const raw = (req as Request & { rawBody?: Buffer }).rawBody;
      if (!raw) {
        res.status(400).send("Missing raw body");
        return;
      }
      event = stripe.webhooks.constructEvent(raw, sig, whSecret);
    } catch (err) {
      console.warn("[stripeWebhook] signature failed", err);
      res.status(400).send("Webhook signature verification failed");
      return;
    }

    if (await markWebhookEventProcessed(event.id)) {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode !== "subscription") break;
          const uid =
            resolveUidFromMetadata(session.metadata) ??
            (typeof session.client_reference_id === "string"
              ? session.client_reference_id
              : null);
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;
          if (uid && subId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            await applyFromStripeSubscription(sub);
          }
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          await applyFromStripeSubscription(sub);
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const subId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription?.id;
          if (!subId) break;
          const sub = await stripe.subscriptions.retrieve(subId);
          const uid = resolveUidFromMetadata(sub.metadata);
          if (!uid) break;
          const expiresAt = new Date(sub.current_period_end * 1000);
          await applySubscriptionState(uid, {
            status: "past_due",
            expiresAt,
            stripeCustomerId:
              typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
            stripeSubscriptionId: sub.id,
          });
          break;
        }
        default:
          break;
      }
      res.status(200).json({ received: true });
    } catch (e) {
      console.error("[stripeWebhook] handler error", e);
      res.status(500).send("Webhook handler failed");
    }
  },
);
