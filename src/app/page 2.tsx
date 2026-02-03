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

  // Check session on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.shop) setShop(data.shop);
      })
      .catch(console.error);
  }, []);

  // Fetch available vehicles
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

  // Fetch ADAS systems when vehicle changes
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
        // Refresh usage
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

      // Refresh usage
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
      <div className="min-h-screen bg-[#0a0612] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold">
              <span className="text-violet-400">Radar</span>
              <span className="text-green-500">Solutions</span>
            </h1>
            <p className="text-gray-400 mt-2">ADAS Calibration Analysis Platform</p>
          </div>

          {/* Auth Card */}
          <div className="bg-[#1a0f2e] border border-violet-900/50 rounded-2xl p-8">
            <div className="flex mb-6">
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-2 text-center rounded-lg transition ${
                  authMode === "login"
                    ? "bg-violet-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode("register")}
                className={`flex-1 py-2 text-center rounded-lg transition ${
                  authMode === "register"
                    ? "bg-violet-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === "register" && (
                <input
                  name="name"
                  type="text"
                  placeholder="Shop Name"
                  required
                  className="w-full px-4 py-3 bg-[#0a0612] border border-violet-900/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                />
              )}
              <input
                name="email"
                type="email"
                placeholder="Email"
                required
                className="w-full px-4 py-3 bg-[#0a0612] border border-violet-900/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
              />
              <input
                name="password"
                type="password"
                placeholder="Password"
                required
                className="w-full px-4 py-3 bg-[#0a0612] border border-violet-900/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
              />

              {authError && (
                <p className="text-red-400 text-sm">{authError}</p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {authLoading ? "Please wait..." : authMode === "login" ? "Login" : "Create Account"}
              </button>
            </form>

            {authMode === "register" && (
              <div className="mt-6 p-4 bg-[#0a0612] rounded-lg border border-green-900/50">
                <p className="text-green-400 font-medium mb-2">Standard Plan</p>
                <p className="text-gray-300 text-sm">
                  $500/month for 150 vehicles
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  $5 per additional vehicle
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="min-h-screen bg-[#0a0612]">
      {/* Header */}
      <header className="bg-[#1a0f2e] border-b border-violet-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-violet-400">Radar</span>
              <span className="text-green-500">Solutions</span>
            </h1>
            <p className="text-gray-500 text-sm">ADAS Calibration Analysis</p>
          </div>

          <div className="flex items-center gap-6">
            {/* Usage Stats */}
            {shop.usage && (
              <div className="text-right">
                <p className="text-gray-400 text-sm">Monthly Usage</p>
                <p className="text-white font-medium">
                  <span className={shop.usage.remaining < 20 ? "text-yellow-400" : "text-green-400"}>
                    {shop.usage.used}
                  </span>
                  <span className="text-gray-500"> / {shop.usage.limit} vehicles</span>
                </p>
                {shop.usage.overage > 0 && (
                  <p className="text-yellow-400 text-xs">
                    +{shop.usage.overage} overage (${shop.usage.overageCharge})
                  </p>
                )}
              </div>
            )}

            {/* Shop Info */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-white font-medium">{shop.name}</p>
                <p className="text-gray-500 text-sm">{shop.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Vehicle Selection */}
            <div className="bg-[#1a0f2e] border border-violet-900/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Vehicle Information
              </h2>

              {selectedVehicle ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {selectedVehicle.yearStart} {selectedVehicle.make}{" "}
                      {selectedVehicle.model}
                    </p>
                    <p className="text-sm text-gray-500">
                      {adasSystems.length} ADAS systems configured
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAdasInfo(!showAdasInfo)}
                    className="px-4 py-2 text-sm bg-violet-900/50 text-violet-300 rounded-lg hover:bg-violet-900 transition"
                  >
                    {showAdasInfo ? "Hide" : "View"} Systems
                  </button>
                </div>
              ) : (
                <p className="text-gray-500">Loading vehicles...</p>
              )}

              {/* ADAS Systems Info */}
              {showAdasInfo && adasSystems.length > 0 && (
                <div className="mt-4 border-t border-violet-900/50 pt-4">
                  <h3 className="font-medium text-gray-300 mb-3">
                    Configured ADAS Systems
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {adasSystems.map((system) => (
                      <div
                        key={system.id}
                        className="bg-[#0a0612] rounded-lg p-3 border border-violet-900/30"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white">
                            {system.systemName}
                          </span>
                          {system.calibrationType && (
                            <span className="text-xs px-2 py-1 bg-violet-600 text-white rounded">
                              {system.calibrationType}
                            </span>
                          )}
                        </div>
                        {system.location && (
                          <p className="text-sm text-gray-500 mt-1">
                            {system.location}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Estimate Input */}
            <div className="bg-[#1a0f2e] border border-violet-900/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  Repair Estimate
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUploadMode("pdf")}
                    className={`px-3 py-1 text-sm rounded-lg transition ${
                      uploadMode === "pdf"
                        ? "bg-violet-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    PDF Upload
                  </button>
                  <button
                    onClick={() => setUploadMode("text")}
                    className={`px-3 py-1 text-sm rounded-lg transition ${
                      uploadMode === "text"
                        ? "bg-violet-600 text-white"
                        : "text-gray-400 hover:text-white"
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
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
                    dragActive
                      ? "border-violet-500 bg-violet-900/20"
                      : selectedFile
                      ? "border-green-500 bg-green-900/10"
                      : "border-violet-900/50 hover:border-violet-700"
                  }`}
                >
                  {selectedFile ? (
                    <div>
                      <div className="w-16 h-16 mx-auto mb-4 bg-green-900/30 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-white font-medium">{selectedFile.name}</p>
                      <p className="text-gray-500 text-sm mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="mt-3 text-sm text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="w-16 h-16 mx-auto mb-4 bg-violet-900/30 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-white font-medium">
                        Drag & drop your estimate PDF
                      </p>
                      <p className="text-gray-500 text-sm mt-1">or</p>
                      <label className="mt-3 inline-block px-4 py-2 bg-violet-600 text-white rounded-lg cursor-pointer hover:bg-violet-700 transition">
                        Browse Files
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => setEstimateText(sampleEstimate)}
                      className="text-sm text-violet-400 hover:text-violet-300"
                    >
                      Load Sample
                    </button>
                  </div>
                  <textarea
                    value={estimateText}
                    onChange={(e) => setEstimateText(e.target.value)}
                    placeholder="Paste your repair estimate here..."
                    className="w-full h-64 p-4 bg-[#0a0612] border border-violet-900/50 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-none"
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
                className="mt-4 w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:bg-gray-700 disabled:cursor-not-allowed transition"
              >
                {isLoading ? "Analyzing..." : "Analyze for Calibrations"}
              </button>
            </div>
          </div>

          {/* Results Section */}
          <div className="bg-[#1a0f2e] border border-violet-900/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Calibration Requirements
              </h2>
              {reportId && (
                <button
                  onClick={openPdfReport}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Report
                </button>
              )}
            </div>

            {scrubResults.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <div className="w-16 h-16 mx-auto mb-4 bg-violet-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p>Upload an estimate to find required calibrations</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-green-400 font-semibold">
                        Analysis Complete
                      </p>
                      <p className="text-gray-400 text-sm">
                        {scrubResults.length} repair line(s) require calibration |{" "}
                        {new Set(
                          scrubResults.flatMap((r) =>
                            r.calibrationMatches.map((m) => m.systemName)
                          )
                        ).size}{" "}
                        unique system(s)
                      </p>
                    </div>
                  </div>
                </div>

                {/* OEM Source */}
                {vehicleSource?.sourceUrl && (
                  <div className="bg-violet-900/20 border border-violet-700/50 rounded-xl p-4">
                    <p className="text-violet-300 text-sm font-medium mb-1">
                      OEM Position Statement Source
                    </p>
                    <p className="text-gray-400 text-sm">
                      {vehicleSource.sourceProvider || "I-CAR RTS"}
                    </p>
                    <a
                      href={vehicleSource.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 text-sm hover:underline break-all"
                    >
                      {vehicleSource.sourceUrl}
                    </a>
                  </div>
                )}

                {/* Results */}
                <div className="space-y-3 max-h-[450px] overflow-y-auto">
                  {scrubResults.map((result) => (
                    <div
                      key={result.lineNumber}
                      className="bg-[#0a0612] border border-violet-900/30 rounded-xl overflow-hidden"
                    >
                      <div className="bg-violet-900/30 px-4 py-3 border-b border-violet-900/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs px-2 py-1 bg-violet-600 text-white rounded">
                            Line {result.lineNumber}
                          </span>
                          <span className="text-xs text-green-400">
                            {result.calibrationMatches.length} calibration(s)
                          </span>
                        </div>
                        <p className="font-medium text-white mt-2">
                          {result.description}
                        </p>
                      </div>

                      <div className="p-4 space-y-3">
                        {result.calibrationMatches.map((match, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-white">
                                  {match.systemName}
                                </span>
                                {match.calibrationType && (
                                  <span className="text-xs px-2 py-0.5 bg-violet-600 text-white rounded">
                                    {match.calibrationType}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 mt-1">
                                {match.reason}
                              </p>
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
