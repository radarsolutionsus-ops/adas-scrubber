import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createReportPdfBuffer } from "@/lib/report-pdf";
import { extractEstimateIdentifiers, extractEstimateMetadata } from "@/lib/estimate-parser";
import { extractVINFromText } from "@/lib/vin-decoder";

export const runtime = "nodejs";

const POSITION_STATEMENT_URL_BY_MAKE: Record<string, string> = {
  acura: "https://techinfo.honda.com/rjanisis/logon.aspx",
  audi: "https://audi.erwin-store.com/erwin/showHome.do",
  bmw: "https://bmwtechinfo.bmwgroup.com",
  buick: "https://www.gmparts.com/technical-resources/position-statements",
  cadillac: "https://www.gmparts.com/technical-resources/position-statements",
  chevrolet: "https://www.gmparts.com/technical-resources/position-statements",
  chrysler: "https://www.moparrepairconnect.com/collision/resources/position-statements/",
  dodge: "https://www.moparrepairconnect.com/collision/resources/position-statements/",
  ford: "https://www.fordcrashparts.com/position-statements/",
  gmc: "https://www.gmparts.com/technical-resources/position-statements",
  genesis: "https://www.hyundaicollisionrepair.com/position-statements/",
  honda: "https://techinfo.honda.com/rjanisis/logon.aspx",
  hyundai: "https://www.hyundaicollisionrepair.com/position-statements/",
  infiniti: "https://www.infiniticollision.com/",
  jeep: "https://www.moparrepairconnect.com/collision/resources/position-statements/",
  kia: "https://kiatechinfo.snapon.com/",
  "land rover": "https://www.landrovertechinfo.com/",
  lexus: "https://techinfo.toyota.com/",
  lincoln: "https://www.fordcrashparts.com/position-statements/",
  mazda: "https://www.mazdaserviceinfo.com/",
  "mercedes-benz": "https://www.startekinfo.com/",
  mini: "https://bmwtechinfo.bmwgroup.com",
  nissan: "https://www.nissancollision.com/",
  porsche: "https://www.porschetechinfo.com/",
  ram: "https://www.moparrepairconnect.com/collision/resources/position-statements/",
  rivian: "https://rivian.com/support/article/certified-collision-centers",
  subaru: "https://techinfo.subaru.com/",
  tesla: "https://www.tesla.com/support/collision-support",
  toyota: "https://techinfo.toyota.com/",
  volkswagen: "https://volkswagen.erwin-store.com/erwin/showHome.do",
  volvo: "https://volvocollision.com/position-statements/",
};

function normalizeSourceUrl(url: string | null, make: string): string | null {
  const makeKey = make.toLowerCase().trim();
  const fallback = POSITION_STATEMENT_URL_BY_MAKE[makeKey];
  if (!url) return fallback || null;

  const trimmed = url.trim();
  const isWeb = /^https?:\/\//i.test(trimmed);
  const isPdf = /\.pdf($|\?)/i.test(trimmed);
  const isPortalLike = /alldata|oem1stop|erwin|techinfo|position-statements|collision/i.test(trimmed);

  if (isWeb && !isPdf) return trimmed;
  if (isWeb && isPortalLike && !isPdf) return trimmed;
  return fallback || (isWeb && !isPdf ? trimmed : null);
}

interface CalibrationMatch {
  systemName: string;
  calibrationType: string | null;
  reason: string;
  matchedKeyword: string;
  repairOperation: string;
  procedureType?: string;
  procedureName?: string;
  location?: string;
  toolsRequired?: string[];
}

interface ScrubResult {
  lineNumber: number;
  description: string;
  calibrationMatches: CalibrationMatch[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const report = await prisma.report.findUnique({
      where: { id },
      include: { shop: true },
    });

    if (!report || report.shopId !== session.user.id) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const template = request.nextUrl.searchParams.get("template") === "work-order"
      ? "work-order"
      : "standard";

    const vehicles = await prisma.vehicle.findMany({
      where: {
        yearStart: { lte: report.vehicleYear },
        yearEnd: { gte: report.vehicleYear },
      },
      include: {
        adasSystems: true,
      },
    });

    const vehicle = vehicles.find(
      (entry) =>
        entry.make.toLowerCase() === report.vehicleMake.toLowerCase() &&
        (entry.model.toLowerCase() === report.vehicleModel.toLowerCase() || entry.model.toLowerCase() === "all models")
    );

    const calibrations: ScrubResult[] = JSON.parse(report.calibrations);
    const identifiers = extractEstimateIdentifiers(report.estimateText);
    const estimateMetadata = extractEstimateMetadata(report.estimateText);
    const vin = extractVINFromText(report.estimateText);

    const displayIdLabel = identifiers.roNumber
      ? "RO Number"
      : identifiers.poNumber
      ? "PO Number"
      : identifiers.workfileId
      ? "Workfile ID"
      : identifiers.claimNumber
      ? "Claim Number"
      : "Report ID";

    const displayId =
      identifiers.preferredReference || report.id.slice(0, 8).toUpperCase();

    const pdfBuffer = await createReportPdfBuffer({
      report: {
        id: report.id,
        displayId,
        displayIdLabel,
        vehicleYear: report.vehicleYear,
        vehicleMake: report.vehicleMake,
        vehicleModel: report.vehicleModel,
        createdAt: report.createdAt,
        shop: { name: report.shop.name },
        vin,
        references: {
          roNumber: identifiers.roNumber,
          poNumber: identifiers.poNumber,
          workfileId: identifiers.workfileId,
          claimNumber: identifiers.claimNumber,
        },
        metadata: estimateMetadata,
      },
      calibrations,
      adasSystems: vehicle?.adasSystems || [],
      vehicle: vehicle
        ? {
            sourceProvider: vehicle.sourceProvider,
            sourceUrl: normalizeSourceUrl(vehicle.sourceUrl, vehicle.make),
          }
        : null,
      template,
    });

    const safeVehicleName = `${report.vehicleYear}-${report.vehicleMake}-${report.vehicleModel}`
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "")
      .toLowerCase();

    const suffix = template === "work-order" ? "work-order" : "calibration-report";
    const fileName = `${safeVehicleName}-${suffix}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=\"${fileName}\"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
