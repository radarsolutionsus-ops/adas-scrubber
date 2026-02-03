-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'standard',
    "monthlyVehicleLimit" INTEGER NOT NULL DEFAULT 150,
    "pricePerMonth" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "overagePrice" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "billingCycleStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "vehicleInfo" TEXT NOT NULL,
    "reportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "yearStart" INTEGER NOT NULL,
    "yearEnd" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "sourceProvider" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdasSystem" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "systemName" TEXT NOT NULL,
    "oemName" TEXT,
    "location" TEXT,
    "dtcSet" BOOLEAN NOT NULL DEFAULT false,
    "scanToolRequired" BOOLEAN,
    "specialToolsRequired" BOOLEAN,
    "calibrationType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdasSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationTrigger" (
    "id" TEXT NOT NULL,
    "adasSystemId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,

    CONSTRAINT "CalibrationTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairCalibrationMap" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "repairOperation" TEXT NOT NULL,
    "repairKeywords" TEXT NOT NULL,
    "triggersCalibration" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "RepairCalibrationMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "vehicleYear" INTEGER NOT NULL,
    "vehicleMake" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "estimateText" TEXT NOT NULL,
    "calibrations" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_email_key" ON "Shop"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_shopId_key" ON "Subscription"("shopId");

-- CreateIndex
CREATE INDEX "UsageRecord_shopId_idx" ON "UsageRecord"("shopId");

-- CreateIndex
CREATE INDEX "UsageRecord_createdAt_idx" ON "UsageRecord"("createdAt");

-- CreateIndex
CREATE INDEX "AdasSystem_vehicleId_idx" ON "AdasSystem"("vehicleId");

-- CreateIndex
CREATE INDEX "CalibrationTrigger_adasSystemId_idx" ON "CalibrationTrigger"("adasSystemId");

-- CreateIndex
CREATE INDEX "RepairCalibrationMap_vehicleId_idx" ON "RepairCalibrationMap"("vehicleId");

-- CreateIndex
CREATE INDEX "Report_shopId_idx" ON "Report"("shopId");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdasSystem" ADD CONSTRAINT "AdasSystem_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationTrigger" ADD CONSTRAINT "CalibrationTrigger_adasSystemId_fkey" FOREIGN KEY ("adasSystemId") REFERENCES "AdasSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairCalibrationMap" ADD CONSTRAINT "RepairCalibrationMap_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
