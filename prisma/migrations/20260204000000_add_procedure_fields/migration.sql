-- AlterTable
ALTER TABLE "RepairCalibrationMap" ADD COLUMN IF NOT EXISTS "procedureType" TEXT;
ALTER TABLE "RepairCalibrationMap" ADD COLUMN IF NOT EXISTS "procedureName" TEXT;
ALTER TABLE "RepairCalibrationMap" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "RepairCalibrationMap" ADD COLUMN IF NOT EXISTS "toolsRequired" TEXT;
