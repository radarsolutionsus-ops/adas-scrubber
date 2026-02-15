import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  applyStripeSubscriptionUpdate,
  getStripeSubscription,
  markSubscriptionCanceled,
  type StripeSubscription,
  verifyStripeWebhook,
} from "@/lib/billing/stripe";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = Reflect.get(error, "code");
  return code === "P2002";
}

export async function POST(request: NextRequest) {
  const rateLimit = applyRateLimit(request, {
    id: "billing-webhook",
    limit: 240,
    windowMs: 60_000,
  });
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  const rawBody = await request.text();

  let event;
  try {
    event = verifyStripeWebhook(rawBody, request.headers.get("stripe-signature"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const payloadHash = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
    try {
      await prisma.webhookEvent.create({
        data: {
          id: event.id,
          source: "stripe",
          eventType: event.type,
          payloadHash,
          processedAt: new Date(),
          createdAt: new Date(),
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw error;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const object = event.data.object as {
          customer?: string;
          subscription?: string;
          metadata?: Record<string, string>;
        };

        const subscriptionId = asString(object.subscription);
        if (subscriptionId) {
          const subscription = await getStripeSubscription(subscriptionId);
          await applyStripeSubscriptionUpdate(subscription, {
            shopIdHint: asString(object.metadata?.shopId),
            planHint: asString(object.metadata?.plan),
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as StripeSubscription;
        await applyStripeSubscriptionUpdate(subscription, {
          shopIdHint: asString(subscription.metadata?.shopId),
          planHint: asString(subscription.metadata?.plan),
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as { customer?: string };
        await markSubscriptionCanceled(asString(subscription.customer));
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handling error:", error);
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
