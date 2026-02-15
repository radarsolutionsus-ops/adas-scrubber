"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSearch,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { BillingActions } from "@/components/dashboard/billing-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const REPORT_FILTER_STORAGE_KEY = "adas-dashboard-report-filter-v1";

const STATUS_LABELS: Record<string, string> = {
  NEW_INTAKE: "New Intake",
  IN_REVIEW: "In Review",
  NEEDS_CORRECTION: "Needs Correction",
  READY_TO_SUBMIT: "Ready to Submit",
  SUBMITTED: "Submitted",
};

interface QueueItem {
  id: string;
  reference: string;
  referenceLabel: string;
  vehicle: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  owner: string;
  dueAt: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  slaMinutes: number;
  overdue: boolean;
  completeness: {
    score: number;
    readyForSubmission: boolean;
    missing: string[];
    checks: Array<{ id: string; label: string; weight: number; passed: boolean }>;
    triggerLineCount: number;
  };
  calibrationCount: number;
  groupedCalibrations: Array<{
    systemName: string;
    operations: string[];
    triggerLines: number[];
    triggerDescriptions: string[];
    calibrationType: string;
  }>;
  reportLinks: {
    standard: string;
    workOrder: string;
  };
}

interface DashboardData {
  shop: {
    id: string;
    name: string;
    plan: string;
    subscriptionActive: boolean;
    monthlyVehicleLimit: number;
  };
  executiveMetrics: {
    monthlyUsed: number;
    monthlyLimit: number;
    monthlyRemaining: number;
    lifetimeScrubs: number;
    calibrationHitRate: number;
    averageCompleteness: number;
    averageTurnaroundHours: number;
    queueByStatus: Record<string, number>;
    resetMode: "calendar" | "billing";
    windowStart: string;
  };
  queue: QueueItem[];
  correctionInbox: {
    pending: Array<{
      id: string;
      action: "add" | "suppress";
      systemName: string;
      keyword: string;
      reason: string;
      createdAt: string;
      reviewStatus: "pending" | "approved" | "rejected";
      reportId?: string;
      impactCount: number;
    }>;
    falsePositiveRate: number;
    trend: Array<{ week: string; add: number; suppress: number; reviewed: number }>;
    totalRecent: number;
    approvedRecent: number;
    rejectedRecent: number;
  };
  packetCenter: QueueItem[];
  oemCoverage: {
    byMake: Array<{
      make: string;
      modelCount: number;
      sourceLinkedCount: number;
      staleCount: number;
      freshnessDays: number;
    }>;
    requiredBrands: string[];
    missingBrands: string[];
    coveragePercent: number;
  };
}

function statusBadgeClass(status: string) {
  if (status === "SUBMITTED") return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (status === "READY_TO_SUBMIT") return "bg-cyan-100 text-cyan-700 border-cyan-300";
  if (status === "NEEDS_CORRECTION") return "bg-rose-100 text-rose-700 border-rose-300";
  if (status === "IN_REVIEW") return "bg-amber-100 text-amber-700 border-amber-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function priorityBadgeClass(priority: QueueItem["priority"]) {
  if (priority === "CRITICAL") return "bg-rose-700 text-white";
  if (priority === "HIGH") return "bg-amber-600 text-white";
  if (priority === "MEDIUM") return "bg-slate-700 text-white";
  return "bg-slate-200 text-slate-700";
}

export function PremiumDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("reports");
  const [reportSearch, setReportSearch] = useState("");
  const [expandedReportDetails, setExpandedReportDetails] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem(REPORT_FILTER_STORAGE_KEY);
    if (saved) {
      setReportSearch(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(REPORT_FILTER_STORAGE_KEY, reportSearch);
  }, [reportSearch]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const payload = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load dashboard");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const reviewCorrection = useCallback(
    async (eventId: string, reviewStatus: "approved" | "rejected") => {
      setActionBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/learning", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ eventId, reviewStatus }),
        });

        const result = (await response.json()) as { success?: boolean; error?: string };
        if (!response.ok) {
          throw new Error(result.error || "Failed to review correction");
        }

        await loadDashboard();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to review correction");
      } finally {
        setActionBusy(false);
      }
    },
    [loadDashboard]
  );

  const reports = useMemo(() => {
    if (!data) return [];
    return data.queue.filter((item) => {
      if (!reportSearch.trim()) return true;
      const haystack = `${item.referenceLabel} ${item.reference} ${item.vehicle} ${item.status}`.toLowerCase();
      return haystack.includes(reportSearch.toLowerCase());
    });
  }, [data, reportSearch]);

  const latestReport = reports[0] || null;

  const toggleReportDetails = useCallback((reportId: string) => {
    setExpandedReportDetails((prev) => ({
      ...prev,
      [reportId]: !prev[reportId],
    }));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="h-6 w-72 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-100" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="border-slate-200 bg-white">
              <CardContent className="p-5 space-y-3">
                <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-20 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        Failed to load dashboard data. {error || "Please refresh and try again."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-amber-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200">Report Center</Badge>
            <h1 className="mt-2 text-2xl md:text-3xl font-bold text-slate-900">
              {data.shop.name} Dashboard
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Quick access to reports, correction reviews, submission packets, and OEM coverage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="border-slate-300 text-slate-700" onClick={() => void loadDashboard()}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Link href="/scrub">
              <Button className="bg-cyan-600 hover:bg-cyan-500 text-white">
                <UploadCloud className="w-4 h-4 mr-1" />
                New Scrub
              </Button>
            </Link>
            {latestReport && (
              <a href={latestReport.reportLinks.standard} target="_blank" rel="noreferrer">
                <Button className="bg-amber-500 hover:bg-amber-400 text-white">
                  <FileSearch className="w-4 h-4 mr-1" />
                  Latest PDF
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-2">
            <CardDescription>Monthly Usage</CardDescription>
            <CardTitle className="text-2xl">{data.executiveMetrics.monthlyUsed} / {data.executiveMetrics.monthlyLimit}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              {data.executiveMetrics.monthlyRemaining} remaining · Lifetime {data.executiveMetrics.lifetimeScrubs}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-2">
            <CardDescription>Calibration Hit Rate</CardDescription>
            <CardTitle className="text-2xl">{data.executiveMetrics.calibrationHitRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Based on retained report history.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-2">
            <CardDescription>Average Completeness</CardDescription>
            <CardTitle className="text-2xl">{data.executiveMetrics.averageCompleteness}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Readiness threshold is 85%.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-2">
            <CardDescription>False Positive Rate</CardDescription>
            <CardTitle className="text-2xl">{data.correctionInbox.falsePositiveRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">From recent correction events.</p>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-slate-900">Billing & Subscription</p>
            <p className="text-xs text-slate-500">
              Plan: <span className="uppercase">{data.shop.plan}</span> · Status: {data.shop.subscriptionActive ? "Active" : "Inactive"}
            </p>
          </div>
          <BillingActions hasActiveSubscription={Boolean(data.shop.subscriptionActive)} />
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line" className="w-full justify-start overflow-auto">
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="corrections">Corrections</TabsTrigger>
          <TabsTrigger value="oem">OEM Coverage</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-slate-900 flex items-center gap-2">
                <FileSearch className="w-5 h-5 text-cyan-600" />
                PDF Reports
              </CardTitle>
              <CardDescription>
                Every scrub report is listed here. Open standard or work-order PDF directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  value={reportSearch}
                  onChange={(event) => setReportSearch(event.target.value)}
                  placeholder="Search by RO/PO, report id, or vehicle"
                />
              </div>

              {reports.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  No reports found. Run a scrub to generate your first PDF report.
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.referenceLabel}: {item.reference}
                          </p>
                          <p className="text-sm text-slate-600">{item.vehicle}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge className={statusBadgeClass(item.status)}>
                              {STATUS_LABELS[item.status] || item.status}
                            </Badge>
                            <Badge className={priorityBadgeClass(item.priority)}>{item.priority}</Badge>
                            <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                              Completeness {item.completeness.score}%
                            </Badge>
                            <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                              {item.calibrationCount} calibration{item.calibrationCount === 1 ? "" : "s"}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <a href={item.reportLinks.standard} target="_blank" rel="noreferrer">
                            <Button size="sm" className="bg-cyan-600 text-white hover:bg-cyan-500">
                              <FileSearch className="w-3.5 h-3.5 mr-1" />
                              View PDF Report
                            </Button>
                          </a>
                          <a href={item.reportLinks.workOrder} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="border-slate-300 text-slate-700">
                              <Download className="w-3.5 h-3.5 mr-1" />
                              Work Order PDF
                            </Button>
                          </a>
                          <Link href={`/scrub?reportId=${item.id}`}>
                            <Button size="sm" variant="ghost" className="text-slate-600">
                              <ExternalLink className="w-3.5 h-3.5 mr-1" />
                              Open Job
                            </Button>
                          </Link>
                        </div>
                      </div>

                      {item.completeness.missing.length > 0 && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs text-amber-700 hover:bg-amber-50"
                            onClick={() => toggleReportDetails(item.id)}
                          >
                            {expandedReportDetails[item.id] ? (
                              <>
                                <ChevronUp className="mr-1 h-3.5 w-3.5" />
                                Hide details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="mr-1 h-3.5 w-3.5" />
                                View details
                              </>
                            )}
                          </Button>

                          {expandedReportDetails[item.id] && (
                            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                              Missing for submission: {item.completeness.missing.join("; ")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="corrections" className="space-y-4">
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-600" />
                Correction Inbox
              </CardTitle>
              <CardDescription>
                Approve or reject pending correction events to improve future scrub quality.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.correctionInbox.pending.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  No pending corrections.
                </div>
              ) : (
                data.correctionInbox.pending.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.action === "suppress" ? "Suppress" : "Add"} · {item.systemName}
                        </p>
                        <p className="text-sm text-slate-600">Keyword: {item.keyword}</p>
                        <p className="text-xs text-slate-500 mt-1">{item.reason}</p>
                        <p className="text-xs text-cyan-700 mt-1">Impact preview: ~{item.impactCount} similar report(s)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-500"
                          disabled={actionBusy}
                          onClick={() => void reviewCorrection(item.id, "approved")}
                        >
                          {actionBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-rose-300 text-rose-700 hover:bg-rose-50"
                          disabled={actionBusy}
                          onClick={() => void reviewCorrection(item.id, "rejected")}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-600" />
                Weekly Learning Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-7">
                {data.correctionInbox.trend.map((week) => (
                  <div key={week.week} className="rounded-lg border border-slate-200 p-2 bg-slate-50">
                    <p className="text-[11px] text-slate-500">{week.week.slice(5)}</p>
                    <p className="text-xs text-slate-700">Add: {week.add}</p>
                    <p className="text-xs text-slate-700">Suppress: {week.suppress}</p>
                    <p className="text-xs text-slate-700">Reviewed: {week.reviewed}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oem" className="space-y-4">
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-600" />
                OEM Coverage & Freshness
              </CardTitle>
              <CardDescription>
                Track coverage across required brands and data freshness by make.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Coverage</p>
                  <p className="text-2xl font-semibold text-slate-900">{data.oemCoverage.coveragePercent}%</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Tracked Makes</p>
                  <p className="text-2xl font-semibold text-slate-900">{data.oemCoverage.byMake.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Missing Required Brands</p>
                  <p className="text-2xl font-semibold text-slate-900">{data.oemCoverage.missingBrands.length}</p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Missing Brands</p>
                <div className="flex flex-wrap gap-2">
                  {data.oemCoverage.missingBrands.length === 0 ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">No gaps</Badge>
                  ) : (
                    data.oemCoverage.missingBrands.map((brand) => (
                      <Badge key={brand} className="bg-rose-100 text-rose-700 border-rose-300">
                        {brand}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-5 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                  <span>Make</span>
                  <span>Models</span>
                  <span>Linked Sources</span>
                  <span>Stale Entries</span>
                  <span>Freshness</span>
                </div>
                {data.oemCoverage.byMake.map((row) => (
                  <div key={row.make} className="grid grid-cols-5 px-3 py-2 text-xs border-t border-slate-100 text-slate-700">
                    <span>{row.make}</span>
                    <span>{row.modelCount}</span>
                    <span>{row.sourceLinkedCount}</span>
                    <span>{row.staleCount}</span>
                    <span>{row.freshnessDays}d</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
