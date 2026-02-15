import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { optionalServerEnv, requireServerEnv } from "@/lib/config/env";
import { resolvePlan } from "@/lib/billing/plan-config";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

interface StripeCheckoutArgs {
  shopId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}

interface StripePortalArgs {
  customerId: string;
  returnUrl: string;
}

interface StripeCustomerArgs {
  shopId: string;
  email: string;
  name: string;
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer?: string;
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
        product?: string;
      };
    }>;
  };
  metadata?: Record<string, string>;
}

interface StripeCheckoutSession {
  id: string;
  url?: string;
  customer?: string;
  subscription?: string;
  metadata?: Record<string, string>;
}

export interface StripeWebhookEvent<T = unknown> {
  id: string;
  type: string;
  data: {
    object: T;
  };
}

function hasStripeSecret(): boolean {
  return Boolean(optionalServerEnv("STRIPE_SECRET_KEY"));
}

export function isStripeConfigured(): boolean {
  return hasStripeSecret();
}

function stripeSecretKey(): string {
  return requireServerEnv("STRIPE_SECRET_KEY");
}

function stripeWebhookSecret(): string {
  return requireServerEnv("STRIPE_WEBHOOK_SECRET");
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

async function stripeRequest<T>(
  path: string,
  options?: {
    method?: "GET" | "POST";
    body?: URLSearchParams;
  }
): Promise<T> {
  const method = options?.method || "POST";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeSecretKey()}`,
  };

  const init: RequestInit = {
    method,
    headers,
  };

  if (options?.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = options.body.toString();
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, init);
  const json = (await response.json()) as T & { error?: { message?: string } };

  if (!isSuccessStatus(response.status)) {
    const message = json?.error?.message || `Stripe request failed (${response.status})`;
    throw new Error(message);
  }

  return json;
}

function toDate(epochSeconds?: number): Date | null {
  if (!epochSeconds || !Number.isFinite(epochSeconds)) return null;
  return new Date(epochSeconds * 1000);
}

function subscriptionActive(status: string): boolean {
  const normalized = (status || "").toLowerCase();
  return ["active", "trialing", "past_due", "unpaid"].includes(normalized);
}

export function getPlanStripePriceId(planId: string): string {
  const plan = resolvePlan(planId);
  const value = optionalServerEnv(plan.stripePriceEnvVar);
  if (!value) {
    throw new Error(`Missing Stripe price id env var: ${plan.stripePriceEnvVar}`);
  }
  return value;
}

export async function createStripeCustomer(input: StripeCustomerArgs): Promise<string> {
  const body = new URLSearchParams();
  body.set("email", input.email);
  body.set("name", input.name);
  body.set("metadata[shopId]", input.shopId);

  const created = await stripeRequest<{ id: string }>("/customers", {
    method: "POST",
    body,
  });

  return created.id;
}

export async function ensureStripeCustomer(shopId: string): Promise<string> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    throw new Error("Shop not found");
  }

  if (shop.stripeCustomerId) {
    return shop.stripeCustomerId;
  }

  const customerId = await createStripeCustomer({
    shopId: shop.id,
    email: shop.email,
    name: shop.name,
  });

  await prisma.shop.update({
    where: { id: shop.id },
    data: { stripeCustomerId: customerId },
  });

  return customerId;
}

export async function createStripeCheckoutSession(args: StripeCheckoutArgs): Promise<StripeCheckoutSession> {
  const customerId = await ensureStripeCustomer(args.shopId);
  const plan = resolvePlan(args.planId);
  const priceId = getPlanStripePriceId(plan.id);

  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("customer", customerId);
  body.set("success_url", args.successUrl);
  body.set("cancel_url", args.cancelUrl);
  body.set("allow_promotion_codes", "true");
  body.set("line_items[0][price]", priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[shopId]", args.shopId);
  body.set("metadata[plan]", plan.id);
  body.set("subscription_data[metadata][shopId]", args.shopId);
  body.set("subscription_data[metadata][plan]", plan.id);

  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    method: "POST",
    body,
  });
}

export async function createStripePortalSession(args: StripePortalArgs): Promise<{ id: string; url?: string }> {
  const body = new URLSearchParams();
  body.set("customer", args.customerId);
  body.set("return_url", args.returnUrl);

  return stripeRequest<{ id: string; url?: string }>("/billing_portal/sessions", {
    method: "POST",
    body,
  });
}

export async function getStripeSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(
    `/subscriptions/${subscriptionId}?expand[]=items.data.price.product`,
    { method: "GET" }
  );
}

function timingSafeEqualHex(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(provided, "hex");
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function parseStripeSignatureHeader(signatureHeader: string): { timestamp: string; signatures: string[] } {
  const pieces = signatureHeader.split(",").map((part) => part.trim());
  let timestamp = "";
  const signatures: string[] = [];

  for (const part of pieces) {
    const [key, value] = part.split("=");
    if (!key || !value) continue;
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }

  return { timestamp, signatures };
}

export function verifyStripeWebhook(rawBody: string, signatureHeader: string | null): StripeWebhookEvent {
  if (!signatureHeader) {
    throw new Error("Missing Stripe-Signature header");
  }

  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);
  if (!timestamp || signatures.length === 0) {
    throw new Error("Malformed Stripe-Signature header");
  }

  const maxToleranceSeconds = 5 * 60;
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > maxToleranceSeconds) {
    throw new Error("Stripe webhook timestamp outside tolerance");
  }

  const payload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", stripeWebhookSecret())
    .update(payload, "utf8")
    .digest("hex");

  const matches = signatures.some((sig) => timingSafeEqualHex(expectedSignature, sig));
  if (!matches) {
    throw new Error("Invalid Stripe webhook signature");
  }

  return JSON.parse(rawBody) as StripeWebhookEvent;
}

export async function applyStripeSubscriptionUpdate(
  subscription: StripeSubscription,
  opts?: { shopIdHint?: string; planHint?: string }
): Promise<void> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : undefined;

  let shopId = opts?.shopIdHint;
  if (!shopId && customerId) {
    const shop = await prisma.shop.findFirst({ where: { stripeCustomerId: customerId } });
    shopId = shop?.id;
  }

  if (!shopId) {
    return;
  }

  const currentPlan = resolvePlan(opts?.planHint || subscription.metadata?.plan || "standard");
  const firstPrice = subscription.items?.data?.[0]?.price;
  const periodStart = toDate(subscription.current_period_start);

  await prisma.subscription.upsert({
    where: { shopId },
    update: {
      plan: currentPlan.id,
      status: subscription.status || "inactive",
      active: subscriptionActive(subscription.status || "inactive"),
      stripeSubscriptionId: subscription.id,
      stripePriceId: firstPrice?.id || null,
      stripeProductId: typeof firstPrice?.product === "string" ? firstPrice.product : null,
      billingCycleStart: periodStart || new Date(),
      currentPeriodStart: periodStart,
      currentPeriodEnd: toDate(subscription.current_period_end),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      monthlyVehicleLimit: currentPlan.monthlyVehicleLimit,
      overagePrice: currentPlan.overagePrice,
      pricePerMonth: currentPlan.pricePerMonth,
    },
    create: {
      shopId,
      plan: currentPlan.id,
      status: subscription.status || "inactive",
      active: subscriptionActive(subscription.status || "inactive"),
      stripeSubscriptionId: subscription.id,
      stripePriceId: firstPrice?.id || null,
      stripeProductId: typeof firstPrice?.product === "string" ? firstPrice.product : null,
      billingCycleStart: periodStart || new Date(),
      currentPeriodStart: periodStart,
      currentPeriodEnd: toDate(subscription.current_period_end),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      monthlyVehicleLimit: currentPlan.monthlyVehicleLimit,
      overagePrice: currentPlan.overagePrice,
      pricePerMonth: currentPlan.pricePerMonth,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function markSubscriptionCanceled(customerId?: string): Promise<void> {
  if (!customerId) return;

  const shop = await prisma.shop.findFirst({ where: { stripeCustomerId: customerId } });
  if (!shop) return;

  await prisma.subscription.updateMany({
    where: { shopId: shop.id },
    data: {
      active: false,
      status: "canceled",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(),
    },
  });
}
