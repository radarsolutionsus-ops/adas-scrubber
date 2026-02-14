import * as fs from "fs";
import * as path from "path";

interface AuditSummary {
  generatedAt: string;
  totals: {
    makes: number;
    pdfFiles: number;
    jsonFiles: number;
    pdfReadable: number;
    pdfUnreadable: number;
    jsonValid: number;
    jsonInvalid: number;
  };
  makeCoverage: Array<{
    make: string;
    pdfCount: number;
    jsonCount: number;
    hasPdf: boolean;
    hasJson: boolean;
  }>;
  unreadablePdfs: Array<{ file: string; error: string }>;
  weakPdfs: Array<{ file: string; extractedChars: number }>;
  jsonIssues: Array<{ file: string; issues: string[] }>;
  recommendations: string[];
}

interface RepairMapRow {
  repair_keywords?: unknown;
  triggers_calibration?: unknown;
}

const DATA_DIR = path.join(process.cwd(), "data");
const OUTPUT_DIR = path.join(process.cwd(), "reports");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "position-statements-audit.json");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, out);
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

function toRel(filePath: string): string {
  return path.relative(process.cwd(), filePath);
}

function looksLikeUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`Data directory not found: ${DATA_DIR}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse/lib/pdf-parse") as (dataBuffer: Buffer) => Promise<{ text: string }>;

  const files = walk(DATA_DIR);
  const pdfFiles = files.filter((file) => file.toLowerCase().endsWith(".pdf"));
  const jsonFiles = files.filter((file) => file.toLowerCase().endsWith(".json"));

  const unreadablePdfs: Array<{ file: string; error: string }> = [];
  const weakPdfs: Array<{ file: string; extractedChars: number }> = [];

  for (const pdfFile of pdfFiles) {
    try {
      const buffer = fs.readFileSync(pdfFile);
      const parsed = await pdfParse(buffer);
      const text = (parsed?.text || "").trim();

      if (text.length < 250) {
        weakPdfs.push({ file: toRel(pdfFile), extractedChars: text.length });
      }
    } catch (error) {
      unreadablePdfs.push({
        file: toRel(pdfFile),
        error: error instanceof Error ? error.message : "Unknown parse error",
      });
    }
  }

  const jsonIssues: Array<{ file: string; issues: string[] }> = [];

  for (const jsonFile of jsonFiles) {
    const issues: string[] = [];

    try {
      const raw = fs.readFileSync(jsonFile, "utf-8");
      const data = JSON.parse(raw);

      if (!data.vehicle?.make || !data.vehicle?.model) {
        issues.push("Missing vehicle.make or vehicle.model");
      }

      if (!Array.isArray(data.adas_systems) || data.adas_systems.length === 0) {
        issues.push("No adas_systems entries");
      }

      if (!Array.isArray(data.repair_to_calibration_map) || data.repair_to_calibration_map.length === 0) {
        issues.push("No repair_to_calibration_map entries");
      }

      if (!data.source?.provider) {
        issues.push("Missing source.provider");
      }

      if (!data.source?.url) {
        issues.push("Missing source.url");
      } else if (!looksLikeUrl(data.source.url)) {
        issues.push("source.url is not a web URL (likely filename/path only)");
      }

      if (Array.isArray(data.repair_to_calibration_map)) {
        const invalidMappings = (data.repair_to_calibration_map as RepairMapRow[]).filter((mapping) =>
          !Array.isArray(mapping.repair_keywords) || mapping.repair_keywords.length === 0 ||
          !Array.isArray(mapping.triggers_calibration) || mapping.triggers_calibration.length === 0
        );

        if (invalidMappings.length > 0) {
          issues.push(`${invalidMappings.length} mapping rows missing keywords or calibration triggers`);
        }
      }
    } catch (error) {
      issues.push(`JSON parse/read error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    if (issues.length > 0) {
      jsonIssues.push({ file: toRel(jsonFile), issues });
    }
  }

  const makes = fs
    .readdirSync(DATA_DIR)
    .filter((name) => fs.statSync(path.join(DATA_DIR, name)).isDirectory())
    .sort((a, b) => a.localeCompare(b));

  const makeCoverage = makes.map((make) => {
    const folder = path.join(DATA_DIR, make);
    const entries = fs.readdirSync(folder);
    const pdfCount = entries.filter((name) => name.toLowerCase().endsWith(".pdf")).length;
    const jsonCount = entries.filter((name) => name.toLowerCase().endsWith(".json")).length;

    return {
      make,
      pdfCount,
      jsonCount,
      hasPdf: pdfCount > 0,
      hasJson: jsonCount > 0,
    };
  });

  const makesWithJsonNoPdf = makeCoverage.filter((m) => m.hasJson && !m.hasPdf).map((m) => m.make);

  const summary: AuditSummary = {
    generatedAt: new Date().toISOString(),
    totals: {
      makes: makeCoverage.length,
      pdfFiles: pdfFiles.length,
      jsonFiles: jsonFiles.length,
      pdfReadable: pdfFiles.length - unreadablePdfs.length,
      pdfUnreadable: unreadablePdfs.length,
      jsonValid: jsonFiles.length - jsonIssues.length,
      jsonInvalid: jsonIssues.length,
    },
    makeCoverage,
    unreadablePdfs,
    weakPdfs,
    jsonIssues,
    recommendations: [
      "Backfill OEM PDFs for makes that currently have JSON only (higher legal defensibility).",
      "Normalize source.url fields to canonical public OEM links for every JSON file.",
      "Regenerate JSON from PDFs after every OEM statement revision and store statement publish date.",
      "Add regression tests using known estimates to verify required calibrations are still detected.",
      `Priority missing-PDF makes: ${makesWithJsonNoPdf.join(", ")}`,
    ],
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(summary, null, 2));

  console.log(`Audit written to ${toRel(OUTPUT_FILE)}`);
  console.log(JSON.stringify(summary.totals, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
