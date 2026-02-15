import { prisma } from "@/lib/prisma";

export type LearningAction = "add" | "suppress";

export interface LearningRule {
  id: string;
  action: LearningAction;
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  keyword: string;
  systemName: string;
  calibrationType: string | null;
  reason: string;
  confidenceWeight: number;
  usageCount: number;
  correctionCount: number;
  createdAt: string;
  updatedAt: string;
  lastAppliedAt?: string;
  lastEditedBy?: string;
  shopId?: string;
}

export interface LearningEvent {
  id: string;
  createdAt: string;
  action: LearningAction;
  ruleId: string;
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  keyword: string;
  systemName: string;
  calibrationType: string | null;
  reason: string;
  confidenceWeight: number;
  reportId?: string;
  estimateReference?: string;
  vehicleVin?: string;
  triggerLines?: number[];
  triggerDescriptions?: string[];
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  reviewStatus?: "pending" | "approved" | "rejected";
  reviewedAt?: string;
  shopId?: string;
}

interface LearningStore {
  version: number;
  updatedAt: string;
  rules: LearningRule[];
}

interface ScrubMatch {
  systemName: string;
  calibrationType: string | null;
  reason: string;
  matchedKeyword: string;
  repairOperation: string;
}

interface ScrubResultLike {
  lineNumber: number;
  description: string;
  calibrationMatches: ScrubMatch[];
}

interface UpsertLearningRuleInput {
  action: LearningAction;
  shopId: string;
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  keyword: string;
  systemName: string;
  calibrationType: string | null;
  reason: string;
  confidenceWeight: number;
  editedBy?: string;
}

interface LearningEventInput {
  action: LearningAction;
  ruleId: string;
  shopId: string;
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  keyword: string;
  systemName: string;
  calibrationType: string | null;
  reason: string;
  confidenceWeight: number;
  reportId?: string;
  estimateReference?: string;
  vehicleVin?: string;
  triggerLines?: number[];
  triggerDescriptions?: string[];
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordMatched(lineText: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalizedKeyword = escaped.replace(/\s+/g, "\\s+");
  const boundaryRegex = new RegExp(`(^|[^a-z0-9])${normalizedKeyword}([^a-z0-9]|$)`, "i");
  return boundaryRegex.test(lineText);
}

function nowIso(): string {
  return new Date().toISOString();
}

function clampWeight(value: number): number {
  return Math.min(1, Math.max(0.1, Number.isFinite(value) ? value : 0.8));
}

function toIso(value?: Date | null): string | undefined {
  if (!value) return undefined;
  return value.toISOString();
}

function parseJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .map((item) => (typeof item === "string" ? item : ""))
          .filter((item) => item.length > 0)
      : [];
  } catch {
    return [];
  }
}

function parseJsonNumberArray(value?: string | null): number[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .map((item) => (typeof item === "number" ? item : Number.NaN))
          .filter((item) => Number.isFinite(item))
      : [];
  } catch {
    return [];
  }
}

function toPublicRule(rule: {
  id: string;
  action: string;
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  keyword: string;
  systemName: string;
  calibrationType: string | null;
  reason: string;
  confidenceWeight: number;
  usageCount: number;
  correctionCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastAppliedAt: Date | null;
  lastEditedBy: string | null;
  shopId: string;
}): LearningRule {
  return {
    id: rule.id,
    action: rule.action === "suppress" ? "suppress" : "add",
    make: rule.make,
    model: rule.model,
    yearStart: rule.yearStart,
    yearEnd: rule.yearEnd,
    keyword: rule.keyword,
    systemName: rule.systemName,
    calibrationType: rule.calibrationType,
    reason: rule.reason,
    confidenceWeight: rule.confidenceWeight,
    usageCount: rule.usageCount,
    correctionCount: rule.correctionCount,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
    lastAppliedAt: toIso(rule.lastAppliedAt),
    lastEditedBy: rule.lastEditedBy || undefined,
    shopId: rule.shopId,
  };
}

export async function loadLearningStore(shopId: string): Promise<LearningStore> {
  const rules = await prisma.learningRule.findMany({
    where: { shopId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return {
    version: 3,
    updatedAt: rules[0]?.updatedAt.toISOString() || nowIso(),
    rules: rules.map(toPublicRule),
  };
}

export async function loadLearningEvents(shopId: string, limit = 200): Promise<LearningEvent[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 2000));
  const events = await prisma.learningEvent.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take: boundedLimit,
  });

  return events.map((event) => ({
    id: event.id,
    createdAt: event.createdAt.toISOString(),
    action: event.action === "suppress" ? "suppress" : "add",
    ruleId: event.ruleId || "",
    make: event.make,
    model: event.model,
    yearStart: event.yearStart,
    yearEnd: event.yearEnd,
    keyword: event.keyword,
    systemName: event.systemName,
    calibrationType: event.calibrationType,
    reason: event.reason,
    confidenceWeight: event.confidenceWeight,
    reportId: event.reportId || undefined,
    estimateReference: event.estimateReference || undefined,
    vehicleVin: event.vehicleVin || undefined,
    triggerLines: parseJsonNumberArray(event.triggerLines),
    triggerDescriptions: parseJsonArray(event.triggerDescriptions),
    actorId: event.actorId || undefined,
    actorName: event.actorName || undefined,
    actorEmail: event.actorEmail || undefined,
    reviewStatus:
      event.reviewStatus === "approved"
        ? "approved"
        : event.reviewStatus === "rejected"
        ? "rejected"
        : "pending",
    reviewedAt: event.reviewedAt ? event.reviewedAt.toISOString() : undefined,
    shopId: event.shopId,
  }));
}

export async function upsertLearningRule(input: UpsertLearningRuleInput): Promise<LearningRule> {
  const now = new Date();
  const makeNorm = normalize(input.make);
  const modelNorm = normalize(input.model);
  const keywordNorm = normalize(input.keyword);
  const systemNorm = normalize(input.systemName);
  const incomingWeight = clampWeight(input.confidenceWeight);

  const existing = await prisma.learningRule.findUnique({
    where: {
      shopId_action_makeNorm_modelNorm_yearStart_yearEnd_keywordNorm_systemNorm: {
        shopId: input.shopId,
        action: input.action,
        makeNorm,
        modelNorm,
        yearStart: input.yearStart,
        yearEnd: input.yearEnd,
        keywordNorm,
        systemNorm,
      },
    },
  });

  if (existing) {
    const nextWeight = clampWeight((existing.confidenceWeight + incomingWeight) / 2);
    const updated = await prisma.learningRule.update({
      where: { id: existing.id },
      data: {
        calibrationType: input.calibrationType,
        reason: input.reason,
        confidenceWeight: nextWeight,
        correctionCount: { increment: 1 },
        lastEditedBy: input.editedBy || existing.lastEditedBy,
        updatedAt: now,
      },
    });

    return toPublicRule(updated);
  }

  const created = await prisma.learningRule.create({
    data: {
      shopId: input.shopId,
      action: input.action,
      make: input.make,
      model: input.model,
      makeNorm,
      modelNorm,
      yearStart: input.yearStart,
      yearEnd: input.yearEnd,
      keyword: input.keyword,
      keywordNorm,
      systemName: input.systemName,
      systemNorm,
      calibrationType: input.calibrationType,
      reason: input.reason,
      confidenceWeight: incomingWeight,
      usageCount: 0,
      correctionCount: 1,
      lastEditedBy: input.editedBy,
      createdAt: now,
      updatedAt: now,
    },
  });

  return toPublicRule(created);
}

export async function appendLearningEvent(input: LearningEventInput): Promise<LearningEvent> {
  const created = await prisma.learningEvent.create({
    data: {
      shopId: input.shopId,
      ruleId: input.ruleId,
      action: input.action,
      make: input.make,
      model: input.model,
      yearStart: input.yearStart,
      yearEnd: input.yearEnd,
      keyword: input.keyword,
      systemName: input.systemName,
      calibrationType: input.calibrationType,
      reason: input.reason,
      confidenceWeight: clampWeight(input.confidenceWeight),
      reportId: input.reportId,
      estimateReference: input.estimateReference,
      vehicleVin: input.vehicleVin,
      triggerLines: input.triggerLines ? JSON.stringify(input.triggerLines) : null,
      triggerDescriptions: input.triggerDescriptions
        ? JSON.stringify(input.triggerDescriptions)
        : null,
      actorId: input.actorId,
      actorName: input.actorName,
      actorEmail: input.actorEmail,
      reviewStatus: "pending",
    },
  });

  return {
    id: created.id,
    createdAt: created.createdAt.toISOString(),
    action: created.action === "suppress" ? "suppress" : "add",
    ruleId: created.ruleId || "",
    make: created.make,
    model: created.model,
    yearStart: created.yearStart,
    yearEnd: created.yearEnd,
    keyword: created.keyword,
    systemName: created.systemName,
    calibrationType: created.calibrationType,
    reason: created.reason,
    confidenceWeight: created.confidenceWeight,
    reportId: created.reportId || undefined,
    estimateReference: created.estimateReference || undefined,
    vehicleVin: created.vehicleVin || undefined,
    triggerLines: parseJsonNumberArray(created.triggerLines),
    triggerDescriptions: parseJsonArray(created.triggerDescriptions),
    actorId: created.actorId || undefined,
    actorName: created.actorName || undefined,
    actorEmail: created.actorEmail || undefined,
    reviewStatus:
      created.reviewStatus === "approved"
        ? "approved"
        : created.reviewStatus === "rejected"
        ? "rejected"
        : "pending",
    reviewedAt: created.reviewedAt ? created.reviewedAt.toISOString() : undefined,
    shopId: created.shopId,
  };
}

export async function reviewLearningEvent(input: {
  shopId: string;
  eventId: string;
  reviewStatus: "approved" | "rejected";
}): Promise<LearningEvent | null> {
  const existing = await prisma.learningEvent.findFirst({
    where: {
      id: input.eventId,
      shopId: input.shopId,
    },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.learningEvent.update({
    where: { id: existing.id },
    data: {
      reviewStatus: input.reviewStatus,
      reviewedAt: new Date(),
    },
  });

  return {
    id: updated.id,
    createdAt: updated.createdAt.toISOString(),
    action: updated.action === "suppress" ? "suppress" : "add",
    ruleId: updated.ruleId || "",
    make: updated.make,
    model: updated.model,
    yearStart: updated.yearStart,
    yearEnd: updated.yearEnd,
    keyword: updated.keyword,
    systemName: updated.systemName,
    calibrationType: updated.calibrationType,
    reason: updated.reason,
    confidenceWeight: updated.confidenceWeight,
    reportId: updated.reportId || undefined,
    estimateReference: updated.estimateReference || undefined,
    vehicleVin: updated.vehicleVin || undefined,
    triggerLines: parseJsonNumberArray(updated.triggerLines),
    triggerDescriptions: parseJsonArray(updated.triggerDescriptions),
    actorId: updated.actorId || undefined,
    actorName: updated.actorName || undefined,
    actorEmail: updated.actorEmail || undefined,
    reviewStatus:
      updated.reviewStatus === "approved"
        ? "approved"
        : updated.reviewStatus === "rejected"
        ? "rejected"
        : "pending",
    reviewedAt: updated.reviewedAt ? updated.reviewedAt.toISOString() : undefined,
    shopId: updated.shopId,
  };
}

export async function applyLearningRules(input: {
  estimateText: string;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  results: ScrubResultLike[];
  shopId: string;
}): Promise<{ results: ScrubResultLike[]; appliedRuleIds: string[] }> {
  const makeNorm = normalize(input.vehicleMake);
  const modelNorm = normalize(input.vehicleModel);

  const matchingRules = await prisma.learningRule.findMany({
    where: {
      shopId: input.shopId,
      makeNorm,
      yearStart: { lte: input.vehicleYear },
      yearEnd: { gte: input.vehicleYear },
      confidenceWeight: { gte: 0.2 },
      OR: [{ modelNorm }, { modelNorm: "all models" }],
    },
    orderBy: [{ confidenceWeight: "desc" }, { updatedAt: "desc" }],
  });

  if (matchingRules.length === 0) {
    return { results: input.results, appliedRuleIds: [] };
  }

  const lines = input.estimateText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const resultMap = new Map<number, ScrubResultLike>();
  for (const result of input.results) {
    resultMap.set(result.lineNumber, {
      ...result,
      calibrationMatches: [...result.calibrationMatches],
    });
  }

  const applied = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i].toLowerCase();
    const lineNumber = i + 1;

    for (const rule of matchingRules) {
      if (!keywordMatched(lineText, rule.keywordNorm)) {
        continue;
      }

      const current = resultMap.get(lineNumber) || {
        lineNumber,
        description: lines[i],
        calibrationMatches: [],
      };

      if (rule.action === "suppress") {
        const before = current.calibrationMatches.length;
        current.calibrationMatches = current.calibrationMatches.filter(
          (match) => normalize(match.systemName) !== rule.systemNorm
        );
        if (before !== current.calibrationMatches.length) {
          resultMap.set(lineNumber, current);
          applied.add(rule.id);
        }
        continue;
      }

      const exists = current.calibrationMatches.some(
        (match) =>
          normalize(match.systemName) === rule.systemNorm &&
          normalize(match.matchedKeyword) === rule.keywordNorm
      );

      if (!exists) {
        current.calibrationMatches.push({
          systemName: rule.systemName,
          calibrationType: rule.calibrationType,
          reason: `${rule.reason} (learned rule)`,
          matchedKeyword: rule.keyword,
          repairOperation: "Learned Manual Operation",
        });
        resultMap.set(lineNumber, current);
        applied.add(rule.id);
      }
    }
  }

  if (applied.size > 0) {
    const appliedRuleIds = Array.from(applied);
    await prisma.$transaction(
      appliedRuleIds.map((ruleId) =>
        prisma.learningRule.update({
          where: { id: ruleId },
          data: {
            usageCount: { increment: 1 },
            lastAppliedAt: new Date(),
            updatedAt: new Date(),
          },
        })
      )
    );
  }

  const updated = Array.from(resultMap.values())
    .filter((result) => result.calibrationMatches.length > 0)
    .sort((a, b) => a.lineNumber - b.lineNumber);

  return {
    results: updated,
    appliedRuleIds: Array.from(applied),
  };
}
