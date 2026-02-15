import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const strict = request.nextUrl.searchParams.get("strict") === "1";

  if (!strict) {
    return NextResponse.json({
      status: "ok",
      service: "adas-scrubber",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      service: "adas-scrubber",
      db: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        service: "adas-scrubber",
        db: "unreachable",
        error: error instanceof Error ? error.message : "database check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
