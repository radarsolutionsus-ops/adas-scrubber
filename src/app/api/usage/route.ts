import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getShopUsage } from "@/lib/auth";
import { applyRateLimit } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const rateLimit = applyRateLimit(request, {
      id: "usage-api",
      limit: 120,
      windowMs: 60_000,
    });
    if (rateLimit.limited) {
      return rateLimit.response;
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const usage = await getShopUsage(session.user.id);

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
