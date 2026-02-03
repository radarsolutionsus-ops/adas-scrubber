"use client";

import { useState, useEffect, useCallback } from "react";

interface Vehicle {
  id: string;
  yearStart: number;
  yearEnd: number;
  make: string;
  model: string;
  sourceProvider?: string;
  sourceUrl?: string;
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

interface AdasSystem {
  id: string;
  systemName: string;
  oemName: string | null;
  location: string | null;
  calibrationType: string | null;
  calibrationTriggers: { trigger: string }[];
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

// Logo component matching RadarSolutions style
function Logo({ size = "default" }: { size?: "default" | "large" }) {
  const textSize = size === "large" ? "text-4xl" : "text-2xl";
  return (
    <span className={`${textSize} font-extrabold gradient-text`}>
      RadarSolutions
    </span>
  );
}

export default function Home() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [adasSystems, setAdasSystems] = useState<AdasSystem[]>([]);
  const [estimateText, setEstimateText] = useState("");
  const [scrubResults, setScrubResults] = useState<ScrubResult[]>([]);
  const [vehicleSource, setVehicleSource] = useState<Vehicle | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdasInfo, setShowAdasInfo] = useState(false);
  const [uploadMode, setUploadMode] = useState<"text" | "pdf">("pdf");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.shop) setShop(data.shop);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch("/api/vehicles")
      .then((res) => res.json())
      .then((data) => {
        setVehicles(data.vehicles || []);
        if (data.vehicles && data.vehicles.length > 0) {
          setSelectedVehicle(data.vehicles[0]);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedVehicle) {
      fetch(`/api/vehicles/${selectedVehicle.id}/adas-systems`)
        .then((res) => res.json())
        .then((data) => setAdasSystems(data.adasSystems || []))
        .catch(console.error);
    }
  }, [selectedVehicle]);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

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
        setShop(result.shop);
        const meRes = await fetch("/api/auth/me");
        const meData = await meRes.json();
        if (meData.shop) setShop(meData.shop);
      }
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setShop(null);
    setScrubResults([]);
    setReportId(null);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleScrub = async () => {
    if (!selectedVehicle) return;
    if (uploadMode === "text" && !estimateText.trim()) return;
    if (uploadMode === "pdf" && !selectedFile) return;

    setIsLoading(true);
    setScrubResults([]);
    setReportId(null);

    try {
      let response;

      if (uploadMode === "pdf" && selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("vehicleYear", selectedVehicle.yearStart.toString());
        formData.append("vehicleMake", selectedVehicle.make);
        formData.append("vehicleModel", selectedVehicle.model);

        response = await fetch("/api/scrub", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/scrub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estimateText,
            vehicleYear: selectedVehicle.yearStart,
            vehicleMake: selectedVehicle.make,
            vehicleModel: selectedVehicle.model,
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to analyze estimate");
        return;
      }

      setScrubResults(data.results || []);
      setVehicleSource(data.vehicle);
      setReportId(data.reportId);

      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (meData.shop) setShop(meData.shop);
    } catch (error) {
      console.error("Scrub failed:", error);
      alert("Failed to analyze estimate");
    } finally {
      setIsLoading(false);
    }
  };

  const openPdfReport = () => {
    if (reportId) {
      window.open(`/api/reports/${reportId}/pdf`, "_blank");
    }
  };

  const sampleEstimate = `R&I Front Bumper Cover
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo */}
          <div className="text-center mb-10">
            <Logo size="large" />
            <p className="text-[#a0a0b0] mt-3 text-lg">Estimate Scrubber</p>
          </div>

          {/* Auth Card */}
          <div className="bg-[#12121a] border border-[#2a2a3a] rounded-2xl p-8 gradient-border">
            <div className="flex mb-8 bg-[#0a0a0f] rounded-lg p-1">
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-2.5 text-center rounded-md font-medium transition-all ${
                  authMode === "login"
                    ? "btn-gradient text-white"
                    : "text-[#a0a0b0] hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthMode("register")}
                className={`flex-1 py-2.5 text-center rounded-md font-medium transition-all ${
                  authMode === "register"
                    ? "btn-gradient text-white"
                    : "text-[#a0a0b0] hover:text-white"
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
              {authMode === "register" && (
                <div>
                  <label className="block text-sm text-[#a0a0b0] mb-2">Shop Name</label>
                  <input
                    name="name"
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg text-white placeholder-[#505060] focus:outline-none focus:border-[#667eea] transition-colors"
                    placeholder="Your Body Shop"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-[#a0a0b0] mb-2">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg text-white placeholder-[#505060] focus:outline-none focus:border-[#667eea] transition-colors"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-[#a0a0b0] mb-2">Password</label>
                <input
                  name="password"
                  type="password"
                  required
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg text-white placeholder-[#505060] focus:outline-none focus:border-[#667eea] transition-colors"
                  placeholder="Enter your password"
                />
              </div>

              {authError && (
                <p className="text-[#ef4444] text-sm bg-[#ef4444]/10 px-4 py-2 rounded-lg">{authError}</p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 btn-gradient text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? "Please wait..." : authMode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            {authMode === "register" && (
              <div className="mt-8 p-5 bg-[#10b981]/10 rounded-xl border border-[#10b981]/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-[#10b981] rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-[#10b981] font-semibold text-lg">Standard Plan</p>
                </div>
                <p className="text-white text-xl font-bold">$500<span className="text-[#a0a0b0] text-base font-normal">/month</span></p>
                <p className="text-[#a0a0b0] text-sm mt-1">150 vehicles included, then $5 each</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 glass border-b border-[#2a2a3a]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="text-[#2a2a3a]">|</span>
            <span className="text-[#a0a0b0] text-sm font-medium">Estimate Scrubber</span>
          </div>

          <div className="flex items-center gap-8">
            {/* Usage Stats */}
            {shop.usage && (
              <div className="text-right">
                <p className="text-[#a0a0b0] text-xs uppercase tracking-wide">Monthly Usage</p>
                <p className="text-white font-semibold">
                  <span className={shop.usage.remaining < 20 ? "text-yellow-400" : "text-[#10b981]"}>
                    {shop.usage.used}
                  </span>
                  <span className="text-[#a0a0b0] font-normal"> / {shop.usage.limit}</span>
                </p>
                {shop.usage.overage > 0 && (
                  <p className="text-yellow-400 text-xs">+${shop.usage.overageCharge} overage</p>
                )}
              </div>
            )}

            {/* Shop Info */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white font-medium">{shop.name}</p>
                <p className="text-[#a0a0b0] text-sm">{shop.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-[#a0a0b0] hover:text-white border border-[#2a2a3a] hover:border-[#667eea] rounded-lg transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Vehicle Selection */}
            <div className="bg-[#12121a] border border-[#2a2a3a] rounded-2xl p-7 card-hover gradient-border">
              <h2 className="text-lg font-semibold text-white mb-5">Vehicle Information</h2>

              {selectedVehicle ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {selectedVehicle.yearStart} {selectedVehicle.make} {selectedVehicle.model}
                    </p>
                    <p className="text-sm text-[#a0a0b0] mt-1">
                      {adasSystems.length} ADAS systems configured
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAdasInfo(!showAdasInfo)}
                    className="px-4 py-2 text-sm bg-[#667eea]/20 text-[#667eea] rounded-lg hover:bg-[#667eea]/30 transition-all font-medium"
                  >
                    {showAdasInfo ? "Hide" : "View"} Systems
                  </button>
                </div>
              ) : (
                <p className="text-[#a0a0b0]">Loading vehicles...</p>
              )}

              {showAdasInfo && adasSystems.length > 0 && (
                <div className="mt-6 pt-6 border-t border-[#2a2a3a]">
                  <h3 className="font-medium text-[#a0a0b0] mb-4 text-sm uppercase tracking-wide">ADAS Systems</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {adasSystems.map((system) => (
                      <div
                        key={system.id}
                        className="bg-[#0a0a0f] rounded-xl p-4 border border-[#2a2a3a]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white">{system.systemName}</span>
                          {system.calibrationType && (
                            <span className="text-xs px-2.5 py-1 bg-[#667eea]/20 text-[#667eea] rounded-full font-medium">
                              {system.calibrationType}
                            </span>
                          )}
                        </div>
                        {system.location && (
                          <p className="text-sm text-[#a0a0b0] mt-1">{system.location}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Estimate Input */}
            <div className="bg-[#12121a] border border-[#2a2a3a] rounded-2xl p-7 card-hover gradient-border">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-white">Repair Estimate</h2>
                <div className="flex bg-[#0a0a0f] rounded-lg p-1">
                  <button
                    onClick={() => setUploadMode("pdf")}
                    className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${
                      uploadMode === "pdf"
                        ? "btn-gradient text-white"
                        : "text-[#a0a0b0] hover:text-white"
                    }`}
                  >
                    PDF Upload
                  </button>
                  <button
                    onClick={() => setUploadMode("text")}
                    className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${
                      uploadMode === "text"
                        ? "btn-gradient text-white"
                        : "text-[#a0a0b0] hover:text-white"
                    }`}
                  >
                    Text Paste
                  </button>
                </div>
              </div>

              {uploadMode === "pdf" ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
                    dragActive
                      ? "border-[#667eea] bg-[#667eea]/10"
                      : selectedFile
                      ? "border-[#10b981] bg-[#10b981]/10"
                      : "border-[#2a2a3a] hover:border-[#667eea]/50"
                  }`}
                >
                  {selectedFile ? (
                    <div className="animate-fade-in">
                      <div className="w-16 h-16 mx-auto mb-4 bg-[#10b981]/20 rounded-full flex items-center justify-center pulse-success">
                        <svg className="w-8 h-8 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-white font-semibold text-lg">{selectedFile.name}</p>
                      <p className="text-[#a0a0b0] text-sm mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="mt-4 text-sm text-[#ef4444] hover:text-[#ef4444]/80 font-medium"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="w-16 h-16 mx-auto mb-4 bg-[#667eea]/20 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-[#667eea]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-white font-semibold text-lg">Drop your estimate PDF here</p>
                      <p className="text-[#a0a0b0] text-sm mt-2 mb-4">or</p>
                      <label className="inline-block px-6 py-2.5 btn-gradient text-white rounded-lg cursor-pointer font-medium">
                        Browse Files
                        <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex justify-end mb-3">
                    <button
                      onClick={() => setEstimateText(sampleEstimate)}
                      className="text-sm text-[#667eea] hover:text-[#667eea]/80 font-medium"
                    >
                      Load sample estimate
                    </button>
                  </div>
                  <textarea
                    value={estimateText}
                    onChange={(e) => setEstimateText(e.target.value)}
                    placeholder="Paste your repair estimate here..."
                    className="w-full h-64 p-4 bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl text-white placeholder-[#505060] focus:outline-none focus:border-[#667eea] resize-none transition-colors"
                  />
                </div>
              )}

              <button
                onClick={handleScrub}
                disabled={
                  isLoading ||
                  !selectedVehicle ||
                  (uploadMode === "text" && !estimateText.trim()) ||
                  (uploadMode === "pdf" && !selectedFile)
                }
                className="mt-6 w-full py-4 btn-success text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none text-lg"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  "Analyze for Calibrations"
                )}
              </button>
            </div>
          </div>

          {/* Results Section */}
          <div className="bg-[#12121a] border border-[#2a2a3a] rounded-2xl p-7 card-hover gradient-border">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Calibration Requirements</h2>
              {reportId && (
                <button
                  onClick={openPdfReport}
                  className="px-5 py-2.5 btn-success text-white rounded-lg flex items-center gap-2 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Report
                </button>
              )}
            </div>

            {scrubResults.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-6 bg-[#667eea]/10 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#667eea]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-[#a0a0b0] text-lg">Upload an estimate to identify<br />required ADAS calibrations</p>
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in">
                {/* Summary */}
                <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#10b981] rounded-full flex items-center justify-center pulse-success">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[#10b981] font-bold text-lg">Analysis Complete</p>
                      <p className="text-[#a0a0b0]">
                        {scrubResults.length} repair line{scrubResults.length !== 1 ? "s" : ""} require calibration &bull;{" "}
                        {new Set(scrubResults.flatMap((r) => r.calibrationMatches.map((m) => m.systemName))).size} unique system{new Set(scrubResults.flatMap((r) => r.calibrationMatches.map((m) => m.systemName))).size !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </div>

                {/* OEM Source */}
                {vehicleSource?.sourceUrl && (
                  <div className="bg-[#667eea]/10 border border-[#667eea]/30 rounded-xl p-5">
                    <p className="text-[#667eea] text-sm font-semibold uppercase tracking-wide mb-2">OEM Position Statement</p>
                    <p className="text-[#a0a0b0] text-sm">{vehicleSource.sourceProvider || "I-CAR RTS"}</p>
                    <a
                      href={vehicleSource.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#10b981] text-sm hover:underline break-all font-medium"
                    >
                      {vehicleSource.sourceUrl}
                    </a>
                  </div>
                )}

                {/* Results */}
                <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                  {scrubResults.map((result, idx) => (
                    <div
                      key={result.lineNumber}
                      className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl overflow-hidden"
                      style={{ animationDelay: `${idx * 0.1}s` }}
                    >
                      <div className="bg-[#667eea]/10 px-5 py-4 border-b border-[#2a2a3a]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs px-2.5 py-1 bg-[#667eea]/20 text-[#667eea] rounded-full font-medium">
                            Line {result.lineNumber}
                          </span>
                          <span className="text-xs text-[#10b981] font-medium">
                            {result.calibrationMatches.length} calibration{result.calibrationMatches.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <p className="font-semibold text-white">{result.description}</p>
                      </div>

                      <div className="p-5 space-y-4">
                        {result.calibrationMatches.map((match, matchIdx) => (
                          <div key={matchIdx} className="flex items-start gap-4">
                            <div className="w-7 h-7 bg-[#10b981] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-white">{match.systemName}</span>
                                {match.calibrationType && (
                                  <span className="text-xs px-2.5 py-0.5 bg-[#667eea]/20 text-[#667eea] rounded-full font-medium">
                                    {match.calibrationType}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-[#a0a0b0] mt-1">{match.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
