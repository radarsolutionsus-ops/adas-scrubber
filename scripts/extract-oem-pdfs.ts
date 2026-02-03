#!/usr/bin/env npx ts-node

/**
 * OEM Position Statement PDF Extractor
 *
 * Reads PDF position statements from the OEM folder and extracts
 * calibration rules into JSON files compatible with the seed script.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/extract-oem-pdfs.ts [Make]
 * Example: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/extract-oem-pdfs.ts Nissan
 */

import * as fs from "fs";
import * as path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse");

const OEM_FOLDER = "/Users/_akhihasan/Desktop/OEM Position Statements";
const OUTPUT_FOLDER = path.join(__dirname, "../data");

interface VehicleOemData {
  vehicle: {
    year_start: number;
    year_end: number;
    make: string;
    model: string;
  };
  source: {
    provider: string;
    url: string;
    date_extracted: string;
  };
  adas_systems: AdasSystem[];
  repair_to_calibration_map: RepairMapping[];
}

interface AdasSystem {
  system_name: string;
  oem_name?: string;
  location?: string;
  dtc_set?: boolean;
  scan_tool_required?: boolean | null;
  special_tools_required?: boolean;
  calibration_type?: string;
  calibration_triggers?: string[];
}

interface RepairMapping {
  repair_operation: string;
  repair_keywords: string[];
  triggers_calibration: string[];
  notes?: string;
}

// Known ADAS systems to look for in PDFs
const KNOWN_ADAS_SYSTEMS = [
  { pattern: /forward\s*(collision|warning|camera|sensing)/i, name: "Forward Collision Warning", location: "windshield" },
  { pattern: /lane\s*(departure|keeping|assist)/i, name: "Lane Departure Warning", location: "windshield" },
  { pattern: /blind\s*spot/i, name: "Blind Spot Warning", location: "rear bumper" },
  { pattern: /rear\s*(cross.?traffic|collision)/i, name: "Rear Cross Traffic Alert", location: "rear bumper" },
  { pattern: /around\s*view|360|surround\s*view|intelligent\s*around/i, name: "Around View Monitor", location: "multiple cameras" },
  { pattern: /adaptive\s*cruise|intelligent\s*cruise|radar\s*cruise/i, name: "Adaptive Cruise Control", location: "front grille/bumper" },
  { pattern: /automatic\s*emergency\s*braking|aeb|auto\s*brake/i, name: "Automatic Emergency Braking", location: "front" },
  { pattern: /parking\s*(sensor|assist|sonar)/i, name: "Parking Sensors", location: "bumpers" },
  { pattern: /steering\s*angle\s*sensor/i, name: "Steering Angle Sensor", location: "steering column" },
  { pattern: /radar/i, name: "Radar Sensor", location: "front grille" },
  { pattern: /lidar/i, name: "LiDAR Sensor", location: "roof/bumper" },
  { pattern: /camera\s*calibration/i, name: "Camera System", location: "windshield" },
  { pattern: /propilot/i, name: "ProPilot Assist", location: "windshield/front" },
  { pattern: /intelligent\s*emergency\s*braking/i, name: "Intelligent Emergency Braking", location: "front" },
];

// Repair operations and their keywords
const REPAIR_PATTERNS = [
  {
    operation: "Windshield Replacement",
    patterns: [/windshield\s*(replace|removal|install)/i, /glass\s*replacement/i, /front\s*glass/i],
    keywords: ["windshield", "front glass", "wsr", "windshield r&i", "windshield r&r"],
  },
  {
    operation: "Front Bumper R&I/R&R",
    patterns: [/front\s*bumper/i, /bumper\s*cover.*front/i, /front\s*fascia/i],
    keywords: ["front bumper", "bumper cover", "front fascia", "frt bumper"],
  },
  {
    operation: "Rear Bumper R&I/R&R",
    patterns: [/rear\s*bumper/i, /bumper\s*cover.*rear/i, /rear\s*fascia/i],
    keywords: ["rear bumper", "rear fascia", "rr bumper", "back bumper"],
  },
  {
    operation: "Front Grille R&I/R&R",
    patterns: [/front\s*grille/i, /grille\s*replacement/i, /radiator\s*grille/i],
    keywords: ["grille", "front grille", "radiator grille"],
  },
  {
    operation: "Headlamp Aiming",
    patterns: [/headlamp|headlight/i],
    keywords: ["headlamp", "headlight", "headlamp aim"],
  },
  {
    operation: "Wheel Alignment",
    patterns: [/wheel\s*alignment|alignment\s*check/i, /thrust\s*angle/i],
    keywords: ["alignment", "wheel alignment", "4 wheel alignment"],
  },
  {
    operation: "Steering Column/Rack",
    patterns: [/steering\s*(column|rack|gear)/i],
    keywords: ["steering column", "steering rack", "steering gear", "tie rod"],
  },
  {
    operation: "Side Mirror R&I/R&R",
    patterns: [/side\s*mirror|door\s*mirror|outside\s*mirror/i],
    keywords: ["side mirror", "door mirror", "outside mirror", "mirror assembly"],
  },
  {
    operation: "Quarter Panel Replacement",
    patterns: [/quarter\s*panel/i],
    keywords: ["quarter panel", "qtr panel", "rear quarter"],
  },
  {
    operation: "Body Structure Repair",
    patterns: [/structural\s*repair|frame\s*repair|unibody/i],
    keywords: ["structural", "frame", "unibody", "body structure"],
  },
  {
    operation: "Suspension Repair",
    patterns: [/suspension|strut|shock|control\s*arm/i],
    keywords: ["suspension", "strut", "shock", "control arm", "subframe"],
  },
  {
    operation: "Bumper Refinishing",
    patterns: [/bumper\s*refinis|paint.*bumper|bumper.*paint/i],
    keywords: ["bumper refinish", "bumper paint", "bumper blend"],
  },
];

// Calibration types
const CALIBRATION_PATTERNS = [
  { pattern: /static\s*calibration/i, type: "Static" },
  { pattern: /dynamic\s*calibration|road\s*test/i, type: "Dynamic" },
  { pattern: /dealer\s*only|dealership/i, type: "Dealer Required" },
  { pattern: /target.*required|calibration\s*target/i, type: "Target Required" },
];

async function extractTextFromPdf(pdfPath: string): Promise<string> {
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);
  return data.text;
}

function extractAdasSystems(text: string): AdasSystem[] {
  const systems: AdasSystem[] = [];
  const foundSystems = new Set<string>();

  for (const system of KNOWN_ADAS_SYSTEMS) {
    if (system.pattern.test(text) && !foundSystems.has(system.name)) {
      foundSystems.add(system.name);

      // Determine calibration type
      let calibrationType = "Static/Dynamic";
      for (const calPattern of CALIBRATION_PATTERNS) {
        if (calPattern.pattern.test(text)) {
          calibrationType = calPattern.type;
          break;
        }
      }

      // Extract calibration triggers from the text context
      const triggers: string[] = [];

      // Look for common trigger phrases
      if (/after\s*(replacement|removal|install)/i.test(text)) {
        triggers.push("Component replacement");
      }
      if (/collision|accident|impact/i.test(text)) {
        triggers.push("After collision repair");
      }
      if (/alignment|wheel\s*angle/i.test(text)) {
        triggers.push("Wheel alignment");
      }
      if (/dtc|diagnostic|fault\s*code/i.test(text)) {
        triggers.push("DTC present");
      }

      systems.push({
        system_name: system.name,
        oem_name: system.name,
        location: system.location,
        dtc_set: /dtc|fault\s*code|diagnostic/i.test(text),
        scan_tool_required: /scan\s*tool|consult|diagnostic\s*tool/i.test(text),
        calibration_type: calibrationType,
        calibration_triggers: triggers.length > 0 ? triggers : ["After replacement or repair"],
      });
    }
  }

  return systems;
}

function extractRepairMappings(text: string, adasSystems: AdasSystem[]): RepairMapping[] {
  const mappings: RepairMapping[] = [];
  const systemNames = adasSystems.map(s => s.system_name);

  for (const repair of REPAIR_PATTERNS) {
    // Check if this repair operation is mentioned
    const isRelevant = repair.patterns.some(p => p.test(text));

    if (isRelevant) {
      // Determine which ADAS systems this repair affects
      const triggersCalibration: string[] = [];

      // Map common repairs to ADAS systems
      if (repair.operation.includes("Windshield")) {
        if (systemNames.includes("Forward Collision Warning")) triggersCalibration.push("Forward Collision Warning");
        if (systemNames.includes("Lane Departure Warning")) triggersCalibration.push("Lane Departure Warning");
        if (systemNames.includes("Camera System")) triggersCalibration.push("Camera System");
        if (systemNames.includes("ProPilot Assist")) triggersCalibration.push("ProPilot Assist");
      }

      if (repair.operation.includes("Front Bumper") || repair.operation.includes("Front Grille")) {
        if (systemNames.includes("Adaptive Cruise Control")) triggersCalibration.push("Adaptive Cruise Control");
        if (systemNames.includes("Radar Sensor")) triggersCalibration.push("Radar Sensor");
        if (systemNames.includes("Parking Sensors")) triggersCalibration.push("Parking Sensors");
        if (systemNames.includes("Automatic Emergency Braking")) triggersCalibration.push("Automatic Emergency Braking");
      }

      if (repair.operation.includes("Rear Bumper")) {
        if (systemNames.includes("Blind Spot Warning")) triggersCalibration.push("Blind Spot Warning");
        if (systemNames.includes("Rear Cross Traffic Alert")) triggersCalibration.push("Rear Cross Traffic Alert");
        if (systemNames.includes("Parking Sensors")) triggersCalibration.push("Parking Sensors");
      }

      if (repair.operation.includes("Side Mirror")) {
        if (systemNames.includes("Blind Spot Warning")) triggersCalibration.push("Blind Spot Warning");
        if (systemNames.includes("Around View Monitor")) triggersCalibration.push("Around View Monitor");
      }

      if (repair.operation.includes("Steering")) {
        if (systemNames.includes("Steering Angle Sensor")) triggersCalibration.push("Steering Angle Sensor");
        if (systemNames.includes("Lane Departure Warning")) triggersCalibration.push("Lane Departure Warning");
      }

      if (repair.operation.includes("Around View") || repair.operation.includes("Quarter Panel")) {
        if (systemNames.includes("Around View Monitor")) triggersCalibration.push("Around View Monitor");
      }

      // Add notes from the PDF context
      let notes: string | undefined;
      const noteMatch = text.match(new RegExp(`${repair.patterns[0].source}[^.]*\\.`, 'i'));
      if (noteMatch) {
        notes = noteMatch[0].trim().substring(0, 200);
      }

      if (triggersCalibration.length > 0 || isRelevant) {
        mappings.push({
          repair_operation: repair.operation,
          repair_keywords: repair.keywords,
          triggers_calibration: triggersCalibration.length > 0 ? triggersCalibration : ["Check ADAS systems"],
          notes,
        });
      }
    }
  }

  return mappings;
}

function determineVehicleInfo(make: string, pdfName: string, text: string): { year_start: number; year_end: number; model: string } {
  // Try to extract year from filename or text
  const yearMatch = pdfName.match(/20\d{2}/) || text.match(/model\s*year[:\s]*(20\d{2})/i);
  const year = yearMatch ? parseInt(yearMatch[0]) : 2024;

  // Try to extract model from filename
  const modelMatch = pdfName.match(/(?:Pos_)?([A-Za-z]+(?:-[A-Za-z]+)?)-/);
  let model = modelMatch ? modelMatch[1].replace(/-/g, ' ') : "All Models";

  // Clean up model name
  if (model.toLowerCase() === 'ariya') model = 'Ariya';
  if (model.toLowerCase() === 'pos') model = 'All Models';

  return {
    year_start: year - 2,  // Position statements usually cover multiple years
    year_end: year + 2,
    model,
  };
}

async function processPdf(pdfPath: string, make: string): Promise<VehicleOemData | null> {
  const pdfName = path.basename(pdfPath);
  console.log(`\nProcessing: ${pdfName}`);

  try {
    const text = await extractTextFromPdf(pdfPath);
    console.log(`  Extracted ${text.length} characters of text`);

    // Extract ADAS systems mentioned
    const adasSystems = extractAdasSystems(text);
    console.log(`  Found ${adasSystems.length} ADAS systems`);

    if (adasSystems.length === 0) {
      console.log(`  Skipping - no ADAS systems found`);
      return null;
    }

    // Extract repair mappings
    const repairMappings = extractRepairMappings(text, adasSystems);
    console.log(`  Found ${repairMappings.length} repair mappings`);

    // Determine vehicle info
    const vehicleInfo = determineVehicleInfo(make, pdfName, text);

    const data: VehicleOemData = {
      vehicle: {
        year_start: vehicleInfo.year_start,
        year_end: vehicleInfo.year_end,
        make,
        model: vehicleInfo.model,
      },
      source: {
        provider: `${make} Position Statement`,
        url: pdfPath,
        date_extracted: new Date().toISOString().split('T')[0],
      },
      adas_systems: adasSystems,
      repair_to_calibration_map: repairMappings,
    };

    return data;
  } catch (error) {
    console.error(`  Error processing ${pdfName}:`, error);
    return null;
  }
}

function mergeVehicleData(existing: VehicleOemData, newData: VehicleOemData): VehicleOemData {
  // Merge ADAS systems (avoid duplicates)
  const existingSystemNames = new Set(existing.adas_systems.map(s => s.system_name));
  for (const system of newData.adas_systems) {
    if (!existingSystemNames.has(system.system_name)) {
      existing.adas_systems.push(system);
    }
  }

  // Merge repair mappings (avoid duplicates)
  const existingOperations = new Set(existing.repair_to_calibration_map.map(m => m.repair_operation));
  for (const mapping of newData.repair_to_calibration_map) {
    if (!existingOperations.has(mapping.repair_operation)) {
      existing.repair_to_calibration_map.push(mapping);
    } else {
      // Merge triggers for existing operation
      const existingMapping = existing.repair_to_calibration_map.find(m => m.repair_operation === mapping.repair_operation);
      if (existingMapping) {
        const existingTriggers = new Set(existingMapping.triggers_calibration);
        for (const trigger of mapping.triggers_calibration) {
          if (!existingTriggers.has(trigger)) {
            existingMapping.triggers_calibration.push(trigger);
          }
        }
      }
    }
  }

  return existing;
}

async function processOemFolder(make: string) {
  const makeFolder = path.join(OEM_FOLDER, make);
  const outputFolder = path.join(OUTPUT_FOLDER, make);

  if (!fs.existsSync(makeFolder)) {
    console.error(`Folder not found: ${makeFolder}`);
    process.exit(1);
  }

  // Create output folder
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  // Get all PDFs
  const pdfFiles = fs.readdirSync(makeFolder).filter(f => f.endsWith('.pdf'));
  console.log(`Found ${pdfFiles.length} PDF files in ${make} folder`);

  // Process each PDF and merge data
  let mergedData: VehicleOemData | null = null;

  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(makeFolder, pdfFile);
    const data = await processPdf(pdfPath, make);

    if (data) {
      if (!mergedData) {
        // First valid data becomes the base
        mergedData = {
          ...data,
          vehicle: {
            ...data.vehicle,
            model: "All Models",  // Since we're merging, use "All Models"
          },
        };
      } else {
        // Merge with existing data
        mergedData = mergeVehicleData(mergedData, data);
      }
    }
  }

  if (mergedData) {
    // Write merged JSON file
    const outputPath = path.join(outputFolder, `${make.toLowerCase()}-all-models.json`);
    fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2));
    console.log(`\nWrote merged data to: ${outputPath}`);
    console.log(`  Total ADAS systems: ${mergedData.adas_systems.length}`);
    console.log(`  Total repair mappings: ${mergedData.repair_to_calibration_map.length}`);
  } else {
    console.log(`\nNo ADAS data found in ${make} PDFs`);
  }
}

// Main execution
const make = process.argv[2];

if (!make) {
  console.log("Usage: npx ts-node scripts/extract-oem-pdfs.ts [Make]");
  console.log("Example: npx ts-node scripts/extract-oem-pdfs.ts Nissan");
  console.log("\nAvailable makes:");
  const makes = fs.readdirSync(OEM_FOLDER).filter(f =>
    fs.statSync(path.join(OEM_FOLDER, f)).isDirectory()
  );
  makes.forEach(m => console.log(`  - ${m}`));
  process.exit(0);
}

console.log(`\n=== OEM Position Statement Extractor ===`);
console.log(`Processing: ${make}`);
console.log(`Output: ${OUTPUT_FOLDER}/${make}/`);

processOemFolder(make).then(() => {
  console.log("\nDone!");
}).catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
