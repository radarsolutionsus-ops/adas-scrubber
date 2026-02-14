const WHITESPACE = /\s+/g;

function normalizeWhitespace(value: string): string {
  return value.replace(WHITESPACE, " ").trim();
}

export function normalizeForKey(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeLegacyOperationName(rawName: string, systemName: string, matchedKeyword?: string): string {
  const name = normalizeWhitespace(rawName || "");
  const lower = name.toLowerCase();
  const keyword = (matchedKeyword || "").toLowerCase();

  if (lower.includes("inferred camera trigger")) return "Forward Camera Calibration";
  if (lower.includes("inferred radar trigger")) return "Front Radar Calibration";
  if (lower.includes("inferred bsm trigger")) return "Blind Spot Radar Calibration";
  if (lower.includes("inferred sas trigger")) return "Steering Angle Sensor Reset/Relearn";
  if (lower.includes("inferred adas part trigger")) {
    if (keyword === "frontradar" || /radar|acc|aeb/i.test(systemName)) return "Front Radar Calibration";
    if (keyword === "frontcamera" || /camera|ldw|lka/i.test(systemName)) return "Forward Camera Calibration";
    if (keyword === "blindspotmonitor" || /blind spot|rear cross/i.test(systemName)) return "Blind Spot Radar Calibration";
    if (keyword === "surroundcamera" || /surround|360/i.test(systemName)) return "Surround View Camera Calibration";
    if (keyword === "parkingsensor" || /parking/i.test(systemName)) return "Parking Sensor Calibration";
    if (keyword === "rearcamera" || /rear view camera|backup camera/i.test(systemName)) return "Rear Camera Calibration";
    if (keyword === "steeringanglesensor" || /steering angle/i.test(systemName)) return "Steering Angle Sensor Reset/Relearn";
    return `${systemName} Calibration`;
  }

  if (lower.startsWith("inferred ") && lower.endsWith(" trigger")) {
    if (/camera/i.test(systemName)) return "Camera Calibration";
    if (/radar|acc|aeb/i.test(systemName)) return "Radar Calibration";
    if (/blind spot|rear cross/i.test(systemName)) return "Blind Spot Radar Calibration";
    if (/steering angle/i.test(systemName)) return "Steering Angle Sensor Reset/Relearn";
  }

  return name || `${systemName} Calibration`;
}

export function canonicalizeOperationName(rawName: string, systemName: string, matchedKeyword?: string): string {
  const base = normalizeLegacyOperationName(rawName, systemName, matchedKeyword);
  const normalized = normalizeForKey(base);

  if (/steering angle|\bsas\b|relearn/.test(normalized)) return "Steering Angle Sensor Reset/Relearn";
  if (/blind spot|rear cross|\bbsm\b|\brcta\b/.test(normalized)) return "Blind Spot Radar Calibration";
  if (/surround|360/.test(normalized) && /camera/.test(normalized)) return "Surround View Camera Calibration";
  if (/rear view camera|backup camera|rear camera/.test(normalized)) return "Rear Camera Calibration";
  if (/parking/.test(normalized) && /(sensor|assist)/.test(normalized)) return "Parking Sensor Calibration";
  if ((/front radar|\bradar\b|\bacc\b|\baeb\b/.test(normalized) && !/blind spot|rear/.test(normalized))) {
    return "Front Radar Calibration";
  }
  if (/forward|front/.test(normalized) && /camera/.test(normalized)) return "Forward Camera Calibration";
  if (/camera/.test(normalized) && !/rear/.test(normalized)) return "Forward Camera Calibration";

  return base;
}

export function isLikelyRepairTriggerOperation(value: string): boolean {
  const normalized = normalizeForKey(value);
  if (!normalized) return false;
  if (/calibrat|reset|relearn|initializ|angle check|aim/.test(normalized)) return false;
  return /repair|replace|repl|r i|r r|remove|install|bumper|panel|windshield|fender|door|hood|quarter|tailgate|mirror|grille|paint|blend|refinish|postscan|prescan/.test(
    normalized
  );
}

export function canonicalizeSystem(rawSystemName: string, operationName?: string): { key: string; label: string } {
  const combined = `${rawSystemName || ""} ${operationName || ""}`;
  const normalized = normalizeForKey(combined);

  if (/steering angle|\bsas\b/.test(normalized)) {
    return { key: "steering-angle-sensor", label: "Steering Angle Sensor" };
  }
  if (/blind spot|rear cross|\bbsm\b|\brcta\b/.test(normalized)) {
    return { key: "blind-spot-radar", label: "Blind Spot / Rear Cross Traffic" };
  }
  if (/surround|360/.test(normalized) && /camera/.test(normalized)) {
    return { key: "surround-view-camera", label: "Surround View / 360 Camera" };
  }
  if (/rear view camera|backup camera|rear camera/.test(normalized)) {
    return { key: "rear-camera", label: "Rear View Camera" };
  }
  if (/parking/.test(normalized) && /(sensor|assist)/.test(normalized)) {
    return { key: "parking-sensor", label: "Parking Assist Sensors" };
  }
  if ((/front radar|\bradar\b|\bacc\b|\baeb\b/.test(normalized) && !/blind spot|rear/.test(normalized))) {
    return { key: "front-radar", label: "Front Radar / ACC-AEB" };
  }
  if (/camera|ldw|lka/.test(normalized) && !/rear/.test(normalized)) {
    return { key: "forward-camera", label: "Forward Camera / LDW-LKA" };
  }

  const cleaned = normalizeWhitespace(rawSystemName || "");
  if (!cleaned) {
    return { key: "unknown-system", label: "ADAS System" };
  }

  return {
    key: normalizeForKey(cleaned) || "unknown-system",
    label: cleaned,
  };
}

export function calibrationOperationForSystem(system: { key: string; label: string }, fallbackOperation?: string): string {
  switch (system.key) {
    case "forward-camera":
      return "Forward Camera Calibration";
    case "front-radar":
      return "Front Radar Calibration";
    case "blind-spot-radar":
      return "Blind Spot Radar Calibration";
    case "surround-view-camera":
      return "Surround View Camera Calibration";
    case "rear-camera":
      return "Rear Camera Calibration";
    case "parking-sensor":
      return "Parking Sensor Calibration";
    case "steering-angle-sensor":
      return "Steering Angle Sensor Reset/Relearn";
    default:
      break;
  }

  if (fallbackOperation) {
    if (!isLikelyRepairTriggerOperation(fallbackOperation)) {
      return fallbackOperation;
    }
    if (system.label && system.label !== "ADAS System") {
      return `${system.label} Calibration`;
    }
  }

  return `${system.label || "ADAS System"} Calibration`;
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function canonicalizeCalibrationType(calibrationType: string | null | undefined): string {
  const raw = normalizeWhitespace(calibrationType || "");
  if (!raw) return "OEM Procedure";

  const normalized = normalizeForKey(raw);

  if (/static/.test(normalized) && /dynamic/.test(normalized)) return "Static + Dynamic";
  if (/coding/.test(normalized) && /init/.test(normalized)) return "Coding / Initialization";
  if (/coding/.test(normalized)) return "Coding / Initialization";
  if (/init|relearn|reset/.test(normalized)) return "Initialization";
  if (/dynamic/.test(normalized)) return "Dynamic";
  if (/static/.test(normalized)) return "Static";
  if (/oem|procedure/.test(normalized)) return "OEM Procedure";

  return toTitleCase(raw.toLowerCase());
}

const CALIBRATION_TYPE_ORDER = [
  "Static + Dynamic",
  "Static",
  "Dynamic",
  "Coding / Initialization",
  "Initialization",
  "OEM Procedure",
];

export function mergeCalibrationTypes(types: Array<string | null | undefined>): string {
  const normalized = new Set<string>();
  types.forEach((type) => {
    const value = canonicalizeCalibrationType(type);
    if (value) normalized.add(value);
  });

  if (normalized.has("Static + Dynamic")) {
    normalized.delete("Static");
    normalized.delete("Dynamic");
  }

  if (normalized.size > 1 && normalized.has("OEM Procedure")) {
    normalized.delete("OEM Procedure");
  }

  if (normalized.size > 1 && normalized.has("Initialization") && normalized.has("Coding / Initialization")) {
    normalized.delete("Initialization");
  }

  const ordered = Array.from(normalized).sort((a, b) => {
    const aIndex = CALIBRATION_TYPE_ORDER.indexOf(a);
    const bIndex = CALIBRATION_TYPE_ORDER.indexOf(b);
    const resolvedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const resolvedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;

    if (resolvedA === resolvedB) {
      return a.localeCompare(b);
    }

    return resolvedA - resolvedB;
  });

  return ordered.join(" / ") || "OEM Procedure";
}

export function canonicalizeProcedureType(procedureType: string | null | undefined): string {
  const raw = normalizeWhitespace(procedureType || "");
  if (!raw) return "Required Procedure";

  const normalized = normalizeForKey(raw);
  if (/required|must/.test(normalized)) return "Required Procedure";
  if (/recommended|advise/.test(normalized)) return "Recommended Procedure";
  if (/inspect|verify|check/.test(normalized)) return "Verification";

  return raw;
}

function procedurePriority(type: string): number {
  const normalized = normalizeForKey(type);
  if (/required|must/.test(normalized)) return 3;
  if (/recommended|advise/.test(normalized)) return 2;
  if (/inspect|verify|check/.test(normalized)) return 1;
  return 0;
}

export function pickHigherPriorityProcedureType(currentType: string, nextType: string): string {
  return procedurePriority(nextType) > procedurePriority(currentType) ? nextType : currentType;
}
