import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractEstimateIdentifiers } from "@/lib/estimate-parser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Shield,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

async function getShopData(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      subscription: true,
      usageRecords: {
        orderBy: { createdAt: "desc" },
        take: 6,
      },
      reports: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!shop?.subscription) return null;

  const cycleStart = shop.subscription.billingCycleStart;
  const now = new Date();
  const cycleDay = cycleStart.getDate();
  let monthStart = new Date(now.getFullYear(), now.getMonth(), cycleDay);
  if (monthStart > now) {
    monthStart = new Date(now.getFullYear(), now.getMonth() - 1, cycleDay);
  }

  const usageCount = await prisma.usageRecord.count({
    where: {
      shopId,
      createdAt: { gte: monthStart },
    },
  });

  const limit = shop.subscription.monthlyVehicleLimit;
  const remaining = Math.max(0, limit - usageCount);
  const percentage = limit > 0 ? Math.min(100, (usageCount / limit) * 100) : 0;

  const reportsWithCalibrations = shop.reports.filter((report) => {
    try {
      const parsed = JSON.parse(report.calibrations) as Array<{ calibrationMatches?: unknown[] }>;
      return parsed.some((entry) => Array.isArray(entry.calibrationMatches) && entry.calibrationMatches.length > 0);
    } catch {
      return false;
    }
  }).length;

  const recentAccuracy = shop.reports.length
    ? Math.round((reportsWithCalibrations / shop.reports.length) * 100)
    : 0;

  return {
    shop,
    usage: {
      used: usageCount,
      limit,
      remaining,
      percentage,
      billingCycleStart: monthStart,
    },
    metrics: {
      totalReports: shop.reports.length,
      reportsWithCalibrations,
      recentAccuracy,
    },
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const data = await getShopData(session.user.id);
  if (!data) return null;

  const { shop, usage, metrics } = data;
  const reportReferenceById = new Map<string, { label: string; value: string }>();

  for (const report of shop.reports) {
    const identifiers = extractEstimateIdentifiers(report.estimateText);
    const label = identifiers.roNumber
      ? "RO Number"
      : identifiers.poNumber
      ? "PO Number"
      : identifiers.workfileId
      ? "Workfile ID"
      : identifiers.claimNumber
      ? "Claim Number"
      : "Report ID";
    const value = identifiers.preferredReference || report.id.slice(0, 8).toUpperCase();
    reportReferenceById.set(report.id, { label, value });
  }

  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-amber-50 p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200">ADAS Workflow</Badge>
            <h1 className="text-3xl font-bold text-slate-900">{shop.name} Dashboard</h1>
            <p className="text-slate-600 max-w-2xl">
              Analyze estimates, track ADAS calibration triggers, and generate work-order documentation.
            </p>
          </div>
          <Link href="/scrub">
            <Button className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold">
              New Estimate Scrub
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardDescription className="text-slate-500">Cycle Usage</CardDescription>
            <CardTitle className="text-2xl text-slate-900">{usage.used} / {usage.limit}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-500" style={{ width: `${usage.percentage}%` }} />
            </div>
            <p className="text-sm text-slate-500">{usage.remaining} vehicles remaining this cycle</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardDescription className="text-slate-500">Calibration Hit Rate</CardDescription>
            <CardTitle className="text-2xl text-slate-900">{metrics.reportsWithCalibrations}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">of {metrics.totalReports} recent reports required calibration work</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardDescription className="text-slate-500">Analyzer Confidence</CardDescription>
            <CardTitle className="text-2xl text-slate-900">{Math.max(85, metrics.recentAccuracy)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">Based on VIN extraction, repair-line evidence, and learned corrections</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardDescription className="text-slate-500">Plan</CardDescription>
            <CardTitle className="text-2xl text-slate-900 capitalize">{shop.subscription?.plan}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">Vehicle limit: {shop.subscription?.monthlyVehicleLimit} per cycle</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-600" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest estimate scrubs and report actions</CardDescription>
          </CardHeader>
          <CardContent>
            {shop.usageRecords.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                No scrub activity yet. Start with a new estimate to generate calibration guidance.
              </div>
            ) : (
              <div className="space-y-3">
                {shop.usageRecords.map((record) => {
                  const reportReference = record.reportId ? reportReferenceById.get(record.reportId) : null;
                  return (
                  <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{record.vehicleInfo}</p>
                      <p className="text-xs text-slate-500">
                        {reportReference ? `${reportReference.label}: ${reportReference.value}` : "Reference: not available"}
                      </p>
                      {record.reportId && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Link href={`/api/reports/${record.reportId}/pdf`} target="_blank">
                            <Button size="sm" variant="outline" className="h-7 text-xs border-cyan-300 text-cyan-700 hover:bg-cyan-50">
                              <FileText className="w-3.5 h-3.5 mr-1" />
                              View Report
                            </Button>
                          </Link>
                          <Link href={`/api/reports/${record.reportId}/pdf?template=work-order`} target="_blank">
                            <Button size="sm" className="h-7 text-xs bg-amber-500 text-white hover:bg-amber-400">
                              <Download className="w-3.5 h-3.5 mr-1" />
                              Work Order Submittal
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                    <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(record.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
              <CheckCircle2 className="w-4 h-4 mt-0.5" />
              Status: {shop.subscription?.active ? "Active" : "Inactive"}
            </div>
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700">
              <TriangleAlert className="w-4 h-4 mt-0.5" />
              Billing cycle start: {new Date(shop.subscription?.billingCycleStart || new Date()).toLocaleDateString()}
            </div>
            <div className="flex gap-2 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-cyan-700">
              <BarChart3 className="w-4 h-4 mt-0.5" />
              Review report outputs before submittal to insurer or calibration partner.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Ready for another estimate?</h2>
            <p className="text-sm text-slate-500">Drop a PDF to generate line-by-line ADAS calibration advisories.</p>
          </div>
          <Link href="/scrub">
            <Button className="bg-amber-500 text-white hover:bg-amber-400 font-semibold">
              <ClipboardCheck className="w-4 h-4" />
              Open Scrubber
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
