import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  calibrationOperationForSystem,
  canonicalizeCalibrationType,
  canonicalizeOperationName,
  canonicalizeProcedureType,
  canonicalizeSystem,
  mergeCalibrationTypes,
  normalizeForKey,
  pickHigherPriorityProcedureType,
} from "@/lib/calibration-normalization";

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

interface AdasSystemInfo {
  systemName: string;
  oemName: string | null;
  location: string | null;
  calibrationType: string | null;
}

interface ReportInput {
  report: {
    id: string;
    displayId: string;
    displayIdLabel: string;
    vehicleYear: number;
    vehicleMake: string;
    vehicleModel: string;
    createdAt: Date;
    shop: { name: string };
    vin?: string | null;
    references?: {
      roNumber?: string;
      poNumber?: string;
      workfileId?: string;
      claimNumber?: string;
    };
    metadata?: {
      shopName?: string;
      customerName?: string;
      insuranceCompany?: string;
      claimNumber?: string;
      policyNumber?: string;
      roNumber?: string;
      poNumber?: string;
      workfileId?: string;
      estimatorName?: string;
      adjusterName?: string;
      lossDate?: string;
      createDate?: string;
    };
  };
  calibrations: ScrubResult[];
  adasSystems: AdasSystemInfo[];
  vehicle: { sourceProvider: string | null; sourceUrl: string | null } | null;
  template: "standard" | "work-order";
}

interface OperationRow {
  procedureType: string;
  procedureName: string;
  calibrationType: string;
  systems: string[];
  triggerOperations: string[];
  reasons: string[];
  keywords: string[];
  locations: string[];
  toolsRequired: string[];
  triggers: Array<{ lineNumber: number; description: string }>;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    fontSize: 9,
    paddingTop: 22,
    paddingBottom: 42,
    paddingHorizontal: 22,
    fontFamily: "Helvetica",
  },
  hero: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  heroTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: 700,
  },
  heroSubtitle: {
    marginTop: 3,
    color: "#cbd5e1",
    fontSize: 10,
  },
  heroMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  heroMetaBlock: {
    marginRight: 16,
    marginBottom: 4,
  },
  heroMetaLabel: {
    color: "#94a3b8",
    fontSize: 8,
    textTransform: "uppercase",
  },
  heroMetaValue: {
    color: "#e2e8f0",
    fontSize: 9,
    marginTop: 1,
  },
  gridRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  gridCol: {
    flexGrow: 1,
    flexBasis: 0,
    marginRight: 8,
  },
  gridColLast: {
    flexGrow: 1,
    flexBasis: 0,
  },
  card: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    padding: 10,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  keyValue: {
    color: "#1e293b",
    fontSize: 9,
    marginBottom: 3,
  },
  summary: {
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 8,
    backgroundColor: "#ecfeff",
    padding: 10,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
  },
  summaryMetric: {
    marginRight: 16,
    marginBottom: 3,
  },
  summaryMetricLabel: {
    fontSize: 8,
    color: "#0369a1",
    textTransform: "uppercase",
  },
  summaryMetricValue: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: 700,
    marginTop: 1,
  },
  sectionTitle: {
    marginTop: 2,
    marginBottom: 6,
    fontSize: 10,
    color: "#0f172a",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  operationCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    padding: 10,
    marginBottom: 8,
  },
  operationHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 5,
    marginBottom: 5,
  },
  operationTitle: {
    color: "#0f172a",
    fontSize: 11,
    fontWeight: 700,
  },
  operationSubtitle: {
    color: "#334155",
    fontSize: 9,
    marginTop: 2,
  },
  operationLine: {
    color: "#334155",
    fontSize: 8.8,
    marginBottom: 3,
  },
  evidenceTitle: {
    color: "#0f172a",
    fontSize: 9,
    fontWeight: 700,
    marginTop: 3,
    marginBottom: 2,
  },
  evidenceLine: {
    color: "#334155",
    fontSize: 8.4,
    marginBottom: 2,
  },
  compactBlock: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    padding: 9,
    marginBottom: 8,
  },
  compactText: {
    color: "#334155",
    fontSize: 8.7,
    marginBottom: 2,
  },
  sourceLink: {
    color: "#0c4a6e",
    fontSize: 8.5,
    marginTop: 3,
  },
  footer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 5,
    color: "#64748b",
    fontSize: 8,
    textAlign: "center",
  },
});

function uniquePush(collection: string[], value?: string | null) {
  if (!value) return;
  const normalized = value.trim();
  if (!normalized) return;
  const duplicate = collection.some((item) => normalizeForKey(item) === normalizeForKey(normalized));
  if (!duplicate) {
    collection.push(normalized);
  }
}

function compactTriggerDescription(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 92) return cleaned;
  return `${cleaned.slice(0, 89)}...`;
}

function buildOperations(calibrations: ScrubResult[]): OperationRow[] {
  const operationsMap = new Map<string, OperationRow>();

  calibrations.forEach((line) => {
    line.calibrationMatches.forEach((match) => {
      const rawProcedure = match.procedureName || match.repairOperation;
      const normalizedRepairOperation = canonicalizeOperationName(
        rawProcedure,
        match.systemName,
        match.matchedKeyword
      );
      const procedureType = canonicalizeProcedureType(match.procedureType);
      const calibrationType = canonicalizeCalibrationType(match.calibrationType);
      const normalizedSystem = canonicalizeSystem(match.systemName, normalizedRepairOperation);
      const procedureName = calibrationOperationForSystem(normalizedSystem, normalizedRepairOperation);
      const key = normalizeForKey(procedureName);

      const existing = operationsMap.get(key);
      if (!existing) {
        operationsMap.set(key, {
          procedureType,
          procedureName,
          calibrationType,
          systems: [normalizedSystem.label],
          triggerOperations: [normalizedRepairOperation],
          reasons: [match.reason],
          keywords: [match.matchedKeyword],
          locations: match.location ? [match.location] : [],
          toolsRequired: match.toolsRequired ? [...match.toolsRequired] : [],
          triggers: [
            {
              lineNumber: line.lineNumber,
              description: line.description,
            },
          ],
        });
        return;
      }

      existing.procedureType = pickHigherPriorityProcedureType(existing.procedureType, procedureType);
      existing.calibrationType = mergeCalibrationTypes([existing.calibrationType, calibrationType]);

      uniquePush(existing.systems, normalizedSystem.label);
      uniquePush(existing.triggerOperations, normalizedRepairOperation);
      uniquePush(existing.reasons, match.reason);
      uniquePush(existing.keywords, match.matchedKeyword);
      uniquePush(existing.locations, match.location);
      (match.toolsRequired || []).forEach((tool) => uniquePush(existing.toolsRequired, tool));

      const hasTrigger = existing.triggers.some(
        (trigger) =>
          trigger.lineNumber === line.lineNumber &&
          normalizeForKey(trigger.description) === normalizeForKey(line.description)
      );

      if (!hasTrigger) {
        existing.triggers.push({
          lineNumber: line.lineNumber,
          description: line.description,
        });
      }
    });
  });

  return Array.from(operationsMap.values())
    .map((operation) => ({
      ...operation,
      triggers: [...operation.triggers].sort((a, b) => a.lineNumber - b.lineNumber),
    }))
    .sort((a, b) => {
      const aLine = a.triggers[0]?.lineNumber || 0;
      const bLine = b.triggers[0]?.lineNumber || 0;
      return aLine - bLine;
    });
}

function formatDate(value: Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ReportDocument({ report, calibrations, adasSystems, vehicle, template }: ReportInput) {
  const operations = buildOperations(calibrations);
  const uniqueSystems = new Set<string>();
  const uniqueTriggerLines = new Set<number>();
  const referenceLabel = report.references?.roNumber ? "RO" : report.references?.poNumber ? "PO" : "Reference";
  const referenceValue = report.references?.roNumber || report.references?.poNumber || report.displayId;

  operations.forEach((operation) => {
    operation.systems.forEach((system) => uniqueSystems.add(system));
    operation.triggers.forEach((trigger) => uniqueTriggerLines.add(trigger.lineNumber));
  });

  const reportTitle = template === "work-order" ? "Work Order Submittal" : "Calibration Analysis";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{reportTitle} Report</Text>
          <Text style={styles.heroSubtitle}>
            {report.vehicleYear} {report.vehicleMake} {report.vehicleModel}
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaBlock}>
              <Text style={styles.heroMetaLabel}>{report.displayIdLabel}</Text>
              <Text style={styles.heroMetaValue}>{report.displayId}</Text>
            </View>
            <View style={styles.heroMetaBlock}>
              <Text style={styles.heroMetaLabel}>Generated</Text>
              <Text style={styles.heroMetaValue}>{formatDate(report.createdAt)}</Text>
            </View>
            <View style={styles.heroMetaBlock}>
              <Text style={styles.heroMetaLabel}>Shop</Text>
              <Text style={styles.heroMetaValue}>{report.shop.name}</Text>
            </View>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.gridCol}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Vehicle Profile</Text>
              <Text style={styles.keyValue}>Year: {report.vehicleYear}</Text>
              <Text style={styles.keyValue}>Make: {report.vehicleMake}</Text>
              <Text style={styles.keyValue}>Model: {report.vehicleModel}</Text>
              <Text style={styles.keyValue}>VIN: {report.vin || "Not detected"}</Text>
            </View>
          </View>
          <View style={styles.gridColLast}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Estimate References</Text>
              <Text style={styles.keyValue}>{referenceLabel}: {referenceValue}</Text>
              <Text style={styles.keyValue}>Claim: {report.metadata?.claimNumber || report.references?.claimNumber || "Not provided"}</Text>
              <Text style={styles.keyValue}>Policy: {report.metadata?.policyNumber || "Not provided"}</Text>
              <Text style={styles.keyValue}>Estimate Shop: {report.metadata?.shopName || report.shop.name || "Not detected"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.summary}>
          <Text style={styles.cardTitle}>Executive Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryMetricLabel}>Operations</Text>
              <Text style={styles.summaryMetricValue}>{operations.length}</Text>
            </View>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryMetricLabel}>Systems</Text>
              <Text style={styles.summaryMetricValue}>{uniqueSystems.size}</Text>
            </View>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryMetricLabel}>Trigger Lines</Text>
              <Text style={styles.summaryMetricValue}>{uniqueTriggerLines.size}</Text>
            </View>
          </View>
          {template === "work-order" ? (
            <Text style={styles.operationLine}>
              Prepared for insurer and calibration partner submittal with operation-level evidence.
            </Text>
          ) : (
            <Text style={styles.operationLine}>
              Estimate lines were scrubbed against mapped triggers, then deduplicated into operation-level recommendations.
            </Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Required Calibration Operations</Text>
        {operations.length === 0 ? (
          <View style={styles.compactBlock} wrap={false}>
            <Text style={styles.compactText}>No calibration operations were identified from the submitted estimate.</Text>
          </View>
        ) : (
          operations.map((operation, index) => (
            <View style={styles.operationCard} key={`${operation.procedureName}-${index}`} wrap={false}>
              <View style={styles.operationHeader}>
                <Text style={styles.operationTitle}>
                  {index + 1}. {operation.procedureName}
                </Text>
                <Text style={styles.operationSubtitle}>
                  {operation.procedureType} • Calibration Type: {operation.calibrationType}
                </Text>
              </View>

              <Text style={styles.operationLine}>Systems: {operation.systems.join(", ")}</Text>
              <Text style={styles.operationLine}>
                Triggering Repair Ops: {operation.triggerOperations.length ? operation.triggerOperations.join(" | ") : "Not captured"}
              </Text>
              <Text style={styles.operationLine}>
                Keywords Matched: {operation.keywords.length ? operation.keywords.join(", ") : "Not captured"}
              </Text>
              <Text style={styles.operationLine}>
                Location: {operation.locations.length ? operation.locations.join(" | ") : "Refer to OEM procedure"}
              </Text>
              <Text style={styles.operationLine}>
                Tools: {operation.toolsRequired.length ? operation.toolsRequired.join(", ") : "OEM scan tool + calibration setup"}
              </Text>

              <Text style={styles.evidenceTitle}>Estimate Lines Triggering This Calibration</Text>
              {operation.triggers.slice(0, 8).map((trigger) => (
                <Text key={`${operation.procedureName}-${trigger.lineNumber}`} style={styles.evidenceLine}>
                  - Line {trigger.lineNumber}: {compactTriggerDescription(trigger.description)}
                </Text>
              ))}
              {operation.triggers.length > 8 && (
                <Text style={styles.evidenceLine}>- +{operation.triggers.length - 8} additional trigger line(s)</Text>
              )}
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Detected ADAS Systems (Vehicle Mapping)</Text>
        <View style={styles.compactBlock} wrap={false}>
          <Text style={styles.compactText}>
            {adasSystems.length > 0
              ? adasSystems.map((system) => system.systemName).join(", ")
              : "No OEM ADAS system list available for the matched vehicle profile."}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Data Source</Text>
        <View style={styles.compactBlock} wrap={false}>
          <Text style={styles.compactText}>Provider: {vehicle?.sourceProvider || "OEM / industry documentation"}</Text>
          <Text style={styles.sourceLink}>{vehicle?.sourceUrl || "No source URL available for this vehicle map."}</Text>
        </View>

        <Text style={styles.footer}>
          Generated by ADAS Intelligence. Verify final calibration procedures against current OEM documentation before vehicle delivery.
        </Text>
      </Page>
    </Document>
  );
}

export async function createReportPdfBuffer(input: ReportInput): Promise<Buffer> {
  return renderToBuffer(<ReportDocument {...input} />);
}
