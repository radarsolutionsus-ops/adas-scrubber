import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  appendLearningEvent,
  loadLearningEvents,
  loadLearningStore,
  upsertLearningRule,
  type LearningAction,
} from "@/lib/learning-memory";

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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await loadLearningStore();
  const events = await loadLearningEvents(200);
  return NextResponse.json({ updatedAt: store.updatedAt, rules: store.rules, events });
}

export async function POST(request: NextRequest) {
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

    const rule = await upsertLearningRule({
      action: payload.action,
      make: payload.make,
      model: payload.model,
      yearStart: payload.yearStart,
      yearEnd: payload.yearEnd,
      keyword: payload.keyword,
      systemName: payload.systemName,
      calibrationType: payload.calibrationType || null,
      reason: payload.reason,
      confidenceWeight: payload.confidenceWeight ?? 0.8,
      editedBy: session.user.id,
    });

    const event = await appendLearningEvent({
      action: payload.action,
      ruleId: rule.id,
      make: payload.make,
      model: payload.model,
      yearStart: payload.yearStart,
      yearEnd: payload.yearEnd,
      keyword: payload.keyword,
      systemName: payload.systemName,
      calibrationType: payload.calibrationType || null,
      reason: payload.reason,
      confidenceWeight: payload.confidenceWeight ?? 0.8,
      reportId: payload.reportId,
      estimateReference: payload.estimateReference,
      vehicleVin: payload.vehicleVin,
      triggerLines: payload.triggerLines,
      triggerDescriptions: payload.triggerDescriptions,
      actorId: session.user.id,
      actorEmail: session.user.email,
      actorName: session.user.name,
      shopId: session.user.id,
    });

    return NextResponse.json({ success: true, rule, event });
  } catch (error) {
    console.error("Learning rule error:", error);
    return NextResponse.json({ error: "Failed to save learning rule" }, { status: 500 });
  }
}
