"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface Vehicle {
  id: string;
  yearStart: number;
  yearEnd: number;
  make: string;
  model: string;
  sourceProvider?: string;
  sourceUrl?: string;
}

interface DetectedVehicle {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  vin?: string;
  confidence?: 'high' | 'medium' | 'low';
  source?: 'vin_api' | 'vin_partial' | 'text' | 'combined';
}

interface AdasFeatures {
  forwardCollisionWarning?: boolean;
  laneDepartureWarning?: boolean;
  blindSpotMonitoring?: boolean;
  adaptiveCruiseControl?: boolean;
  parkingAssist?: boolean;
  rearCrossTraffic?: boolean;
  automaticEmergencyBraking?: boolean;
  laneKeepAssist?: boolean;
  backupCamera?: boolean;
  surroundViewCamera?: boolean;
}

interface AdasPartInEstimate {
  system: string;
  description: string;
  lineNumbers: number[];
}

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

interface DetectedRepair {
  lineNumber: number;
  description: string;
  repairType: string;
}

interface Shop {
  id: string;
  name: string;
  email: string;
  subscription: {
    monthlyVehicleLimit: number;
    pricePerMonth: number;
    overagePrice: number;
  };
  usage?: {
    used: number;
    limit: number;
    remaining: number;
    overage: number;
    overageCharge: number;
  };
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function UploadIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function DocumentIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function CarIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  );
}

export default function Home() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [estimateText, setEstimateText] = useState("");
  const [scrubResults, setScrubResults] = useState<ScrubResult[]>([]);
  const [vehicleSource, setVehicleSource] = useState<Vehicle | null>(null);
  const [detectedVehicle, setDetectedVehicle] = useState<DetectedVehicle | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [detectedRepairs, setDetectedRepairs] = useState<DetectedRepair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState<"pdf" | "text">("pdf");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [estimateFormat, setEstimateFormat] = useState<string | null>(null);
  const [adasFeaturesFromVIN, setAdasFeaturesFromVIN] = useState<AdasFeatures | null>(null);
  const [adasPartsInEstimate, setAdasPartsInEstimate] = useState<AdasPartInEstimate[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => { if (data.shop) setShop(data.shop); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch("/api/vehicles")
      .then((res) => res.json())
      .then((data) => {
        setVehicles(data.vehicles || []);
      })
      .catch(console.error);
  }, []);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((v, k) => { data[k] = v.toString(); });

    try {
      const res = await fetch(`/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        setAuthError(result.error || "Authentication failed");
      } else {
        const meRes = await fetch("/api/auth/me");
        const meData = await meRes.json();
        if (meData.shop) setShop(meData.shop);
      }
    } catch {
      setAuthError("Network error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setShop(null);
    setScrubResults([]);
    setReportId(null);
    setDetectedVehicle(null);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type === "application/pdf") setSelectedFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
  };

  const handleAnalyze = async () => {
    if (inputMode === "text" && !estimateText.trim()) return;
    if (inputMode === "pdf" && !selectedFile) return;

    setIsLoading(true);
    setScrubResults([]);
    setReportId(null);
    setDetectedVehicle(null);
    setVehicleSource(null);
    setDetectedRepairs([]);
    setEstimateFormat(null);
    setAdasFeaturesFromVIN(null);
    setAdasPartsInEstimate([]);

    try {
      let response;
      if (inputMode === "pdf" && selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        response = await fetch("/api/scrub", { method: "POST", body: formData });
      } else {
        response = await fetch("/api/scrub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estimateText }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Analysis failed");
        return;
      }

      setScrubResults(data.results || []);
      setVehicleSource(data.vehicle);
      setDetectedVehicle(data.detectedVehicle);
      setReportId(data.reportId);
      setDetectedRepairs(data.detectedRepairs || []);
      // Enhanced data
      setEstimateFormat(data.estimateFormat || null);
      setAdasFeaturesFromVIN(data.adasFeaturesFromVIN || null);
      setAdasPartsInEstimate(data.adasPartsInEstimate || []);

      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (meData.shop) setShop(meData.shop);
    } catch {
      alert("Analysis failed");
    } finally {
      setIsLoading(false);
    }
  };

  const sampleEstimate = `2024 Toyota Camry
VIN: 4T1BF1FK5EU123456

R&I Front Bumper Cover
Replace Windshield
R&I Left Side Mirror Assembly
Repair Front Bumper Reinforcement
Replace Hood
Blend Left Fender
R&R Front Radar Sensor
Align Front End`;

  // Auth screen
  if (!shop) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
          {/* Radial gradient overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.1),transparent_50%)]" />
        </div>

        <div className="relative z-10 min-h-screen flex">
          {/* Left side - Branding */}
          <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12">
            <div className="max-w-md">
              {/* Logo Icon */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/25">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>

              <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
                Estimate<br />
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Scrubber</span>
              </h1>

              <p className="text-xl text-slate-400 mb-12 leading-relaxed">
                Intelligent ADAS calibration detection for collision repair estimates.
              </p>

              {/* Feature list */}
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">VIN Decoding</h3>
                    <p className="text-slate-400 text-sm">Automatic vehicle identification via NHTSA API</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">PDF Processing</h3>
                    <p className="text-slate-400 text-sm">CCC ONE, Mitchell, and Audatex support</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">OEM Data</h3>
                    <p className="text-slate-400 text-sm">Position statements from 30+ manufacturers</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Auth Form */}
          <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
            <div className="w-full max-w-md">
              {/* Mobile logo */}
              <div className="lg:hidden text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/25">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-white">Estimate Scrubber</h1>
                <p className="text-slate-400 text-sm mt-1">ADAS Calibration Analysis</p>
              </div>

              {/* Auth Card */}
              <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800/50 p-8 shadow-2xl">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white">
                    {authMode === "login" ? "Welcome back" : "Get started"}
                  </h2>
                  <p className="text-slate-400 mt-2 text-sm">
                    {authMode === "login"
                      ? "Sign in to access your dashboard"
                      : "Create your account to start analyzing estimates"}
                  </p>
                </div>

                <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as "login" | "register")} className="mb-6">
                  <TabsList className="w-full bg-slate-800/50 p-1 rounded-xl">
                    <TabsTrigger
                      value="login"
                      className="flex-1 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
                    >
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger
                      value="register"
                      className="flex-1 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
                    >
                      Register
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <form onSubmit={handleAuth} className="space-y-5">
                  {authMode === "register" && (
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-slate-300 text-sm font-medium">Shop Name</Label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        required
                        placeholder="Acme Auto Body"
                        className="h-12 bg-slate-800/50 border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-300 text-sm font-medium">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@company.com"
                      className="h-12 bg-slate-800/50 border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-300 text-sm font-medium">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      placeholder="••••••••"
                      className="h-12 bg-slate-800/50 border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>

                  {authError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                      <p className="text-red-400 text-sm text-center">{authError}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={authLoading}
                    className="w-full h-12 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30"
                  >
                    {authLoading ? <Spinner /> : authMode === "login" ? "Sign In" : "Create Account"}
                  </Button>
                </form>

                {authMode === "register" && (
                  <div className="mt-8 pt-6 border-t border-slate-800/50">
                    <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl p-4 border border-emerald-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-300 font-medium">Standard Plan</span>
                        <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">$500<span className="text-sm text-slate-400">/mo</span></span>
                      </div>
                      <p className="text-slate-400 text-sm">150 vehicles included • $5 per additional vehicle</p>
                    </div>
                  </div>
                )}

                {authMode === "login" && (
                  <div className="mt-6 text-center">
                    <p className="text-slate-500 text-sm">
                      Demo credentials: <span className="text-slate-400">demo@test.com</span> / <span className="text-slate-400">demo123</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <p className="text-center text-slate-500 text-xs mt-8">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const uniqueSystems = new Set(scrubResults.flatMap(r => r.calibrationMatches.map(m => m.systemName)));
  const vehicleDisplay = detectedVehicle?.year && detectedVehicle?.make && detectedVehicle?.model
    ? `${detectedVehicle.year} ${detectedVehicle.make} ${detectedVehicle.model}`
    : detectedVehicle?.year || detectedVehicle?.make || detectedVehicle?.model
    ? [detectedVehicle.year, detectedVehicle.make, detectedVehicle.model].filter(Boolean).join(' ')
    : null;

  // Main app
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold gradient-text">Estimate Scrubber</h1>
          </div>

          <div className="flex items-center gap-6">
            {shop.usage && (
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-sm">Usage</span>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${shop.usage.remaining < 20 ? "text-amber-400" : "text-[#10b981]"}`}>
                    {shop.usage.used}
                  </span>
                  <span className="text-muted-foreground text-sm">/ {shop.usage.limit}</span>
                </div>
              </div>
            )}
            <Separator orientation="vertical" className="h-8 bg-border" />
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{shop.name}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column - inputs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Estimate input */}
            <div className="card-gradient">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Estimate</span>
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "pdf" | "text")}>
                  <TabsList className="bg-secondary h-8">
                    <TabsTrigger value="pdf" className="text-xs px-3 h-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">PDF</TabsTrigger>
                    <TabsTrigger value="text" className="text-xs px-3 h-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Text</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="p-5">
                {inputMode === "pdf" ? (
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border border-dashed rounded-xl p-8 text-center transition-all ${
                      dragActive
                        ? "border-primary bg-primary/10"
                        : selectedFile
                        ? "border-[#10b981] bg-[#10b981]/10"
                        : "border-border hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    {selectedFile ? (
                      <div>
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#10b981] flex items-center justify-center">
                          <CheckIcon className="w-6 h-6 text-white" />
                        </div>
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        <Button
                          variant="link"
                          size="sm"
                          className="mt-2 text-destructive"
                          onClick={() => setSelectedFile(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-secondary flex items-center justify-center">
                          <UploadIcon className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">Drop PDF or</p>
                        <label className="text-primary hover:underline cursor-pointer font-medium">
                          browse
                          <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-primary"
                        onClick={() => setEstimateText(sampleEstimate)}
                      >
                        Load sample
                      </Button>
                    </div>
                    <textarea
                      value={estimateText}
                      onChange={(e) => setEstimateText(e.target.value)}
                      placeholder="Paste estimate text (vehicle info will be auto-detected)..."
                      className="w-full h-40 resize-none text-sm bg-secondary border border-border rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                )}

                <Button
                  onClick={handleAnalyze}
                  disabled={isLoading || (inputMode === "text" && !estimateText.trim()) || (inputMode === "pdf" && !selectedFile)}
                  className="w-full mt-5 gradient-primary hover:opacity-90 h-11 font-semibold"
                >
                  {isLoading ? <><Spinner className="mr-2" /> Analyzing...</> : "Analyze Estimate"}
                </Button>
              </div>
            </div>

            {/* Detected Vehicle Info */}
            {detectedVehicle && (
              <div className="card-gradient">
                <div className="p-5 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Detected Vehicle</span>
                  {detectedVehicle.confidence && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      detectedVehicle.confidence === 'high' ? 'bg-[#10b981]/20 text-[#10b981]' :
                      detectedVehicle.confidence === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {detectedVehicle.confidence === 'high' ? 'VIN Verified' :
                       detectedVehicle.confidence === 'medium' ? 'Partial Match' : 'Text Only'}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                      <CarIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      {vehicleDisplay ? (
                        <>
                          <p className="text-xl font-bold">{vehicleDisplay}</p>
                          {detectedVehicle.trim && (
                            <p className="text-sm text-muted-foreground">{detectedVehicle.trim}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground">Vehicle info not detected</p>
                      )}
                      {detectedVehicle.vin && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono">VIN: {detectedVehicle.vin}</p>
                      )}
                      {estimateFormat && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Format: <span className="text-primary uppercase">{estimateFormat}</span>
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {vehicleSource ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10b981]/20 text-[#10b981] text-xs font-medium">
                            <CheckIcon className="w-3 h-3" />
                            ADAS data available
                          </span>
                        ) : vehicleDisplay ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                            No ADAS data in database
                          </span>
                        ) : null}
                        {detectedVehicle.source === 'vin_api' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                            NHTSA Verified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ADAS Features from VIN */}
                  {adasFeaturesFromVIN && Object.values(adasFeaturesFromVIN).some(v => v) && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Factory ADAS Features</p>
                      <div className="flex flex-wrap gap-1.5">
                        {adasFeaturesFromVIN.forwardCollisionWarning && <Badge variant="secondary" className="text-xs">FCW</Badge>}
                        {adasFeaturesFromVIN.automaticEmergencyBraking && <Badge variant="secondary" className="text-xs">AEB</Badge>}
                        {adasFeaturesFromVIN.laneDepartureWarning && <Badge variant="secondary" className="text-xs">LDW</Badge>}
                        {adasFeaturesFromVIN.laneKeepAssist && <Badge variant="secondary" className="text-xs">LKA</Badge>}
                        {adasFeaturesFromVIN.blindSpotMonitoring && <Badge variant="secondary" className="text-xs">BSM</Badge>}
                        {adasFeaturesFromVIN.adaptiveCruiseControl && <Badge variant="secondary" className="text-xs">ACC</Badge>}
                        {adasFeaturesFromVIN.parkingAssist && <Badge variant="secondary" className="text-xs">Park Assist</Badge>}
                        {adasFeaturesFromVIN.rearCrossTraffic && <Badge variant="secondary" className="text-xs">RCTA</Badge>}
                        {adasFeaturesFromVIN.backupCamera && <Badge variant="secondary" className="text-xs">Backup Cam</Badge>}
                        {adasFeaturesFromVIN.surroundViewCamera && <Badge variant="secondary" className="text-xs">360 Cam</Badge>}
                      </div>
                    </div>
                  )}

                  {/* ADAS Parts Found in Estimate */}
                  {adasPartsInEstimate.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">ADAS Parts in Estimate</p>
                      <div className="space-y-1">
                        {adasPartsInEstimate.map((part, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-[#10b981]">•</span>
                            <span>{part.description}</span>
                            <span className="text-muted-foreground">(Line {part.lineNumbers.join(', ')})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right column - results */}
          <div className="lg:col-span-3">
            <div className="card-gradient min-h-[500px]">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Results</span>
                {reportId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`/api/reports/${reportId}/pdf`, "_blank")}
                    className="text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <DocumentIcon className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
                )}
              </div>
              <div className="p-5">
                {scrubResults.length === 0 && detectedRepairs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-80 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                      <DocumentIcon className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      Upload an estimate to see<br />calibration requirements
                    </p>
                    <p className="text-xs text-muted-foreground mt-3">
                      Vehicle info will be auto-detected from the estimate
                    </p>
                  </div>
                ) : scrubResults.length === 0 && detectedRepairs.length > 0 ? (
                  /* Show detected repairs when no ADAS data exists */
                  <div className="space-y-5">
                    {/* Warning banner */}
                    <div className="card-warning rounded-xl p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-amber-400">No Calibration Rules Available</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            ADAS data not in database for this vehicle. Showing detected repairs below.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Detected repairs list */}
                    <div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">
                        Detected Repairs ({detectedRepairs.length})
                      </p>
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                        {detectedRepairs.map((repair, i) => (
                          <div key={i} className="bg-secondary rounded-xl p-4 flex items-start gap-4">
                            <span className="px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold">
                              Line {repair.lineNumber}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{repair.description}</p>
                              <span className="inline-block mt-2 px-2 py-0.5 rounded bg-border text-xs text-muted-foreground">
                                {repair.repairType}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center pt-2">
                      These repairs may require ADAS calibration. Consult OEM repair procedures.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Summary */}
                    <div className="card-success rounded-xl p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#10b981] flex items-center justify-center">
                          <CheckIcon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-[#10b981] text-lg">Analysis Complete</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {scrubResults.length} line{scrubResults.length !== 1 ? "s" : ""} flagged &middot; {uniqueSystems.size} system{uniqueSystems.size !== 1 ? "s" : ""} require calibration
                          </p>
                        </div>
                      </div>
                      {/* Stats */}
                      <div className="flex gap-8 mt-5 pt-5 border-t border-[#10b981]/20">
                        <div className="text-center">
                          <p className="text-3xl font-bold text-[#10b981]">{scrubResults.length}</p>
                          <p className="text-xs text-muted-foreground mt-1">Lines Flagged</p>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-[#10b981]">{uniqueSystems.size}</p>
                          <p className="text-xs text-muted-foreground mt-1">ADAS Systems</p>
                        </div>
                      </div>
                    </div>

                    {/* OEM Source */}
                    {vehicleSource?.sourceProvider && (
                      <div className="bg-secondary rounded-xl p-4">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Source</p>
                        <p className="text-sm">{vehicleSource.sourceProvider}</p>
                      </div>
                    )}

                    {/* Results list - grouped by system */}
                    <div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">
                        Calibration Requirements
                      </p>
                      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                        {(() => {
                          // Group calibrations by system name
                          const systemMap = new Map<string, {
                            systemName: string;
                            calibrationType: string | null;
                            triggers: Array<{ lineNumber: number; description: string; reason: string }>;
                          }>();

                          scrubResults.forEach((result) => {
                            result.calibrationMatches.forEach((match) => {
                              const existing = systemMap.get(match.systemName);
                              if (existing) {
                                // Add this trigger if not already present
                                const alreadyHasTrigger = existing.triggers.some(
                                  t => t.lineNumber === result.lineNumber
                                );
                                if (!alreadyHasTrigger) {
                                  existing.triggers.push({
                                    lineNumber: result.lineNumber,
                                    description: result.description,
                                    reason: match.reason,
                                  });
                                }
                              } else {
                                systemMap.set(match.systemName, {
                                  systemName: match.systemName,
                                  calibrationType: match.calibrationType,
                                  triggers: [{
                                    lineNumber: result.lineNumber,
                                    description: result.description,
                                    reason: match.reason,
                                  }],
                                });
                              }
                            });
                          });

                          return Array.from(systemMap.values()).map((system) => (
                            <div key={system.systemName} className="bg-secondary rounded-xl overflow-hidden">
                              {/* System Header */}
                              <div className="bg-primary/10 px-4 py-3 border-b border-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded-full bg-[#10b981] flex items-center justify-center flex-shrink-0">
                                    <CheckIcon className="w-3.5 h-3.5 text-white" />
                                  </div>
                                  <span className="font-semibold">{system.systemName}</span>
                                  {system.calibrationType && (
                                    <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-medium">
                                      {system.calibrationType}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {system.triggers.length} repair{system.triggers.length !== 1 ? "s" : ""} trigger this
                                </span>
                              </div>
                              {/* Triggering repairs */}
                              <div className="p-4">
                                <p className="text-xs text-muted-foreground mb-3">Triggered by:</p>
                                <div className="space-y-2">
                                  {system.triggers.map((trigger, i) => (
                                    <div key={i} className="flex items-start gap-3 bg-card/50 rounded-lg p-3">
                                      <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold flex-shrink-0">
                                        Line {trigger.lineNumber}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{trigger.description}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{trigger.reason}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
