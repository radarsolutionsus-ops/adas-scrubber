import { prisma } from "./prisma";

export interface CalibrationMatch {
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

export interface ScrubResult {
  lineNumber: number;
  description: string;
  calibrationMatches: CalibrationMatch[];
}

export interface DetectedRepair {
  lineNumber: number;
  description: string;
  repairType: string;
}

export interface VehicleWithSource {
  id: string;
  yearStart: number;
  yearEnd: number;
  make: string;
  model: string;
  sourceProvider: string | null;
  sourceUrl: string | null;
}

/**
 * Extract CCC ONE estimate line number from text
 * CCC ONE format: "2 * Rpr Bumper cover" or "6 O/H bumper assy"
 * Returns the estimate line number or null if not found
 */
function extractCCCLineNumber(line: string): number | null {
  // Match patterns like "2 * Rpr", "6 O/H", "15 * Subl", "7 Repl", etc.
  // The line number is at the start, optionally followed by * or **
  const match = line.match(/^\s*(\d{1,3})\s*\*{0,2}\s*(Rpr|Repl|O\/H|Ovhl|R&I|R&R|Subl|Add|Blend|Refn)/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Also match section headers like "1 FRONT BUMPER"
  const sectionMatch = line.match(/^\s*(\d{1,3})\s+[A-Z]{2,}/);
  if (sectionMatch) {
    return parseInt(sectionMatch[1], 10);
  }

  return null;
}

/**
 * Check if a line is a supplier/vendor address line that should be skipped entirely
 */
function isSupplierAddressLine(line: string): boolean {
  // Lines with street addresses (number + street name patterns)
  if (/\d+\s*(NW|NE|SW|SE|N|S|E|W)?\s+\d*(st|nd|rd|th)?\s+(st|ave|blvd|rd|dr|ln|way|ct|pl)/i.test(line)) {
    return true;
  }
  // Lines that are primarily phone/fax numbers
  if (/^\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(line)) {
    return true;
  }
  // Lines with city, state ZIP patterns
  if (/[A-Za-z]+,?\s+[A-Z]{2}\s+\d{5}/.test(line)) {
    return true;
  }
  // Lines starting with A/M CAPA or similar vendor codes followed by address-like content
  if (/^A\/M\s*(CAPA|NSF|OEM)?\s*\d+\s*(NW|NE|SW|SE|N|S|E|W)/i.test(line)) {
    return true;
  }
  return false;
}

/**
 * Clean up a repair line description by extracting just the operation name
 * and stripping out part numbers, prices, quantities, and supplier info.
 *
 * Examples:
 * - "6Repl Lower Grille622546LY0A1603.82Incl." â "Lower Grille - Replace"
 * - "1FRONT BUMPER & GRILLE" â "Front Bumper & Grille"
 * - "R&I Front Bumper Cover" â "Front Bumper Cover - R&I"
 */
function cleanRepairDescription(rawLine: string): string {
  // First, try to extract repair operation using common patterns
  // This handles concatenated text like "6Repl Lower Grille622546LY0A1603.82Incl."

  let operation = '';
  let component = '';

  // Detect operation type at the start (after optional leading number)
  const replMatch = rawLine.match(/^\d*\s*(Repl(?:ace)?|R&R)\s*/i);
  const riMatch = rawLine.match(/^\d*\s*(R&I|Remove)\s*/i);
  const overhaulMatch = rawLine.match(/^\d*\s*(O\/H|Overhaul|Ovhl)\s*/i);
  const repairMatch = rawLine.match(/^\d*\s*(Rpr|Repair)\s*/i);
  const refinishMatch = rawLine.match(/^\d*\s*(Refinish|Blend|Paint)\s*/i);

  if (replMatch) {
    operation = 'Replace';
  } else if (riMatch) {
    operation = 'R&I';
  } else if (overhaulMatch) {
    operation = 'Overhaul';
  } else if (repairMatch) {
    operation = 'Repair';
  } else if (refinishMatch) {
    operation = 'Refinish';
  }

  // Common component patterns to extract
  const componentPatterns = [
    /front\s*bumper\s*(?:&|and)?\s*grille/i,
    /front\s*bumper\s*cover/i,
    /front\s*bumper/i,
    /rear\s*bumper\s*cover/i,
    /rear\s*bumper/i,
    /bumper\s*cover/i,
    /bumper/i,
    /lower\s*grille/i,
    /upper\s*grille/i,
    /front\s*grille/i,
    /grille/i,
    /grill/i,
    /windshield/i,
    /front\s*glass/i,
    /side\s*mirror/i,
    /door\s*mirror/i,
    /mirror\s*assembly/i,
    /mirror/i,
    /hood/i,
    /fender/i,
    /headlamp/i,
    /headlight/i,
    /tail\s*lamp/i,
    /tail\s*light/i,
    /radar\s*sensor/i,
    /front\s*radar/i,
    /camera/i,
    /quarter\s*panel/i,
    /rocker\s*panel/i,
    /door\s*shell/i,
    /door/i,
    /trunk/i,
    /decklid/i,
    /tailgate/i,
    /liftgate/i,
    /roof/i,
    /alignment/i,
    /suspension/i,
    /strut/i,
    /control\s*arm/i,
  ];

  for (const pattern of componentPatterns) {
    const match = rawLine.match(pattern);
    if (match) {
      component = match[0];
      break;
    }
  }

  // If we found a component, build a clean description
  if (component) {
    // Capitalize properly
    component = component.replace(/\b\w/g, c => c.toUpperCase());
    component = component.replace(/\s+/g, ' ').trim();

    if (operation) {
      return `${component} - ${operation}`;
    }
    return component;
  }

  // Fallback: clean up the raw line more aggressively
  let cleaned = rawLine;

  // Remove leading numbers (line numbers)
  cleaned = cleaned.replace(/^\s*\d{1,3}\s*/, '');

  // Remove operation prefixes for cleaner output (we'll add them back formatted)
  cleaned = cleaned.replace(/^(Repl|Replace|R&R|R&I|Remove|O\/H|Overhaul|Ovhl|Rpr|Repair|Refinish|Blend)\s*/i, '');

  // Remove part numbers (6+ digits, or alphanumeric with digits like "622546LY0A")
  cleaned = cleaned.replace(/[A-Z0-9]*\d{5,}[A-Z0-9]*/gi, '');

  // Remove prices (digits with decimal, like "1603.82" or "234.56")
  cleaned = cleaned.replace(/\d+\.\d{2}/g, '');

  // Remove "Incl.", "Included", etc.
  cleaned = cleaned.replace(/\b(Incl\.?|Included|Inc\.?)\b/gi, '');

  // Remove A/M, CAPA, OEM, NSF quality markers (keep them only if that's all we have)
  const qualityMarkers = cleaned.match(/\b(A\/M|CAPA|OEM|NSF|LKQ|KEYSTONE)\b/gi);
  cleaned = cleaned.replace(/\b(A\/M|CAPA|OEM|NSF|LKQ|KEYSTONE)\b/gi, '');

  // Remove quantities
  cleaned = cleaned.replace(/\b\d+\s*(ea|pc|hr|hrs)\b/gi, '');
  cleaned = cleaned.replace(/\bqty[:\s]*\d+/gi, '');

  // Clean up whitespace and punctuation
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^[-,.\s]+|[-,.\s]+$/g, '');

  // Capitalize
  if (cleaned) {
    cleaned = cleaned.replace(/\b\w/g, c => c.toUpperCase());
  }

  // If nothing left, return a generic description with quality marker if found
  if (!cleaned || cleaned.length < 3) {
    if (qualityMarkers && qualityMarkers.length > 0) {
      return `Part (${qualityMarkers[0].toUpperCase()})`;
    }
    return rawLine.substring(0, 40).trim();
  }

  // Add operation back if we detected one
  if (operation && !cleaned.toLowerCase().includes(operation.toLowerCase())) {
    return `${cleaned} - ${operation}`;
  }

  return cleaned;
}

// Common repair operation patterns to detect in estimates
const REPAIR_PATTERNS = [
  // Bumper operations with O/H (overhaul), Rpr (repair), R&I, R&R
  { pattern: /o\/h\s*(front\s*)?bumper|bumper.*o\/h|overhaul\s*(front\s*)?bumper/i, type: "Bumper Overhaul" },
  { pattern: /rpr\s*(front\s*)?bumper|bumper.*rpr|repair\s*(front\s*)?bumper/i, type: "Bumper Repair" },
  { pattern: /r\s*&\s*i.*bumper|bumper.*r\s*&\s*i|remove.*bumper|bumper.*remove/i, type: "Bumper R&I" },
  { pattern: /r\s*&\s*r.*bumper|bumper.*r\s*&\s*r|replace.*bumper|bumper.*replace/i, type: "Bumper R&R" },
  { pattern: /front\s*bumper/i, type: "Front Bumper" },
  { pattern: /rear\s*bumper/i, type: "Rear Bumper" },
  // Grille operations with R&I, R&R
  { pattern: /r\s*&\s*i\s*grille?|grille?\s*r\s*&\s*i/i, type: "Grille R&I" },
  { pattern: /r\s*&\s*r\s*grille?|grille?\s*r\s*&\s*r/i, type: "Grille R&R" },
  { pattern: /grille|grill/i, type: "Grille" },
  { pattern: /windshield|w\/s|wsr|front\s*glass/i, type: "Windshield" },
  { pattern: /r\s*&\s*i.*mirror|mirror.*r\s*&\s*i|side\s*mirror|door\s*mirror/i, type: "Side Mirror" },
  { pattern: /headlamp|headlight|head\s*lamp|head\s*light/i, type: "Headlamp" },
  { pattern: /radar\s*sensor|front\s*radar|distronic/i, type: "Radar Sensor" },
  { pattern: /camera|cam\b/i, type: "Camera" },
  { pattern: /hood|bonnet/i, type: "Hood" },
  { pattern: /fender/i, type: "Fender" },
  { pattern: /quarter\s*panel|qtr\s*panel/i, type: "Quarter Panel" },
  { pattern: /door\s*shell|door\s*skin/i, type: "Door" },
  { pattern: /tailgate|tail\s*gate|liftgate|lift\s*gate/i, type: "Tailgate/Liftgate" },
  { pattern: /alignment|align/i, type: "Alignment" },
  { pattern: /suspension|strut|shock|control\s*arm/i, type: "Suspension" },
  { pattern: /steering|rack|tie\s*rod/i, type: "Steering" },
  { pattern: /sensor/i, type: "Sensor" },
  { pattern: /calibrat/i, type: "Calibration" },
  { pattern: /blend|refinish|paint/i, type: "Refinish/Paint" },
  { pattern: /structural|frame|rail/i, type: "Structural" },
  { pattern: /roof|moonroof|sunroof/i, type: "Roof" },
  { pattern: /trunk|decklid/i, type: "Trunk/Decklid" },
];

export function detectRepairs(estimateText: string): DetectedRepair[] {
  const lines = estimateText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const detectedRepairs: DetectedRepair[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip supplier/vendor address lines
    if (isSupplierAddressLine(line)) {
      continue;
    }

    for (const repairPattern of REPAIR_PATTERNS) {
      if (repairPattern.pattern.test(line)) {
        // Avoid duplicate repair types for the same line
        if (!detectedRepairs.find(r => r.lineNumber === i + 1 && r.repairType === repairPattern.type)) {
          detectedRepairs.push({
            lineNumber: i + 1,
            description: cleanRepairDescription(line),
            repairType: repairPattern.type,
          });
        }
        break; // Only match first pattern per line
      }
    }
  }

  return detectedRepairs;
}

export async function scrubEstimate(
  estimateText: string,
  vehicleYear: number,
  vehicleMake: string,
  vehicleModel: string
): Promise<{ results: ScrubResult[]; vehicle: VehicleWithSource | null; detectedRepairs: DetectedRepair[] }> {
  // Always detect repairs from the estimate
  const detectedRepairs = detectRepairs(estimateText);

  // Get all vehicles for this make and filter case-insensitively
  const allVehicles = await prisma.vehicle.findMany({
    where: {
      yearStart: { lte: vehicleYear },
      yearEnd: { gte: vehicleYear },
    },
    include: {
      repairCalibrationMaps: true,
      adasSystems: {
        include: {
          calibrationTriggers: true,
        },
      },
    },
  });

  // Normalize make for matching (handle Mercedes variants: Mercedes, Mercedes Benz, Mercedes-Benz)
  const normalizeMake = (make: string): string => {
    const lower = make.toLowerCase();
    if (lower.includes('mercedes')) return 'mercedes';
    return lower;
  };

  // Case-insensitive search for exact model match
  let vehicle = allVehicles.find(
    v => normalizeMake(v.make) === normalizeMake(vehicleMake) &&
         v.model.toLowerCase() === vehicleModel.toLowerCase()
  );

  // If no exact match, try "All Models" for the make
  if (!vehicle) {
    vehicle = allVehicles.find(
      v => normalizeMake(v.make) === normalizeMake(vehicleMake) &&
           v.model.toLowerCase() === "all models"
    );
  }

  if (!vehicle) {
    return { results: [], vehicle: null, detectedRepairs };
  }

  // Parse estimate lines
  const lines = estimateText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const results: ScrubResult[] = [];

  // Build a map of system names to their calibration types
  const systemCalibrationTypes = new Map<string, string | null>();
  for (const system of vehicle.adasSystems) {
    systemCalibrationTypes.set(system.systemName, system.calibrationType);
  }

  // Check each line against repair keywords
  for (let i = 0; i < lines.length; i++) {
    // Skip supplier/vendor address lines
    if (isSupplierAddressLine(lines[i])) {
      continue;
    }

    const line = lines[i].toLowerCase();
    const calibrationMatches: CalibrationMatch[] = [];

    // Try to extract CCC ONE estimate line number
    const cccLineNumber = extractCCCLineNumber(lines[i]);

    for (const mapping of vehicle.repairCalibrationMaps) {
      const keywords: string[] = JSON.parse(mapping.repairKeywords);
      const triggeredSystems: string[] = JSON.parse(mapping.triggersCalibration);

      // Parse optional procedure details from mapping
      let procedureType: string | undefined;
      let procedureName: string | undefined;
      let location: string | undefined;
      let toolsRequired: string[] | undefined;

      try {
        if (mapping.procedureType) procedureType = mapping.procedureType;
        if (mapping.procedureName) procedureName = mapping.procedureName;
        if (mapping.location) location = mapping.location;
        if (mapping.toolsRequired) toolsRequired = JSON.parse(mapping.toolsRequired);
      } catch {
        // Ignore parsing errors for optional fields
      }

      for (const keyword of keywords) {
        if (line.includes(keyword.toLowerCase())) {
          // Found a match - add all triggered systems
          for (const systemName of triggeredSystems) {
            // Avoid duplicates
            if (!calibrationMatches.find((m) => m.systemName === systemName && m.matchedKeyword === keyword)) {
              calibrationMatches.push({
                systemName,
                calibrationType: systemCalibrationTypes.get(systemName) || null,
                reason: `Repair operation "${mapping.repairOperation}" triggers calibration`,
                matchedKeyword: keyword,
                repairOperation: mapping.repairOperation,
                procedureType,
                procedureName,
                location,
                toolsRequired,
              });
            }
          }
        }
      }
    }

    if (calibrationMatches.length > 0) {
      // Use CCC line number if available, otherwise use text line position
      const lineNumber = cccLineNumber !== null ? cccLineNumber : i + 1;
      results.push({
        lineNumber,
        description: cleanRepairDescription(lines[i]),
        calibrationMatches,
      });
    }
  }

  return {
    results,
    vehicle: {
      id: vehicle.id,
      yearStart: vehicle.yearStart,
      yearEnd: vehicle.yearEnd,
      make: vehicle.make,
      model: vehicle.model,
      sourceProvider: vehicle.sourceProvider,
      sourceUrl: vehicle.sourceUrl,
    },
    detectedRepairs,
  };
}

export async function getVehicles() {
  return prisma.vehicle.findMany({
    orderBy: [{ make: "asc" }, { model: "asc" }, { yearStart: "desc" }],
  });
}

export async function getVehicleAdasSystems(vehicleId: string) {
  return prisma.adasSystem.findMany({
    where: { vehicleId },
    include: {
      calibrationTriggers: true,
    },
    orderBy: { systemName: "asc" },
  });
}
