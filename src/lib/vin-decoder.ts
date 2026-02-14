/**
 * VIN Decoder using NHTSA vPIC API
 * Provides complete vehicle identification from VIN including:
 * - Year, Make, Model, Trim
 * - Body Style, Engine, Drivetrain
 * - Factory-installed ADAS features
 */

export interface VINDecodeResult {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  bodyClass: string | null;
  driveType: string | null;
  engineConfig: string | null;
  fuelType: string | null;
  // ADAS Features detected from VIN decode
  adasFeatures: {
    forwardCollisionWarning: boolean;
    laneDepartureWarning: boolean;
    blindSpotMonitoring: boolean;
    adaptiveCruiseControl: boolean;
    parkingAssist: boolean;
    rearCrossTraffic: boolean;
    automaticEmergencyBraking: boolean;
    laneKeepAssist: boolean;
    nightVision: boolean;
    pedestrianDetection: boolean;
    backupCamera: boolean;
    surroundViewCamera: boolean;
  };
  errors: string[];
  rawData?: Record<string, string>;
}

interface NHTSAVariable {
  Variable: string;
  Value: string | null;
  ValueId: string | null;
  VariableId: number;
}

interface NHTSAResponse {
  Count: number;
  Message: string;
  SearchCriteria: string;
  Results: NHTSAVariable[];
}

// ADAS variable name to feature flag mapping
const ADAS_VARIABLE_TO_FEATURE: Record<string, keyof VINDecodeResult['adasFeatures']> = {
  'Forward Collision Warning': 'forwardCollisionWarning',
  'Lane Departure Warning': 'laneDepartureWarning',
  'Blind Spot Warning': 'blindSpotMonitoring',
  'Adaptive Cruise Control (ACC)': 'adaptiveCruiseControl',
  'Park Assist': 'parkingAssist',
  'Rear Cross Traffic Alert': 'rearCrossTraffic',
  'Automatic Emergency Braking (AEB)': 'automaticEmergencyBraking',
  'Lane Keep System': 'laneKeepAssist',
  'Night Vision': 'nightVision',
  'Pedestrian Automatic Emergency Braking': 'pedestrianDetection',
  'Backup Camera': 'backupCamera',
  'Dynamic Brake Support (DBS)': 'automaticEmergencyBraking',
  'Crash Imminent Braking (CIB)': 'automaticEmergencyBraking',
  'Lane Centering Assistance': 'laneKeepAssist',
};

/**
 * Validate VIN format (17 characters, no I, O, Q)
 */
export function isValidVIN(vin: string): boolean {
  if (!vin || vin.length !== 17) return false;
  // VINs cannot contain I, O, or Q
  if (/[IOQ]/i.test(vin)) return false;
  // Must be alphanumeric
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) return false;
  return true;
}

/**
 * Extract VIN from text using regex
 */
export function extractVINFromText(text: string): string | null {
  if (!text) return null;

  const upperText = text.toUpperCase();

  // 1) Strict whole-token VIN matches.
  const strictMatches = upperText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/g) || [];
  for (const match of strictMatches) {
    if (isValidVIN(match)) return match;
  }

  const hasReasonableVinPattern = (candidate: string): boolean => {
    const digits = (candidate.match(/\d/g) || []).length;
    const letters = (candidate.match(/[A-Z]/g) || []).length;
    return digits >= 5 && letters >= 5;
  };

  const extractVinWindow = (value: string): string | null => {
    const compact = value.replace(/[^A-HJ-NPR-Z0-9]/g, "");
    if (compact.length < 17) return null;

    for (let i = 0; i <= compact.length - 17; i++) {
      const candidate = compact.slice(i, i + 17);
      if (isValidVIN(candidate) && hasReasonableVinPattern(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  // 2) VIN-labeled lines (handles split chars/hyphens/spaces in OCR output).
  const lines = upperText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/\bVIN\b/.test(line)) continue;

    const sameLineCandidate = line.replace(/^.*\bVIN(?:\s*(?:NO|NUMBER|#|:|-))?\s*/i, "");
    const vinFromSameLine = extractVinWindow(sameLineCandidate);
    if (vinFromSameLine) return vinFromSameLine;

    // If VIN wraps to next line, try combining with subsequent line.
    if (i + 1 < lines.length) {
      const combined = `${sameLineCandidate} ${lines[i + 1]}`;
      const vinFromCombined = extractVinWindow(combined);
      if (vinFromCombined) return vinFromCombined;
    }
  }

  // 3) Last-chance relaxed scan for OCR-separated VIN segments.
  const relaxedSegments =
    upperText.match(/[A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9\s:-]{15,45}[A-HJ-NPR-Z0-9]/g) || [];
  for (const segment of relaxedSegments) {
    const candidate = extractVinWindow(segment);
    if (candidate) return candidate;
  }

  return null;
}

/**
 * Decode VIN using NHTSA vPIC API
 */
export async function decodeVIN(vin: string): Promise<VINDecodeResult> {
  const result: VINDecodeResult = {
    vin: vin.toUpperCase(),
    year: null,
    make: null,
    model: null,
    trim: null,
    bodyClass: null,
    driveType: null,
    engineConfig: null,
    fuelType: null,
    adasFeatures: {
      forwardCollisionWarning: false,
      laneDepartureWarning: false,
      blindSpotMonitoring: false,
      adaptiveCruiseControl: false,
      parkingAssist: false,
      rearCrossTraffic: false,
      automaticEmergencyBraking: false,
      laneKeepAssist: false,
      nightVision: false,
      pedestrianDetection: false,
      backupCamera: false,
      surroundViewCamera: false,
    },
    errors: [],
  };

  if (!isValidVIN(vin)) {
    result.errors.push('Invalid VIN format');
    return result;
  }

  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      result.errors.push(`NHTSA API error: ${response.status}`);
      return result;
    }

    const data: NHTSAResponse = await response.json();

    if (!data.Results || data.Results.length === 0) {
      result.errors.push('No results from NHTSA API');
      return result;
    }

    // Store raw data for debugging
    const rawData: Record<string, string> = {};

    for (const variable of data.Results) {
      const varName = variable.Variable;
      const value = variable.Value;

      if (!value || value === 'Not Applicable' || value === '') continue;

      rawData[varName] = value;

      // Map to our result structure
      if (varName === 'Model Year') {
        const year = parseInt(value, 10);
        if (!isNaN(year)) result.year = year;
      } else if (varName === 'Make') {
        result.make = normalizeManufacturer(value);
      } else if (varName === 'Model') {
        result.model = value;
      } else if (varName === 'Trim') {
        result.trim = value;
      } else if (varName === 'Body Class') {
        result.bodyClass = value;
      } else if (varName === 'Drive Type') {
        result.driveType = value;
      } else if (varName === 'Engine Configuration') {
        result.engineConfig = value;
      } else if (varName === 'Fuel Type - Primary') {
        result.fuelType = value;
      }

      // Check for ADAS features
      const adasFeature = ADAS_VARIABLE_TO_FEATURE[varName];
      if (adasFeature && isADASpresent(value)) {
        result.adasFeatures[adasFeature] = true;
      }
    }

    // Check for error codes in the response
    const errorCode = data.Results.find(r => r.Variable === 'Error Code');
    const errorText = data.Results.find(r => r.Variable === 'Error Text');

    if (errorCode?.Value && errorCode.Value !== '0') {
      if (errorText?.Value) {
        result.errors.push(errorText.Value);
      }
    }

    result.rawData = rawData;

  } catch (error) {
    result.errors.push(`VIN decode failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Check if ADAS feature value indicates presence
 */
function isADASpresent(value: string | null): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  // Standard = present, Optional = might be present, Not Applicable = not present
  return lower === 'standard' || lower === 'optional' || lower === 'yes';
}

/**
 * Normalize manufacturer names for consistency
 */
function normalizeManufacturer(make: string): string {
  const normalizations: Record<string, string> = {
    'MERCEDES-BENZ': 'Mercedes-Benz',
    'MERCEDES BENZ': 'Mercedes-Benz',
    'MERCEDES': 'Mercedes-Benz',
    'BMW': 'BMW',
    'VOLKSWAGEN': 'Volkswagen',
    'GENERAL MOTORS': 'GM',
    'FORD MOTOR COMPANY': 'Ford',
    'FORD': 'Ford',
    'TOYOTA': 'Toyota',
    'TOYOTA MOTOR': 'Toyota',
    'HONDA': 'Honda',
    'NISSAN': 'Nissan',
    'NISSAN NORTH AMERICA': 'Nissan',
    'HYUNDAI': 'Hyundai',
    'KIA': 'Kia',
    'KIA MOTORS': 'Kia',
    'MAZDA': 'Mazda',
    'SUBARU': 'Subaru',
    'SUBARU OF AMERICA': 'Subaru',
    'LEXUS': 'Lexus',
    'ACURA': 'Acura',
    'INFINITI': 'Infiniti',
    'GENESIS': 'Genesis',
    'VOLVO': 'Volvo',
    'AUDI': 'Audi',
    'PORSCHE': 'Porsche',
    'JAGUAR': 'Jaguar',
    'LAND ROVER': 'Land Rover',
    'TESLA': 'Tesla',
    'TESLA INC': 'Tesla',
    'RIVIAN': 'Rivian',
    'CHEVROLET': 'Chevrolet',
    'GMC': 'GMC',
    'BUICK': 'Buick',
    'CADILLAC': 'Cadillac',
    'CHRYSLER': 'Chrysler',
    'DODGE': 'Dodge',
    'JEEP': 'Jeep',
    'RAM': 'Ram',
    'LINCOLN': 'Lincoln',
    'MINI': 'MINI',
  };

  const upper = make.toUpperCase().trim();
  return normalizations[upper] || make;
}

/**
 * Get year from VIN 10th character (model year code)
 * This is a fallback if NHTSA API doesn't return year
 */
export function getYearFromVIN(vin: string): number | null {
  if (!vin || vin.length < 10) return null;

  const yearChar = vin.charAt(9).toUpperCase();

  // Year codes: A=2010, B=2011, ... H=2017, J=2018, K=2019, L=2020, M=2021, N=2022, P=2023, R=2024, S=2025, T=2026
  const yearCodes: Record<string, number> = {
    'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
    'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
    'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024,
    'S': 2025, 'T': 2026, 'V': 2027, 'W': 2028, 'X': 2029, 'Y': 2030,
    '1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005,
    '6': 2006, '7': 2007, '8': 2008, '9': 2009,
  };

  return yearCodes[yearChar] || null;
}

/**
 * Enhanced vehicle info extraction combining VIN decode with text parsing
 */
export async function extractVehicleInfoEnhanced(
  text: string
): Promise<{
  vin: string | null;
  vinDecoded: VINDecodeResult | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  confidence: 'high' | 'medium' | 'low';
  source: 'vin' | 'text' | 'combined';
}> {
  const result = {
    vin: null as string | null,
    vinDecoded: null as VINDecodeResult | null,
    year: null as number | null,
    make: null as string | null,
    model: null as string | null,
    trim: null as string | null,
    confidence: 'low' as 'high' | 'medium' | 'low',
    source: 'text' as 'vin' | 'text' | 'combined',
  };

  // Try to extract VIN
  const vin = extractVINFromText(text);

  if (vin) {
    result.vin = vin;

    // Decode VIN using NHTSA API
    const decoded = await decodeVIN(vin);
    result.vinDecoded = decoded;

    if (decoded.year && decoded.make && decoded.model) {
      result.year = decoded.year;
      result.make = decoded.make;
      result.model = decoded.model;
      result.trim = decoded.trim;
      result.confidence = 'high';
      result.source = 'vin';
      return result;
    }

    // Partial VIN decode - use what we got
    if (decoded.year) result.year = decoded.year;
    if (decoded.make) result.make = decoded.make;
    if (decoded.model) result.model = decoded.model;
    if (decoded.trim) result.trim = decoded.trim;

    // If we got year from VIN character but not API
    if (!result.year && vin) {
      result.year = getYearFromVIN(vin);
    }
  }

  // If we have partial info from VIN, mark as combined
  if (result.vin && (result.year || result.make)) {
    result.confidence = 'medium';
    result.source = 'combined';
  }

  return result;
}
