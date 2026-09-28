-- CreateEnum
CREATE TYPE "SupplierSlaActionStatus" AS ENUM ('NOT_REQUIRED', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "SupplierSlaPolicy"
ADD COLUMN "autoEvaluationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "warningActionDueDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN "breachActionDueDays" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "SupplierSlaBreach"
ADD COLUMN "actionStatus" "SupplierSlaActionStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "ownerUserId" TEXT,
ADD COLUMN "dueDate" TIMESTAMP(3),
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "resolvedById" TEXT,
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "alertTriggeredAt" TIMESTAMP(3),
ADD COLUMN "alertMessage" TEXT,
ADD COLUMN "alertAcknowledgedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_actionStatus_dueDate_idx" ON "SupplierSlaBreach"("actionStatus", "dueDate");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_ownerUserId_actionStatus_idx" ON "SupplierSlaBreach"("ownerUserId", "actionStatus");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_resolvedById_idx" ON "SupplierSlaBreach"("resolvedById");

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach"
ADD CONSTRAINT "SupplierSlaBreach_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach"
ADD CONSTRAINT "SupplierSlaBreach_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
