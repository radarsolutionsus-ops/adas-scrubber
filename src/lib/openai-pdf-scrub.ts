import { optionalServerEnv } from "@/lib/config/env";

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const MAX_PROMPT_TEXT_CHARS = 60_000;
const MAX_OPERATION_COUNT = 120;

const ALLOWED_OP_CODES = new Set([
  "Rpr",
  "Repl",
  "R&I",
  "R&R",
  "O/H",
  "Subl",
  "Add",
  "Blend",
  "Refn",
  "Aim",
  "Align",
  "Calibrat",
  "Repair",
  "Replace",
  "Remove",
  "Overhaul",
]);

export interface OpenAIOperationSignal {
  lineNumber?: number;
  opCode: string;
  component: string;
  rawText?: string;
}

export interface OpenAIEstimateAssist {
  model: string;
  documentType: "estimate" | "adas_report" | "unknown";
  confidence: number;
  vehicle: {
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
  };
  metadata: {
    shopName?: string;
    roNumber?: string;
    poNumber?: string;
    claimNumber?: string;
    policyNumber?: string;
    customerName?: string;
    estimatorName?: string;
    adjusterName?: string;
    lossDate?: string;
    createDate?: string;
  };
  operations: OpenAIOperationSignal[];
}

function asCleanString(value: unknown, maxLength = 140): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, maxLength);
}

function asYear(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    if (normalized >= 1980 && normalized <= 2035) return normalized;
    return undefined;
  }
  if (typeof value === "string" && /^\d{4}$/.test(value.trim())) {
    const normalized = Number.parseInt(value.trim(), 10);
    if (normalized >= 1980 && normalized <= 2035) return normalized;
  }
  return undefined;
}

function asLineNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    if (normalized >= 1 && normalized <= 999) return normalized;
    return undefined;
  }
  if (typeof value === "string" && /^\d{1,3}$/.test(value.trim())) {
    const normalized = Number.parseInt(value.trim(), 10);
    if (normalized >= 1 && normalized <= 999) return normalized;
  }
  return undefined;
}

function normalizeOpCode(value: unknown): string | null {
  const raw = asCleanString(value, 24)?.toLowerCase().replace(/\s+/g, "") || "";
  switch (raw) {
    case "rpr":
    case "repair":
      return "Rpr";
    case "repl":
    case "replace":
      return "Repl";
    case "r&i":
    case "ri":
    case "removeinstall":
      return "R&I";
    case "r&r":
    case "rr":
    case "removereplace":
      return "R&R";
    case "o/h":
    case "oh":
    case "ovhl":
    case "overhaul":
      return "O/H";
    case "subl":
      return "Subl";
    case "add":
      return "Add";
    case "blend":
      return "Blend";
    case "refn":
    case "refinish":
      return "Refn";
    case "aim":
      return "Aim";
    case "align":
    case "alignment":
      return "Align";
    case "calibrat":
    case "calibration":
    case "calibrate":
      return "Calibrat";
    case "remove":
      return "Remove";
    default:
      return null;
  }
}

function extractMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("\n")
    .trim();
}

function safeJsonParseObject(value: string): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore parse errors and fall back to null.
  }
  return null;
}

function normalizeDocumentType(value: unknown): OpenAIEstimateAssist["documentType"] {
  const raw = asCleanString(value, 30)?.toLowerCase() || "";
  if (raw === "estimate") return "estimate";
  if (raw === "adas_report" || raw === "report" || raw === "calibration_report") return "adas_report";
  return "unknown";
}

function normalizeConfidence(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  return 0;
}

function normalizeOperations(value: unknown): OpenAIOperationSignal[] {
  if (!Array.isArray(value)) return [];
  const operations: OpenAIOperationSignal[] = [];
  const dedupe = new Set<string>();

  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;

    const opCode = normalizeOpCode(record.opCode);
    if (!opCode || !ALLOWED_OP_CODES.has(opCode)) continue;

    const component =
      asCleanString(record.component, 120) ||
      asCleanString(record.description, 120) ||
      asCleanString(record.rawText, 120);
    if (!component) continue;

    const lineNumber = asLineNumber(record.lineNumber);
    const rawText = asCleanString(record.rawText, 200);
    const key = `${lineNumber || 0}|${opCode}|${component.toLowerCase()}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);

    operations.push({
      lineNumber,
      opCode,
      component,
      rawText,
    });

    if (operations.length >= MAX_OPERATION_COUNT) break;
  }

  return operations;
}

export function buildOpenAIOperationHintText(operations: OpenAIOperationSignal[]): string {
  if (!operations.length) return "";
  return operations
    .slice(0, MAX_OPERATION_COUNT)
    .map((operation, index) => {
      const lineNumber =
        operation.lineNumber && operation.lineNumber >= 1 && operation.lineNumber <= 999
          ? operation.lineNumber
          : index + 1;
      return `${lineNumber} ${operation.opCode} ${operation.component}`.trim();
    })
    .join("\n");
}

export async function extractEstimateAssistFromOpenAI(input: {
  estimateText: string;
  fileName?: string;
}): Promise<OpenAIEstimateAssist | null> {
  const apiKey = optionalServerEnv("OPENAI_API_KEY");
  if (!apiKey) return null;

  const model = optionalServerEnv("OPENAI_PDF_MODEL") || DEFAULT_OPENAI_MODEL;
  const promptText = input.estimateText.slice(0, MAX_PROMPT_TEXT_CHARS);
  if (!promptText.trim()) return null;

  const systemPrompt = [
    "You extract structured estimate signals from collision repair estimate text.",
    "Return strict JSON only. No markdown.",
    "Classify documentType as one of: estimate, adas_report, unknown.",
    "If this is a generated calibration report, set documentType to adas_report and leave operations mostly empty.",
    "Extract vehicle fields (vin, year, make, model) when present.",
    "Extract metadata fields (shopName, roNumber, poNumber, claimNumber, policyNumber, customerName, estimatorName, adjusterName, lossDate, createDate).",
    "Extract only true estimate line-item operations, not narrative guidance/disclaimers.",
    "For each operation, output lineNumber if visible, opCode from this set exactly:",
    "Rpr, Repl, R&I, R&R, O/H, Subl, Add, Blend, Refn, Aim, Align, Calibrat, Repair, Replace, Remove, Overhaul.",
    "Use concise component labels (example: Front Bumper Cover, Windshield, Front Radar Sensor).",
    "Output schema:",
    '{"documentType":"estimate|adas_report|unknown","confidence":0.0,"vehicle":{"vin":"","year":0,"make":"","model":""},"metadata":{"shopName":"","roNumber":"","poNumber":"","claimNumber":"","policyNumber":"","customerName":"","estimatorName":"","adjusterName":"","lossDate":"","createDate":""},"operations":[{"lineNumber":1,"opCode":"Rpr","component":"Front Bumper Cover","rawText":""}]}',
  ].join(" ");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              fileName: input.fileName || "estimate.pdf",
              estimateText: promptText,
            }),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI estimate assist HTTP error:", response.status, errText.slice(0, 300));
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: unknown;
        };
      }>;
    };
    const content = extractMessageContent(payload.choices?.[0]?.message?.content);
    const parsed = safeJsonParseObject(content);
    if (!parsed) return null;

    const vehicleRecord =
      parsed.vehicle && typeof parsed.vehicle === "object" && !Array.isArray(parsed.vehicle)
        ? (parsed.vehicle as Record<string, unknown>)
        : {};
    const metadataRecord =
      parsed.metadata && typeof parsed.metadata === "object" && !Array.isArray(parsed.metadata)
        ? (parsed.metadata as Record<string, unknown>)
        : {};

    return {
      model,
      documentType: normalizeDocumentType(parsed.documentType),
      confidence: normalizeConfidence(parsed.confidence),
      vehicle: {
        vin: asCleanString(vehicleRecord.vin, 24),
        year: asYear(vehicleRecord.year),
        make: asCleanString(vehicleRecord.make, 40),
        model: asCleanString(vehicleRecord.model, 50),
      },
      metadata: {
        shopName: asCleanString(metadataRecord.shopName, 90),
        roNumber: asCleanString(metadataRecord.roNumber, 60),
        poNumber: asCleanString(metadataRecord.poNumber, 60),
        claimNumber: asCleanString(metadataRecord.claimNumber, 60),
        policyNumber: asCleanString(metadataRecord.policyNumber, 60),
        customerName: asCleanString(metadataRecord.customerName, 90),
        estimatorName: asCleanString(metadataRecord.estimatorName, 90),
        adjusterName: asCleanString(metadataRecord.adjusterName, 90),
        lossDate: asCleanString(metadataRecord.lossDate, 30),
        createDate: asCleanString(metadataRecord.createDate, 30),
      },
      operations: normalizeOperations(parsed.operations),
    };
  } catch (error) {
    console.error("OpenAI estimate assist failed:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
