-- CreateEnum
CREATE TYPE "SupplierInvoicePaymentHoldStatus" AS ENUM ('CLEAR', 'HELD', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "SupplierInvoiceSlaCreditStatus" AS ENUM ('NONE', 'RECOMMENDED', 'APPLIED', 'WAIVED');

-- AlterTable
ALTER TABLE "SupplierInvoice"
ADD COLUMN "paymentHoldStatus" "SupplierInvoicePaymentHoldStatus" NOT NULL DEFAULT 'CLEAR',
ADD COLUMN "paymentHoldReason" TEXT,
ADD COLUMN "paymentHoldAt" TIMESTAMP(3),
ADD COLUMN "paymentHoldReleasedAt" TIMESTAMP(3),
ADD COLUMN "paymentHoldReleasedById" TEXT,
ADD COLUMN "paymentHoldOverrideNote" TEXT,
ADD COLUMN "slaRecommendedCredit" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "slaCreditStatus" "SupplierInvoiceSlaCreditStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "slaCreditReason" TEXT,
ADD COLUMN "slaCreditUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SupplierSlaFinancialRule" (
    "id" SERIAL NOT NULL,
    "supplierSlaPolicyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "holdPaymentsOnThreeWayVariance" BOOLEAN NOT NULL DEFAULT true,
    "holdPaymentsOnOpenSlaAction" BOOLEAN NOT NULL DEFAULT true,
    "allowPaymentHoldOverride" BOOLEAN NOT NULL DEFAULT true,
    "autoCreditRecommendationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "warningPenaltyRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "breachPenaltyRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "criticalPenaltyRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "minBreachCountForCredit" INTEGER NOT NULL DEFAULT 1,
    "maxCreditCapAmount" DECIMAL(12,2),
    "note" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSlaFinancialRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSlaFinancialRule_supplierSlaPolicyId_key" ON "SupplierSlaFinancialRule"("supplierSlaPolicyId");

-- CreateIndex
CREATE INDEX "SupplierSlaFinancialRule_isActive_idx" ON "SupplierSlaFinancialRule"("isActive");

-- CreateIndex
CREATE INDEX "SupplierSlaFinancialRule_createdById_idx" ON "SupplierSlaFinancialRule"("createdById");

-- CreateIndex
CREATE INDEX "SupplierSlaFinancialRule_updatedById_idx" ON "SupplierSlaFinancialRule"("updatedById");

-- CreateIndex
CREATE INDEX "SupplierInvoice_paymentHoldStatus_idx" ON "SupplierInvoice"("paymentHoldStatus");

-- CreateIndex
CREATE INDEX "SupplierInvoice_slaCreditStatus_idx" ON "SupplierInvoice"("slaCreditStatus");

-- CreateIndex
CREATE INDEX "SupplierInvoice_paymentHoldReleasedById_idx" ON "SupplierInvoice"("paymentHoldReleasedById");

-- AddForeignKey
ALTER TABLE "SupplierInvoice"
ADD CONSTRAINT "SupplierInvoice_paymentHoldReleasedById_fkey" FOREIGN KEY ("paymentHoldReleasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaFinancialRule"
ADD CONSTRAINT "SupplierSlaFinancialRule_supplierSlaPolicyId_fkey" FOREIGN KEY ("supplierSlaPolicyId") REFERENCES "SupplierSlaPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaFinancialRule"
ADD CONSTRAINT "SupplierSlaFinancialRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaFinancialRule"
ADD CONSTRAINT "SupplierSlaFinancialRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
