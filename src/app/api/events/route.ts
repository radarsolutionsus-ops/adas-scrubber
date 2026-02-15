import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { applyRateLimit } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const rateLimit = applyRateLimit(request, {
    id: "events-api",
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopId = session.user.id;
  const [reports, learningEvents, usageRecords] = await Promise.all([
    prisma.report.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        vehicleYear: true,
        vehicleMake: true,
        vehicleModel: true,
        createdAt: true,
      },
    }),
    prisma.learningEvent.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        action: true,
        keyword: true,
        systemName: true,
        createdAt: true,
      },
    }),
    prisma.usageRecord.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        vehicleInfo: true,
        createdAt: true,
      },
    }),
  ]);

  const normalizedEvents = [
    ...reports.map((report) => ({
      id: `report-${report.id}`,
      type: "report_created",
      message: `Generated report for ${report.vehicleYear} ${report.vehicleMake} ${report.vehicleModel}`.trim(),
      createdAt: report.createdAt.toISOString(),
    })),
    ...learningEvents.map((event) => ({
      id: `learning-${event.id}`,
      type: event.action === "suppress" ? "correction_suppress" : "correction_add",
      message:
        event.action === "suppress"
          ? `Suppressed ${event.systemName} for keyword "${event.keyword}".`
          : `Added learned rule for ${event.systemName} from keyword "${event.keyword}".`,
      createdAt: event.createdAt.toISOString(),
    })),
    ...usageRecords.map((usage) => ({
      id: `usage-${usage.id}`,
      type: "scrub_ran",
      message: `Scrubbed estimate for ${usage.vehicleInfo}`,
      createdAt: usage.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25);

  return NextResponse.json({ events: normalizedEvents });
}
