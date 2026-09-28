DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ComparativeStatementStatus'
  ) THEN
    CREATE TYPE "ComparativeStatementStatus" AS ENUM (
      'DRAFT',
      'SUBMITTED',
      'MANAGER_APPROVED',
      'COMMITTEE_APPROVED',
      'FINAL_APPROVED',
      'REJECTED',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ComparativeStatementApprovalStage'
  ) THEN
    CREATE TYPE "ComparativeStatementApprovalStage" AS ENUM (
      'DRAFT',
      'SUBMISSION',
      'MANAGER_REVIEW',
      'COMMITTEE_REVIEW',
      'FINAL_APPROVAL',
      'REJECTION',
      'CANCELLATION'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ComparativeStatementApprovalDecision'
  ) THEN
    CREATE TYPE "ComparativeStatementApprovalDecision" AS ENUM (
      'SUBMITTED',
      'APPROVED',
      'REJECTED',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ComparativeStatement" (
  "id" SERIAL NOT NULL,
  "csNumber" TEXT NOT NULL,
  "rfqId" INTEGER NOT NULL,
  "warehouseId" INTEGER NOT NULL,
  "versionNo" INTEGER NOT NULL DEFAULT 1,
  "status" "ComparativeStatementStatus" NOT NULL DEFAULT 'DRAFT',
  "approvalStage" "ComparativeStatementApprovalStage" NOT NULL DEFAULT 'DRAFT',
  "technicalWeight" DECIMAL(5,2) NOT NULL DEFAULT 70,
  "financialWeight" DECIMAL(5,2) NOT NULL DEFAULT 30,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "managerApprovedAt" TIMESTAMP(3),
  "committeeApprovedAt" TIMESTAMP(3),
  "finalApprovedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "managerApprovedById" TEXT,
  "committeeApprovedById" TEXT,
  "finalApprovedById" TEXT,
  "rejectedById" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "note" TEXT,
  "rejectionNote" TEXT,
  "sourceQuotationSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComparativeStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ComparativeStatementLine" (
  "id" SERIAL NOT NULL,
  "comparativeStatementId" INTEGER NOT NULL,
  "supplierQuotationId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "financialSubtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "financialTaxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "financialGrandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "technicalScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "financialScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "combinedScore" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "rank" INTEGER,
  "isResponsive" BOOLEAN NOT NULL DEFAULT true,
  "technicalNote" TEXT,
  "financialNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComparativeStatementLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ComparativeStatementApprovalEvent" (
  "id" SERIAL NOT NULL,
  "comparativeStatementId" INTEGER NOT NULL,
  "stage" "ComparativeStatementApprovalStage" NOT NULL,
  "decision" "ComparativeStatementApprovalDecision" NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "actedById" TEXT,
  "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComparativeStatementApprovalEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ComparativeStatementNotification" (
  "id" SERIAL NOT NULL,
  "comparativeStatementId" INTEGER NOT NULL,
  "stage" "ComparativeStatementApprovalStage" NOT NULL,
  "channel" "WorkflowNotificationChannel" NOT NULL,
  "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "recipientUserId" TEXT,
  "recipientEmail" TEXT,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComparativeStatementNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ComparativeStatement_csNumber_key"
  ON "ComparativeStatement"("csNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ComparativeStatement_rfqId_versionNo_key"
  ON "ComparativeStatement"("rfqId", "versionNo");
CREATE INDEX IF NOT EXISTS "ComparativeStatement_rfqId_status_idx"
  ON "ComparativeStatement"("rfqId", "status");
CREATE INDEX IF NOT EXISTS "ComparativeStatement_warehouseId_status_idx"
  ON "ComparativeStatement"("warehouseId", "status");
CREATE INDEX IF NOT EXISTS "ComparativeStatement_createdById_idx"
  ON "ComparativeStatement"("createdById");
CREATE INDEX IF NOT EXISTS "ComparativeStatement_managerApprovedById_idx"
  ON "ComparativeStatement"("managerApprovedById");
CREATE INDEX IF NOT EXISTS "ComparativeStatement_committeeApprovedById_idx"
  ON "ComparativeStatement"("committeeApprovedById");
CREATE INDEX IF NOT EXISTS "ComparativeStatement_finalApprovedById_idx"
  ON "ComparativeStatement"("finalApprovedById");

CREATE UNIQUE INDEX IF NOT EXISTS "ComparativeStatementLine_comparativeStatementId_supplierQuotationId_key"
  ON "ComparativeStatementLine"("comparativeStatementId", "supplierQuotationId");
CREATE INDEX IF NOT EXISTS "ComparativeStatementLine_comparativeStatementId_rank_idx"
  ON "ComparativeStatementLine"("comparativeStatementId", "rank");
CREATE INDEX IF NOT EXISTS "ComparativeStatementLine_supplierId_idx"
  ON "ComparativeStatementLine"("supplierId");

CREATE INDEX IF NOT EXISTS "ComparativeStatementApprovalEvent_comparativeStatementId_stage_idx"
  ON "ComparativeStatementApprovalEvent"("comparativeStatementId", "stage");
CREATE INDEX IF NOT EXISTS "ComparativeStatementApprovalEvent_actedById_idx"
  ON "ComparativeStatementApprovalEvent"("actedById");

CREATE INDEX IF NOT EXISTS "ComparativeStatementNotification_comparativeStatementId_stage_createdAt_idx"
  ON "ComparativeStatementNotification"("comparativeStatementId", "stage", "createdAt");
CREATE INDEX IF NOT EXISTS "ComparativeStatementNotification_recipientUserId_idx"
  ON "ComparativeStatementNotification"("recipientUserId");
CREATE INDEX IF NOT EXISTS "ComparativeStatementNotification_status_channel_idx"
  ON "ComparativeStatementNotification"("status", "channel");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatement_rfqId_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatement"
      ADD CONSTRAINT "ComparativeStatement_rfqId_fkey"
      FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatement_warehouseId_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatement"
      ADD CONSTRAINT "ComparativeStatement_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatement_managerApprovedById_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatement"
      ADD CONSTRAINT "ComparativeStatement_managerApprovedById_fkey"
      FOREIGN KEY ("managerApprovedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatement_committeeApprovedById_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatement"
      ADD CONSTRAINT "ComparativeStatement_committeeApprovedById_fkey"
      FOREIGN KEY ("committeeApprovedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatement_finalApprovedById_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatement"
      ADD CONSTRAINT "ComparativeStatement_finalApprovedById_fkey"
      FOREIGN KEY ("finalApprovedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatement_rejectedById_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatement"
      ADD CONSTRAINT "ComparativeStatement_rejectedById_fkey"
      FOREIGN KEY ("rejectedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatement_createdById_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatement"
      ADD CONSTRAINT "ComparativeStatement_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatement_updatedById_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatement"
      ADD CONSTRAINT "ComparativeStatement_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatementLine_comparativeStatementId_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatementLine"
      ADD CONSTRAINT "ComparativeStatementLine_comparativeStatementId_fkey"
      FOREIGN KEY ("comparativeStatementId") REFERENCES "ComparativeStatement"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatementLine_supplierQuotationId_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatementLine"
      ADD CONSTRAINT "ComparativeStatementLine_supplierQuotationId_fkey"
      FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatementLine_supplierId_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatementLine"
      ADD CONSTRAINT "ComparativeStatementLine_supplierId_fkey"
      FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatementApprovalEvent_comparativeStatementId_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatementApprovalEvent"
      ADD CONSTRAINT "ComparativeStatementApprovalEvent_comparativeStatementId_fkey"
      FOREIGN KEY ("comparativeStatementId") REFERENCES "ComparativeStatement"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatementApprovalEvent_actedById_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatementApprovalEvent"
      ADD CONSTRAINT "ComparativeStatementApprovalEvent_actedById_fkey"
      FOREIGN KEY ("actedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatementNotification_comparativeStatementId_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatementNotification"
      ADD CONSTRAINT "ComparativeStatementNotification_comparativeStatementId_fkey"
      FOREIGN KEY ("comparativeStatementId") REFERENCES "ComparativeStatement"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparativeStatementNotification_recipientUserId_fkey'
  ) THEN
    ALTER TABLE "ComparativeStatementNotification"
      ADD CONSTRAINT "ComparativeStatementNotification_recipientUserId_fkey"
      FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

