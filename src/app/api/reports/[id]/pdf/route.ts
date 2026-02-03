import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const report = await prisma.report.findUnique({
      where: { id },
      include: { shop: true },
    });

    if (!report || report.shopId !== session.shopId) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Get all matching vehicles and filter case-insensitively
    const vehicles = await prisma.vehicle.findMany({
      where: {
        yearStart: { lte: report.vehicleYear },
        yearEnd: { gte: report.vehicleYear },
      },
    });

    const vehicle = vehicles.find(
      v => v.make.toLowerCase() === report.vehicleMake.toLowerCase() &&
           (v.model.toLowerCase() === report.vehicleModel.toLowerCase() ||
            v.model.toLowerCase() === "all models")
    );

    const calibrations: ScrubResult[] = JSON.parse(report.calibrations);
    const html = generateReportHtml(report, calibrations, vehicle || null);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

function generateReportHtml(
  report: {
    id: string;
    vehicleYear: number;
    vehicleMake: string;
    vehicleModel: string;
    createdAt: Date;
    shop: { name: string };
  },
  calibrations: ScrubResult[],
  vehicle: { sourceProvider: string | null; sourceUrl: string | null } | null
) {
  const uniqueSystems = new Set<string>();
  calibrations.forEach((c) =>
    c.calibrationMatches.forEach((m) => uniqueSystems.add(m.systemName))
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ADAS Calibration Report - ${report.vehicleYear} ${report.vehicleMake} ${report.vehicleModel}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0f;
      color: #ffffff;
      padding: 40px;
      line-height: 1.6;
    }
    .container { max-width: 800px; margin: 0 auto; }

    /* Header */
    .header {
      background: #12121a;
      border: 1px solid #2a2a3a;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #667eea, #764ba2);
    }
    .logo {
      font-size: 32px;
      font-weight: 800;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .tagline {
      color: #a0a0b0;
      font-size: 14px;
      margin-top: 4px;
      font-weight: 500;
    }

    /* Vehicle Info */
    .vehicle-info {
      background: #12121a;
      border: 1px solid #2a2a3a;
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 24px;
    }
    .vehicle-title {
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 12px;
    }
    .meta-row {
      display: flex;
      gap: 32px;
      color: #a0a0b0;
      font-size: 14px;
    }

    /* Summary */
    .summary {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .summary-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .summary-icon {
      width: 48px;
      height: 48px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .summary-title {
      color: #10b981;
      font-weight: 700;
      font-size: 20px;
    }
    .summary-subtitle {
      color: #a0a0b0;
      font-size: 14px;
    }
    .summary-stats {
      display: flex;
      gap: 48px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid rgba(16, 185, 129, 0.2);
    }
    .stat { text-align: center; }
    .stat-value {
      font-size: 36px;
      font-weight: 800;
      color: #10b981;
    }
    .stat-label {
      color: #a0a0b0;
      font-size: 13px;
      margin-top: 4px;
    }

    /* Calibrations */
    .section-title {
      color: #667eea;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .calibration-item {
      background: #12121a;
      border: 1px solid #2a2a3a;
      border-radius: 12px;
      margin-bottom: 16px;
      overflow: hidden;
    }
    .repair-line {
      background: rgba(102, 126, 234, 0.1);
      padding: 16px 20px;
      border-bottom: 1px solid #2a2a3a;
    }
    .repair-line-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .line-number {
      background: rgba(102, 126, 234, 0.2);
      color: #667eea;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .cal-count {
      color: #10b981;
      font-size: 12px;
      font-weight: 600;
    }
    .repair-description {
      color: #fff;
      font-weight: 600;
      font-size: 16px;
    }
    .systems-list {
      padding: 20px;
    }
    .system-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 12px 0;
      border-bottom: 1px solid #1a1a24;
    }
    .system-item:last-child { border-bottom: none; }
    .check-icon {
      width: 24px;
      height: 24px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 14px;
      font-weight: bold;
      flex-shrink: 0;
    }
    .system-details { flex: 1; }
    .system-name {
      color: #fff;
      font-weight: 600;
      font-size: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .calibration-type {
      background: rgba(102, 126, 234, 0.2);
      color: #667eea;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .system-reason {
      color: #a0a0b0;
      font-size: 13px;
      margin-top: 4px;
    }

    /* OEM Source */
    .oem-source {
      background: rgba(102, 126, 234, 0.1);
      border: 1px solid rgba(102, 126, 234, 0.3);
      border-radius: 16px;
      padding: 24px;
      margin-top: 24px;
    }
    .oem-title {
      color: #667eea;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }
    .oem-provider {
      color: #a0a0b0;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .oem-link {
      color: #10b981;
      text-decoration: none;
      word-break: break-all;
      font-weight: 500;
    }

    /* Footer */
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid #2a2a3a;
      color: #606070;
      font-size: 12px;
    }
    .footer-logo {
      font-weight: 700;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    @media print {
      body {
        background: #fff;
        color: #000;
        padding: 20px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .header, .vehicle-info, .calibration-item {
        background: #f9f9f9;
        border-color: #e0e0e0;
      }
      .header::before {
        background: linear-gradient(90deg, #667eea, #764ba2);
      }
      .summary {
        background: rgba(16, 185, 129, 0.05);
        border-color: rgba(16, 185, 129, 0.3);
      }
      .oem-source {
        background: rgba(102, 126, 234, 0.05);
        border-color: rgba(102, 126, 234, 0.3);
      }
      .check-icon {
        background: #10b981 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">RadarSolutions</div>
      <div class="tagline">ADAS Calibration Analysis Report</div>
    </div>

    <div class="vehicle-info">
      <div class="vehicle-title">${report.vehicleYear} ${report.vehicleMake} ${report.vehicleModel}</div>
      <div class="meta-row">
        <span>Report ID: ${report.id.slice(0, 8).toUpperCase()}</span>
        <span>Generated: ${report.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        <span>Shop: ${report.shop.name}</span>
      </div>
    </div>

    <div class="summary">
      <div class="summary-header">
        <div class="summary-icon">&#10003;</div>
        <div>
          <div class="summary-title">Analysis Complete</div>
          <div class="summary-subtitle">ADAS calibration requirements identified</div>
        </div>
      </div>
      <div class="summary-stats">
        <div class="stat">
          <div class="stat-value">${calibrations.length}</div>
          <div class="stat-label">Repair Lines Flagged</div>
        </div>
        <div class="stat">
          <div class="stat-value">${uniqueSystems.size}</div>
          <div class="stat-label">Systems Requiring Calibration</div>
        </div>
      </div>
    </div>

    <div class="section-title">Required Calibrations</div>

    ${(() => {
      // Group calibrations by system name
      const systemMap = new Map<string, {
        systemName: string;
        calibrationType: string | null;
        triggers: Array<{ lineNumber: number; description: string; reason: string }>;
      }>();

      calibrations.forEach((cal) => {
        cal.calibrationMatches.forEach((match) => {
          const existing = systemMap.get(match.systemName);
          if (existing) {
            const alreadyHasTrigger = existing.triggers.some(
              t => t.lineNumber === cal.lineNumber
            );
            if (!alreadyHasTrigger) {
              existing.triggers.push({
                lineNumber: cal.lineNumber,
                description: cal.description,
                reason: match.reason,
              });
            }
          } else {
            systemMap.set(match.systemName, {
              systemName: match.systemName,
              calibrationType: match.calibrationType,
              triggers: [{
                lineNumber: cal.lineNumber,
                description: cal.description,
                reason: match.reason,
              }],
            });
          }
        });
      });

      return Array.from(systemMap.values()).map((system) => `
        <div class="calibration-item">
          <div class="repair-line">
            <div class="repair-line-header">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="check-icon">&#10003;</div>
                <span style="font-weight: 600; font-size: 16px;">${system.systemName}</span>
                ${system.calibrationType ? `<span class="calibration-type">${system.calibrationType}</span>` : ""}
              </div>
              <span class="cal-count">${system.triggers.length} repair${system.triggers.length !== 1 ? 's' : ''} trigger this</span>
            </div>
          </div>
          <div class="systems-list">
            <div style="color: #a0a0b0; font-size: 12px; margin-bottom: 12px;">Triggered by:</div>
            ${system.triggers.map((trigger) => `
              <div class="system-item" style="background: rgba(18, 18, 26, 0.5); border-radius: 8px; padding: 12px; margin-bottom: 8px;">
                <span class="line-number">Line ${trigger.lineNumber}</span>
                <div class="system-details">
                  <div style="font-weight: 500; font-size: 14px;">${trigger.description}</div>
                  <div class="system-reason">${trigger.reason}</div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("");
    })()}

    ${vehicle?.sourceUrl ? `
      <div class="oem-source">
        <div class="oem-title">OEM Position Statement Source</div>
        <div class="oem-provider">${vehicle.sourceProvider || "I-CAR RTS"}</div>
        <a href="${vehicle.sourceUrl}" class="oem-link" target="_blank">${vehicle.sourceUrl}</a>
      </div>
    ` : ""}

    <div class="footer">
      Generated by <span class="footer-logo">RadarSolutions</span> ADAS Calibration Platform<br>
      This report is based on OEM position statements and should be verified with current manufacturer specifications.
    </div>
  </div>

  <script>
    window.onload = function() {
      // Uncomment to auto-print: window.print();
    }
  </script>
</body>
</html>
  `;
}
