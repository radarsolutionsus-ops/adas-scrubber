import { NextRequest, NextResponse } from "next/server";
import { scrubEstimate, detectRepairs } from "@/lib/scrubber";
import { getSession, recordUsage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  decodeVIN,
  extractVINFromText,
  getYearFromVIN,
  isValidVIN,
  VINDecodeResult,
} from "@/lib/vin-decoder";
import {
  parseEstimate,
  detectEstimateFormat,
  REPAIR_KEYWORDS,
  ADAS_PART_INDICATORS,
  getADASSystemDescription,
  EstimateFormat,
} from "@/lib/estimate-parser";

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

async function extractVehicleInfo(text: string): Promise<ExtractedVehicleInfo> {
  const result: ExtractedVehicleInfo = {
    confidence: 'low',
    source: 'text',
  };

  // Step 1: Try to find and decode VIN
  const vin = extractVINFromText(text);

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
  if (!result.year && textInfo.year) result.year = textInfo.year;
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
  const normalizedText = text.replace(/\s+/g, ' ').toUpperCase();

  // Find year (4 digits between 1990-2030)
  const yearMatch = text.match(/\b(199[0-9]|20[0-2][0-9]|2030)\b/);
  if (yearMatch) {
    result.year = parseInt(yearMatch[1], 10);
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
  const pdfParse = require('pdf-parse/lib/pdf-parse');
  const data = await pdfParse(buffer);
  return data.text;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Please login to analyze estimates" },
        { status: 401 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let estimateText: string;
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

      const buffer = Buffer.from(await file.arrayBuffer());
      estimateText = await parsePdf(buffer);

      if (yearStr) providedYear = parseInt(yearStr, 10);
      if (makeStr) providedMake = makeStr;
      if (modelStr) providedModel = modelStr;
    } else {
      const body = await request.json();
      estimateText = body.estimateText;
      if (body.vehicleYear) providedYear = parseInt(body.vehicleYear, 10);
      if (body.vehicleMake) providedMake = body.vehicleMake;
      if (body.vehicleModel) providedModel = body.vehicleModel;
    }

    if (!estimateText) {
      return NextResponse.json({ error: "No estimate text provided" }, { status: 400 });
    }

    // Step 1: Parse estimate with enhanced parser
    const parsedEstimate = parseEstimate(estimateText);

    // Step 2: Extract vehicle info (VIN API + text parsing)
    const extractedVehicle = await extractVehicleInfo(estimateText);

    // Use provided values or fall back to extracted
    const vehicleYear = providedYear || extractedVehicle.year;
    const vehicleMake = providedMake || extractedVehicle.make;
    const vehicleModel = providedModel || extractedVehicle.model;

    // Step 3: Run scrub against database
    let results: Awaited<ReturnType<typeof scrubEstimate>>['results'] = [];
    let vehicle: Awaited<ReturnType<typeof scrubEstimate>>['vehicle'] = null;
    let detectedRepairs: Awaited<ReturnType<typeof scrubEstimate>>['detectedRepairs'] = [];

    if (vehicleYear && vehicleMake && vehicleModel) {
      const scrubResult = await scrubEstimate(estimateText, vehicleYear, vehicleMake, vehicleModel);
      results = scrubResult.results;
      vehicle = scrubResult.vehicle;
      detectedRepairs = scrubResult.detectedRepairs;
    } else if (vehicleMake) {
      const scrubResult = await scrubEstimate(estimateText, vehicleYear || 2024, vehicleMake, "All Models");
      results = scrubResult.results;
      vehicle = scrubResult.vehicle;
      detectedRepairs = scrubResult.detectedRepairs;
    } else {
      detectedRepairs = detectRepairs(estimateText);
    }

    // Step 4: Build enhanced response
    const vehicleInfo = vehicleYear && vehicleMake && vehicleModel
      ? `${vehicleYear} ${vehicleMake} ${vehicleModel}`
      : vehicleMake
      ? `${vehicleYear || ''} ${vehicleMake} ${vehicleModel || 'Unknown'}`.trim()
      : 'Unknown Vehicle';

    // Create report
    const report = await prisma.report.create({
      data: {
        shopId: session.shopId,
        vehicleYear: vehicleYear || 0,
        vehicleMake: vehicleMake || 'Unknown',
        vehicleModel: vehicleModel || 'Unknown',
        estimateText,
        calibrations: JSON.stringify(results),
      },
    });

    await recordUsage(session.shopId, vehicleInfo, report.id);

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

    // Include ADAS parts detected in estimate
    const adasPartsInEstimate = parsedEstimate.adasPartsFound.map(p => ({
      system: p.system,
      description: getADASSystemDescription(p.system),
      lineNumbers: p.lineNumbers,
    }));

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
    });
  } catch (error) {
    console.error("Scrub error:", error);
    return NextResponse.json({ error: "Failed to scrub estimate" }, { status: 500 });
  }
}
