import { prisma } from "./prisma";
import { getUsageResetMode, getUsageWindowStart } from "./usage-window";

export async function getShopUsage(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { subscription: true },
  });

  if (!shop) {
    return null;
  }

  let subscription = shop.subscription;
  if (!subscription) {
    try {
      subscription = await prisma.subscription.create({
        data: {
          shopId: shop.id,
          plan: "standard",
          status: "active",
          monthlyVehicleLimit: 150,
          pricePerMonth: 500,
          overagePrice: 5,
          active: true,
        },
      });
    } catch {
      // Handle race where another request created it first.
      subscription = await prisma.subscription.findUnique({
        where: { shopId: shop.id },
      });
    }
  }

  if (!subscription) {
    return null;
  }

  const monthStart = getUsageWindowStart(subscription.billingCycleStart);

  const [usageCount, lifetimeCount] = await Promise.all([
    prisma.usageRecord.count({
      where: {
        shopId,
        createdAt: { gte: monthStart },
      },
    }),
    prisma.usageRecord.count({
      where: { shopId },
    }),
  ]);

  const limit = subscription.monthlyVehicleLimit;
  const remaining = Math.max(0, limit - usageCount);
  const overage = Math.max(0, usageCount - limit);

  return {
    used: usageCount,
    limit,
    remaining,
    overage,
    overageCharge: overage * subscription.overagePrice,
    billingCycleStart: monthStart,
    lifetimeUsed: lifetimeCount,
    resetMode: getUsageResetMode(),
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
