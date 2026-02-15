"use client";

import { DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowLeft,
  Car,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Loader2,
  PlusCircle,
  RefreshCw,
  Shield,
  ShieldAlert,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

interface AnalysisResults {
  reportId?: string;
  results: ScrubResult[];
  groupedCalibrations?: Array<{
    systemName: string;
    calibrationType: string | null;
    reason: string;
    repairOperation: string;
    matchedKeywords: string[];
    triggerLines: number[];
    triggerDescriptions: string[];
  }>;
  learnedRuleIdsApplied?: string[];
  detectedVehicle?: {
    year?: number;
    make?: string;
    model?: string;
    vin?: string;
    confidence?: "high" | "medium" | "low";
    source?: string;
  };
  analysisConfidence?: {
    score: number;
    label: "high" | "medium" | "low";
    reasons: string[];
  };
  estimateMetadata?: {
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
  estimateLines?: Array<{
    lineNumber: number;
    text: string;
  }>;
  rescrubSummary?: {
    changed?: boolean;
    inferredMergedCount: number;
    removedMatchCount: number;
    addedMatchCount: number;
  };
}

export default function ScrubPage() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get("reportId");
  const [estimateFile, setEstimateFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRescrubbing, setIsRescrubbing] = useState(false);
  const [isAutoRefining, setIsAutoRefining] = useState(false);
  const [autoRefined, setAutoRefined] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [estimateLines, setEstimateLines] = useState<Array<{ lineNumber: number; text: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [learningMsg, setLearningMsg] = useState<string | null>(null);
  const [manualKeyword, setManualKeyword] = useState("");
  const [manualSystem, setManualSystem] = useState("");
  const [manualCalibrationType, setManualCalibrationType] = useState("");
  const [manualReason, setManualReason] = useState("Manually confirmed operation from shop review.");
  const [editLineNumber, setEditLineNumber] = useState("");
  const [editSystemName, setEditSystemName] = useState("Steering Angle Sensor");
  const [editCalibrationType, setEditCalibrationType] = useState("Initialization");
  const [editRepairOperation, setEditRepairOperation] = useState("Steering Angle Sensor Reset/Relearn");
  const [editReason, setEditReason] = useState("Manually flagged by technician review.");

  const getEstimateReference = () => {
    return (
      results?.estimateMetadata?.roNumber ||
      results?.estimateMetadata?.poNumber ||
      results?.estimateMetadata?.workfileId
    );
  };

  const setFileFromList = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Only PDF estimates are supported.");
      return;
    }
    setError(null);
    setResults(null);
    setEstimateLines([]);
    setEstimateFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    setFileFromList(event.dataTransfer.files);
  };

  const handleAnalyze = async () => {
    if (!estimateFile) {
      setError("Drop a PDF estimate to continue.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResults(null);
    setLearningMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", estimateFile);

      const response = await fetch("/api/scrub", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = (await response.json()) as AnalysisResults;
      setResults(data);
      setEstimateLines(data.estimateLines || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze estimate");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadReport = useCallback(async (targetReportId: string) => {
    setIsAnalyzing(true);
    setError(null);
    setLearningMsg(null);

    try {
      const response = await fetch(`/api/reports/${targetReportId}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as AnalysisResults & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to load report");
      }
      setResults(data);
      setEstimateLines(data.estimateLines || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const rescrubReport = useCallback(
    async (
      payload: { add?: Array<Record<string, unknown>>; remove?: Array<Record<string, unknown>> },
      options?: { successMessage?: string; silent?: boolean }
    ) => {
      if (!reportId) {
        setError("Open a submitted job from dashboard before rescrubbing.");
        return null;
      }

      setIsRescrubbing(true);
      setError(null);
      if (!options?.silent) {
        setLearningMsg(null);
      }

      try {
        const response = await fetch(`/api/reports/${reportId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as AnalysisResults & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || "Failed to rescrub report");
        }

        setResults(data);
        setEstimateLines(data.estimateLines || []);
        if (!options?.silent && options?.successMessage) {
          setLearningMsg(options.successMessage);
        }
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rescrub report");
        return null;
      } finally {
        setIsRescrubbing(false);
      }
    },
    [reportId]
  );

  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;

    const run = async () => {
      setAutoRefined(false);
      await loadReport(reportId);
      if (cancelled) return;

      setIsAutoRefining(true);
      const data = await rescrubReport({}, { silent: true });
      if (cancelled) return;
      if (!data) {
        setIsAutoRefining(false);
        return;
      }

      if (data.rescrubSummary?.changed) {
        setLearningMsg("Auto-refine updated this job with additional calibration evidence.");
      } else {
        setLearningMsg("Auto-refine completed. No manual edits required unless you want overrides.");
      }
      setAutoRefined(true);
      setIsAutoRefining(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [reportId, loadReport, rescrubReport]);

  const addOperationAndRescrub = async () => {
    const lineNumber = Number.parseInt(editLineNumber, 10);
    if (!Number.isFinite(lineNumber) || lineNumber < 1) {
      setError("Enter a valid estimate line number.");
      return;
    }
    if (!editSystemName.trim()) {
      setError("System name is required to add an operation.");
      return;
    }

    const lineText = estimateLines.find((line) => line.lineNumber === lineNumber)?.text;

    await rescrubReport(
      {
        add: [
          {
            lineNumber,
            systemName: editSystemName,
            calibrationType: editCalibrationType || null,
            repairOperation: editRepairOperation || `${editSystemName} Calibration`,
            reason: editReason || "Manually flagged by technician review.",
            description: lineText,
          },
        ],
      },
      { successMessage: `Added operation on line ${lineNumber} and re-scrubbed this job.` }
    );
  };

  const handleManualRule = async () => {
    if (!results?.detectedVehicle?.make || !results?.detectedVehicle?.model || !results?.detectedVehicle?.year) {
      setError("Run analysis first so the system can scope the manual operation rule to the detected vehicle.");
      return;
    }
    if (!manualKeyword.trim() || !manualSystem.trim() || !manualReason.trim()) {
      setError("Keyword, system name, and reason are required.");
      return;
    }

    setError(null);
    setLearningMsg(null);

    const response = await fetch("/api/learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        make: results.detectedVehicle.make,
        model: results.detectedVehicle.model,
        yearStart: results.detectedVehicle.year,
        yearEnd: results.detectedVehicle.year,
        keyword: manualKeyword,
        systemName: manualSystem,
        calibrationType: manualCalibrationType || null,
        reason: manualReason,
        confidenceWeight: 0.85,
        reportId: results.reportId,
        estimateReference: getEstimateReference(),
        vehicleVin: results.detectedVehicle?.vin,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Failed to save manual rule");
      return;
    }

    setLearningMsg("Manual operation rule saved. Future scrubs will apply it automatically.");
    setManualKeyword("");
    setManualSystem("");
    setManualCalibrationType("");
  };

  const markFalsePositive = async (group: NonNullable<AnalysisResults["groupedCalibrations"]>[number]) => {
    if (!results?.detectedVehicle?.make || !results?.detectedVehicle?.model || !results?.detectedVehicle?.year) {
      setError("Vehicle detection is required before saving corrections.");
      return;
    }

    const keyword = group.matchedKeywords[0];
    if (!keyword) {
      setError("No matched keyword found for this recommendation.");
      return;
    }

    setError(null);
    setLearningMsg(null);

    const response = await fetch("/api/learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "suppress",
        make: results.detectedVehicle.make,
        model: results.detectedVehicle.model,
        yearStart: results.detectedVehicle.year,
        yearEnd: results.detectedVehicle.year,
        keyword,
        systemName: group.systemName,
        calibrationType: group.calibrationType || null,
        reason: "Marked false positive by shop reviewer.",
        confidenceWeight: 0.9,
        reportId: results.reportId,
        estimateReference: getEstimateReference(),
        vehicleVin: results.detectedVehicle?.vin,
        triggerLines: group.triggerLines,
        triggerDescriptions: group.triggerDescriptions.slice(0, 6),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Failed to save correction");
      return;
    }

    setLearningMsg(`Saved correction: suppress ${group.systemName} when keyword "${keyword}" appears for this vehicle.`);
  };

  const removeOperationAndRescrub = async (group: NonNullable<AnalysisResults["groupedCalibrations"]>[number]) => {
    await rescrubReport(
      {
        remove: [
          {
            repairOperation: group.repairOperation,
          },
        ],
      },
      { successMessage: `Removed ${group.repairOperation} and re-scrubbed this job.` }
    );
  };

  const calibrationCount = useMemo(
    () => results?.groupedCalibrations?.length || 0,
    [results]
  );

  const confidenceColor =
    results?.analysisConfidence?.label === "high"
      ? "bg-emerald-700 text-emerald-50 border-emerald-800"
      : results?.analysisConfidence?.label === "medium"
      ? "bg-amber-700 text-amber-50 border-amber-800"
      : "bg-rose-700 text-rose-50 border-rose-800";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-cyan-500/15">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ADAS Estimate Scrubber</h1>
          <p className="text-slate-600">
            {reportId
              ? "Submitted job opened. Auto-refine runs automatically and updates line-level calibrations."
              : "Drop one estimate PDF. Vehicle and ADAS calibration requirements are auto-detected."}
          </p>
        </div>
      </div>

      {reportId && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">
          Auto mode is active for report <span className="font-semibold">{reportId}</span>. The system re-evaluates the estimate and applies missing calibrations automatically.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-600" />
              Drag & Drop Estimate
            </CardTitle>
            <CardDescription>PDF-only intake. No manual vehicle input required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reportId ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <RefreshCw className={`h-8 w-8 text-cyan-600 ${isAutoRefining ? "animate-spin" : ""}`} />
                <p className="font-medium text-slate-900">
                  {isAutoRefining ? "Auto-refining submitted job..." : "Submitted estimate loaded from report record"}
                </p>
                <p className="text-xs text-slate-500">
                  No manual upload needed. Use auto-refine to refresh calibrations from stored estimate lines.
                </p>
              </div>
            ) : (
              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  isDragActive
                    ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                    : "border-cyan-300 bg-cyan-50/50 text-slate-700 hover:border-cyan-500"
                }`}
              >
                <Upload className="w-8 h-8" />
                <div>
                  <p className="font-medium">{estimateFile ? estimateFile.name : "Drop PDF Here"}</p>
                  <p className="text-xs text-slate-500 mt-1">or click to browse your estimate file</p>
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFileFromList(e.target.files)}
                />
              </label>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {learningMsg && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{learningMsg}</span>
              </div>
            )}

            {!reportId && (
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !estimateFile}
                className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running ADAS analysis...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <FileSearch className="w-4 h-4" />
                    Analyze Estimate
                  </span>
                )}
              </Button>
            )}

            {reportId && (
              <Button
                type="button"
                onClick={() =>
                  void rescrubReport(
                    {},
                    { successMessage: "Auto-refine rerun completed with latest logic." }
                  )
                }
                disabled={isRescrubbing || isAnalyzing || isAutoRefining}
                variant="outline"
                className="w-full h-11 border-slate-300 text-slate-700"
              >
                {isRescrubbing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running auto-refine...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Run Auto-Refine Again
                  </span>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-cyan-600" />
              Analysis Output
            </CardTitle>
            <CardDescription>Detected vehicle profile and line-level calibration advisories</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!results ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 py-16 text-center">
                <div className="p-4 rounded-full bg-slate-100 mb-4">
                  <Car className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-700">No analysis yet</p>
                <p className="text-sm text-slate-500">Upload one estimate to generate ADAS calibration guidance</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-slate-900 font-medium">
                        {results.detectedVehicle?.year || "Unknown"} {results.detectedVehicle?.make || "Unknown"} {results.detectedVehicle?.model || "Unknown"}
                      </p>
                      <p className="text-xs text-slate-500">VIN: {results.detectedVehicle?.vin || "Not detected"}</p>
                    </div>
                    <Badge className={calibrationCount > 0 ? "bg-amber-700 text-amber-50 border-amber-800 shadow-sm" : "bg-emerald-700 text-emerald-50 border-emerald-800 shadow-sm"}>
                      {calibrationCount} Calibration{calibrationCount !== 1 ? "s" : ""} Recommended
                    </Badge>
                  </div>
                  {results.analysisConfidence && (
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="w-4 h-4 text-cyan-700" />
                      <Badge className={confidenceColor}>Confidence {results.analysisConfidence.score}%</Badge>
                    </div>
                  )}
                </div>

                {results.estimateMetadata && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Estimate Metadata</p>
                    <div className="grid gap-2 sm:grid-cols-2 text-sm text-slate-700">
                      <p>Shop: {results.estimateMetadata.shopName || "Not detected"}</p>
                      <p>Carrier: {results.estimateMetadata.insuranceCompany || "Not detected"}</p>
                      <p>Claim: {results.estimateMetadata.claimNumber || "Not detected"}</p>
                      <p>Policy: {results.estimateMetadata.policyNumber || "Not detected"}</p>
                      <p>RO: {results.estimateMetadata.roNumber || "Not detected"}</p>
                      <p>PO: {results.estimateMetadata.poNumber || "Not detected"}</p>
                      <p>Workfile: {results.estimateMetadata.workfileId || "Not detected"}</p>
                      <p>Loss Date: {results.estimateMetadata.lossDate || "Not detected"}</p>
                    </div>
                  </div>
                )}

                {results.analysisConfidence?.reasons && results.analysisConfidence.reasons.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Confidence Drivers</p>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {results.analysisConfidence.reasons.map((reason) => (
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Separator className="bg-border/70" />

                {calibrationCount === 0 ? (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-slate-900 font-medium">No immediate ADAS calibration triggers detected</p>
                      <p className="text-sm text-emerald-700">Verify against OEM procedures if structural or sensor-area repairs are present</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-auto pr-1">
                    {(results.groupedCalibrations || []).map((group) => (
                        <div key={`${group.systemName}-${group.repairOperation}`} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                          <div>
                            <p className="text-slate-900 font-medium">{group.systemName}</p>
                            <p className="text-xs text-slate-500">Triggered by lines: {group.triggerLines.join(", ")}</p>
                          </div>
                          <div className="space-y-2">
                              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-sm text-amber-900">{group.reason}</p>
                                  <p className="text-xs text-amber-700 mt-1">Operation: {group.repairOperation}</p>
                                  <p className="text-xs text-amber-700 mt-1">Keywords: {group.matchedKeywords.join(", ")}</p>
                                  {group.calibrationType && (
                                    <Badge className="mt-2 bg-white text-slate-700 border-slate-300">
                                      {group.calibrationType} Calibration
                                    </Badge>
                                  )}
                                </div>
                              </div>
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 border-red-300 text-red-700 hover:bg-red-50"
                                onClick={() => markFalsePositive(group)}
                              >
                                <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                                Mark False Positive
                              </Button>
                              {reportId && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-slate-300 text-slate-700 hover:bg-slate-100"
                                  onClick={() => void removeOperationAndRescrub(group)}
                                  disabled={isRescrubbing}
                                >
                                  Remove Operation + Rescrub
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                <Separator className="bg-border/70" />

                {reportId && (
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Auto Job Refinement</p>
                        <p className="text-xs text-slate-600">
                          The system auto-refines calibrations from estimate lines without technician scrubbing.
                        </p>
                      </div>
                      <Badge className="bg-white text-slate-700 border-slate-300">
                        {isAutoRefining
                          ? "Auto-refining..."
                          : autoRefined
                          ? "Auto-refine complete"
                          : "Auto-refine pending"}
                      </Badge>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      className="bg-cyan-600 hover:bg-cyan-500 text-white w-fit"
                      onClick={() =>
                        void rescrubReport(
                          {},
                          { successMessage: "Auto-refine rerun completed with latest logic." }
                        )
                      }
                      disabled={isRescrubbing || isAutoRefining}
                    >
                      {isRescrubbing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                      Run Auto-Refine
                    </Button>

                    {results?.rescrubSummary && (
                      <p className="text-xs text-slate-600">
                        Auto summary: {results.rescrubSummary.changed ? "updated" : "no change"}, inferred {results.rescrubSummary.inferredMergedCount}, removed {results.rescrubSummary.removedMatchCount}, added {results.rescrubSummary.addedMatchCount}.
                      </p>
                    )}

                    {estimateLines.length > 0 && (
                      <details className="rounded-lg border border-slate-200 bg-white p-3">
                        <summary className="cursor-pointer text-sm font-medium text-slate-800">
                          Estimate lines ({estimateLines.length})
                        </summary>
                        <div className="mt-2 max-h-52 overflow-auto space-y-1 text-xs text-slate-600">
                          {estimateLines.slice(0, 220).map((line) => (
                            <p key={`${line.lineNumber}-${line.text}`}>
                              <span className="font-semibold text-slate-800">Line {line.lineNumber}:</span> {line.text}
                            </p>
                          ))}
                        </div>
                      </details>
                    )}

                    <details className="rounded-lg border border-slate-200 bg-white p-3">
                      <summary className="cursor-pointer text-sm font-medium text-slate-800">
                        Advanced Manual Override (Optional)
                      </summary>
                      <div className="mt-3 space-y-3">
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            value={editLineNumber}
                            onChange={(e) => setEditLineNumber(e.target.value)}
                            placeholder="Estimate line number (e.g., 60)"
                            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                          />
                          <input
                            value={editSystemName}
                            onChange={(e) => setEditSystemName(e.target.value)}
                            placeholder="System name"
                            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                          />
                          <input
                            value={editCalibrationType}
                            onChange={(e) => setEditCalibrationType(e.target.value)}
                            placeholder="Calibration type"
                            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                          />
                          <input
                            value={editRepairOperation}
                            onChange={(e) => setEditRepairOperation(e.target.value)}
                            placeholder="Calibration operation label"
                            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                          />
                          <input
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            placeholder="Reason"
                            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm md:col-span-2"
                          />
                        </div>

                        {editLineNumber && (
                          <p className="text-xs text-slate-600">
                            Line text:{" "}
                            {estimateLines.find((line) => line.lineNumber === Number.parseInt(editLineNumber, 10))?.text ||
                              "Not found in extracted estimate lines"}
                          </p>
                        )}

                        <Button
                          type="button"
                          size="sm"
                          className="bg-cyan-600 hover:bg-cyan-500 text-white"
                          onClick={() => void addOperationAndRescrub()}
                          disabled={isRescrubbing}
                        >
                          {isRescrubbing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5 mr-1.5" />}
                          Add Operation + Rescrub
                        </Button>
                      </div>
                    </details>
                  </div>
                )}

                {reportId && <Separator className="bg-border/70" />}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Teach Analyzer</p>
                    <p className="text-xs text-slate-600">Add manual operation-to-calibration rules for this vehicle profile.</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      value={manualKeyword}
                      onChange={(e) => setManualKeyword(e.target.value)}
                      placeholder="Operation keyword (e.g., front bumper)"
                      className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                    />
                    <input
                      value={manualSystem}
                      onChange={(e) => setManualSystem(e.target.value)}
                      placeholder="ADAS system (e.g., Front Radar / ACC-AEB)"
                      className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                    />
                    <input
                      value={manualCalibrationType}
                      onChange={(e) => setManualCalibrationType(e.target.value)}
                      placeholder="Calibration type (optional)"
                      className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                    />
                    <input
                      value={manualReason}
                      onChange={(e) => setManualReason(e.target.value)}
                      placeholder="Reason"
                      className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                    />
                  </div>
                  <Button type="button" size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white" onClick={handleManualRule}>
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                    Save Manual Operation Rule
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
