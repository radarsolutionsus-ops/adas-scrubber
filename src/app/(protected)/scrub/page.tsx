"use client";

import { DragEvent, useMemo, useState } from "react";
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
  Shield,
  ShieldAlert,
  Upload,
} from "lucide-react";
import Link from "next/link";

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
}

export default function ScrubPage() {
  const [estimateFile, setEstimateFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [learningMsg, setLearningMsg] = useState<string | null>(null);
  const [manualKeyword, setManualKeyword] = useState("");
  const [manualSystem, setManualSystem] = useState("");
  const [manualCalibrationType, setManualCalibrationType] = useState("");
  const [manualReason, setManualReason] = useState("Manually confirmed operation from shop review.");

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze estimate");
    } finally {
      setIsAnalyzing(false);
    }
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
          <p className="text-slate-600">Drop one estimate PDF. Vehicle and ADAS calibration requirements are auto-detected.</p>
        </div>
      </div>

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
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                <Separator className="bg-border/70" />

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
