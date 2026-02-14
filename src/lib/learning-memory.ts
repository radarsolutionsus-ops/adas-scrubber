import { promises as fs } from "fs";
import path from "path";

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
  shopId?: string;
}

interface LearningStore {
  version: number;
  updatedAt: string;
  rules: LearningRule[];
}

interface LearningEventStore {
  version: number;
  updatedAt: string;
  events: LearningEvent[];
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
  shopId?: string;
}

const STORE_PATH = path.join(process.cwd(), "data", "learning-overrides.json");
const EVENTS_PATH = path.join(process.cwd(), "data", "learning-events.json");
const MAX_EVENTS = 10000;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
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

function defaultStore(): LearningStore {
  return {
    version: 2,
    updatedAt: nowIso(),
    rules: [],
  };
}

function defaultEventStore(): LearningEventStore {
  return {
    version: 1,
    updatedAt: nowIso(),
    events: [],
  };
}

function hydrateRule(raw: Partial<LearningRule>): LearningRule {
  const now = nowIso();
  return {
    id: raw.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action: raw.action === "suppress" ? "suppress" : "add",
    make: raw.make || "Unknown",
    model: raw.model || "All Models",
    yearStart: typeof raw.yearStart === "number" ? raw.yearStart : 1900,
    yearEnd: typeof raw.yearEnd === "number" ? raw.yearEnd : 2100,
    keyword: raw.keyword || "",
    systemName: raw.systemName || "",
    calibrationType: raw.calibrationType ?? null,
    reason: raw.reason || "Learned rule",
    confidenceWeight: clampWeight(raw.confidenceWeight ?? 0.8),
    usageCount: Number.isFinite(raw.usageCount) ? Number(raw.usageCount) : 0,
    correctionCount: Number.isFinite(raw.correctionCount)
      ? Number(raw.correctionCount)
      : Number.isFinite(raw.usageCount)
      ? 1
      : 0,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    lastAppliedAt: raw.lastAppliedAt,
    lastEditedBy: raw.lastEditedBy,
  };
}

export async function loadLearningStore(): Promise<LearningStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as LearningStore;
    return {
      version: parsed.version || 1,
      updatedAt: parsed.updatedAt || nowIso(),
      rules: Array.isArray(parsed.rules) ? parsed.rules.map(hydrateRule) : [],
    };
  } catch {
    return defaultStore();
  }
}

async function saveLearningStore(store: LearningStore): Promise<void> {
  const dir = path.dirname(STORE_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

async function loadLearningEventStore(): Promise<LearningEventStore> {
  try {
    const raw = await fs.readFile(EVENTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as LearningEventStore;
    return {
      version: parsed.version || 1,
      updatedAt: parsed.updatedAt || nowIso(),
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return defaultEventStore();
  }
}

async function saveLearningEventStore(store: LearningEventStore): Promise<void> {
  const dir = path.dirname(EVENTS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(EVENTS_PATH, JSON.stringify(store, null, 2));
}

export async function loadLearningEvents(limit = 200): Promise<LearningEvent[]> {
  const store = await loadLearningEventStore();
  return [...store.events]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.max(1, Math.min(limit, 2000)));
}

export async function upsertLearningRule(input: UpsertLearningRuleInput): Promise<LearningRule> {
  const store = await loadLearningStore();
  const now = nowIso();

  const existing = store.rules.find(
    (rule) =>
      rule.action === input.action &&
      normalize(rule.make) === normalize(input.make) &&
      normalize(rule.model) === normalize(input.model) &&
      rule.yearStart === input.yearStart &&
      rule.yearEnd === input.yearEnd &&
      normalize(rule.keyword) === normalize(input.keyword) &&
      normalize(rule.systemName) === normalize(input.systemName)
  );

  if (existing) {
    const nextWeight = clampWeight((existing.confidenceWeight + clampWeight(input.confidenceWeight)) / 2);
    existing.calibrationType = input.calibrationType;
    existing.reason = input.reason;
    existing.confidenceWeight = nextWeight;
    existing.updatedAt = now;
    existing.correctionCount += 1;
    if (input.editedBy) {
      existing.lastEditedBy = input.editedBy;
    }
    store.updatedAt = now;
    await saveLearningStore(store);
    return existing;
  }

  const created: LearningRule = {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    usageCount: 0,
    correctionCount: 1,
    createdAt: now,
    updatedAt: now,
    lastEditedBy: input.editedBy,
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
  };

  store.rules.push(created);
  store.updatedAt = now;
  await saveLearningStore(store);

  return created;
}

export async function appendLearningEvent(input: LearningEventInput): Promise<LearningEvent> {
  const store = await loadLearningEventStore();
  const now = nowIso();

  const event: LearningEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    action: input.action,
    ruleId: input.ruleId,
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
    triggerLines: input.triggerLines,
    triggerDescriptions: input.triggerDescriptions,
    actorId: input.actorId,
    actorName: input.actorName,
    actorEmail: input.actorEmail,
    shopId: input.shopId,
  };

  store.events.push(event);
  if (store.events.length > MAX_EVENTS) {
    store.events = store.events.slice(store.events.length - MAX_EVENTS);
  }
  store.updatedAt = now;

  await saveLearningEventStore(store);
  return event;
}

export async function applyLearningRules(input: {
  estimateText: string;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  results: ScrubResultLike[];
}): Promise<{ results: ScrubResultLike[]; appliedRuleIds: string[] }> {
  const store = await loadLearningStore();
  const matchingRules = store.rules.filter((rule) => {
    if (rule.confidenceWeight < 0.2) return false;
    if (input.vehicleYear < rule.yearStart || input.vehicleYear > rule.yearEnd) return false;
    if (normalize(rule.make) !== normalize(input.vehicleMake)) return false;
    const ruleModel = normalize(rule.model);
    const model = normalize(input.vehicleModel);
    return ruleModel === "all models" || ruleModel === model;
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
    const lineText = lines[i];
    const lineNumber = i + 1;

    for (const rule of matchingRules) {
      if (!keywordMatched(lineText.toLowerCase(), rule.keyword.toLowerCase())) {
        continue;
      }

      const current = resultMap.get(lineNumber) || {
        lineNumber,
        description: lineText,
        calibrationMatches: [],
      };

      if (rule.action === "suppress") {
        const before = current.calibrationMatches.length;
        current.calibrationMatches = current.calibrationMatches.filter(
          (match) => normalize(match.systemName) !== normalize(rule.systemName)
        );
        if (before !== current.calibrationMatches.length) {
          resultMap.set(lineNumber, current);
          applied.add(rule.id);
        }
        continue;
      }

      const exists = current.calibrationMatches.some(
        (match) =>
          normalize(match.systemName) === normalize(rule.systemName) &&
          normalize(match.matchedKeyword) === normalize(rule.keyword)
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
    const now = nowIso();
    for (const ruleId of applied) {
      const rule = store.rules.find((entry) => entry.id === ruleId);
      if (!rule) continue;
      rule.usageCount += 1;
      rule.lastAppliedAt = now;
      rule.updatedAt = now;
    }
    store.updatedAt = now;
    await saveLearningStore(store);
  }

  const updated = Array.from(resultMap.values())
    .filter((result) => result.calibrationMatches.length > 0)
    .sort((a, b) => a.lineNumber - b.lineNumber);

  return {
    results: updated,
    appliedRuleIds: Array.from(applied),
  };
}
