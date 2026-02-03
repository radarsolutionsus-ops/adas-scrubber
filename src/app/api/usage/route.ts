import { NextResponse } from "next/server";
import { getSession, getShopUsage } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const usage = await getShopUsage(session.shopId);

    if (!usage) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ usage });
  } catch (error) {
    console.error("Get usage error:", error);
    return NextResponse.json(
      { error: "Failed to get usage" },
      { status: 500 }
    );
  }
}
