import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  appendLearningEvent,
  loadLearningEvents,
  loadLearningStore,
  reviewLearningEvent,
  upsertLearningRule,
  type LearningAction,
} from "@/lib/learning-memory";
import { applyRateLimit } from "@/lib/security/rate-limit";

interface LearningPayload {
  action: LearningAction;
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  keyword: string;
  systemName: string;
  calibrationType?: string | null;
  reason: string;
  confidenceWeight?: number;
  reportId?: string;
  estimateReference?: string;
  vehicleVin?: string;
  triggerLines?: number[];
  triggerDescriptions?: string[];
}

interface ReviewPayload {
  eventId: string;
  reviewStatus: "approved" | "rejected";
}

export async function GET(request: NextRequest) {
  const rateLimit = applyRateLimit(request, {
    id: "learning-get",
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

  const store = await loadLearningStore(session.user.id);
  const events = await loadLearningEvents(session.user.id, 200);
  return NextResponse.json({ updatedAt: store.updatedAt, rules: store.rules, events });
}

export async function POST(request: NextRequest) {
  const rateLimit = applyRateLimit(request, {
    id: "learning-post",
    limit: 90,
    windowMs: 60_000,
  });
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as LearningPayload;

    if (!payload.make || !payload.model || !payload.keyword || !payload.systemName || !payload.reason) {
      return NextResponse.json({ error: "Missing required fields for learning rule" }, { status: 400 });
    }

    if (payload.action !== "add" && payload.action !== "suppress") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const yearStart = Number(payload.yearStart);
    const yearEnd = Number(payload.yearEnd);
    if (!Number.isFinite(yearStart) || !Number.isFinite(yearEnd) || yearStart > yearEnd) {
      return NextResponse.json({ error: "Invalid year range" }, { status: 400 });
    }

    const make = payload.make.trim();
    const model = payload.model.trim();
    const keyword = payload.keyword.trim();
    const systemName = payload.systemName.trim();
    const reason = payload.reason.trim();
    if (!make || !model || !keyword || !systemName || !reason) {
      return NextResponse.json({ error: "Fields cannot be empty" }, { status: 400 });
    }

    const rule = await upsertLearningRule({
      action: payload.action,
      shopId: session.user.id,
      make,
      model,
      yearStart,
      yearEnd,
      keyword,
      systemName,
      calibrationType: payload.calibrationType || null,
      reason,
      confidenceWeight: payload.confidenceWeight ?? 0.8,
      editedBy: session.user.id,
    });

    const event = await appendLearningEvent({
      action: payload.action,
      ruleId: rule.id,
      shopId: session.user.id,
      make,
      model,
      yearStart,
      yearEnd,
      keyword,
      systemName,
      calibrationType: payload.calibrationType || null,
      reason,
      confidenceWeight: payload.confidenceWeight ?? 0.8,
      reportId: payload.reportId,
      estimateReference: payload.estimateReference,
      vehicleVin: payload.vehicleVin,
      triggerLines: payload.triggerLines,
      triggerDescriptions: payload.triggerDescriptions,
      actorId: session.user.id,
      actorEmail: session.user.email,
      actorName: session.user.name,
    });

    return NextResponse.json({ success: true, rule, event });
  } catch (error) {
    console.error("Learning rule error:", error);
    return NextResponse.json({ error: "Failed to save learning rule" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const rateLimit = applyRateLimit(request, {
    id: "learning-review",
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

  try {
    const payload = (await request.json()) as ReviewPayload;
    if (!payload?.eventId || (payload.reviewStatus !== "approved" && payload.reviewStatus !== "rejected")) {
      return NextResponse.json({ error: "Invalid review payload" }, { status: 400 });
    }

    const reviewed = await reviewLearningEvent({
      shopId: session.user.id,
      eventId: payload.eventId,
      reviewStatus: payload.reviewStatus,
    });

    if (!reviewed) {
      return NextResponse.json({ error: "Learning event not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, event: reviewed });
  } catch (error) {
    console.error("Learning review error:", error);
    return NextResponse.json({ error: "Failed to review learning event" }, { status: 500 });
  }
}
