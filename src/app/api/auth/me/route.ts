import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getShopUsage } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ shop: null });
    }

    const shop = await prisma.shop.findUnique({
      where: { id: session.user.id },
      include: { subscription: true },
    });

    if (!shop) {
      return NextResponse.json({ shop: null });
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
        subscription = await prisma.subscription.findUnique({ where: { shopId: shop.id } });
      }
    }

    const usage = await getShopUsage(shop.id);

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
        email: shop.email,
        role: shop.role,
        subscription,
        usage,
      },
    });
  } catch (error) {
    console.error("Get session error:", error);
    return NextResponse.json({ shop: null });
  }
}
