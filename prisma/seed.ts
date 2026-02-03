import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient();

async function createDemoAccount() {
  const demoEmail = "demo@test.com";
  const demoPassword = "demo123";

  // Check if demo account exists
  const existing = await prisma.shop.findUnique({
    where: { email: demoEmail },
  });

  if (existing) {
    console.log("Demo account already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash(demoPassword, 12);

  const shop = await prisma.shop.create({
    data: {
      name: "Demo Shop",
      email: demoEmail,
      passwordHash,
      subscription: {
        create: {
          plan: "standard",
          monthlyVehicleLimit: 150,
          pricePerMonth: 500,
          overagePrice: 5,
        },
      },
    },
  });

  console.log(`Created demo account: ${demoEmail} / ${demoPassword}`);
  return shop;
}

interface OemDataSource {
  provider: string;
  url: string;
  date_extracted: string;
}

interface AdasSystemData {
  system_name: string;
  oem_name?: string;
  location?: string;
  dtc_set?: boolean;
  scan_tool_required?: boolean | null;
  special_tools_required?: boolean;
  calibration_type?: string;
  calibration_triggers?: string[];
}

interface RepairCalibrationMapData {
  repair_operation: string;
  repair_keywords: string[];
  triggers_calibration: string[];
  notes?: string;
}

interface VehicleOemData {
  vehicle: {
    year_start: number;
    year_end: number;
    make: string;
    model: string;
  };
  source: OemDataSource;
  adas_systems: AdasSystemData[];
  repair_to_calibration_map: RepairCalibrationMapData[];
}

async function seedFromJsonFile(filePath: string) {
  console.log(`Seeding from: ${filePath}`);

  const data: VehicleOemData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // Create the vehicle with source info
  const vehicle = await prisma.vehicle.create({
    data: {
      yearStart: data.vehicle.year_start,
      yearEnd: data.vehicle.year_end,
      make: data.vehicle.make,
      model: data.vehicle.model,
      sourceProvider: data.source?.provider || null,
      sourceUrl: data.source?.url || null,
    },
  });

  console.log(`  Created vehicle: ${data.vehicle.year_start} ${data.vehicle.make} ${data.vehicle.model}`);

  // Create ADAS systems and their calibration triggers
  for (const system of data.adas_systems) {
    const adasSystem = await prisma.adasSystem.create({
      data: {
        vehicleId: vehicle.id,
        systemName: system.system_name,
        oemName: system.oem_name || null,
        location: system.location || null,
        dtcSet: system.dtc_set ?? false,
        scanToolRequired: system.scan_tool_required ?? null,
        specialToolsRequired: system.special_tools_required ?? null,
        calibrationType: system.calibration_type || null,
      },
    });

    // Create calibration triggers
    if (system.calibration_triggers) {
      for (const trigger of system.calibration_triggers) {
        await prisma.calibrationTrigger.create({
          data: {
            adasSystemId: adasSystem.id,
            trigger,
          },
        });
      }
    }
  }

  console.log(`  Created ${data.adas_systems.length} ADAS systems`);

  // Create repair to calibration mappings
  for (const mapping of data.repair_to_calibration_map) {
    await prisma.repairCalibrationMap.create({
      data: {
        vehicleId: vehicle.id,
        repairOperation: mapping.repair_operation,
        repairKeywords: JSON.stringify(mapping.repair_keywords),
        triggersCalibration: JSON.stringify(mapping.triggers_calibration),
        notes: mapping.notes || null,
      },
    });
  }

  console.log(`  Created ${data.repair_to_calibration_map.length} repair-to-calibration mappings`);

  return vehicle;
}

function findAllJsonFiles(dir: string): string[] {
  const jsonFiles: string[] = [];

  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        jsonFiles.push(...findAllJsonFiles(fullPath));
      } else if (item.name.endsWith(".json") && !item.name.startsWith(".")) {
        jsonFiles.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return jsonFiles;
}

async function main() {
  console.log("Starting database seed...\n");

  // Create demo account first
  await createDemoAccount();
  console.log("");

  // Clear existing vehicle data (keep shops)
  await prisma.calibrationTrigger.deleteMany();
  await prisma.repairCalibrationMap.deleteMany();
  await prisma.adasSystem.deleteMany();
  await prisma.vehicle.deleteMany();

  console.log("Cleared existing vehicle data.\n");

  // Find all JSON files in the data directory
  const dataDir = path.join(__dirname, "../data");
  const jsonFiles = findAllJsonFiles(dataDir);

  console.log(`Found ${jsonFiles.length} JSON files to process.\n`);

  let vehicleCount = 0;
  for (const file of jsonFiles) {
    try {
      await seedFromJsonFile(file);
      vehicleCount++;
    } catch (error) {
      console.error(`  Error processing ${file}:`, error);
    }
  }

  console.log(`\nSeeding complete! Created ${vehicleCount} vehicles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
