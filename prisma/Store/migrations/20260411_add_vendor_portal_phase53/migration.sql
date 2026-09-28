CREATE TYPE "SupplierDocumentVerificationStatus" AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'EXPIRED'
);

CREATE TYPE "SupplierProfileUpdateRequestType" AS ENUM (
  'PROFILE_UPDATE',
  'DOCUMENT_UPDATE',
  'ANNUAL_RENEWAL'
);

CREATE TYPE "SupplierProfileUpdateRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "SupplierFeedbackSourceType" AS ENUM (
  'INTERNAL',
  'CLIENT',
  'VENDOR_SELF'
);

CREATE TYPE "SupplierPortalNotificationType" AS ENUM (
  'GENERAL',
  'DOCUMENT_EXPIRY',
  'APPROVAL',
  'RFQ',
  'WORK_ORDER',
  'PAYMENT'
);

ALTER TYPE "SupplierDocumentType" ADD VALUE IF NOT EXISTS 'TAX_COMPLIANCE_CERTIFICATE';
ALTER TYPE "SupplierDocumentType" ADD VALUE IF NOT EXISTS 'BANK_INFORMATION';

ALTER TABLE "SupplierPortalAccess"
  ADD COLUMN "twoFactorRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "twoFactorMethod" TEXT,
  ADD COLUMN "twoFactorLastVerifiedAt" TIMESTAMP(3);

ALTER TABLE "SupplierDocument"
  ADD COLUMN "documentNumber" TEXT,
  ADD COLUMN "issuedAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "verificationStatus" "SupplierDocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedById" TEXT,
  ADD COLUMN "verificationNote" TEXT,
  ADD COLUMN "lastReminderAt" TIMESTAMP(3);

CREATE TABLE "SupplierProfileUpdateRequest" (
  "id" SERIAL NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "requestType" "SupplierProfileUpdateRequestType" NOT NULL DEFAULT 'PROFILE_UPDATE',
  "status" "SupplierProfileUpdateRequestStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "note" TEXT,
  "reviewNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupplierProfileUpdateRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierFeedback" (
  "id" SERIAL NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "sourceType" "SupplierFeedbackSourceType" NOT NULL DEFAULT 'INTERNAL',
  "sourceReference" TEXT,
  "clientName" TEXT,
  "clientEmail" TEXT,
  "rating" INTEGER NOT NULL,
  "serviceQualityRating" INTEGER,
  "deliveryRating" INTEGER,
  "complianceRating" INTEGER,
  "comment" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupplierFeedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierFeedback_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "SupplierFeedback_serviceQualityRating_check" CHECK ("serviceQualityRating" IS NULL OR "serviceQualityRating" BETWEEN 1 AND 5),
  CONSTRAINT "SupplierFeedback_deliveryRating_check" CHECK ("deliveryRating" IS NULL OR "deliveryRating" BETWEEN 1 AND 5),
  CONSTRAINT "SupplierFeedback_complianceRating_check" CHECK ("complianceRating" IS NULL OR "complianceRating" BETWEEN 1 AND 5)
);

CREATE TABLE "SupplierPortalNotification" (
  "id" SERIAL NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "userId" TEXT,
  "channel" "WorkflowNotificationChannel" NOT NULL,
  "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "type" "SupplierPortalNotificationType" NOT NULL DEFAULT 'GENERAL',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "recipientEmail" TEXT,
  "metadata" JSONB,
  "sentAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupplierPortalNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierDocument_expiresAt_idx" ON "SupplierDocument"("expiresAt");
CREATE INDEX "SupplierDocument_verificationStatus_idx" ON "SupplierDocument"("verificationStatus");
CREATE INDEX "SupplierDocument_verifiedById_idx" ON "SupplierDocument"("verifiedById");

CREATE INDEX "SupplierProfileUpdateRequest_supplierId_status_idx" ON "SupplierProfileUpdateRequest"("supplierId", "status");
CREATE INDEX "SupplierProfileUpdateRequest_requestedByUserId_createdAt_idx" ON "SupplierProfileUpdateRequest"("requestedByUserId", "createdAt");
CREATE INDEX "SupplierProfileUpdateRequest_reviewedById_idx" ON "SupplierProfileUpdateRequest"("reviewedById");

CREATE INDEX "SupplierFeedback_supplierId_createdAt_idx" ON "SupplierFeedback"("supplierId", "createdAt");
CREATE INDEX "SupplierFeedback_sourceType_createdAt_idx" ON "SupplierFeedback"("sourceType", "createdAt");
CREATE INDEX "SupplierFeedback_createdById_idx" ON "SupplierFeedback"("createdById");

CREATE INDEX "SupplierPortalNotification_supplierId_createdAt_idx" ON "SupplierPortalNotification"("supplierId", "createdAt");
CREATE INDEX "SupplierPortalNotification_userId_createdAt_idx" ON "SupplierPortalNotification"("userId", "createdAt");
CREATE INDEX "SupplierPortalNotification_status_channel_idx" ON "SupplierPortalNotification"("status", "channel");
CREATE INDEX "SupplierPortalNotification_type_createdAt_idx" ON "SupplierPortalNotification"("type", "createdAt");
CREATE INDEX "SupplierPortalNotification_createdById_idx" ON "SupplierPortalNotification"("createdById");

ALTER TABLE "SupplierDocument"
  ADD CONSTRAINT "SupplierDocument_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierProfileUpdateRequest"
  ADD CONSTRAINT "SupplierProfileUpdateRequest_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierProfileUpdateRequest"
  ADD CONSTRAINT "SupplierProfileUpdateRequest_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierProfileUpdateRequest"
  ADD CONSTRAINT "SupplierProfileUpdateRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierFeedback"
  ADD CONSTRAINT "SupplierFeedback_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierFeedback"
  ADD CONSTRAINT "SupplierFeedback_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierPortalNotification"
  ADD CONSTRAINT "SupplierPortalNotification_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierPortalNotification"
  ADD CONSTRAINT "SupplierPortalNotification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierPortalNotification"
  ADD CONSTRAINT "SupplierPortalNotification_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
