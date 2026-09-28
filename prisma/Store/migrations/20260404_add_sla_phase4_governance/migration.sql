-- CreateEnum
CREATE TYPE "SupplierSlaDisputeStatus" AS ENUM ('NONE', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SupplierSlaTerminationCaseStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "SupplierSlaTerminationAction" AS ENUM ('WATCHLIST', 'SUSPEND_NEW_PO', 'REVIEW_CONTRACT', 'TERMINATE_RELATIONSHIP');

-- AlterTable
ALTER TABLE "SupplierSlaPolicy"
ADD COLUMN "terminationClauseEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "terminationLookbackDays" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN "terminationMinBreachCount" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "terminationMinCriticalCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "terminationRecommendedAction" "SupplierSlaTerminationAction" NOT NULL DEFAULT 'REVIEW_CONTRACT',
ADD COLUMN "terminationNote" TEXT;

-- AlterTable
ALTER TABLE "SupplierSlaFinancialRule"
ADD COLUMN "autoApplyRecommendedCredit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "autoApplyRequireMatchedInvoice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "autoApplyBlockOnOpenDispute" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "autoApplyMaxAmount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "SupplierSlaBreach"
ADD COLUMN "disputeStatus" "SupplierSlaDisputeStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "disputeReason" TEXT,
ADD COLUMN "disputeRaisedAt" TIMESTAMP(3),
ADD COLUMN "disputeRaisedById" TEXT,
ADD COLUMN "disputeResolutionNote" TEXT,
ADD COLUMN "disputeResolvedAt" TIMESTAMP(3),
ADD COLUMN "disputeResolvedById" TEXT,
ADD COLUMN "terminationCaseId" INTEGER,
ADD COLUMN "terminationSuggestedAt" TIMESTAMP(3),
ADD COLUMN "terminationSuggestionNote" TEXT;

-- CreateTable
CREATE TABLE "SupplierSlaTerminationCase" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "supplierSlaPolicyId" INTEGER NOT NULL,
    "triggerBreachId" INTEGER,
    "status" "SupplierSlaTerminationCaseStatus" NOT NULL DEFAULT 'OPEN',
    "recommendedAction" "SupplierSlaTerminationAction" NOT NULL DEFAULT 'REVIEW_CONTRACT',
    "openBreachCount" INTEGER NOT NULL DEFAULT 0,
    "criticalBreachCount" INTEGER NOT NULL DEFAULT 0,
    "lookbackDays" INTEGER NOT NULL DEFAULT 180,
    "reason" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSlaTerminationCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierSlaPolicy_terminationClauseEnabled_idx" ON "SupplierSlaPolicy"("terminationClauseEnabled");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_disputeStatus_evaluationDate_idx" ON "SupplierSlaBreach"("disputeStatus", "evaluationDate");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_disputeRaisedById_idx" ON "SupplierSlaBreach"("disputeRaisedById");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_disputeResolvedById_idx" ON "SupplierSlaBreach"("disputeResolvedById");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_terminationCaseId_idx" ON "SupplierSlaBreach"("terminationCaseId");

-- CreateIndex
CREATE INDEX "SupplierSlaTerminationCase_supplierId_status_idx" ON "SupplierSlaTerminationCase"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierSlaTerminationCase_supplierSlaPolicyId_status_idx" ON "SupplierSlaTerminationCase"("supplierSlaPolicyId", "status");

-- CreateIndex
CREATE INDEX "SupplierSlaTerminationCase_ownerUserId_status_idx" ON "SupplierSlaTerminationCase"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "SupplierSlaTerminationCase_resolvedById_idx" ON "SupplierSlaTerminationCase"("resolvedById");

-- CreateIndex
CREATE INDEX "SupplierSlaTerminationCase_createdById_idx" ON "SupplierSlaTerminationCase"("createdById");

-- CreateIndex
CREATE INDEX "SupplierSlaTerminationCase_createdAt_idx" ON "SupplierSlaTerminationCase"("createdAt");

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach"
ADD CONSTRAINT "SupplierSlaBreach_disputeRaisedById_fkey" FOREIGN KEY ("disputeRaisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach"
ADD CONSTRAINT "SupplierSlaBreach_disputeResolvedById_fkey" FOREIGN KEY ("disputeResolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach"
ADD CONSTRAINT "SupplierSlaBreach_terminationCaseId_fkey" FOREIGN KEY ("terminationCaseId") REFERENCES "SupplierSlaTerminationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaTerminationCase"
ADD CONSTRAINT "SupplierSlaTerminationCase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaTerminationCase"
ADD CONSTRAINT "SupplierSlaTerminationCase_supplierSlaPolicyId_fkey" FOREIGN KEY ("supplierSlaPolicyId") REFERENCES "SupplierSlaPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaTerminationCase"
ADD CONSTRAINT "SupplierSlaTerminationCase_triggerBreachId_fkey" FOREIGN KEY ("triggerBreachId") REFERENCES "SupplierSlaBreach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaTerminationCase"
ADD CONSTRAINT "SupplierSlaTerminationCase_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaTerminationCase"
ADD CONSTRAINT "SupplierSlaTerminationCase_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaTerminationCase"
ADD CONSTRAINT "SupplierSlaTerminationCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
