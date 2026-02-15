import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAppUrlFromRequestHost } from "@/lib/config/env";
import { resolvePlan } from "@/lib/billing/plan-config";
import {
  createStripeCheckoutSession,
  createStripePortalSession,
  isStripeConfigured,
} from "@/lib/billing/stripe";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = applyRateLimit(request, {
      id: `billing-checkout-${session.user.id}`,
      limit: 15,
      windowMs: 60_000,
    });
    if (rateLimit.limited) {
      return rateLimit.response;
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Billing is not configured yet. Add Stripe keys to environment variables." },
        { status: 503 }
      );
    }

    let planId = "standard";
    try {
      const body = (await request.json()) as { plan?: string };
      planId = body.plan || "standard";
    } catch {
      // Keep default plan for empty body.
    }

    const plan = resolvePlan(planId);
    const appUrl = getAppUrlFromRequestHost(
      request.headers.get("host"),
      request.headers.get("x-forwarded-proto")
    );

    const shop = await prisma.shop.findUnique({
      where: { id: session.user.id },
      include: { subscription: true },
    });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const hasSubscription = Boolean(
      shop.subscription?.stripeSubscriptionId &&
        shop.subscription?.status &&
        !["canceled", "incomplete_expired"].includes(shop.subscription.status)
    );

    if (hasSubscription && shop.stripeCustomerId) {
      const portal = await createStripePortalSession({
        customerId: shop.stripeCustomerId,
        returnUrl: `${appUrl}/dashboard`,
      });
      return NextResponse.json({ url: portal.url });
    }

    await prisma.subscription.updateMany({
      where: { shopId: shop.id },
      data: {
        plan: plan.id,
        monthlyVehicleLimit: plan.monthlyVehicleLimit,
        overagePrice: plan.overagePrice,
        pricePerMonth: plan.pricePerMonth,
        updatedAt: new Date(),
      },
    });

    const checkout = await createStripeCheckoutSession({
      shopId: shop.id,
      planId: plan.id,
      successUrl: `${appUrl}/dashboard?billing=success`,
      cancelUrl: `${appUrl}/dashboard?billing=canceled`,
    });

    if (!checkout.url) {
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Billing checkout error:", error);
    return NextResponse.json({ error: "Failed to initialize checkout session" }, { status: 500 });
  }
}
