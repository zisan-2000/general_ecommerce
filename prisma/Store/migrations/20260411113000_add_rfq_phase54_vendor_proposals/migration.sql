DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'SupplierProposalAttachmentType'
  ) THEN
    CREATE TYPE "SupplierProposalAttachmentType" AS ENUM ('TECHNICAL', 'FINANCIAL', 'SUPPORTING');
  END IF;
END $$;

ALTER TABLE "SupplierQuotation"
  ADD COLUMN IF NOT EXISTS "technicalProposal" TEXT,
  ADD COLUMN IF NOT EXISTS "financialProposal" TEXT;

CREATE TABLE IF NOT EXISTS "SupplierQuotationAttachment" (
  "id" SERIAL NOT NULL,
  "supplierQuotationId" INTEGER NOT NULL,
  "proposalType" "SupplierProposalAttachmentType" NOT NULL DEFAULT 'SUPPORTING',
  "label" TEXT,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierQuotationAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupplierQuotationAttachment_supplierQuotationId_idx"
  ON "SupplierQuotationAttachment"("supplierQuotationId");
CREATE INDEX IF NOT EXISTS "SupplierQuotationAttachment_proposalType_idx"
  ON "SupplierQuotationAttachment"("proposalType");
CREATE INDEX IF NOT EXISTS "SupplierQuotationAttachment_uploadedById_idx"
  ON "SupplierQuotationAttachment"("uploadedById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SupplierQuotationAttachment_supplierQuotationId_fkey'
  ) THEN
    ALTER TABLE "SupplierQuotationAttachment"
      ADD CONSTRAINT "SupplierQuotationAttachment_supplierQuotationId_fkey"
      FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SupplierQuotationAttachment_uploadedById_fkey'
  ) THEN
    ALTER TABLE "SupplierQuotationAttachment"
      ADD CONSTRAINT "SupplierQuotationAttachment_uploadedById_fkey"
      FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
