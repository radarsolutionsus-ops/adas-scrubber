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

    const usage = await getShopUsage(shop.id);

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
        email: shop.email,
        role: shop.role,
        subscription: shop.subscription,
        usage,
      },
    });
  } catch (error) {
    console.error("Get session error:", error);
    return NextResponse.json({ shop: null });
  }
}
