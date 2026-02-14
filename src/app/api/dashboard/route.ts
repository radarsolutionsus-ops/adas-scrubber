import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopId = session.user.id;
  const [totalReports, recentUsage] = await Promise.all([
    prisma.report.count({ where: { shopId } }),
    prisma.usageRecord.count({
      where: {
        shopId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return NextResponse.json({
    totalReports,
    recentUsage,
  });
}
