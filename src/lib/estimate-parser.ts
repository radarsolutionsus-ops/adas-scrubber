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

interface EstimateSection {
  type: 'labor' | 'parts' | 'materials' | 'sublet' | 'other';
  lines: ParsedLine[];
}

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
  isADASpArt: boolean;
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
    isADASpArt: adasDetection.isADAS,
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
