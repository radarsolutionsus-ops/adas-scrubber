import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAppUrlFromRequestHost } from "@/lib/config/env";
import { createStripePortalSession, ensureStripeCustomer, isStripeConfigured } from "@/lib/billing/stripe";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = applyRateLimit(request, {
      id: `billing-portal-${session.user.id}`,
      limit: 20,
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

    const shop = await prisma.shop.findUnique({ where: { id: session.user.id } });
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const customerId = shop.stripeCustomerId || (await ensureStripeCustomer(shop.id));
    const appUrl = getAppUrlFromRequestHost(
      request.headers.get("host"),
      request.headers.get("x-forwarded-proto")
    );

    const portal = await createStripePortalSession({
      customerId,
      returnUrl: `${appUrl}/dashboard`,
    });

    if (!portal.url) {
      return NextResponse.json({ error: "Failed to create billing portal session" }, { status: 500 });
    }

    return NextResponse.json({ url: portal.url });
  } catch (error) {
    console.error("Billing portal error:", error);
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}
