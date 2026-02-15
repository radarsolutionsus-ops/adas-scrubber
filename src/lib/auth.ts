import { prisma } from "./prisma";
import { getUsageResetMode, getUsageWindowStart } from "./usage-window";

export async function getShopUsage(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { subscription: true },
  });

  if (!shop || !shop.subscription) {
    return null;
  }

  const monthStart = getUsageWindowStart(shop.subscription.billingCycleStart);

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
