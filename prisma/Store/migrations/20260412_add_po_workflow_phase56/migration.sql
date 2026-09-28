DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'PurchaseOrderApprovalStage'
  ) THEN
    CREATE TYPE "PurchaseOrderApprovalStage" AS ENUM (
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
    SELECT 1 FROM pg_type WHERE typname = 'PurchaseOrderApprovalDecision'
  ) THEN
    CREATE TYPE "PurchaseOrderApprovalDecision" AS ENUM (
      'SUBMITTED',
      'APPROVED',
      'REJECTED',
      'CANCELLED'
    );
  END IF;
END $$;

ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'MANAGER_APPROVED';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'COMMITTEE_APPROVED';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "PurchaseOrder"
  ADD COLUMN IF NOT EXISTS "sourceComparativeStatementId" INTEGER,
  ADD COLUMN IF NOT EXISTS "approvalStage" "PurchaseOrderApprovalStage" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "managerApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "committeeApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "managerApprovedById" TEXT,
  ADD COLUMN IF NOT EXISTS "committeeApprovedById" TEXT,
  ADD COLUMN IF NOT EXISTS "finalApprovedById" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectedById" TEXT,
  ADD COLUMN IF NOT EXISTS "termsTemplateId" INTEGER,
  ADD COLUMN IF NOT EXISTS "termsTemplateCode" TEXT,
  ADD COLUMN IF NOT EXISTS "termsTemplateName" TEXT,
  ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectionNote" TEXT;

CREATE TABLE IF NOT EXISTS "PurchaseOrderTermsTemplate" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderTermsTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseOrderApprovalEvent" (
  "id" SERIAL NOT NULL,
  "purchaseOrderId" INTEGER NOT NULL,
  "stage" "PurchaseOrderApprovalStage" NOT NULL,
  "decision" "PurchaseOrderApprovalDecision" NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "actedById" TEXT,
  "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderApprovalEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseOrderNotification" (
  "id" SERIAL NOT NULL,
  "purchaseOrderId" INTEGER NOT NULL,
  "stage" "PurchaseOrderApprovalStage" NOT NULL,
  "channel" "WorkflowNotificationChannel" NOT NULL,
  "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "recipientUserId" TEXT,
  "recipientEmail" TEXT,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_sourceComparativeStatementId_key"
  ON "PurchaseOrder"("sourceComparativeStatementId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_sourceComparativeStatementId_idx"
  ON "PurchaseOrder"("sourceComparativeStatementId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_managerApprovedById_idx"
  ON "PurchaseOrder"("managerApprovedById");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_committeeApprovedById_idx"
  ON "PurchaseOrder"("committeeApprovedById");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_finalApprovedById_idx"
  ON "PurchaseOrder"("finalApprovedById");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_rejectedById_idx"
  ON "PurchaseOrder"("rejectedById");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_termsTemplateId_idx"
  ON "PurchaseOrder"("termsTemplateId");

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrderTermsTemplate_code_key"
  ON "PurchaseOrderTermsTemplate"("code");
CREATE INDEX IF NOT EXISTS "PurchaseOrderTermsTemplate_isActive_isDefault_idx"
  ON "PurchaseOrderTermsTemplate"("isActive", "isDefault");
CREATE INDEX IF NOT EXISTS "PurchaseOrderTermsTemplate_createdById_idx"
  ON "PurchaseOrderTermsTemplate"("createdById");
CREATE INDEX IF NOT EXISTS "PurchaseOrderTermsTemplate_updatedById_idx"
  ON "PurchaseOrderTermsTemplate"("updatedById");

CREATE INDEX IF NOT EXISTS "PurchaseOrderApprovalEvent_purchaseOrderId_stage_idx"
  ON "PurchaseOrderApprovalEvent"("purchaseOrderId", "stage");
CREATE INDEX IF NOT EXISTS "PurchaseOrderApprovalEvent_actedById_idx"
  ON "PurchaseOrderApprovalEvent"("actedById");

CREATE INDEX IF NOT EXISTS "PurchaseOrderNotification_purchaseOrderId_stage_createdAt_idx"
  ON "PurchaseOrderNotification"("purchaseOrderId", "stage", "createdAt");
CREATE INDEX IF NOT EXISTS "PurchaseOrderNotification_recipientUserId_idx"
  ON "PurchaseOrderNotification"("recipientUserId");
CREATE INDEX IF NOT EXISTS "PurchaseOrderNotification_status_channel_idx"
  ON "PurchaseOrderNotification"("status", "channel");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_sourceComparativeStatementId_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrder"
      ADD CONSTRAINT "PurchaseOrder_sourceComparativeStatementId_fkey"
      FOREIGN KEY ("sourceComparativeStatementId") REFERENCES "ComparativeStatement"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_managerApprovedById_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrder"
      ADD CONSTRAINT "PurchaseOrder_managerApprovedById_fkey"
      FOREIGN KEY ("managerApprovedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_committeeApprovedById_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrder"
      ADD CONSTRAINT "PurchaseOrder_committeeApprovedById_fkey"
      FOREIGN KEY ("committeeApprovedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_finalApprovedById_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrder"
      ADD CONSTRAINT "PurchaseOrder_finalApprovedById_fkey"
      FOREIGN KEY ("finalApprovedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_rejectedById_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrder"
      ADD CONSTRAINT "PurchaseOrder_rejectedById_fkey"
      FOREIGN KEY ("rejectedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrder_termsTemplateId_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrder"
      ADD CONSTRAINT "PurchaseOrder_termsTemplateId_fkey"
      FOREIGN KEY ("termsTemplateId") REFERENCES "PurchaseOrderTermsTemplate"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderTermsTemplate_createdById_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrderTermsTemplate"
      ADD CONSTRAINT "PurchaseOrderTermsTemplate_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderTermsTemplate_updatedById_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrderTermsTemplate"
      ADD CONSTRAINT "PurchaseOrderTermsTemplate_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderApprovalEvent_purchaseOrderId_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrderApprovalEvent"
      ADD CONSTRAINT "PurchaseOrderApprovalEvent_purchaseOrderId_fkey"
      FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderApprovalEvent_actedById_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrderApprovalEvent"
      ADD CONSTRAINT "PurchaseOrderApprovalEvent_actedById_fkey"
      FOREIGN KEY ("actedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderNotification_purchaseOrderId_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrderNotification"
      ADD CONSTRAINT "PurchaseOrderNotification_purchaseOrderId_fkey"
      FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderNotification_recipientUserId_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrderNotification"
      ADD CONSTRAINT "PurchaseOrderNotification_recipientUserId_fkey"
      FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "PurchaseOrderTermsTemplate" (
  "code",
  "name",
  "body",
  "isDefault",
  "isActive"
)
VALUES
  (
    'STANDARD_SUPPLY',
    'Standard Supply Terms',
    '1) Supplier must deliver full ordered quantity within agreed timeline.\n2) Goods must match approved specification/BOQ and quality standards.\n3) Buyer reserves right to reject non-conforming materials.\n4) Invoice must reference PO number and delivered quantities.\n5) Payment terms follow approved contract and 3-way match compliance.\n6) Applicable taxes, duties, and statutory compliance remain supplier responsibility unless explicitly stated.',
    true,
    true
  ),
  (
    'PROJECT_PROCUREMENT',
    'Project Procurement Terms',
    '1) Delivery schedule shall align with project milestone plan.\n2) Supplier must share pre-dispatch checklist and batch details.\n3) Delay beyond committed lead time may trigger SLA penalty.\n4) Buyer may request phased delivery and partial inspection.\n5) Any variation in scope/spec must be pre-approved in writing.\n6) Final payment is subject to acceptance and compliance documentation.',
    false,
    true
  )
ON CONFLICT ("code") DO NOTHING;
