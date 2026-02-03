import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "radarsolutions-secret-key-change-in-production"
);

export interface ShopSession {
  shopId: string;
  email: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createToken(shop: ShopSession): Promise<string> {
  return new SignJWT({ ...shop })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<ShopSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as ShopSession;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<ShopSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getShopUsage(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { subscription: true },
  });

  if (!shop || !shop.subscription) {
    return null;
  }

  // Get current billing cycle start
  const cycleStart = shop.subscription.billingCycleStart;
  const now = new Date();

  // Calculate this month's start based on billing cycle
  const cycleDay = cycleStart.getDate();
  let monthStart = new Date(now.getFullYear(), now.getMonth(), cycleDay);
  if (monthStart > now) {
    monthStart = new Date(now.getFullYear(), now.getMonth() - 1, cycleDay);
  }

  // Count usage this billing period
  const usageCount = await prisma.usageRecord.count({
    where: {
      shopId,
      createdAt: { gte: monthStart },
    },
  });

  const limit = shop.subscription.monthlyVehicleLimit;
  const remaining = Math.max(0, limit - usageCount);
  const overage = Math.max(0, usageCount - limit);

  return {
    used: usageCount,
    limit,
    remaining,
    overage,
    overageCharge: overage * shop.subscription.overagePrice,
    billingCycleStart: monthStart,
  };
}

export async function recordUsage(shopId: string, vehicleInfo: string, reportId?: string) {
  return prisma.usageRecord.create({
    data: {
      shopId,
      vehicleInfo,
      reportId,
    },
  });
}
