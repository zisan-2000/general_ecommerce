-- CreateEnum
CREATE TYPE "SupplierSlaEvaluationStatus" AS ENUM ('OK', 'WARNING', 'BREACH');

-- CreateEnum
CREATE TYPE "SupplierSlaSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "SupplierSlaPolicy" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "evaluationWindowDays" INTEGER NOT NULL DEFAULT 90,
    "minTrackedPoCount" INTEGER NOT NULL DEFAULT 3,
    "targetLeadTimeDays" INTEGER NOT NULL,
    "minimumOnTimeRate" DECIMAL(5,2) NOT NULL DEFAULT 90,
    "minimumFillRate" DECIMAL(5,2) NOT NULL DEFAULT 95,
    "maxOpenLatePoCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSlaBreach" (
    "id" SERIAL NOT NULL,
    "supplierSlaPolicyId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "evaluationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "trackedPoCount" INTEGER NOT NULL DEFAULT 0,
    "completedPoCount" INTEGER NOT NULL DEFAULT 0,
    "openLatePoCount" INTEGER NOT NULL DEFAULT 0,
    "breachCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SupplierSlaEvaluationStatus" NOT NULL DEFAULT 'OK',
    "severity" "SupplierSlaSeverity" NOT NULL DEFAULT 'LOW',
    "observedLeadTimeDays" DECIMAL(8,2),
    "onTimeRatePercent" DECIMAL(5,2),
    "fillRatePercent" DECIMAL(5,2),
    "issues" JSONB,
    "evaluatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSlaBreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSlaPolicy_supplierId_key" ON "SupplierSlaPolicy"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierSlaPolicy_isActive_idx" ON "SupplierSlaPolicy"("isActive");

-- CreateIndex
CREATE INDEX "SupplierSlaPolicy_createdById_idx" ON "SupplierSlaPolicy"("createdById");

-- CreateIndex
CREATE INDEX "SupplierSlaPolicy_updatedById_idx" ON "SupplierSlaPolicy"("updatedById");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_supplierId_evaluationDate_idx" ON "SupplierSlaBreach"("supplierId", "evaluationDate");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_supplierSlaPolicyId_evaluationDate_idx" ON "SupplierSlaBreach"("supplierSlaPolicyId", "evaluationDate");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_status_evaluationDate_idx" ON "SupplierSlaBreach"("status", "evaluationDate");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_evaluatedById_idx" ON "SupplierSlaBreach"("evaluatedById");

-- AddForeignKey
ALTER TABLE "SupplierSlaPolicy" ADD CONSTRAINT "SupplierSlaPolicy_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaPolicy" ADD CONSTRAINT "SupplierSlaPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaPolicy" ADD CONSTRAINT "SupplierSlaPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach" ADD CONSTRAINT "SupplierSlaBreach_supplierSlaPolicyId_fkey" FOREIGN KEY ("supplierSlaPolicyId") REFERENCES "SupplierSlaPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach" ADD CONSTRAINT "SupplierSlaBreach_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach" ADD CONSTRAINT "SupplierSlaBreach_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
