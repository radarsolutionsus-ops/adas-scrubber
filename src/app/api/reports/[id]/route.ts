import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scrubEstimate, type ScrubResult } from "@/lib/scrubber";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { extractEstimateMetadata, getADASSystemDescription, parseEstimate } from "@/lib/estimate-parser";
import { extractVINFromText } from "@/lib/vin-decoder";
import {
  calibrationOperationForSystem,
  canonicalizeCalibrationType,
  canonicalizeOperationName,
  canonicalizeSystem,
  mergeCalibrationTypes,
  normalizeForKey,
} from "@/lib/calibration-normalization";

type ManualAddOperation = {
  lineNumber: number;
  systemName: string;
  calibrationType?: string | null;
  reason?: string;
  repairOperation?: string;
  matchedKeyword?: string;
  description?: string;
};

type ManualRemoveOperation = {
  repairOperation?: string;
  systemName?: string;
  lineNumber?: number;
};

function parseStoredCalibrations(value: string): ScrubResult[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as ScrubResult[];
    }
  } catch {
    // Ignore malformed payload.
  }
  return [];
}

function extractEstimateLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({
      lineNumber: index + 1,
      text: line.trim(),
    }))
    .filter((line) => line.text.length > 0);
}

function groupCalibrations(results: ScrubResult[]) {
  type GroupedCalibration = {
    systemName: string;
    calibrationType: string;
    reason: string;
    repairOperation: string;
    matchedKeywords: string[];
    triggerLines: number[];
    triggerDescriptions: string[];
    calibrationTypes: string[];
    reasons: string[];
  };

  const grouped = new Map<string, GroupedCalibration>();

  for (const result of results) {
    for (const match of result.calibrationMatches) {
      const repairOperation = canonicalizeOperationName(
        match.repairOperation,
        match.systemName,
        match.matchedKeyword
      );
      const normalizedSystem = canonicalizeSystem(match.systemName, repairOperation);
      const recommendedOperation = calibrationOperationForSystem(normalizedSystem, repairOperation);
      const calibrationType = canonicalizeCalibrationType(match.calibrationType);
      const key = normalizeForKey(recommendedOperation);

      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          systemName: normalizedSystem.label,
          calibrationType,
          reason: match.reason,
          repairOperation: recommendedOperation,
          matchedKeywords: [match.matchedKeyword],
          triggerLines: [result.lineNumber],
          triggerDescriptions: [result.description],
          calibrationTypes: [calibrationType],
          reasons: [match.reason],
        });
        continue;
      }

      const hasKeyword = existing.matchedKeywords.some(
        (keyword) => normalizeForKey(keyword) === normalizeForKey(match.matchedKeyword)
      );
      if (!hasKeyword) {
        existing.matchedKeywords.push(match.matchedKeyword);
      }
      if (!existing.triggerLines.includes(result.lineNumber)) {
        existing.triggerLines.push(result.lineNumber);
      }
      const hasDescription = existing.triggerDescriptions.some(
        (description) => normalizeForKey(description) === normalizeForKey(result.description)
      );
      if (!hasDescription) {
        existing.triggerDescriptions.push(result.description);
      }
      if (!existing.calibrationTypes.includes(calibrationType)) {
        existing.calibrationTypes.push(calibrationType);
      }
      if (!existing.reasons.includes(match.reason)) {
        existing.reasons.push(match.reason);
      }

      existing.calibrationType = mergeCalibrationTypes(existing.calibrationTypes);
      existing.reason = existing.reasons[0] || existing.reason;
    }
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      systemName: entry.systemName,
      calibrationType: mergeCalibrationTypes(entry.calibrationTypes),
      reason: entry.reasons[0] || entry.reason,
      repairOperation: entry.repairOperation,
      matchedKeywords: entry.matchedKeywords,
      triggerLines: entry.triggerLines.sort((a, b) => a - b),
      triggerDescriptions: entry.triggerDescriptions,
    }))
    .sort((a, b) => {
      const aFirstLine = a.triggerLines[0] ?? Number.MAX_SAFE_INTEGER;
      const bFirstLine = b.triggerLines[0] ?? Number.MAX_SAFE_INTEGER;
      if (aFirstLine !== bFirstLine) return aFirstLine - bFirstLine;
      return a.systemName.localeCompare(b.systemName);
    });
}

function inferCalibrations(
  detectedRepairs: Array<{ lineNumber: number; description: string; repairType: string }>,
  adasPartsInEstimate: Array<{ system: string; description: string; lineNumbers: number[] }>
): ScrubResult[] {
  const resultsByLine = new Map<number, ScrubResult>();

  const pushMatch = (
    lineNumber: number,
    description: string,
    match: {
      systemName: string;
      calibrationType: string | null;
      reason: string;
      matchedKeyword: string;
      repairOperation: string;
    }
  ) => {
    const existing = resultsByLine.get(lineNumber);
    if (!existing) {
      resultsByLine.set(lineNumber, {
        lineNumber,
        description,
        calibrationMatches: [match],
      });
      return;
    }
    if (!existing.calibrationMatches.some((m) => m.systemName === match.systemName && m.matchedKeyword === match.matchedKeyword)) {
      existing.calibrationMatches.push(match);
    }
  };

  for (const repair of detectedRepairs) {
    const repairType = repair.repairType.toLowerCase();

    if (/(alignment|suspension|steering)/.test(repairType)) {
      pushMatch(repair.lineNumber, repair.description, {
        systemName: "Steering Angle Sensor",
        calibrationType: "Initialization",
        reason: "Alignment or steering work commonly requires steering-angle reset/relearn.",
        matchedKeyword: repair.repairType,
        repairOperation: "Steering Angle Sensor Reset/Relearn",
      });
    }

    if (/(windshield|camera|headlamp)/.test(repairType)) {
      pushMatch(repair.lineNumber, repair.description, {
        systemName: "Forward Camera / LDW-LKA",
        calibrationType: "Static + Dynamic",
        reason: "Camera or windshield-area repair commonly requires forward-camera aiming/calibration.",
        matchedKeyword: repair.repairType,
        repairOperation: "Forward Camera Calibration",
      });
    }

    if (/(front bumper|bumper overhaul|bumper repair|bumper r&i|bumper r&r|grille|radar sensor)/.test(repairType)) {
      pushMatch(repair.lineNumber, repair.description, {
        systemName: "Front Radar / ACC-AEB",
        calibrationType: "Static or Dynamic",
        reason: "Front fascia/radar-zone repair commonly requires front-radar calibration.",
        matchedKeyword: repair.repairType,
        repairOperation: "Front Radar Calibration",
      });
    }
  }

  for (const adasPart of adasPartsInEstimate) {
    const lineNumber = adasPart.lineNumbers[0] || 1;
    pushMatch(lineNumber, adasPart.description, {
      systemName:
        adasPart.system === "steeringAngleSensor"
          ? "Steering Angle Sensor"
          : adasPart.description,
      calibrationType: adasPart.system === "steeringAngleSensor" ? "Initialization" : "OEM Procedure",
      reason: "ADAS-related component detected in estimate; calibration verification is recommended.",
      matchedKeyword: adasPart.system,
      repairOperation:
        adasPart.system === "steeringAngleSensor"
          ? "Steering Angle Sensor Reset/Relearn"
          : `${adasPart.description} Calibration`,
    });
  }

  return Array.from(resultsByLine.values()).sort((a, b) => a.lineNumber - b.lineNumber);
}

function inferSteeringFromLineMentions(
  estimateText: string,
  lineTextByNumber: Map<number, string>
): ScrubResult[] {
  const matches: ScrubResult[] = [];
  const seenLines = new Set<number>();
  const regex = /\bSteering[^\n]{0,120}?\bLine\s+(\d{1,3})\b/gi;
  let hit: RegExpExecArray | null;

  while ((hit = regex.exec(estimateText)) !== null) {
    const lineNumber = Number.parseInt(hit[1], 10);
    if (!Number.isFinite(lineNumber) || lineNumber < 1 || lineNumber > 999) continue;
    if (seenLines.has(lineNumber)) continue;
    seenLines.add(lineNumber);

    const description = lineTextByNumber.get(lineNumber) || "Steering operation";
    matches.push({
      lineNumber,
      description,
      calibrationMatches: [
        {
          systemName: "Steering Angle Sensor",
          calibrationType: "Initialization",
          reason: "Steering-system operation reference indicates steering-angle reset/relearn requirement.",
          matchedKeyword: "steering-line-mention",
          repairOperation: "Steering Angle Sensor Reset/Relearn",
        },
      ],
    });
  }

  return matches;
}

function matchOperationKey(match: ScrubResult["calibrationMatches"][number]) {
  const repairOperation = canonicalizeOperationName(
    match.repairOperation,
    match.systemName,
    match.matchedKeyword
  );
  const normalizedSystem = canonicalizeSystem(match.systemName, repairOperation);
  return normalizeForKey(calibrationOperationForSystem(normalizedSystem, repairOperation));
}

function mergeMissingInferred(baseResults: ScrubResult[], inferred: ScrubResult[]) {
  if (inferred.length === 0) return { merged: baseResults, addedCount: 0 };
  if (baseResults.length === 0) return { merged: inferred, addedCount: inferred.length };

  const existingOperationKeys = new Set<string>();
  for (const result of baseResults) {
    for (const match of result.calibrationMatches) {
      existingOperationKeys.add(matchOperationKey(match));
    }
  }

  const mergedByLine = new Map<number, ScrubResult>();
  for (const result of baseResults) {
    mergedByLine.set(result.lineNumber, {
      lineNumber: result.lineNumber,
      description: result.description,
      calibrationMatches: [...result.calibrationMatches],
    });
  }

  let addedCount = 0;
  for (const result of inferred) {
    for (const match of result.calibrationMatches) {
      const key = matchOperationKey(match);
      if (existingOperationKeys.has(key)) continue;
      existingOperationKeys.add(key);

      const existingLine = mergedByLine.get(result.lineNumber);
      if (!existingLine) {
        mergedByLine.set(result.lineNumber, {
          lineNumber: result.lineNumber,
          description: result.description,
          calibrationMatches: [match],
        });
      } else {
        existingLine.calibrationMatches.push(match);
      }
      addedCount += 1;
    }
  }

  return {
    merged: Array.from(mergedByLine.values()).sort((a, b) => a.lineNumber - b.lineNumber),
    addedCount,
  };
}

function applyRemoveOperations(results: ScrubResult[], removeOperations: ManualRemoveOperation[]) {
  if (removeOperations.length === 0) return results;

  const cleaned = results
    .map((result) => {
      const remainingMatches = result.calibrationMatches.filter((match) => {
        const operationKey = matchOperationKey(match);
        return !removeOperations.some((remove) => {
          if (typeof remove.lineNumber === "number" && remove.lineNumber !== result.lineNumber) {
            return false;
          }

          if (remove.repairOperation && normalizeForKey(remove.repairOperation) !== operationKey) {
            return false;
          }

          if (
            remove.systemName &&
            !normalizeForKey(match.systemName).includes(normalizeForKey(remove.systemName))
          ) {
            return false;
          }

          if (!remove.repairOperation && !remove.systemName && typeof remove.lineNumber !== "number") {
            return false;
          }

          return true;
        });
      });

      return {
        ...result,
        calibrationMatches: remainingMatches,
      };
    })
    .filter((result) => result.calibrationMatches.length > 0);

  return cleaned;
}

function applyAddOperations(
  results: ScrubResult[],
  addOperations: ManualAddOperation[],
  lineTextByNumber: Map<number, string>
) {
  if (addOperations.length === 0) return results;

  const byLine = new Map<number, ScrubResult>();
  for (const result of results) {
    byLine.set(result.lineNumber, {
      lineNumber: result.lineNumber,
      description: result.description,
      calibrationMatches: [...result.calibrationMatches],
    });
  }

  for (const add of addOperations) {
    if (!Number.isFinite(add.lineNumber) || add.lineNumber < 1 || add.lineNumber > 999) continue;
    if (!add.systemName || !add.systemName.trim()) continue;

    const lineNumber = Math.trunc(add.lineNumber);
    const description =
      add.description?.trim() ||
      lineTextByNumber.get(lineNumber) ||
      `Line ${lineNumber}`;

    const existing = byLine.get(lineNumber);
    const nextMatch = {
      systemName: add.systemName.trim(),
      calibrationType: add.calibrationType?.trim() || null,
      reason: add.reason?.trim() || "Manually flagged by technician review.",
      matchedKeyword: add.matchedKeyword?.trim() || `manual-line-${lineNumber}`,
      repairOperation: add.repairOperation?.trim() || `${add.systemName.trim()} Calibration`,
    };

    if (!existing) {
      byLine.set(lineNumber, {
        lineNumber,
        description,
        calibrationMatches: [nextMatch],
      });
      continue;
    }

    const duplicate = existing.calibrationMatches.some((match) => {
      return (
        normalizeForKey(match.systemName) === normalizeForKey(nextMatch.systemName) &&
        normalizeForKey(match.repairOperation) === normalizeForKey(nextMatch.repairOperation)
      );
    });
    if (!duplicate) {
      existing.calibrationMatches.push(nextMatch);
    }
  }

  return Array.from(byLine.values()).sort((a, b) => a.lineNumber - b.lineNumber);
}

async function getOwnedReportOrNull(reportId: string, shopId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      shopId: true,
      vehicleYear: true,
      vehicleMake: true,
      vehicleModel: true,
      estimateText: true,
      calibrations: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!report || report.shopId !== shopId) return null;
  return report;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = applyRateLimit(request, {
    id: "report-detail",
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

  const { id } = await params;
  const report = await getOwnedReportOrNull(id, session.user.id);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const results = parseStoredCalibrations(report.calibrations);
  const groupedCalibrations = groupCalibrations(results);
  const estimateMetadata = extractEstimateMetadata(report.estimateText);
  const estimateLines = extractEstimateLines(report.estimateText);
  const vin = extractVINFromText(report.estimateText);

  return NextResponse.json({
    reportId: report.id,
    results,
    groupedCalibrations,
    detectedVehicle: {
      year: report.vehicleYear,
      make: report.vehicleMake,
      model: report.vehicleModel,
      vin,
      confidence: "medium",
      source: "report",
    },
    detectedRepairs: [],
    estimateMetadata,
    estimateLines,
    adasPartsInEstimate: parseEstimate(report.estimateText).adasPartsFound.map((part) => ({
      system: part.system,
      description: getADASSystemDescription(part.system),
      lineNumbers: part.lineNumbers,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = applyRateLimit(request, {
    id: "report-rescrub",
    limit: 80,
    windowMs: 60_000,
  });
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    add?: ManualAddOperation[];
    remove?: ManualRemoveOperation[];
  };

  const addOperations = Array.isArray(payload.add) ? payload.add : [];
  const removeOperations = Array.isArray(payload.remove) ? payload.remove : [];

  const { id } = await params;
  const report = await getOwnedReportOrNull(id, session.user.id);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const lineEntries = extractEstimateLines(report.estimateText);
  const lineTextByNumber = new Map<number, string>(lineEntries.map((line) => [line.lineNumber, line.text]));
  const parsedEstimate = parseEstimate(report.estimateText);
  const adasPartsInEstimate = parsedEstimate.adasPartsFound.map((part) => ({
    system: part.system,
    description: getADASSystemDescription(part.system),
    lineNumbers: part.lineNumbers,
  }));

  const scrubbed = await scrubEstimate(
    report.estimateText,
    report.vehicleYear,
    report.vehicleMake,
    report.vehicleModel
  );

  let results = scrubbed.results;
  let inferredMergedCount = 0;
  const inferred = inferCalibrations(scrubbed.detectedRepairs, adasPartsInEstimate);
  if (results.length === 0) {
    results = inferred;
    inferredMergedCount = inferred.length;
  } else {
    const merged = mergeMissingInferred(results, inferred);
    results = merged.merged;
    inferredMergedCount += merged.addedCount;
  }

  const steeringMentions = inferSteeringFromLineMentions(report.estimateText, lineTextByNumber);
  if (steeringMentions.length > 0) {
    const merged = mergeMissingInferred(results, steeringMentions);
    results = merged.merged;
    inferredMergedCount += merged.addedCount;
  }

  const preRemoveCount = results.reduce((sum, line) => sum + line.calibrationMatches.length, 0);
  results = applyRemoveOperations(results, removeOperations);
  const postRemoveCount = results.reduce((sum, line) => sum + line.calibrationMatches.length, 0);

  const preAddCount = postRemoveCount;
  results = applyAddOperations(results, addOperations, lineTextByNumber);
  const postAddCount = results.reduce((sum, line) => sum + line.calibrationMatches.length, 0);

  const originalCalibrations = parseStoredCalibrations(report.calibrations);
  const nextCalibrationsSerialized = JSON.stringify(results);
  const originalCalibrationsSerialized = JSON.stringify(originalCalibrations);
  const changed = nextCalibrationsSerialized !== originalCalibrationsSerialized;

  if (changed) {
    await prisma.report.update({
      where: { id: report.id },
      data: {
        calibrations: nextCalibrationsSerialized,
        updatedAt: new Date(),
      },
    });
  }

  const groupedCalibrations = groupCalibrations(results);
  const estimateMetadata = extractEstimateMetadata(report.estimateText);
  const vin = extractVINFromText(report.estimateText);

  return NextResponse.json({
    reportId: report.id,
    results,
    groupedCalibrations,
    detectedVehicle: {
      year: report.vehicleYear,
      make: report.vehicleMake,
      model: report.vehicleModel,
      vin,
      confidence: "medium",
      source: "report",
    },
    detectedRepairs: scrubbed.detectedRepairs,
    estimateMetadata,
    estimateLines: lineEntries,
    adasPartsInEstimate,
    rescrubSummary: {
      changed,
      inferredMergedCount,
      removedMatchCount: Math.max(0, preRemoveCount - postRemoveCount),
      addedMatchCount: Math.max(0, postAddCount - preAddCount),
    },
  });
}
