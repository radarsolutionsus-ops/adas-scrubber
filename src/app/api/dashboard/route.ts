import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getShopUsage } from "@/lib/auth";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { extractEstimateIdentifiers, extractEstimateMetadata } from "@/lib/estimate-parser";
import { extractVINFromText } from "@/lib/vin-decoder";
import { canonicalizeCalibrationType, canonicalizeSystem, normalizeForKey } from "@/lib/calibration-normalization";

const QUEUE_STATUSES = [
  "NEW_INTAKE",
  "IN_REVIEW",
  "NEEDS_CORRECTION",
  "READY_TO_SUBMIT",
  "SUBMITTED",
] as const;

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const REQUIRED_OEM_BRANDS = [
  "Acura",
  "Audi",
  "BMW",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jeep",
  "Kia",
  "Lexus",
  "Lincoln",
  "Mazda",
  "Mercedes-Benz",
  "Nissan",
  "Porsche",
  "Ram",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

interface CalibrationMatch {
  systemName: string;
  calibrationType: string | null;
  reason: string;
  matchedKeyword: string;
  repairOperation: string;
}

interface ScrubResult {
  lineNumber: number;
  description: string;
  calibrationMatches: CalibrationMatch[];
}

interface QueuePatchPayload {
  reportIds: string[];
  status?: string;
  priority?: string;
  assignedTo?: string | null;
  dueAt?: string | null;
  markSubmitted?: boolean;
}

function isQueueStatus(value?: string): value is (typeof QUEUE_STATUSES)[number] {
  return Boolean(value && QUEUE_STATUSES.includes(value as (typeof QUEUE_STATUSES)[number]));
}

function isPriority(value?: string): value is (typeof PRIORITIES)[number] {
  return Boolean(value && PRIORITIES.includes(value as (typeof PRIORITIES)[number]));
}

function parseCalibrations(value: string): ScrubResult[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as ScrubResult[]) : [];
  } catch {
    return [];
  }
}

function safeDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  const candidate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function minutesBetween(now: Date, target: Date): number {
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

function isUsableSourceUrl(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) && !/\.pdf($|\?)/i.test(trimmed);
}

function groupCalibrations(calibrations: ScrubResult[]) {
  const groups = new Map<
    string,
    {
      systemName: string;
      operations: Set<string>;
      triggerLines: Set<number>;
      triggerDescriptions: Set<string>;
      calibrationTypes: Set<string>;
    }
  >();

  for (const line of calibrations) {
    for (const match of line.calibrationMatches) {
      const normalizedSystem = canonicalizeSystem(match.systemName, match.repairOperation);
      const key = normalizeForKey(normalizedSystem.label);
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, {
          systemName: normalizedSystem.label,
          operations: new Set([match.repairOperation]),
          triggerLines: new Set([line.lineNumber]),
          triggerDescriptions: new Set([line.description]),
          calibrationTypes: new Set([canonicalizeCalibrationType(match.calibrationType)]),
        });
        continue;
      }

      existing.operations.add(match.repairOperation);
      existing.triggerLines.add(line.lineNumber);
      existing.triggerDescriptions.add(line.description);
      existing.calibrationTypes.add(canonicalizeCalibrationType(match.calibrationType));
    }
  }

  return Array.from(groups.values())
    .map((entry) => ({
      systemName: entry.systemName,
      operations: Array.from(entry.operations),
      triggerLines: Array.from(entry.triggerLines).sort((a, b) => a - b),
      triggerDescriptions: Array.from(entry.triggerDescriptions),
      calibrationType: Array.from(entry.calibrationTypes).join(" / "),
    }))
    .sort((a, b) => (a.triggerLines[0] || 0) - (b.triggerLines[0] || 0));
}

function buildCompleteness(input: {
  estimateText: string;
  groupedCalibrations: ReturnType<typeof groupCalibrations>;
  sourceUrl?: string | null;
}) {
  const identifiers = extractEstimateIdentifiers(input.estimateText);
  const metadata = extractEstimateMetadata(input.estimateText);
  const vin = extractVINFromText(input.estimateText);
  const triggerLineCount = input.groupedCalibrations.reduce((count, entry) => count + entry.triggerLines.length, 0);

  const checks = [
    { id: "vin", label: "VIN detected", weight: 20, passed: Boolean(vin) },
    {
      id: "reference",
      label: "RO/PO reference detected",
      weight: 15,
      passed: Boolean(identifiers.roNumber || identifiers.poNumber),
    },
    { id: "shop", label: "Estimate shop detected", weight: 10, passed: Boolean(metadata.shopName) },
    {
      id: "claim",
      label: "Claim or policy reference detected",
      weight: 10,
      passed: Boolean(metadata.claimNumber || metadata.policyNumber || identifiers.claimNumber),
    },
    {
      id: "calibrations",
      label: "Calibration systems grouped",
      weight: 15,
      passed: input.groupedCalibrations.length > 0,
    },
    {
      id: "triggers",
      label: "Trigger line evidence present",
      weight: 10,
      passed: triggerLineCount > 0,
    },
    {
      id: "oemSource",
      label: "OEM/industry source URL linked",
      weight: 10,
      passed: isUsableSourceUrl(input.sourceUrl),
    },
    {
      id: "dates",
      label: "Estimate date metadata present",
      weight: 10,
      passed: Boolean(metadata.lossDate || metadata.createDate),
    },
  ];

  const score = checks.reduce((sum, check) => (check.passed ? sum + check.weight : sum), 0);

  return {
    score,
    readyForSubmission: score >= 85 && input.groupedCalibrations.length > 0,
    missing: checks.filter((check) => !check.passed).map((check) => check.label),
    checks,
    vin: vin || undefined,
    identifiers,
    metadata,
    triggerLineCount,
  };
}

function startOfWeek(date: Date): Date {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = (day + 6) % 7;
  clone.setDate(clone.getDate() - diff);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

export async function GET(request: NextRequest) {
  const rateLimit = applyRateLimit(request, {
    id: "dashboard-api",
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
  const [shop, reports, vehicles, learningEvents, usage] = await Promise.all([
    prisma.shop.findUnique({
      where: { id: shopId },
      include: { subscription: true },
    }),
    prisma.report.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        id: true,
        vehicleYear: true,
        vehicleMake: true,
        vehicleModel: true,
        estimateText: true,
        calibrations: true,
        workflowStatus: true,
        priority: true,
        assignedTo: true,
        dueAt: true,
        submittedAt: true,
        updatedAt: true,
        createdAt: true,
      },
    }),
    prisma.vehicle.findMany({
      select: {
        id: true,
        make: true,
        model: true,
        yearStart: true,
        yearEnd: true,
        sourceProvider: true,
        sourceUrl: true,
        updatedAt: true,
      },
      orderBy: [{ make: "asc" }, { model: "asc" }],
    }),
    prisma.learningEvent.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        action: true,
        make: true,
        model: true,
        yearStart: true,
        yearEnd: true,
        keyword: true,
        systemName: true,
        reason: true,
        confidenceWeight: true,
        reviewStatus: true,
        reviewedAt: true,
        createdAt: true,
        reportId: true,
        triggerLines: true,
        triggerDescriptions: true,
      },
    }),
    getShopUsage(shopId),
  ]);

  if (!shop || !shop.subscription || !usage) {
    return NextResponse.json({ error: "Shop subscription not found" }, { status: 404 });
  }

  const now = new Date();

  const queueItems = reports.map((report) => {
    const matchingVehicle = vehicles.find(
      (vehicle) =>
        vehicle.make.toLowerCase() === report.vehicleMake.toLowerCase() &&
        (vehicle.model.toLowerCase() === report.vehicleModel.toLowerCase() || vehicle.model.toLowerCase() === "all models") &&
        report.vehicleYear >= vehicle.yearStart &&
        report.vehicleYear <= vehicle.yearEnd
    );

    const calibrations = parseCalibrations(report.calibrations);
    const groupedCalibrations = groupCalibrations(calibrations);
    const completeness = buildCompleteness({
      estimateText: report.estimateText,
      groupedCalibrations,
      sourceUrl: matchingVehicle?.sourceUrl,
    });

    const reference =
      completeness.identifiers.roNumber ||
      completeness.identifiers.poNumber ||
      completeness.identifiers.workfileId ||
      completeness.identifiers.claimNumber ||
      report.id.slice(0, 8).toUpperCase();

    const referenceLabel = completeness.identifiers.roNumber
      ? "RO"
      : completeness.identifiers.poNumber
      ? "PO"
      : completeness.identifiers.workfileId
      ? "Workfile"
      : completeness.identifiers.claimNumber
      ? "Claim"
      : "Report";

    const dueAt = safeDate(report.dueAt) || new Date(report.createdAt.getTime() + 24 * 60 * 60 * 1000);
    const slaMinutes = minutesBetween(now, dueAt);

    return {
      id: report.id,
      reference,
      referenceLabel,
      vehicle: `${report.vehicleYear} ${report.vehicleMake} ${report.vehicleModel}`,
      status: report.workflowStatus,
      priority: report.priority,
      owner: report.assignedTo || "Unassigned",
      dueAt: dueAt.toISOString(),
      submittedAt: report.submittedAt ? report.submittedAt.toISOString() : null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      slaMinutes,
      overdue: slaMinutes < 0,
      completeness,
      calibrationCount: groupedCalibrations.length,
      groupedCalibrations,
      reportLinks: {
        standard: `/api/reports/${report.id}/pdf`,
        workOrder: `/api/reports/${report.id}/pdf?template=work-order`,
      },
    };
  });

  const reportsWithCalibrations = queueItems.filter((item) => item.calibrationCount > 0).length;
  const avgCompleteness =
    queueItems.length > 0
      ? Math.round(queueItems.reduce((sum, item) => sum + item.completeness.score, 0) / queueItems.length)
      : 0;

  const submittedWithDuration = queueItems.filter((item) => item.submittedAt);
  const avgTurnaroundHours =
    submittedWithDuration.length > 0
      ? Math.round(
          submittedWithDuration.reduce((sum, item) => {
            const submittedAt = safeDate(item.submittedAt);
            const createdAt = safeDate(item.createdAt);
            if (!submittedAt || !createdAt) return sum;
            return sum + (submittedAt.getTime() - createdAt.getTime()) / 3_600_000;
          }, 0) / submittedWithDuration.length
        )
      : 0;

  const queueByStatus = QUEUE_STATUSES.reduce<Record<string, number>>((acc, status) => {
    acc[status] = queueItems.filter((item) => item.status === status).length;
    return acc;
  }, {});

  const packetCenter = queueItems
    .filter((item) => item.status === "READY_TO_SUBMIT" || item.status === "SUBMITTED")
    .slice(0, 25);

  const pendingCorrections = learningEvents.filter((event) => event.reviewStatus === "pending").slice(0, 25);

  const pendingCorrectionsWithImpact = await Promise.all(
    pendingCorrections.map(async (event) => {
      const impactCount = await prisma.report.count({
        where: {
          shopId,
          vehicleMake: event.make,
          vehicleModel: event.model,
          vehicleYear: {
            gte: event.yearStart,
            lte: event.yearEnd,
          },
        },
      });

      return {
        id: event.id,
        action: event.action,
        systemName: event.systemName,
        keyword: event.keyword,
        reason: event.reason,
        createdAt: event.createdAt.toISOString(),
        reviewStatus: event.reviewStatus,
        reportId: event.reportId,
        impactCount,
      };
    })
  );

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentLearningEvents = learningEvents.filter((event) => event.createdAt >= thirtyDaysAgo);
  const falsePositiveRate =
    recentLearningEvents.length > 0
      ? Math.round(
          (recentLearningEvents.filter((event) => event.action === "suppress").length / recentLearningEvents.length) * 100
        )
      : 0;

  const sixWeeksAgo = startOfWeek(new Date(now.getTime() - 6 * 7 * 24 * 60 * 60 * 1000));
  const trendBuckets = new Map<string, { week: string; add: number; suppress: number; reviewed: number }>();

  for (let i = 0; i < 7; i++) {
    const week = new Date(sixWeeksAgo.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const weekKey = week.toISOString().slice(0, 10);
    trendBuckets.set(weekKey, { week: weekKey, add: 0, suppress: 0, reviewed: 0 });
  }

  for (const event of learningEvents) {
    if (event.createdAt < sixWeeksAgo) continue;
    const week = startOfWeek(event.createdAt).toISOString().slice(0, 10);
    const bucket = trendBuckets.get(week);
    if (!bucket) continue;

    if (event.action === "suppress") {
      bucket.suppress += 1;
    } else {
      bucket.add += 1;
    }
    if (event.reviewStatus !== "pending") {
      bucket.reviewed += 1;
    }
  }

  const vehicleByMake = new Map<
    string,
    {
      make: string;
      models: Set<string>;
      sourceLinkedCount: number;
      staleCount: number;
      latestUpdatedAt: Date;
    }
  >();

  for (const vehicle of vehicles) {
    const makeKey = vehicle.make.toLowerCase();
    const existing = vehicleByMake.get(makeKey);
    const staleDays = Math.floor((now.getTime() - vehicle.updatedAt.getTime()) / (24 * 60 * 60 * 1000));

    if (!existing) {
      vehicleByMake.set(makeKey, {
        make: vehicle.make,
        models: new Set([vehicle.model]),
        sourceLinkedCount: isUsableSourceUrl(vehicle.sourceUrl) ? 1 : 0,
        staleCount: staleDays > 120 ? 1 : 0,
        latestUpdatedAt: vehicle.updatedAt,
      });
      continue;
    }

    existing.models.add(vehicle.model);
    if (isUsableSourceUrl(vehicle.sourceUrl)) {
      existing.sourceLinkedCount += 1;
    }
    if (staleDays > 120) {
      existing.staleCount += 1;
    }
    if (vehicle.updatedAt > existing.latestUpdatedAt) {
      existing.latestUpdatedAt = vehicle.updatedAt;
    }
  }

  const oemCoverageRows = Array.from(vehicleByMake.values())
    .map((entry) => {
      const freshnessDays = Math.floor((now.getTime() - entry.latestUpdatedAt.getTime()) / (24 * 60 * 60 * 1000));
      return {
        make: entry.make,
        modelCount: entry.models.size,
        sourceLinkedCount: entry.sourceLinkedCount,
        staleCount: entry.staleCount,
        freshnessDays,
      };
    })
    .sort((a, b) => a.make.localeCompare(b.make));

  const availableBrandSet = new Set(oemCoverageRows.map((row) => row.make.toLowerCase()));
  const missingBrands = REQUIRED_OEM_BRANDS.filter((brand) => !availableBrandSet.has(brand.toLowerCase()));
  const availableRequired = REQUIRED_OEM_BRANDS.length - missingBrands.length;
  const coveragePercent = Math.round((availableRequired / REQUIRED_OEM_BRANDS.length) * 100);

  const recentQueue = queueItems.slice(0, 40);

  return NextResponse.json({
    shop: {
      id: shop.id,
      name: shop.name,
      plan: shop.subscription.plan,
      subscriptionActive: shop.subscription.active,
      monthlyVehicleLimit: shop.subscription.monthlyVehicleLimit,
    },
    executiveMetrics: {
      monthlyUsed: usage.used,
      monthlyLimit: usage.limit,
      monthlyRemaining: usage.remaining,
      lifetimeScrubs: usage.lifetimeUsed,
      calibrationHitRate: queueItems.length ? Math.round((reportsWithCalibrations / queueItems.length) * 100) : 0,
      averageCompleteness: avgCompleteness,
      averageTurnaroundHours: avgTurnaroundHours,
      queueByStatus,
      resetMode: usage.resetMode,
      windowStart: usage.billingCycleStart,
    },
    queue: recentQueue,
    correctionInbox: {
      pending: pendingCorrectionsWithImpact,
      falsePositiveRate,
      trend: Array.from(trendBuckets.values()).sort((a, b) => a.week.localeCompare(b.week)),
      totalRecent: recentLearningEvents.length,
      approvedRecent: recentLearningEvents.filter((event) => event.reviewStatus === "approved").length,
      rejectedRecent: recentLearningEvents.filter((event) => event.reviewStatus === "rejected").length,
    },
    packetCenter,
    oemCoverage: {
      byMake: oemCoverageRows,
      requiredBrands: REQUIRED_OEM_BRANDS,
      missingBrands,
      coveragePercent,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const rateLimit = applyRateLimit(request, {
    id: "dashboard-queue-patch",
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

  try {
    const payload = (await request.json()) as QueuePatchPayload;
    const reportIds = Array.isArray(payload.reportIds)
      ? payload.reportIds.filter((id) => typeof id === "string" && id.trim().length > 0)
      : [];

    if (reportIds.length === 0) {
      return NextResponse.json({ error: "No report IDs provided" }, { status: 400 });
    }

    const nextStatus = payload.markSubmitted
      ? "SUBMITTED"
      : payload.status
      ? payload.status.trim().toUpperCase()
      : undefined;

    if (nextStatus && !isQueueStatus(nextStatus)) {
      return NextResponse.json({ error: "Invalid queue status" }, { status: 400 });
    }

    const nextPriority = payload.priority ? payload.priority.trim().toUpperCase() : undefined;
    if (nextPriority && !isPriority(nextPriority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }

    const selectedReports = await prisma.report.findMany({
      where: {
        id: { in: reportIds },
        shopId,
      },
      select: {
        id: true,
        estimateText: true,
        calibrations: true,
        vehicleMake: true,
        vehicleModel: true,
        vehicleYear: true,
      },
    });

    if (selectedReports.length !== reportIds.length) {
      return NextResponse.json({ error: "Some reports were not found" }, { status: 404 });
    }

    if (nextStatus === "READY_TO_SUBMIT") {
      const vehicles = await prisma.vehicle.findMany({
        select: {
          make: true,
          model: true,
          yearStart: true,
          yearEnd: true,
          sourceUrl: true,
        },
      });

      const blocked: Array<{ reportId: string; score: number; missing: string[] }> = [];
      for (const report of selectedReports) {
        const matchingVehicle = vehicles.find(
          (vehicle) =>
            vehicle.make.toLowerCase() === report.vehicleMake.toLowerCase() &&
            (vehicle.model.toLowerCase() === report.vehicleModel.toLowerCase() || vehicle.model.toLowerCase() === "all models") &&
            report.vehicleYear >= vehicle.yearStart &&
            report.vehicleYear <= vehicle.yearEnd
        );

        const groupedCalibrations = groupCalibrations(parseCalibrations(report.calibrations));
        const completeness = buildCompleteness({
          estimateText: report.estimateText,
          groupedCalibrations,
          sourceUrl: matchingVehicle?.sourceUrl,
        });

        if (!completeness.readyForSubmission) {
          blocked.push({
            reportId: report.id,
            score: completeness.score,
            missing: completeness.missing,
          });
        }
      }

      if (blocked.length > 0) {
        return NextResponse.json(
          {
            error: "Completeness threshold not met for one or more reports",
            blocked,
          },
          { status: 409 }
        );
      }
    }

    const data: {
      workflowStatus?: string;
      priority?: string;
      assignedTo?: string | null;
      dueAt?: Date | null;
      submittedAt?: Date | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (nextStatus) {
      data.workflowStatus = nextStatus;
      data.submittedAt = nextStatus === "SUBMITTED" ? new Date() : null;
    }

    if (nextPriority) {
      data.priority = nextPriority;
    }

    if (payload.assignedTo !== undefined) {
      const assignedTo = typeof payload.assignedTo === "string" ? payload.assignedTo.trim() : "";
      data.assignedTo = assignedTo || null;
    }

    if (payload.dueAt !== undefined) {
      if (!payload.dueAt) {
        data.dueAt = null;
      } else {
        const dueDate = safeDate(payload.dueAt);
        if (!dueDate) {
          return NextResponse.json({ error: "Invalid dueAt date" }, { status: 400 });
        }
        data.dueAt = dueDate;
      }
    }

    const updateResult = await prisma.report.updateMany({
      where: {
        id: { in: reportIds },
        shopId,
      },
      data,
    });

    return NextResponse.json({ success: true, updatedCount: updateResult.count });
  } catch (error) {
    console.error("Dashboard queue update error:", error);
    return NextResponse.json({ error: "Failed to update queue" }, { status: 500 });
  }
}
