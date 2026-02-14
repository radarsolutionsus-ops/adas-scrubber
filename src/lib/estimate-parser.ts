/**
 * Enhanced Estimate Parser
 * Handles CCC ONE, Mitchell, and generic estimate formats
 * Includes comprehensive keyword matching and ADAS parts detection
 */

// ============================================================================
// COMPREHENSIVE REPAIR KEYWORD LIBRARY
// ============================================================================

export const REPAIR_KEYWORDS = {
  // BUMPER OPERATIONS - Front
  frontBumper: [
    // Full terms
    'front bumper', 'frt bumper', 'f bumper', 'front fascia', 'frt fascia',
    'bumper cover front', 'bumper cvr frt', 'front cover bumper', 'f/bumper',
    'bumper assy front', 'bumper assembly front', 'front bumper assy',
    // Operations
    'r&i front bumper', 'r&i frt bumper', 'r&i f bumper',
    'r&r front bumper', 'r&r frt bumper', 'r&r f bumper',
    'o/h front bumper', 'o/h frt bumper', 'oh front bumper', 'oh frt bumper',
    'ovhl front bumper', 'ovhl frt bumper', 'overhaul front bumper',
    'rpr front bumper', 'rpr frt bumper', 'repair front bumper',
    'repl front bumper', 'repl frt bumper', 'replace front bumper',
    'refinish front bumper', 'blend front bumper',
    // CCC/Mitchell abbreviations
    'bpr cvr frt', 'bmpr cvr frt', 'bpr frt', 'bmpr frt',
    'frt bpr', 'frt bmpr', 'frt fascia cvr',
  ],

  // BUMPER OPERATIONS - Rear
  rearBumper: [
    'rear bumper', 'rr bumper', 'r bumper', 'rear fascia', 'rr fascia',
    'bumper cover rear', 'bumper cvr rr', 'rear cover bumper', 'r/bumper',
    'back bumper', 'bumper assy rear', 'bumper assembly rear',
    'r&i rear bumper', 'r&i rr bumper',
    'r&r rear bumper', 'r&r rr bumper',
    'o/h rear bumper', 'o/h rr bumper', 'oh rear bumper',
    'rpr rear bumper', 'rpr rr bumper', 'repair rear bumper',
    'repl rear bumper', 'repl rr bumper', 'replace rear bumper',
    'refinish rear bumper', 'blend rear bumper',
    'bpr cvr rr', 'bmpr cvr rr', 'bpr rr', 'bmpr rr', 'rr bpr', 'rr bmpr',
  ],

  // BUMPER REINFORCEMENT
  bumperReinforcement: [
    'bumper reinforcement', 'bumper reinf', 'bumper rebar',
    'impact bar', 'impact absorber', 'energy absorber',
    'frt reinf', 'rr reinf', 'front reinforcement', 'rear reinforcement',
    'bumper beam', 'bumper support', 'bumper bracket',
    'r&i reinforcement', 'r&r reinforcement', 'repl reinforcement',
  ],

  // GRILLE OPERATIONS
  grille: [
    'grille', 'grill', 'front grille', 'radiator grille', 'active grille',
    'upper grille', 'lower grille', 'grille assy', 'grille assembly',
    'r&i grille', 'r&i grill', 'r&r grille', 'r&r grill',
    'repl grille', 'repl grill', 'replace grille',
    'active shutter', 'grille shutter', 'air shutter',
  ],

  // WINDSHIELD / FRONT GLASS
  windshield: [
    'windshield', 'windscreen', 'front glass', 'w/s', 'w/s glass',
    'laminated glass', 'wsr', 'ws glass', 'windshld',
    'r&i windshield', 'r&r windshield', 'repl windshield',
    'replace windshield', 'windshield replacement',
    'front window', 'frt glass', 'frt window',
    'acoustic glass', 'heated windshield', 'rain sensor glass',
    // With camera mentions
    'windshield w/camera', 'windshield camera', 'ws w/cam',
  ],

  // SIDE MIRROR OPERATIONS
  sideMirror: [
    'side mirror', 'door mirror', 'outside mirror', 'exterior mirror',
    'wing mirror', 'mirror assy', 'mirror assembly',
    'lh mirror', 'rh mirror', 'left mirror', 'right mirror',
    'r&i mirror', 'r&r mirror', 'repl mirror', 'replace mirror',
    'mirror glass', 'mirror cap', 'mirror cover', 'mirror housing',
    'power mirror', 'heated mirror', 'blind spot mirror', 'bsm mirror',
    'mirror w/camera', 'mirror camera',
  ],

  // HEADLAMP / LIGHTING
  headlamp: [
    'headlamp', 'headlight', 'head lamp', 'head light',
    'h/lamp', 'h/light', 'headlamp assy', 'headlight assembly',
    'lh headlamp', 'rh headlamp', 'left headlamp', 'right headlamp',
    'r&i headlamp', 'r&r headlamp', 'repl headlamp',
    'led headlamp', 'hid headlamp', 'xenon headlamp', 'halogen headlamp',
    'adaptive headlamp', 'matrix headlamp', 'laser headlamp',
    'headlamp level', 'headlamp aim', 'aim headlamp',
  ],

  // TAILGATE / LIFTGATE / TRUNK
  tailgate: [
    'tailgate', 'tail gate', 'liftgate', 'lift gate',
    'rear gate', 'hatch', 'hatchback', 'trunk lid', 'decklid', 'deck lid',
    'r&i tailgate', 'r&r tailgate', 'repl tailgate',
    'r&i liftgate', 'r&r liftgate', 'repl liftgate',
    'r&i trunk', 'r&r trunk', 'repl trunk',
    'power tailgate', 'power liftgate', 'hands free liftgate',
  ],

  // HOOD OPERATIONS
  hood: [
    'hood', 'bonnet', 'hood assy', 'hood assembly', 'hood panel',
    'r&i hood', 'r&r hood', 'repl hood', 'replace hood',
    'hood hinge', 'hood latch', 'hood strut',
    'active hood', 'pedestrian hood', 'pop-up hood',
  ],

  // FENDER OPERATIONS
  fender: [
    'fender', 'front fender', 'frt fender', 'fender panel',
    'lh fender', 'rh fender', 'left fender', 'right fender',
    'r&i fender', 'r&r fender', 'repl fender', 'replace fender',
    'rpr fender', 'repair fender', 'blend fender', 'refinish fender',
    'fender liner', 'inner fender', 'fender apron',
  ],

  // QUARTER PANEL
  quarterPanel: [
    'quarter panel', 'qtr panel', 'quarter pnl', 'qtr pnl',
    'rear quarter', 'rr qtr', 'c-pillar', 'd-pillar',
    'r&i quarter', 'r&r quarter', 'repl quarter', 'replace quarter',
    'section quarter', 'partial quarter',
  ],

  // DOOR OPERATIONS
  door: [
    'door shell', 'door skin', 'door panel', 'door assy',
    'front door', 'rear door', 'frt door', 'rr door',
    'lh door', 'rh door', 'left door', 'right door',
    'r&i door', 'r&r door', 'repl door', 'replace door',
  ],

  // ROOF / SUNROOF
  roof: [
    'roof', 'roof panel', 'roof skin', 'roof assy',
    'sunroof', 'moonroof', 'panoramic roof', 'panoroof',
    'roof rail', 'roof rack', 'roof molding',
    'r&i roof', 'r&r roof', 'repl roof', 'replace roof',
    'section roof', 'partial roof',
  ],

  // WHEEL ALIGNMENT / SUSPENSION
  alignment: [
    'alignment', 'wheel alignment', 'four wheel alignment', '4 wheel alignment',
    '4-wheel alignment', 'thrust angle', 'toe adjustment', 'camber adjustment',
    'front alignment', 'rear alignment', 'check alignment',
    'set alignment', 'adjust alignment',
  ],

  suspension: [
    'suspension', 'strut', 'shock', 'shock absorber',
    'control arm', 'lower arm', 'upper arm', 'a-arm',
    'subframe', 'cradle', 'crossmember', 'k-frame',
    'steering knuckle', 'spindle', 'hub', 'bearing',
    'spring', 'coil spring', 'leaf spring', 'air spring',
    'sway bar', 'stabilizer', 'link',
    'ride height', 'level sensor',
  ],

  // STEERING
  steering: [
    'steering', 'steering gear', 'steering rack', 'rack and pinion',
    'steering column', 'steering shaft', 'intermediate shaft',
    'tie rod', 'tie rod end', 'inner tie rod', 'outer tie rod',
    'steering angle sensor', 'sas', 'clock spring',
    'power steering', 'eps', 'electric power steering',
  ],

  // STRUCTURAL / FRAME
  structural: [
    'structural', 'frame', 'unibody', 'frame rail',
    'apron', 'radiator support', 'core support',
    'rocker', 'rocker panel', 'sill', 'threshold',
    'a-pillar', 'b-pillar', 'c-pillar', 'd-pillar',
    'floor pan', 'floor board', 'trunk floor',
    'section', 'sectioning', 'partial replacement',
    'pull', 'frame pull', 'straighten',
  ],

  // RADAR/SENSOR SPECIFIC
  radarSensor: [
    'radar', 'radar sensor', 'front radar', 'rear radar',
    'corner radar', 'side radar', 'blind spot radar',
    'distronic', 'distance sensor', 'proximity sensor',
    'acc sensor', 'adaptive cruise sensor', 'cruise control sensor',
    'collision sensor', 'pre-collision sensor',
    'r&i radar', 'r&r radar', 'repl radar', 'calibrate radar',
  ],

  // CAMERA SPECIFIC
  camera: [
    'camera', 'front camera', 'rear camera', 'backup camera',
    'forward camera', 'windshield camera', 'rearview camera',
    'surround camera', '360 camera', 'bird eye camera',
    'side camera', 'mirror camera', 'grille camera',
    'lane camera', 'adas camera', 'safety camera',
    'r&i camera', 'r&r camera', 'repl camera', 'calibrate camera',
  ],

  // EXPLICIT CALIBRATION
  calibration: [
    'calibration', 'calibrate', 'recalibration', 'recalibrate',
    'adas calibration', 'camera calibration', 'radar calibration',
    'sensor calibration', 'static calibration', 'dynamic calibration',
    'aim', 'aiming', 're-aim', 'target', 'targeting',
  ],
};

// ============================================================================
// ADAS PARTS DETECTION
// ============================================================================

/**
 * ADAS-related part numbers and descriptions that indicate
 * specific ADAS systems are installed on the vehicle
 */
export const ADAS_PART_INDICATORS = {
  frontRadar: [
    // Generic terms
    'radar sensor', 'front radar', 'millimeter wave radar',
    'distance sensor', 'acc sensor', 'cruise control sensor',
    'distronic sensor', 'collision sensor', 'pre-collision sensor',
    // OEM-specific
    'toyota safety sense radar', 'tss radar',
    'honda sensing radar', 'acurawatch radar',
    'eyesight radar', 'subaru eyesight',
    'nissan propilot radar', 'intelligent cruise radar',
    'mazda i-activsense radar', 'mrcc sensor',
    'hyundai smartsense radar', 'fca radar',
    'kia drive wise radar',
    // Part number patterns (common prefixes)
    'radar assy', 'radar unit', 'radar module',
  ],

  frontCamera: [
    // Generic
    'front camera', 'windshield camera', 'forward camera',
    'lane camera', 'safety camera', 'adas camera',
    'mono camera', 'stereo camera', 'single lens camera',
    // OEM-specific
    'toyota safety sense camera', 'tss camera',
    'honda sensing camera', 'acurawatch camera',
    'eyesight camera', 'subaru camera',
    'nissan propilot camera', 'intelligent camera',
    'mazda i-activsense camera',
    'hyundai smartsense camera',
    'mobileye', 'mobileye camera',
    // Mounting
    'camera bracket', 'camera mount', 'camera housing',
  ],

  blindSpotMonitor: [
    'blind spot sensor', 'bsm sensor', 'blis sensor',
    'blind spot radar', 'blind spot warning sensor',
    'rear corner radar', 'side radar', 'quarter radar',
    'rcta sensor', 'rear cross traffic sensor',
    'change lane assist sensor', 'cla sensor',
    'lane change sensor',
  ],

  surroundCamera: [
    '360 camera', 'surround camera', 'around view camera',
    'bird eye camera', 'overhead camera', 'top view camera',
    'multi view camera', 'panoramic camera',
    'front camera', 'side camera', 'rear camera',
    // OEM names
    'panoramic view monitor', 'pvm camera',
    'around view monitor', 'avm camera',
    'surround view camera', 'svc',
    'bird\'s eye view', 'top down view',
  ],

  parkingSensor: [
    'parking sensor', 'ultrasonic sensor', 'sonar sensor',
    'clearance sensor', 'proximity sensor', 'distance sensor',
    'park assist sensor', 'parktronic sensor',
    'front parking sensor', 'rear parking sensor',
    'corner sensor', 'bumper sensor',
  ],

  steeringAngleSensor: [
    'steering angle sensor', 'sas', 'steering sensor',
    'angle sensor', 'rotation sensor',
    'clock spring', 'spiral cable',
    'yaw rate sensor', 'lateral sensor',
  ],

  rearCamera: [
    'backup camera', 'rear camera', 'reverse camera',
    'rearview camera', 'back up camera', 'reversing camera',
    'tail camera', 'trunk camera', 'tailgate camera',
    'liftgate camera', 'hatch camera',
  ],
};

// ============================================================================
// ESTIMATE FORMAT DETECTION & PARSING
// ============================================================================

export type EstimateFormat = 'ccc' | 'mitchell' | 'audatex' | 'generic';

export interface ParsedLine {
  lineNumber: number;
  rawText: string;
  cleanedText: string;
  operationType?: 'R&I' | 'R&R' | 'Repair' | 'Refinish' | 'Blend' | 'Overhaul' | 'Other';
  partNumber?: string;
  description?: string;
  quantity?: number;
  laborHours?: number;
  partPrice?: number;
  laborPrice?: number;
  isADASPart: boolean;
  adasSystemsDetected: string[];
  repairCategoriesMatched: string[];
}

/**
 * Detect the estimate format based on content patterns
 */
export function detectEstimateFormat(text: string): EstimateFormat {
  const upperText = text.toUpperCase();

  // CCC ONE patterns
  if (
    upperText.includes('CCC ONE') ||
    upperText.includes('CCCONE') ||
    upperText.includes('PATHWAYS') ||
    /PROFILE\s*#/.test(upperText) ||
    /ESTIMATE\s*#\s*\d{8,}/.test(upperText)
  ) {
    return 'ccc';
  }

  // Mitchell patterns
  if (
    upperText.includes('MITCHELL') ||
    upperText.includes('ULTRAMATE') ||
    upperText.includes('MITCHELL INTERNATIONAL') ||
    /CLAIM\s*#/.test(upperText) ||
    /ESTIMATOR:/.test(upperText)
  ) {
    return 'mitchell';
  }

  // Audatex patterns
  if (
    upperText.includes('AUDATEX') ||
    upperText.includes('SOLERA') ||
    upperText.includes('QAPTER')
  ) {
    return 'audatex';
  }

  return 'generic';
}

/**
 * Parse operation type from line text
 */
function parseOperationType(text: string): ParsedLine['operationType'] {
  const lower = text.toLowerCase();

  if (/\br\s*&\s*i\b|remove.*install|r\/i\b/i.test(lower)) return 'R&I';
  if (/\br\s*&\s*r\b|replace|r\/r\b|repl\b/i.test(lower)) return 'R&R';
  if (/\bo\/h\b|overhaul|ovhl\b|oh\b/i.test(lower)) return 'Overhaul';
  if (/\brpr\b|repair\b/i.test(lower)) return 'Repair';
  if (/\bblend\b/i.test(lower)) return 'Blend';
  if (/\brefinish\b|paint\b|color\b/i.test(lower)) return 'Refinish';

  return 'Other';
}

/**
 * Extract part number from line
 */
function extractPartNumber(text: string): string | undefined {
  // Common part number patterns
  // Toyota: 52119-33xxx, Honda: 04711-TBA-xxx
  // Ford: FL3Z-xxxxx, GM: 84xxxxxx
  const patterns = [
    /\b(\d{5}-\d{5})\b/, // Toyota/Lexus
    /\b(\d{5}-[A-Z]{3}-[A-Z0-9]{3})\b/, // Honda/Acura
    /\b([A-Z]{2}\d[A-Z]-[\dA-Z]{5,})\b/, // Ford
    /\b(8\d{7})\b/, // GM
    /\b([A-Z0-9]{8,15})\b/, // Generic alphanumeric
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

/**
 * Check if line contains ADAS-related parts
 */
function detectADASParts(text: string): { isADAS: boolean; systems: string[] } {
  const lower = text.toLowerCase();
  const systems: string[] = [];

  for (const [system, keywords] of Object.entries(ADAS_PART_INDICATORS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        systems.push(system);
        break;
      }
    }
  }

  return {
    isADAS: systems.length > 0,
    systems: [...new Set(systems)], // Remove duplicates
  };
}

/**
 * Match repair categories from line text
 */
function matchRepairCategories(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];

  for (const [category, keywords] of Object.entries(REPAIR_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        matched.push(category);
        break;
      }
    }
  }

  return [...new Set(matched)];
}

/**
 * Clean and normalize estimate line text
 */
function cleanLineText(text: string): string {
  let cleaned = text;

  // Remove leading line numbers
  cleaned = cleaned.replace(/^\s*\d{1,4}\s*/, '');

  // Remove part numbers (keep for separate extraction)
  cleaned = cleaned.replace(/\b\d{5}-\d{5}\b/g, '');
  cleaned = cleaned.replace(/\b[A-Z]{2}\d[A-Z]-[\dA-Z]{5,}\b/g, '');

  // Remove prices
  cleaned = cleaned.replace(/\$?\d+\.\d{2}/g, '');

  // Remove quantities like "1 ea", "2 hr", "1.5 hrs"
  cleaned = cleaned.replace(/\b\d+\.?\d*\s*(ea|pc|hr|hrs|hour|hours)\b/gi, '');

  // Remove "Incl.", "Included"
  cleaned = cleaned.replace(/\b(incl\.?|included)\b/gi, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Parse a single estimate line
 */
export function parseLine(text: string, lineNumber: number): ParsedLine {
  const cleaned = cleanLineText(text);
  const adasDetection = detectADASParts(text);

  return {
    lineNumber,
    rawText: text,
    cleanedText: cleaned,
    operationType: parseOperationType(text),
    partNumber: extractPartNumber(text),
    isADASPart: adasDetection.isADAS,
    adasSystemsDetected: adasDetection.systems,
    repairCategoriesMatched: matchRepairCategories(text),
  };
}

/**
 * Parse full estimate text
 */
export function parseEstimate(text: string): {
  format: EstimateFormat;
  lines: ParsedLine[];
  adasPartsFound: { system: string; lineNumbers: number[] }[];
  repairsSummary: { category: string; count: number; lineNumbers: number[] }[];
} {
  const format = detectEstimateFormat(text);
  const rawLines = text.split('\n').filter(line => line.trim().length > 0);

  const lines: ParsedLine[] = [];
  const adasPartsMap = new Map<string, number[]>();
  const repairsMap = new Map<string, number[]>();

  for (let i = 0; i < rawLines.length; i++) {
    const parsed = parseLine(rawLines[i], i + 1);
    lines.push(parsed);

    // Track ADAS parts
    for (const system of parsed.adasSystemsDetected) {
      const existing = adasPartsMap.get(system) || [];
      existing.push(parsed.lineNumber);
      adasPartsMap.set(system, existing);
    }

    // Track repairs
    for (const category of parsed.repairCategoriesMatched) {
      const existing = repairsMap.get(category) || [];
      existing.push(parsed.lineNumber);
      repairsMap.set(category, existing);
    }
  }

  // Convert maps to arrays
  const adasPartsFound = Array.from(adasPartsMap.entries()).map(([system, lineNumbers]) => ({
    system,
    lineNumbers,
  }));

  const repairsSummary = Array.from(repairsMap.entries()).map(([category, lineNumbers]) => ({
    category,
    count: lineNumbers.length,
    lineNumbers,
  }));

  return {
    format,
    lines,
    adasPartsFound,
    repairsSummary,
  };
}

function prepareEstimateScanText(text: string): string {
  const base = text.replace(
    /([A-Za-z0-9])(RO Number|RO#|PO Number|Purchase Order|Workfile ID|Claim|Policy|Loss Date|Date of Loss|Create Date|Customer|Insurance Company|Insurance|Adjuster|Estimator|Written By|VIN|Owner|Inspection Location)/gi,
    "$1 $2"
  );
  return base.replace(/([A-Z])(ENTERPRISE|GEICO|PROGRESSIVE|ALLSTATE|USAA|FARMERS|LIBERTY MUTUAL)/g, "$1 $2");
}

function normalizeExtractedValue(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[#:\-.\s]+/, "")
    .replace(/[|]+/g, " ")
    .trim();
}

function removeTrailingLabels(value: string): string {
  return normalizeExtractedValue(
    value.replace(
      /\b(Phone|Create Date|Loss Date|Date of Loss|Claim|Estimator|Adjuster|Customer|Insurance(?: Company)?|Owner|Inspection Location|Policy)\b\s*:?.*$/i,
      ""
    )
  );
}

function isLegalEntitySuffixLine(line: string): boolean {
  return /^(INC\.?|LLC|CORP\.?|CORPORATION|CO\.?|LTD\.?)$/i.test(normalizeExtractedValue(line));
}

function appendCompanySuffixLine(baseLine: string, nextLine?: string): string {
  const base = normalizeExtractedValue(baseLine);
  if (!nextLine || !isLegalEntitySuffixLine(nextLine)) return base;
  const suffix = normalizeExtractedValue(nextLine);
  return normalizeExtractedValue(`${base} ${suffix}`);
}

function looksLegalDisclosureLine(line: string): boolean {
  return /\b(LENDING INSTITUTION|MISCELLANEOUS SHOP SUPPLIES|WASTE (?:REMOVAL|DISPOSAL)|OWNER LIMITED GUARANTEE|STATEMENT OF CLAIM OR AN APPLICATION|IF A CHARGE FOR|THIS GUARANTEE|INSURANCE PROCEEDS|CCC ONE ESTIMATING|BUREAU OF AUTOMOTIVE REPAIR)\b/i.test(
    line
  );
}

function isAddressLike(line: string): boolean {
  return (
    /\d{1,6}\s+[A-Z0-9.\-]+\s+(ST|STREET|AVE|AVENUE|BLVD|ROAD|RD|DR|DRIVE|CT|COURT|LANE|LN|WAY)\b/i.test(line) ||
    /\b[A-Z][A-Z\s.]+,\s*[A-Z]{2}\s*\d{5}/i.test(line)
  );
}

function isMetadataLabelOnly(value: string): boolean {
  return /^(Estimator|Adjuster|Insurance|Insurance Company|Customer|Claim|Policy|Loss Date|Create Date|Phone)$/i.test(value.trim());
}

function isFinancialSummaryValue(value: string): boolean {
  return /\b(TOTAL|BALANCE|SUBTOTAL|DEDUCTIBLE|RECEIVED)\b/i.test(value) || /\$/.test(value);
}

function extractCompanyTail(value: string): string {
  const legalSuffixMatches = value.match(/[A-Z][A-Z0-9&.,' -]{1,60}?(?:INC\.?|LLC|CORP\.?)\b/gi);
  if (legalSuffixMatches && legalSuffixMatches.length > 0) {
    return normalizeExtractedValue(legalSuffixMatches[legalSuffixMatches.length - 1]);
  }
  const compactMatches = value.match(/[A-Z][A-Z0-9&.,' -]{1,60}?(?:INC\.?|LLC|CORP\.?|COMPANY|HOLDINGS|INSURANCE|RENTAL|GROUP|MOTORS)\b/gi);
  if (compactMatches && compactMatches.length > 0) {
    return normalizeExtractedValue(compactMatches[compactMatches.length - 1]);
  }
  return normalizeExtractedValue(value);
}

function isLikelyCompanyName(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length < 3 || trimmed.length > 90) return false;
  if (/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(trimmed)) return false;
  if (isAddressLike(trimmed)) return false;
  if (looksLegalDisclosureLine(trimmed)) return false;
  if (
    /\b(VEHICLE INFORMATION|ADAS OPERATIONS|ADAS SYSTEMS|FUNCTIONAL OPERATIONS|OPERATIONS|PROCEDURE TYPE|MANUFACTURER REQUIREMENT)\b/i.test(
      trimmed
    )
  ) {
    return false;
  }
  if (
    /\b(ESTIMATE|PRELIMINARY|LINE|OPERATION|DESCRIPTION|VIN|LICENSE|STATE|MILEAGE|TOTAL|SUBTOTAL|DEDUCTIBLE|PAGE|RECEIVED FROM)\b/i.test(
      trimmed
    )
  ) {
    return false;
  }

  const hasLetters = /[A-Z]/i.test(trimmed);
  const hasSignal = /\b(AUTO|BODY|COLLISION|MOTORS|REPAIR|PAINT|GARAGE|LLC|INC|HOLDINGS|RENTAL|GROUP|SHOP|INSURANCE|COMPANY)\b/i.test(trimmed);
  return hasLetters && (hasSignal || /^[A-Z][A-Z0-9&.,'\-\s]{3,}$/i.test(trimmed));
}

function isLikelyShopName(line: string): boolean {
  return (
    isLikelyCompanyName(line) &&
    !/\b(INSURANCE|HOLDINGS|RENTAL|ENTERPRISE|GEICO|PROGRESSIVE|ALLSTATE|STATE FARM|USAA)\b/i.test(line)
  );
}

function normalizeIdentifierComparable(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function looksCompositePartyLine(value: string): boolean {
  return /\b(INSURED|CUSTOMER|CLAIM|RISK|MANAGEMENT|POLICY|ENTERPRISE|HERTZ|GEICO|PROGRESSIVE|ALLSTATE|USAA)\b/i.test(
    value
  );
}

function isRepairFacilityHeadingLine(value: string): boolean {
  const normalized = normalizeExtractedValue(value).toLowerCase();
  if (!normalized) return false;
  if (normalized === "repair facility") return true;
  if (normalized.startsWith("repair facility:")) return true;
  if (normalized.startsWith("repair facility ") && normalized.length <= 40) return true;
  return false;
}

function resolveBestShopName(currentShopName?: string, topShopCandidate?: string): string | undefined {
  if (!currentShopName) return topShopCandidate;
  if (!topShopCandidate) return currentShopName;

  const current = normalizeExtractedValue(currentShopName);
  const top = normalizeExtractedValue(topShopCandidate);
  if (!current) return top || undefined;
  if (!top) return current || undefined;

  const currentKey = normalizeIdentifierComparable(current);
  const topKey = normalizeIdentifierComparable(top);

  if (currentKey && topKey && currentKey.includes(topKey)) {
    return top;
  }

  if (looksLegalDisclosureLine(current)) {
    return top;
  }

  if (looksCompositePartyLine(current) && !looksCompositePartyLine(top)) {
    return top;
  }

  return current;
}

function extractFirstByPatterns(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = normalizeExtractedValue(match[1]);
      if (value) return value;
    }
  }
  return undefined;
}

function extractFromLines(
  lines: string[],
  patterns: RegExp[],
  options?: { stripTailLabels?: boolean; compact?: boolean }
): string | undefined {
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match?.[1]) continue;
      let value = options?.stripTailLabels ? removeTrailingLabels(match[1]) : normalizeExtractedValue(match[1]);
      if (options?.compact) {
        value = value.replace(/\s+/g, "");
      }
      if (value && !isMetadataLabelOnly(value)) {
        return value;
      }
    }
  }
  return undefined;
}

export interface EstimateIdentifiers {
  roNumber?: string;
  poNumber?: string;
  workfileId?: string;
  claimNumber?: string;
  preferredReference?: string;
}

function isLikelyVinToken(value: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(value);
}

function normalizeIdentifierToken(value?: string): string | undefined {
  const normalized = normalizeExtractedValue(value || "").replace(/\s+/g, "");
  return normalized || undefined;
}

function buildPreferredReference(input: EstimateIdentifiers): string | undefined {
  return input.roNumber || input.poNumber || input.workfileId || input.claimNumber;
}

export function extractEstimateIdentifiers(text: string): EstimateIdentifiers {
  const scanText = prepareEstimateScanText(text);

  const roNumber = extractFirstByPatterns(scanText, [
    /\b(?:R\/?O|REPAIR\s*ORDER)(?:\s*(?:NUMBER|NO|#)\s*[:\-]?|[:\-])\s*([A-Z0-9][A-Z0-9\-]{1,})/i,
  ])?.replace(/\s+/g, "") || extractFirstByPatterns(scanText, [
    /\bRO\s*NUMBER\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{1,})/i,
  ])?.replace(/\s+/g, "");

  const poNumber = extractFirstByPatterns(scanText, [
    /\b(?:P\/?O|PURCHASE\s*ORDER)(?:\s*(?:NUMBER|NO|#)\s*[:\-]?|[:\-])\s*([A-Z0-9][A-Z0-9\-]{1,})/i,
  ])?.replace(/\s+/g, "") || extractFirstByPatterns(scanText, [
    /\bPO\s*NUMBER\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{1,})/i,
  ])?.replace(/\s+/g, "");

  const workfileId = extractFirstByPatterns(scanText, [
    /\bWORKFILE\s*(?:ID|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{1,})/i,
  ])?.replace(/\s+/g, "");

  const claimNumber = extractFirstByPatterns(scanText, [
    /\bCLAIM(?:\s*(?:NUMBER|NO|#))?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{3,})/i,
  ])?.replace(/\s+/g, "");

  const normalizedWorkfileId = workfileId && /^(FEDERAL|STATE|LICENSE|NUMBER)$/i.test(workfileId)
    ? undefined
    : workfileId;

  return {
    roNumber,
    poNumber,
    workfileId: normalizedWorkfileId,
    claimNumber,
    preferredReference: buildPreferredReference({ roNumber, poNumber, workfileId: normalizedWorkfileId, claimNumber }),
  };
}

export function extractEstimateIdentifiersFromFileName(fileName?: string): EstimateIdentifiers {
  if (!fileName) return {};

  const baseName = fileName.split(/[\\/]/).pop() || fileName;
  const withoutExtension = baseName.replace(/\.[^.]+$/, "");
  const scanText = prepareEstimateScanText(withoutExtension.replace(/[_]+/g, " "));

  let roNumber = normalizeIdentifierToken(
    extractFirstByPatterns(scanText, [
      /\b(?:R\/?O|REPAIR\s*ORDER)(?:\s*(?:NUMBER|NO|#)\s*[:\-]?|[:\-])\s*([A-Z0-9][A-Z0-9\-]{1,})/i,
      /\bRO\s+([A-Z0-9][A-Z0-9\-]{1,})/i,
    ])
  );

  let poNumber = normalizeIdentifierToken(
    extractFirstByPatterns(scanText, [
      /\b(?:P\/?O|PURCHASE\s*ORDER)(?:\s*(?:NUMBER|NO|#)\s*[:\-]?|[:\-])\s*([A-Z0-9][A-Z0-9\-]{1,})/i,
      /\bPO\s+([A-Z0-9][A-Z0-9\-]{1,})/i,
    ])
  );

  const workfileId = normalizeIdentifierToken(
    extractFirstByPatterns(scanText, [
      /\bWORKFILE\s*(?:ID|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{1,})/i,
    ])
  );

  if (!roNumber && !poNumber) {
    const tokens = (scanText.match(/\b[A-Z0-9][A-Z0-9\-]{2,}\b/gi) || []).map((token) => token.toUpperCase());
    const numericCandidate = tokens.find(
      (token) => /\d/.test(token) && token.length <= 14 && !isLikelyVinToken(token)
    );

    if (numericCandidate) {
      if (/\bPO\b/i.test(scanText)) {
        poNumber = numericCandidate;
      } else {
        roNumber = numericCandidate;
      }
    }
  }

  const claimNumber = normalizeIdentifierToken(
    extractFirstByPatterns(scanText, [
      /\bCLAIM(?:\s*(?:NUMBER|NO|#))?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{3,})/i,
    ])
  );

  return {
    roNumber,
    poNumber,
    workfileId,
    claimNumber,
    preferredReference: buildPreferredReference({ roNumber, poNumber, workfileId, claimNumber }),
  };
}

export function mergeEstimateIdentifiers(
  primary: EstimateIdentifiers,
  fallback?: EstimateIdentifiers
): EstimateIdentifiers {
  const merged = {
    roNumber: primary.roNumber || fallback?.roNumber,
    poNumber: primary.poNumber || fallback?.poNumber,
    workfileId: primary.workfileId || fallback?.workfileId,
    claimNumber: primary.claimNumber || fallback?.claimNumber,
  };

  return {
    ...merged,
    preferredReference: buildPreferredReference(merged),
  };
}

export function appendEstimateIdentifierHints(
  estimateText: string,
  identifiers: EstimateIdentifiers,
  uploadFileName?: string
): string {
  if (estimateText.includes("__ESTIMATE_REFERENCE_HINTS__")) {
    return estimateText;
  }

  const hintLines: string[] = ["__ESTIMATE_REFERENCE_HINTS__"];
  if (uploadFileName) hintLines.push(`Upload File: ${uploadFileName}`);
  if (identifiers.roNumber) hintLines.push(`RO Number: ${identifiers.roNumber}`);
  if (identifiers.poNumber) hintLines.push(`PO Number: ${identifiers.poNumber}`);
  if (identifiers.workfileId) hintLines.push(`Workfile ID: ${identifiers.workfileId}`);
  if (identifiers.claimNumber) hintLines.push(`Claim Number: ${identifiers.claimNumber}`);

  if (hintLines.length === 1) {
    return estimateText;
  }

  return `${estimateText}\n\n${hintLines.join("\n")}\n`;
}

export interface EstimateMetadata {
  shopName?: string;
  customerName?: string;
  insuranceCompany?: string;
  claimNumber?: string;
  policyNumber?: string;
  roNumber?: string;
  poNumber?: string;
  workfileId?: string;
  estimatorName?: string;
  adjusterName?: string;
  lossDate?: string;
  createDate?: string;
}

export function extractEstimateMetadata(text: string): EstimateMetadata {
  const scanText = prepareEstimateScanText(text);
  const lines = scanText
    .split(/\r?\n/)
    .map((line) => normalizeExtractedValue(line))
    .filter((line) => line.length > 0);

  const ids = extractEstimateIdentifiers(scanText);
  const metadata: EstimateMetadata = {
    roNumber: ids.roNumber,
    poNumber: ids.poNumber,
    workfileId: ids.workfileId,
    claimNumber: ids.claimNumber,
  };

  metadata.policyNumber = extractFromLines(
    lines,
    [
      /\bPolicy(?:\s*(?:#|No|Number))?\s*[:#\-]?\s*([A-Z0-9\-]{4,})/i,
    ],
    { compact: true }
  );

  metadata.claimNumber =
    metadata.claimNumber ||
    extractFromLines(
      lines,
      [
        /\bClaim(?:\s*(?:#|No|Number))?\s*[:#\-]?\s*([A-Z0-9\-]{4,})/i,
      ],
      { compact: true }
    );

  metadata.lossDate = extractFromLines(lines, [
    /\b(?:Date of Loss|Loss Date)\s*[:#\-]?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
  ]);

  metadata.createDate = extractFromLines(lines, [
    /\b(?:Create Date|Created Date)\s*[:#\-]?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
  ]);

  metadata.estimatorName = extractFromLines(
    lines,
    [
      /\bEstimator\s*[:#\-]?\s*([A-Z][A-Z .'\-]{2,})/i,
      /\bWritten By\s*[:#\-]?\s*([A-Z][A-Z .'\-]{2,})/i,
    ],
    { stripTailLabels: true }
  );

  metadata.adjusterName = extractFromLines(
    lines,
    [
      /\bAdjuster\s*[:#\-]?\s*([^:]{2,80})/i,
    ],
    { stripTailLabels: true }
  );

  metadata.customerName = extractFromLines(
    lines,
    [
      /\bCustomer\s*[:#\-]\s*([^:]{2,80})/i,
    ],
    { stripTailLabels: true }
  );
  if (metadata.customerName && (isMetadataLabelOnly(metadata.customerName) || isFinancialSummaryValue(metadata.customerName))) {
    metadata.customerName = undefined;
  }

  let insuranceCompany = extractFromLines(
    lines,
    [
      /\bInsurance(?:\s*Company)?\s*[:#\-]\s*([^:]{2,120})/i,
    ],
    { stripTailLabels: true }
  );
  if (insuranceCompany && (isMetadataLabelOnly(insuranceCompany) || insuranceCompany.toLowerCase() === "company" || isFinancialSummaryValue(insuranceCompany))) {
    insuranceCompany = undefined;
  }

  if (!insuranceCompany) {
    for (let i = 0; i < lines.length; i++) {
      if (!/\bInsurance(?:\s*Company)?\b/i.test(lines[i])) continue;
      for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
        const candidate = extractCompanyTail(removeTrailingLabels(lines[j]));
        if (isLikelyCompanyName(candidate) && !isFinancialSummaryValue(candidate)) {
          insuranceCompany = candidate;
          break;
        }
      }
      if (insuranceCompany) break;
    }
  }
  if (insuranceCompany && !isMetadataLabelOnly(insuranceCompany)) {
    metadata.insuranceCompany = insuranceCompany;
  }

  const topShopCandidate = (() => {
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const rawCandidate = appendCompanySuffixLine(lines[i], lines[i + 1]);
      const candidate = extractCompanyTail(removeTrailingLabels(rawCandidate));
      if (isLikelyShopName(candidate)) {
        return candidate;
      }
    }
    return undefined;
  })();

  for (let i = 0; i < lines.length; i++) {
    if (!isRepairFacilityHeadingLine(lines[i])) continue;
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const rawCandidate = appendCompanySuffixLine(lines[j], lines[j + 1]);
      const candidate = extractCompanyTail(removeTrailingLabels(rawCandidate));
      if (isLikelyShopName(candidate)) {
        metadata.shopName = candidate;
        break;
      }
    }
    // Use first Repair Facility block only to avoid picking disclaimer text from later pages.
    break;
  }

  metadata.shopName = resolveBestShopName(metadata.shopName, topShopCandidate);

  if (!metadata.insuranceCompany) {
    for (let i = 0; i < lines.length; i++) {
      const candidate = extractCompanyTail(lines[i]);
      if (
        candidate !== metadata.shopName &&
        isLikelyCompanyName(candidate) &&
        !isFinancialSummaryValue(candidate) &&
        /\b(INSURANCE|HOLDINGS|RENTAL|LLC|INC|COMPANY)\b/i.test(candidate)
      ) {
        metadata.insuranceCompany = candidate;
        break;
      }
    }
  }

  return metadata;
}

/**
 * Get human-readable description for ADAS system
 */
export function getADASSystemDescription(systemKey: string): string {
  const descriptions: Record<string, string> = {
    frontRadar: 'Front Radar Sensor (ACC/AEB)',
    frontCamera: 'Front Camera (LDW/LKA)',
    blindSpotMonitor: 'Blind Spot Monitor (BSM/RCTA)',
    surroundCamera: '360° Surround View Camera',
    parkingSensor: 'Parking Sensors (Ultrasonic)',
    steeringAngleSensor: 'Steering Angle Sensor',
    rearCamera: 'Rear Backup Camera',
  };

  return descriptions[systemKey] || systemKey;
}
