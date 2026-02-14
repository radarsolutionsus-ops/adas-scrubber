import { NextRequest, NextResponse } from "next/server";
import { scrubEstimate, type ScrubResult } from "@/lib/scrubber";
import { applyLearningRules } from "@/lib/learning-memory";
import { auth } from "@/auth";
import { recordUsage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  decodeVIN,
  extractVINFromText,
  getYearFromVIN,
  isValidVIN,
  VINDecodeResult,
} from "@/lib/vin-decoder";
import {
  appendEstimateIdentifierHints,
  extractEstimateIdentifiersFromFileName,
  parseEstimate,
  extractEstimateMetadata,
  extractEstimateIdentifiers,
  mergeEstimateIdentifiers,
  getADASSystemDescription,
} from "@/lib/estimate-parser";
import {
  calibrationOperationForSystem,
  canonicalizeCalibrationType,
  canonicalizeOperationName,
  canonicalizeSystem,
  mergeCalibrationTypes,
  normalizeForKey,
} from "@/lib/calibration-normalization";

// Common vehicle models by make for text-based detection fallback
const VEHICLE_MODELS: Record<string, string[]> = {
  'Toyota': ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Tacoma', 'Tundra', 'Prius', 'Sienna', '4Runner', 'Avalon', 'Venza', 'Supra', 'GR86', 'Sequoia', 'Land Cruiser', 'Crown', 'bZ4X', 'Grand Highlander'],
  'Honda': ['Civic', 'Accord', 'CR-V', 'Pilot', 'Odyssey', 'HR-V', 'Passport', 'Ridgeline', 'Insight', 'Prologue'],
  'Nissan': ['Altima', 'Sentra', 'Maxima', 'Rogue', 'Murano', 'Pathfinder', 'Frontier', 'Titan', 'Armada', 'Kicks', 'Versa', 'Leaf', 'Z', 'Ariya'],
  'Ford': ['F-150', 'F150', 'Mustang', 'Explorer', 'Escape', 'Edge', 'Bronco', 'Ranger', 'Expedition', 'Maverick', 'Transit', 'Mach-E', 'Lightning'],
  'Chevrolet': ['Silverado', 'Malibu', 'Equinox', 'Traverse', 'Tahoe', 'Suburban', 'Colorado', 'Camaro', 'Corvette', 'Blazer', 'Trailblazer', 'Bolt', 'Trax'],
  'Hyundai': ['Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Palisade', 'Kona', 'Venue', 'Ioniq', 'Ioniq 5', 'Ioniq 6', 'Santa Cruz'],
  'Kia': ['Forte', 'K5', 'Sportage', 'Sorento', 'Telluride', 'Soul', 'Seltos', 'Carnival', 'Stinger', 'EV6', 'EV9', 'Niro'],
  'Mazda': ['Mazda3', 'Mazda6', 'CX-5', 'CX-9', 'CX-30', 'CX-50', 'CX-70', 'CX-90', 'MX-5', 'MX-30'],
  'Subaru': ['Outback', 'Forester', 'Crosstrek', 'Impreza', 'Legacy', 'Ascent', 'WRX', 'BRZ', 'Solterra'],
  'Volkswagen': ['Jetta', 'Passat', 'Tiguan', 'Atlas', 'Golf', 'GTI', 'Arteon', 'Taos', 'ID.4', 'ID.Buzz'],
  'BMW': ['3 Series', '5 Series', 'X3', 'X5', 'X1', 'X7', '7 Series', '4 Series', 'M3', 'M5', 'iX', 'i4', 'i7'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'S-Class', 'GLC', 'GLE', 'GLA', 'GLB', 'A-Class', 'CLA', 'GLS', 'AMG GT', 'EQS', 'EQE', 'EQB', 'Sprinter'],
  'Audi': ['A4', 'A6', 'Q5', 'Q7', 'Q3', 'A3', 'A5', 'Q8', 'e-tron', 'Q4 e-tron', 'RS'],
  'Lexus': ['ES', 'RX', 'NX', 'GX', 'IS', 'LX', 'UX', 'LS', 'LC', 'RZ'],
  'Infiniti': ['Q50', 'Q60', 'QX50', 'QX60', 'QX80', 'QX55'],
  'Acura': ['TLX', 'MDX', 'RDX', 'Integra', 'ZDX'],
  'Volvo': ['XC90', 'XC60', 'XC40', 'S60', 'S90', 'V60', 'V90', 'C40', 'EX90', 'EX30'],
  'Genesis': ['G70', 'G80', 'G90', 'GV70', 'GV80', 'GV60', 'Electrified G80'],
  'Jeep': ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Gladiator', 'Renegade', 'Wagoneer', 'Grand Wagoneer'],
  'Dodge': ['Charger', 'Challenger', 'Durango', 'Hornet'],
  'Ram': ['1500', '2500', '3500', 'ProMaster'],
  'GMC': ['Sierra', 'Yukon', 'Acadia', 'Terrain', 'Canyon', 'Hummer EV'],
  'Buick': ['Enclave', 'Encore', 'Envision', 'Envista'],
  'Cadillac': ['Escalade', 'CT5', 'CT4', 'XT5', 'XT6', 'Lyriq', 'Celestiq'],
  'Lincoln': ['Navigator', 'Aviator', 'Corsair', 'Nautilus'],
  'Chrysler': ['Pacifica', '300'],
  'Porsche': ['911', 'Cayenne', 'Macan', 'Panamera', 'Taycan', 'Boxster', 'Cayman'],
  'Tesla': ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck'],
};

// Make abbreviations and aliases commonly found in estimates
const MAKE_ALIASES: Record<string, string> = {
  'NISS': 'Nissan', 'NIS': 'Nissan', 'NISSAN': 'Nissan',
  'INFI': 'Infiniti', 'INF': 'Infiniti', 'INFIN': 'Infiniti', 'INFINITI': 'Infiniti',
  'TOY': 'Toyota', 'TOYO': 'Toyota', 'TOYOTA': 'Toyota',
  'LEX': 'Lexus', 'LEXUS': 'Lexus',
  'HON': 'Honda', 'HOND': 'Honda', 'HONDA': 'Honda',
  'ACU': 'Acura', 'ACUR': 'Acura', 'ACURA': 'Acura',
  'CHEV': 'Chevrolet', 'CHE': 'Chevrolet', 'CHEVY': 'Chevrolet', 'CHEVROLET': 'Chevrolet',
  'GMC': 'GMC',
  'BUI': 'Buick', 'BUIC': 'Buick', 'BUICK': 'Buick',
  'CAD': 'Cadillac', 'CADI': 'Cadillac', 'CADDY': 'Cadillac', 'CADILLAC': 'Cadillac',
  'FORD': 'Ford', 'FRD': 'Ford',
  'LIN': 'Lincoln', 'LINC': 'Lincoln', 'LINCOLN': 'Lincoln',
  'MERC': 'Mercedes-Benz', 'MERCEDES': 'Mercedes-Benz', 'MERCEDES-BENZ': 'Mercedes-Benz',
  'BENZ': 'Mercedes-Benz', 'MB': 'Mercedes-Benz', 'MBUSA': 'Mercedes-Benz',
  'BMW': 'BMW',
  'MINI': 'MINI',
  'VW': 'Volkswagen', 'VOLK': 'Volkswagen', 'VOLKS': 'Volkswagen', 'VOLKSWAGEN': 'Volkswagen',
  'AUD': 'Audi', 'AUDI': 'Audi',
  'POR': 'Porsche', 'PORS': 'Porsche', 'PORSCHE': 'Porsche',
  'HYU': 'Hyundai', 'HYUN': 'Hyundai', 'HYUNDAI': 'Hyundai',
  'KIA': 'Kia',
  'GEN': 'Genesis', 'GENE': 'Genesis', 'GENESIS': 'Genesis',
  'MAZ': 'Mazda', 'MAZD': 'Mazda', 'MAZDA': 'Mazda',
  'SUB': 'Subaru', 'SUBA': 'Subaru', 'SUBARU': 'Subaru',
  'JEE': 'Jeep', 'JEEP': 'Jeep',
  'DOD': 'Dodge', 'DODG': 'Dodge', 'DODGE': 'Dodge',
  'RAM': 'Ram',
  'CHR': 'Chrysler', 'CHRY': 'Chrysler', 'CHRYSLER': 'Chrysler',
  'VOL': 'Volvo', 'VOLV': 'Volvo', 'VOLVO': 'Volvo',
  'JAG': 'Jaguar', 'JAGU': 'Jaguar', 'JAGUAR': 'Jaguar',
  'LAND': 'Land Rover', 'LR': 'Land Rover', 'LANDROVER': 'Land Rover', 'LAND ROVER': 'Land Rover',
  'TES': 'Tesla', 'TESL': 'Tesla', 'TESLA': 'Tesla',
  'RIV': 'Rivian', 'RIVI': 'Rivian', 'RIVIAN': 'Rivian',
};

// Enhanced vehicle info extraction combining VIN API + text parsing
interface ExtractedVehicleInfo {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  vin?: string;
  vinDecoded?: VINDecodeResult;
  adasFeaturesFromVIN?: VINDecodeResult['adasFeatures'];
  confidence: 'high' | 'medium' | 'low';
  source: 'vin_api' | 'vin_partial' | 'text' | 'combined';
}

async function extractVehicleInfo(text: string, vinHint?: string): Promise<ExtractedVehicleInfo> {
  const result: ExtractedVehicleInfo = {
    confidence: 'low',
    source: 'text',
  };

  // Step 1: Try to find and decode VIN
  const vinFromText = extractVINFromText(text);
  const vinFromHint = vinHint ? extractVINFromText(vinHint) : null;
  const vin = vinFromText || vinFromHint;

  if (vin && isValidVIN(vin)) {
    result.vin = vin;

    try {
      // Call NHTSA API for full VIN decode
      const vinDecoded = await decodeVIN(vin);
      result.vinDecoded = vinDecoded;

      if (vinDecoded.year && vinDecoded.make && vinDecoded.model) {
        // Full VIN decode successful - highest confidence
        result.year = vinDecoded.year;
        result.make = vinDecoded.make;
        result.model = vinDecoded.model;
        result.trim = vinDecoded.trim || undefined;
        result.adasFeaturesFromVIN = vinDecoded.adasFeatures;
        result.confidence = 'high';
        result.source = 'vin_api';
        return result;
      }

      // Partial VIN decode - use what we got
      if (vinDecoded.year) result.year = vinDecoded.year;
      if (vinDecoded.make) result.make = vinDecoded.make;
      if (vinDecoded.model) result.model = vinDecoded.model;
      if (vinDecoded.adasFeatures) result.adasFeaturesFromVIN = vinDecoded.adasFeatures;

      // Try to get year from VIN character if API didn't return it
      if (!result.year) {
        result.year = getYearFromVIN(vin) || undefined;
      }

      if (result.year || result.make) {
        result.confidence = 'medium';
        result.source = 'vin_partial';
      }
    } catch (error) {
      console.error('VIN decode error:', error);
      // Fall back to VIN character year
      result.year = getYearFromVIN(vin) || undefined;
    }
  }

  // Step 2: Text-based detection (supplement or fallback)
  const textInfo = extractVehicleFromText(text);

  // Merge text-based info if we're missing data
  // IMPORTANT: VIN-based year should ALWAYS take priority over text extraction
  // Only use text year if we have NO VIN at all
  if (!result.year && textInfo.year) {
    // Only trust text year if no VIN was found, or if years are close
    if (!result.vin) {
      result.year = textInfo.year;
    } else if (result.vinDecoded?.errors && result.vinDecoded.errors.length > 0) {
      // VIN decode failed, but validate text year is reasonable (2010+)
      if (textInfo.year >= 2010) {
        result.year = textInfo.year;
      }
    }
  }
  if (!result.make && textInfo.make) result.make = textInfo.make;
  if (!result.model && textInfo.model) result.model = textInfo.model;

  // Update confidence if we got info from text
  if (result.source === 'text' && (result.year || result.make || result.model)) {
    result.confidence = result.year && result.make && result.model ? 'medium' : 'low';
  } else if (result.source === 'vin_partial' && textInfo.make) {
    result.source = 'combined';
  }

  return result;
}

function extractVehicleFromText(text: string): { year?: number; make?: string; model?: string } {
  const result: { year?: number; make?: string; model?: string } = {};

  // Find year - look for ALL years and pick the most likely vehicle year
  // Vehicle years are typically recent (2015-2030), prioritize those over older dates
  const yearRegex = /\b(199[0-9]|20[0-3][0-9])\b/g;
  const allYears: number[] = [];
  let match;
  while ((match = yearRegex.exec(text)) !== null) {
    allYears.push(parseInt(match[1], 10));
  }

  if (allYears.length > 0) {
    // Filter to likely vehicle years (2010+) first
    const recentYears = allYears.filter(y => y >= 2010 && y <= 2030);

    if (recentYears.length > 0) {
      // Find the most common recent year, or the highest one
      const yearCounts = new Map<number, number>();
      for (const y of recentYears) {
        yearCounts.set(y, (yearCounts.get(y) || 0) + 1);
      }

      // Get year with highest count, prefer higher year on tie
      let bestYear = recentYears[0];
      let bestCount = 0;
      for (const [year, count] of yearCounts) {
        if (count > bestCount || (count === bestCount && year > bestYear)) {
          bestYear = year;
          bestCount = count;
        }
      }
      result.year = bestYear;
    } else {
      // No recent years found, use the highest year found
      result.year = Math.max(...allYears);
    }
  }

  // Check for make aliases first (NISS, CHEV, TOY, etc.)
  for (const [alias, fullMake] of Object.entries(MAKE_ALIASES)) {
    const aliasRegex = new RegExp(`\\b${alias}\\b`, 'i');
    if (aliasRegex.test(text)) {
      result.make = fullMake;

      // Look for model after alias
      const models = VEHICLE_MODELS[fullMake] || [];
      for (const model of models) {
        const escapedModel = model.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const modelRegex = new RegExp(`\\b${escapedModel}\\b`, 'i');
        if (modelRegex.test(text)) {
          result.model = model;
          break;
        }
      }

      // Try to extract word after alias as model
      if (!result.model) {
        const afterAliasPattern = new RegExp(`${alias}\\s+([A-Za-z0-9-]+)(?:\\s+(\\d{2,3}|[A-Za-z]{1,3}))?`, 'i');
        const afterMatch = text.match(afterAliasPattern);
        if (afterMatch && afterMatch[1] && !/^\d{4}$/.test(afterMatch[1])) {
          const modelPart = afterMatch[1];
          const variantPart = afterMatch[2];
          if (!['VIN', 'THE', 'AND', 'FOR', 'CAR', 'AUTO'].includes(modelPart.toUpperCase())) {
            const knownModel = models.find(m => m.toLowerCase() === modelPart.toLowerCase());
            result.model = knownModel || (variantPart ? `${modelPart} ${variantPart}` : modelPart);
          }
        }
      }

      break;
    }
  }

  // Full make name search if no alias found
  if (!result.make) {
    const makes = Object.keys(VEHICLE_MODELS);
    for (const make of makes) {
      const makeRegex = new RegExp(`\\b${make.replace(/[-]/g, '[-\\s]?')}\\b`, 'i');
      if (makeRegex.test(text)) {
        result.make = make;

        // Look for model
        const models = VEHICLE_MODELS[make] || [];
        for (const model of models) {
          const escapedModel = model.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const modelRegex = new RegExp(`\\b${escapedModel}\\b`, 'i');
          if (modelRegex.test(text)) {
            result.model = model;
            break;
          }
        }
        break;
      }
    }
  }

  return result;
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse/lib/pdf-parse");
  const pdfParse = (pdfParseModule.default || pdfParseModule) as (dataBuffer: Buffer) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  return data.text;
}

function buildAnalysisConfidence(input: {
  hasVehicleFromDb: boolean;
  extractedConfidence: "high" | "medium" | "low";
  resultsCount: number;
  detectedRepairCount: number;
  adasPartsCount: number;
  hasVin: boolean;
  usedInferenceFallback: boolean;
}) {
  const reasons: string[] = [];
  let score = 52;

  if (input.hasVehicleFromDb) {
    score += 20;
    reasons.push("Vehicle mapped to OEM-backed database record.");
  } else {
    reasons.push("No exact vehicle mapping found; falling back to generic detection.");
  }

  if (input.hasVin) {
    score += 8;
    reasons.push("VIN detected and used for vehicle confidence.");
  }

  if (input.extractedConfidence === "high") {
    score += 12;
    reasons.push("Vehicle extraction confidence is high.");
  } else if (input.extractedConfidence === "medium") {
    score += 7;
    reasons.push("Vehicle extraction confidence is medium.");
  } else {
    score += 2;
    reasons.push("Vehicle extraction confidence is low.");
  }

  if (input.detectedRepairCount >= 5) {
    score += 10;
    reasons.push("Sufficient repair-line evidence was detected.");
  } else if (input.detectedRepairCount >= 2) {
    score += 5;
    reasons.push("Moderate repair-line evidence was detected.");
  } else {
    reasons.push("Limited repair-line evidence was detected.");
  }

  if (input.resultsCount > 0) {
    score += 8;
    reasons.push("Calibration recommendations matched to known repair triggers.");
  }

  if (input.adasPartsCount > 0) {
    score += 6;
    reasons.push("ADAS-specific parts were detected in estimate content.");
  }

  if (input.usedInferenceFallback) {
    score -= 8;
    reasons.push("Used inference fallback because direct OEM map matching was limited.");
  }

  const normalized = Math.max(45, Math.min(96, score));
  const label = normalized >= 85 ? "high" : normalized >= 70 ? "medium" : "low";

  return { score: normalized, label, reasons };
}

function inferCalibrations(
  detectedRepairs: Array<{ lineNumber: number; description: string; repairType: string }>,
  adasPartsInEstimate: Array<{ system: string; description: string; lineNumbers: number[] }>
): ScrubResult[] {
  const resultsByLine = new Map<number, ScrubResult>();
  const adasPartGuidance: Record<string, {
    component: string;
    systemName: string;
    calibrationType: string;
    repairOperation: string;
    reason: string;
  }> = {
    frontRadar: {
      component: "Front Radar Sensor",
      systemName: "Front Radar / ACC-AEB",
      calibrationType: "Static or Dynamic",
      repairOperation: "Front Radar Calibration",
      reason: "Front radar component detected in estimate; radar aiming/calibration is typically required after service.",
    },
    frontCamera: {
      component: "Forward Camera",
      systemName: "Forward Camera / LDW-LKA",
      calibrationType: "Static + Dynamic",
      repairOperation: "Forward Camera Calibration",
      reason: "Forward-facing ADAS camera component detected; camera calibration procedure is typically required.",
    },
    blindSpotMonitor: {
      component: "Blind Spot Radar Sensor",
      systemName: "Blind Spot / Rear Cross Traffic",
      calibrationType: "Static",
      repairOperation: "Blind Spot Radar Calibration",
      reason: "Blind spot radar-related component detected; BSM/RCTA verification and calibration are typically required.",
    },
    surroundCamera: {
      component: "Surround View Camera",
      systemName: "Surround View / 360 Camera",
      calibrationType: "Static",
      repairOperation: "Surround View Camera Calibration",
      reason: "360/surround camera component detected; multi-camera alignment/calibration is typically required.",
    },
    parkingSensor: {
      component: "Parking Sensor",
      systemName: "Parking Assist Sensors",
      calibrationType: "Coding / Initialization",
      repairOperation: "Parking Sensor Calibration",
      reason: "Parking-assist sensor component detected; sensor initialization/coding and verification are typically required.",
    },
    steeringAngleSensor: {
      component: "Steering Angle Sensor",
      systemName: "Steering Angle Sensor",
      calibrationType: "Initialization",
      repairOperation: "Steering Angle Sensor Reset/Relearn",
      reason: "Steering-angle related component detected; SAS reset/relearn is typically required after service.",
    },
    rearCamera: {
      component: "Rear View Camera",
      systemName: "Rear View Camera",
      calibrationType: "Static",
      repairOperation: "Rear Camera Calibration",
      reason: "Rear camera component detected; calibration/aim verification is typically required.",
    },
  };

  const pushMatch = (
    lineNumber: number,
    description: string,
    match: {
      systemName: string;
      calibrationType: string | null;
      reason: string;
      matchedKeyword: string;
      repairOperation: string;
    }
  ) => {
    const existing = resultsByLine.get(lineNumber);
    if (!existing) {
      resultsByLine.set(lineNumber, {
        lineNumber,
        description,
        calibrationMatches: [match],
      });
      return;
    }
    if (!existing.calibrationMatches.some((m) => m.systemName === match.systemName && m.matchedKeyword === match.matchedKeyword)) {
      existing.calibrationMatches.push(match);
    }
  };

  for (const repair of detectedRepairs) {
    const repairType = repair.repairType.toLowerCase();

    if (/(windshield|camera|headlamp)/.test(repairType)) {
      pushMatch(repair.lineNumber, repair.description, {
        systemName: "Forward Camera / LDW-LKA",
        calibrationType: "Static + Dynamic",
        reason: "Camera or windshield-area repair commonly requires forward-camera aiming/calibration.",
        matchedKeyword: repair.repairType,
        repairOperation: "Forward Camera Calibration",
      });
    }

    if (/(front bumper|bumper overhaul|bumper repair|bumper r&i|bumper r&r|grille|radar sensor)/.test(repairType)) {
      pushMatch(repair.lineNumber, repair.description, {
        systemName: "Front Radar / ACC-AEB",
        calibrationType: "Static or Dynamic",
        reason: "Front fascia/radar-zone repair commonly requires front-radar calibration.",
        matchedKeyword: repair.repairType,
        repairOperation: "Front Radar Calibration",
      });
    }

    if (/(rear bumper|tailgate|quarter panel|side mirror)/.test(repairType)) {
      pushMatch(repair.lineNumber, repair.description, {
        systemName: "Blind Spot / Rear Cross Traffic",
        calibrationType: "Static",
        reason: "Rear-quarter and mirror-zone work can impact blind-spot and rear-cross-traffic sensors.",
        matchedKeyword: repair.repairType,
        repairOperation: "Blind Spot Radar Calibration",
      });
    }

    if (/(alignment|suspension|steering)/.test(repairType)) {
      pushMatch(repair.lineNumber, repair.description, {
        systemName: "Steering Angle Sensor",
        calibrationType: "Initialization",
        reason: "Alignment or steering work commonly requires steering-angle reset/relearn.",
        matchedKeyword: repair.repairType,
        repairOperation: "Steering Angle Sensor Reset/Relearn",
      });
    }
  }

  for (const adasPart of adasPartsInEstimate) {
    const guidance = adasPartGuidance[adasPart.system] || {
      component: adasPart.description,
      systemName: adasPart.description,
      calibrationType: "OEM Procedure",
      repairOperation: `${adasPart.description} Calibration`,
      reason: "ADAS-related component detected in estimate; calibration verification is recommended.",
    };

    const lineNumber = adasPart.lineNumbers[0] || 1;
    pushMatch(lineNumber, guidance.component, {
      systemName: guidance.systemName,
      calibrationType: guidance.calibrationType,
      reason: guidance.reason,
      matchedKeyword: adasPart.system,
      repairOperation: guidance.repairOperation,
    });
  }

  return Array.from(resultsByLine.values()).sort((a, b) => a.lineNumber - b.lineNumber);
}

function groupCalibrations(results: ScrubResult[]) {
  type GroupedCalibration = {
    systemName: string;
    calibrationType: string;
    reason: string;
    repairOperation: string;
    matchedKeywords: string[];
    triggerLines: number[];
    triggerDescriptions: string[];
    calibrationTypes: string[];
    reasons: string[];
  };

  const grouped = new Map<string, GroupedCalibration>();

  for (const result of results) {
    for (const match of result.calibrationMatches) {
      const repairOperation = canonicalizeOperationName(
        match.repairOperation,
        match.systemName,
        match.matchedKeyword
      );
      const normalizedSystem = canonicalizeSystem(match.systemName, repairOperation);
      const recommendedOperation = calibrationOperationForSystem(normalizedSystem, repairOperation);
      const calibrationType = canonicalizeCalibrationType(match.calibrationType);
      const key = normalizeForKey(recommendedOperation);

      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          systemName: normalizedSystem.label,
          calibrationType,
          reason: match.reason,
          repairOperation: recommendedOperation,
          matchedKeywords: [match.matchedKeyword],
          triggerLines: [result.lineNumber],
          triggerDescriptions: [result.description],
          calibrationTypes: [calibrationType],
          reasons: [match.reason],
        });
        continue;
      }

      const hasKeyword = existing.matchedKeywords.some(
        (keyword) => normalizeForKey(keyword) === normalizeForKey(match.matchedKeyword)
      );
      if (!hasKeyword) {
        existing.matchedKeywords.push(match.matchedKeyword);
      }
      if (!existing.triggerLines.includes(result.lineNumber)) {
        existing.triggerLines.push(result.lineNumber);
      }
      const hasDescription = existing.triggerDescriptions.some(
        (description) => normalizeForKey(description) === normalizeForKey(result.description)
      );
      if (!hasDescription) {
        existing.triggerDescriptions.push(result.description);
      }
      if (!existing.calibrationTypes.includes(calibrationType)) {
        existing.calibrationTypes.push(calibrationType);
      }
      if (!existing.reasons.includes(match.reason)) {
        existing.reasons.push(match.reason);
      }

      existing.calibrationType = mergeCalibrationTypes(existing.calibrationTypes);
      existing.reason = existing.reasons[0] || existing.reason;
    }
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      systemName: entry.systemName,
      calibrationType: mergeCalibrationTypes(entry.calibrationTypes),
      reason: entry.reasons[0] || entry.reason,
      repairOperation: entry.repairOperation,
      matchedKeywords: entry.matchedKeywords,
      triggerLines: entry.triggerLines.sort((a, b) => a - b),
      triggerDescriptions: entry.triggerDescriptions,
    }))
    .sort((a, b) => {
      const aFirstLine = a.triggerLines[0] ?? Number.MAX_SAFE_INTEGER;
      const bFirstLine = b.triggerLines[0] ?? Number.MAX_SAFE_INTEGER;
      if (aFirstLine !== bFirstLine) return aFirstLine - bFirstLine;
      return a.systemName.localeCompare(b.systemName);
    });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Please login to analyze estimates" },
        { status: 401 }
      );
    }

    const shopId = session.user.id;

    const contentType = request.headers.get("content-type") || "";
    let estimateText: string;
    let uploadFileName: string | undefined;
    let providedYear: number | undefined;
    let providedMake: string | undefined;
    let providedModel: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const yearStr = formData.get("vehicleYear") as string;
      const makeStr = formData.get("vehicleMake") as string;
      const modelStr = formData.get("vehicleModel") as string;

      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      uploadFileName = file.name;
      const buffer = Buffer.from(await file.arrayBuffer());
      estimateText = await parsePdf(buffer);

      if (yearStr) providedYear = parseInt(yearStr, 10);
      if (makeStr) providedMake = makeStr;
      if (modelStr) providedModel = modelStr;
    } else {
      const body = await request.json();
      estimateText = body.estimateText;
      uploadFileName = body.fileName;
      if (body.vehicleYear) providedYear = parseInt(body.vehicleYear, 10);
      if (body.vehicleMake) providedMake = body.vehicleMake;
      if (body.vehicleModel) providedModel = body.vehicleModel;
    }

    if (!estimateText) {
      return NextResponse.json({ error: "No estimate text provided" }, { status: 400 });
    }

    // Step 1: Parse estimate with enhanced parser
    const parsedEstimate = parseEstimate(estimateText);
    const textIdentifiers = extractEstimateIdentifiers(estimateText);
    const fileIdentifiers = extractEstimateIdentifiersFromFileName(uploadFileName);
    const estimateIdentifiers = mergeEstimateIdentifiers(textIdentifiers, fileIdentifiers);
    const estimateMetadata = extractEstimateMetadata(estimateText);
    if (!estimateMetadata.roNumber && estimateIdentifiers.roNumber) estimateMetadata.roNumber = estimateIdentifiers.roNumber;
    if (!estimateMetadata.poNumber && estimateIdentifiers.poNumber) estimateMetadata.poNumber = estimateIdentifiers.poNumber;
    if (!estimateMetadata.workfileId && estimateIdentifiers.workfileId) estimateMetadata.workfileId = estimateIdentifiers.workfileId;
    if (!estimateMetadata.claimNumber && estimateIdentifiers.claimNumber) estimateMetadata.claimNumber = estimateIdentifiers.claimNumber;

    // Step 2: Extract vehicle info (VIN API + text parsing)
    const extractedVehicle = await extractVehicleInfo(estimateText, uploadFileName);

    // Debug logging for vehicle detection
    console.log('Vehicle Detection:', {
      providedYear,
      providedMake,
      providedModel,
      extractedYear: extractedVehicle.year,
      extractedMake: extractedVehicle.make,
      extractedModel: extractedVehicle.model,
      vin: extractedVehicle.vin,
      confidence: extractedVehicle.confidence,
      source: extractedVehicle.source,
    });

    // Use provided values or fall back to extracted
    const vehicleYear = providedYear || extractedVehicle.year;
    const vehicleMake = providedMake || extractedVehicle.make;
    const vehicleModel = providedModel || extractedVehicle.model;

    // Step 3: Require fully detected vehicle profile from uploaded estimate.
    if (!vehicleYear || !vehicleMake || !vehicleModel) {
      return NextResponse.json(
        {
          error:
            "Could not fully detect vehicle year/make/model from this estimate PDF. Include a page with VIN or vehicle header.",
          detectedVehicle: {
            year: vehicleYear,
            make: vehicleMake,
            model: vehicleModel,
            vin: extractedVehicle.vin,
            confidence: extractedVehicle.confidence,
            source: extractedVehicle.source,
          },
        },
        { status: 422 }
      );
    }

    let results: Awaited<ReturnType<typeof scrubEstimate>>["results"] = [];
    let vehicle: Awaited<ReturnType<typeof scrubEstimate>>["vehicle"] = null;
    let detectedRepairs: Awaited<ReturnType<typeof scrubEstimate>>["detectedRepairs"] = [];

    const scrubResult = await scrubEstimate(estimateText, vehicleYear, vehicleMake, vehicleModel);
    results = scrubResult.results;
    vehicle = scrubResult.vehicle;
    detectedRepairs = scrubResult.detectedRepairs;

    // Step 4: Build enhanced response
    const vehicleInfo = vehicleYear && vehicleMake && vehicleModel
      ? `${vehicleYear} ${vehicleMake} ${vehicleModel}`
      : vehicleMake
      ? `${vehicleYear || ''} ${vehicleMake} ${vehicleModel || 'Unknown'}`.trim()
      : 'Unknown Vehicle';

    // Include ADAS parts detected in estimate
    const adasPartsInEstimate = parsedEstimate.adasPartsFound.map(p => ({
      system: p.system,
      description: getADASSystemDescription(p.system),
      lineNumbers: p.lineNumbers,
    }));

    let usedInferenceFallback = false;
    if (results.length === 0 && (detectedRepairs.length > 0 || adasPartsInEstimate.length > 0)) {
      const inferred = inferCalibrations(detectedRepairs, adasPartsInEstimate);
      if (inferred.length > 0) {
        results = inferred;
        usedInferenceFallback = true;
      }
    }

    const learningOutput = await applyLearningRules({
      estimateText,
      vehicleYear,
      vehicleMake,
      vehicleModel,
      results,
    });
    results = learningOutput.results;

    // Create report
    const storedEstimateText = appendEstimateIdentifierHints(estimateText, estimateIdentifiers, uploadFileName);

    const report = await prisma.report.create({
      data: {
        shopId: shopId,
        vehicleYear: vehicleYear || 0,
        vehicleMake: vehicleMake || 'Unknown',
        vehicleModel: vehicleModel || 'Unknown',
        estimateText: storedEstimateText,
        calibrations: JSON.stringify(results),
      },
    });

    await recordUsage(shopId, vehicleInfo, report.id);

    // Build detected vehicle object for response
    const detectedVehicle = {
      year: vehicleYear,
      make: vehicleMake,
      model: vehicleModel,
      trim: extractedVehicle.trim,
      vin: extractedVehicle.vin,
      confidence: extractedVehicle.confidence,
      source: extractedVehicle.source,
    };

    // Include ADAS features detected from VIN
    const adasFeaturesFromVIN = extractedVehicle.adasFeaturesFromVIN;

    const groupedCalibrations = groupCalibrations(results);

    const analysisConfidence = buildAnalysisConfidence({
      hasVehicleFromDb: Boolean(vehicle),
      extractedConfidence: extractedVehicle.confidence,
      resultsCount: groupedCalibrations.length,
      detectedRepairCount: detectedRepairs.length,
      adasPartsCount: adasPartsInEstimate.length,
      hasVin: Boolean(extractedVehicle.vin),
      usedInferenceFallback,
    });

    return NextResponse.json({
      results,
      vehicle,
      reportId: report.id,
      detectedVehicle,
      detectedRepairs,
      // Enhanced data
      estimateFormat: parsedEstimate.format,
      adasFeaturesFromVIN,
      adasPartsInEstimate,
      repairsSummary: parsedEstimate.repairsSummary,
      estimateIdentifiers,
      estimateMetadata,
      groupedCalibrations,
      learnedRuleIdsApplied: learningOutput.appliedRuleIds,
      analysisConfidence,
    });
  } catch (error) {
    console.error("Scrub error:", error);
    return NextResponse.json({ error: "Failed to scrub estimate" }, { status: 500 });
  }
}
