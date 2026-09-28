DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'RfqInvitationStatus'
      AND e.enumlabel = 'RESUBMISSION_REQUESTED'
  ) THEN
    ALTER TYPE "RfqInvitationStatus" ADD VALUE 'RESUBMISSION_REQUESTED';
  END IF;
END $$;

ALTER TABLE "Rfq"
  ADD COLUMN IF NOT EXISTS "scopeOfWork" TEXT,
  ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT,
  ADD COLUMN IF NOT EXISTS "boqDetails" TEXT,
  ADD COLUMN IF NOT EXISTS "technicalSpecifications" TEXT,
  ADD COLUMN IF NOT EXISTS "evaluationCriteria" TEXT,
  ADD COLUMN IF NOT EXISTS "resubmissionAllowed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "resubmissionRound" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastResubmissionRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastResubmissionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceRequisitionSnapshot" JSONB;

ALTER TABLE "RfqSupplierInvite"
  ADD COLUMN IF NOT EXISTS "lastNotifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resubmissionRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resubmissionReason" TEXT;

ALTER TABLE "SupplierQuotation"
  ADD COLUMN IF NOT EXISTS "revisionNo" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "resubmissionRound" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "resubmissionNote" TEXT;

CREATE TABLE IF NOT EXISTS "SupplierCategory" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierCategory_code_key" ON "SupplierCategory"("code");
CREATE INDEX IF NOT EXISTS "SupplierCategory_isActive_name_idx" ON "SupplierCategory"("isActive", "name");
CREATE INDEX IF NOT EXISTS "SupplierCategory_createdById_idx" ON "SupplierCategory"("createdById");

CREATE TABLE IF NOT EXISTS "SupplierCategorySupplier" (
  "id" SERIAL NOT NULL,
  "supplierCategoryId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierCategorySupplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierCategorySupplier_supplierCategoryId_supplierId_key"
  ON "SupplierCategorySupplier"("supplierCategoryId", "supplierId");
CREATE INDEX IF NOT EXISTS "SupplierCategorySupplier_supplierId_idx"
  ON "SupplierCategorySupplier"("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierCategorySupplier_createdById_idx"
  ON "SupplierCategorySupplier"("createdById");

CREATE TABLE IF NOT EXISTS "RfqCategoryTarget" (
  "id" SERIAL NOT NULL,
  "rfqId" INTEGER NOT NULL,
  "supplierCategoryId" INTEGER NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RfqCategoryTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RfqCategoryTarget_rfqId_supplierCategoryId_key"
  ON "RfqCategoryTarget"("rfqId", "supplierCategoryId");
CREATE INDEX IF NOT EXISTS "RfqCategoryTarget_supplierCategoryId_idx"
  ON "RfqCategoryTarget"("supplierCategoryId");
CREATE INDEX IF NOT EXISTS "RfqCategoryTarget_createdById_idx"
  ON "RfqCategoryTarget"("createdById");

CREATE TABLE IF NOT EXISTS "RfqAttachment" (
  "id" SERIAL NOT NULL,
  "rfqId" INTEGER NOT NULL,
  "label" TEXT,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RfqAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RfqAttachment_rfqId_idx" ON "RfqAttachment"("rfqId");
CREATE INDEX IF NOT EXISTS "RfqAttachment_uploadedById_idx" ON "RfqAttachment"("uploadedById");

CREATE TABLE IF NOT EXISTS "RfqNotification" (
  "id" SERIAL NOT NULL,
  "rfqId" INTEGER NOT NULL,
  "inviteId" INTEGER,
  "supplierId" INTEGER NOT NULL,
  "channel" "WorkflowNotificationChannel" NOT NULL,
  "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "recipientEmail" TEXT,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "sentAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RfqNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RfqNotification_rfqId_createdAt_idx"
  ON "RfqNotification"("rfqId", "createdAt");
CREATE INDEX IF NOT EXISTS "RfqNotification_inviteId_idx"
  ON "RfqNotification"("inviteId");
CREATE INDEX IF NOT EXISTS "RfqNotification_supplierId_createdAt_idx"
  ON "RfqNotification"("supplierId", "createdAt");
CREATE INDEX IF NOT EXISTS "RfqNotification_status_channel_idx"
  ON "RfqNotification"("status", "channel");
CREATE INDEX IF NOT EXISTS "RfqNotification_createdById_idx"
  ON "RfqNotification"("createdById");

CREATE INDEX IF NOT EXISTS "Rfq_resubmissionRound_idx" ON "Rfq"("resubmissionRound");

ALTER TABLE "SupplierCategory"
  ADD CONSTRAINT "SupplierCategory_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierCategorySupplier"
  ADD CONSTRAINT "SupplierCategorySupplier_supplierCategoryId_fkey"
  FOREIGN KEY ("supplierCategoryId") REFERENCES "SupplierCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierCategorySupplier"
  ADD CONSTRAINT "SupplierCategorySupplier_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierCategorySupplier"
  ADD CONSTRAINT "SupplierCategorySupplier_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RfqCategoryTarget"
  ADD CONSTRAINT "RfqCategoryTarget_rfqId_fkey"
  FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RfqCategoryTarget"
  ADD CONSTRAINT "RfqCategoryTarget_supplierCategoryId_fkey"
  FOREIGN KEY ("supplierCategoryId") REFERENCES "SupplierCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RfqCategoryTarget"
  ADD CONSTRAINT "RfqCategoryTarget_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RfqAttachment"
  ADD CONSTRAINT "RfqAttachment_rfqId_fkey"
  FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RfqAttachment"
  ADD CONSTRAINT "RfqAttachment_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RfqNotification"
  ADD CONSTRAINT "RfqNotification_rfqId_fkey"
  FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RfqNotification"
  ADD CONSTRAINT "RfqNotification_inviteId_fkey"
  FOREIGN KEY ("inviteId") REFERENCES "RfqSupplierInvite"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RfqNotification"
  ADD CONSTRAINT "RfqNotification_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RfqNotification"
  ADD CONSTRAINT "RfqNotification_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
