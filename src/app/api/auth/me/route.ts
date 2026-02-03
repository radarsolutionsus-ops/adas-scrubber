import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getShopUsage } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ shop: null });
    }

    const shop = await prisma.shop.findUnique({
      where: { id: session.shopId },
      include: { subscription: true },
    });

    if (!shop) {
      return NextResponse.json({ shop: null });
    }

    const usage = await getShopUsage(shop.id);

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
        email: shop.email,
        subscription: shop.subscription,
        usage,
      },
    });
  } catch (error) {
    console.error("Get session error:", error);
    return NextResponse.json({ shop: null });
  }
}
