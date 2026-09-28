ALTER TYPE "PurchaseRequisitionStatus" ADD VALUE IF NOT EXISTS 'BUDGET_CLEARED';
ALTER TYPE "PurchaseRequisitionStatus" ADD VALUE IF NOT EXISTS 'ENDORSED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseRequisitionApprovalStage') THEN
    CREATE TYPE "PurchaseRequisitionApprovalStage" AS ENUM (
      'PLANNING',
      'SUBMISSION',
      'BUDGET_CLEARANCE',
      'ENDORSEMENT',
      'FINAL_APPROVAL',
      'ROUTED_TO_PROCUREMENT',
      'REJECTION',
      'CANCELLATION'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseRequisitionApprovalDecision') THEN
    CREATE TYPE "PurchaseRequisitionApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkflowNotificationChannel') THEN
    CREATE TYPE "WorkflowNotificationChannel" AS ENUM ('SYSTEM', 'EMAIL');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkflowNotificationStatus') THEN
    CREATE TYPE "WorkflowNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
  END IF;
END
$$;

ALTER TABLE "PurchaseRequisition"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "purpose" TEXT,
  ADD COLUMN IF NOT EXISTS "budgetCode" TEXT,
  ADD COLUMN IF NOT EXISTS "boqReference" TEXT,
  ADD COLUMN IF NOT EXISTS "specification" TEXT,
  ADD COLUMN IF NOT EXISTS "planningNote" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedAmount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "endorsementRequiredCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "budgetClearedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endorsedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "routedToProcurementAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "budgetClearedById" TEXT,
  ADD COLUMN IF NOT EXISTS "endorsedById" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedProcurementOfficerId" TEXT;

CREATE TABLE IF NOT EXISTS "PurchaseRequisitionAttachment" (
  "id" SERIAL NOT NULL,
  "purchaseRequisitionId" INTEGER NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "note" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseRequisitionAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseRequisitionApprovalEvent" (
  "id" SERIAL NOT NULL,
  "purchaseRequisitionId" INTEGER NOT NULL,
  "stage" "PurchaseRequisitionApprovalStage" NOT NULL,
  "decision" "PurchaseRequisitionApprovalDecision" NOT NULL,
  "note" TEXT,
  "actedById" TEXT,
  "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseRequisitionApprovalEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseRequisitionVersion" (
  "id" SERIAL NOT NULL,
  "purchaseRequisitionId" INTEGER NOT NULL,
  "versionNo" INTEGER NOT NULL,
  "stage" "PurchaseRequisitionApprovalStage" NOT NULL,
  "action" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseRequisitionVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseRequisitionNotification" (
  "id" SERIAL NOT NULL,
  "purchaseRequisitionId" INTEGER NOT NULL,
  "stage" "PurchaseRequisitionApprovalStage" NOT NULL,
  "channel" "WorkflowNotificationChannel" NOT NULL,
  "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "recipientUserId" TEXT,
  "recipientEmail" TEXT,
  "message" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "PurchaseRequisitionNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PurchaseRequisition_budgetClearedById_idx" ON "PurchaseRequisition"("budgetClearedById");
CREATE INDEX IF NOT EXISTS "PurchaseRequisition_endorsedById_idx" ON "PurchaseRequisition"("endorsedById");
CREATE INDEX IF NOT EXISTS "PurchaseRequisition_assignedProcurementOfficerId_idx" ON "PurchaseRequisition"("assignedProcurementOfficerId");

CREATE INDEX IF NOT EXISTS "PurchaseRequisitionAttachment_purchaseRequisitionId_idx" ON "PurchaseRequisitionAttachment"("purchaseRequisitionId");
CREATE INDEX IF NOT EXISTS "PurchaseRequisitionAttachment_uploadedById_idx" ON "PurchaseRequisitionAttachment"("uploadedById");

CREATE INDEX IF NOT EXISTS "PurchaseRequisitionApprovalEvent_purchaseRequisitionId_stage_idx" ON "PurchaseRequisitionApprovalEvent"("purchaseRequisitionId", "stage");
CREATE INDEX IF NOT EXISTS "PurchaseRequisitionApprovalEvent_actedById_idx" ON "PurchaseRequisitionApprovalEvent"("actedById");
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseRequisitionApprovalEvent_purchaseRequisitionId_stage_actedById_key" ON "PurchaseRequisitionApprovalEvent"("purchaseRequisitionId", "stage", "actedById");

CREATE INDEX IF NOT EXISTS "PurchaseRequisitionVersion_purchaseRequisitionId_createdAt_idx" ON "PurchaseRequisitionVersion"("purchaseRequisitionId", "createdAt");
CREATE INDEX IF NOT EXISTS "PurchaseRequisitionVersion_createdById_idx" ON "PurchaseRequisitionVersion"("createdById");
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseRequisitionVersion_purchaseRequisitionId_versionNo_key" ON "PurchaseRequisitionVersion"("purchaseRequisitionId", "versionNo");

CREATE INDEX IF NOT EXISTS "PurchaseRequisitionNotification_purchaseRequisitionId_stage_createdAt_idx" ON "PurchaseRequisitionNotification"("purchaseRequisitionId", "stage", "createdAt");
CREATE INDEX IF NOT EXISTS "PurchaseRequisitionNotification_recipientUserId_idx" ON "PurchaseRequisitionNotification"("recipientUserId");
CREATE INDEX IF NOT EXISTS "PurchaseRequisitionNotification_status_channel_idx" ON "PurchaseRequisitionNotification"("status", "channel");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequisition_budgetClearedById_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequisition"
      ADD CONSTRAINT "PurchaseRequisition_budgetClearedById_fkey"
      FOREIGN KEY ("budgetClearedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequisition_endorsedById_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequisition"
      ADD CONSTRAINT "PurchaseRequisition_endorsedById_fkey"
      FOREIGN KEY ("endorsedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequisition_assignedProcurementOfficerId_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequisition"
      ADD CONSTRAINT "PurchaseRequisition_assignedProcurementOfficerId_fkey"
      FOREIGN KEY ("assignedProcurementOfficerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequisitionAttachment_purchaseRequisitionId_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequisitionAttachment"
      ADD CONSTRAINT "PurchaseRequisitionAttachment_purchaseRequisitionId_fkey"
      FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequisitionAttachment_uploadedById_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequisitionAttachment"
      ADD CONSTRAINT "PurchaseRequisitionAttachment_uploadedById_fkey"
      FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequisitionApprovalEvent_purchaseRequisitionId_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequisitionApprovalEvent"
      ADD CONSTRAINT "PurchaseRequisitionApprovalEvent_purchaseRequisitionId_fkey"
      FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequisitionApprovalEvent_actedById_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequisitionApprovalEvent"
      ADD CONSTRAINT "PurchaseRequisitionApprovalEvent_actedById_fkey"
      FOREIGN KEY ("actedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequisitionVersion_purchaseRequisitionId_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequisitionVersion"
      ADD CONSTRAINT "PurchaseRequisitionVersion_purchaseRequisitionId_fkey"
      FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequisitionVersion_createdById_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequisitionVersion"
      ADD CONSTRAINT "PurchaseRequisitionVersion_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequisitionNotification_purchaseRequisitionId_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequisitionNotification"
      ADD CONSTRAINT "PurchaseRequisitionNotification_purchaseRequisitionId_fkey"
      FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequisitionNotification_recipientUserId_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequisitionNotification"
      ADD CONSTRAINT "PurchaseRequisitionNotification_recipientUserId_fkey"
      FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
