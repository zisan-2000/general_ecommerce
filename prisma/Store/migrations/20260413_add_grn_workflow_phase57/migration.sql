DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GoodsReceiptAttachmentType') THEN
    CREATE TYPE "GoodsReceiptAttachmentType" AS ENUM ('CHALLAN', 'BILL', 'OTHER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GoodsReceiptEvaluatorRole') THEN
    CREATE TYPE "GoodsReceiptEvaluatorRole" AS ENUM ('REQUESTER', 'PROCUREMENT', 'ADMINISTRATION');
  END IF;
END $$;

ALTER TABLE "GoodsReceipt"
  ADD COLUMN IF NOT EXISTS "requesterConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "requesterConfirmedById" TEXT,
  ADD COLUMN IF NOT EXISTS "requesterConfirmationNote" TEXT;

CREATE TABLE IF NOT EXISTS "GoodsReceiptAttachment" (
  "id" SERIAL NOT NULL,
  "goodsReceiptId" INTEGER NOT NULL,
  "type" "GoodsReceiptAttachmentType" NOT NULL DEFAULT 'OTHER',
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "note" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoodsReceiptAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GoodsReceiptVendorEvaluation" (
  "id" SERIAL NOT NULL,
  "goodsReceiptId" INTEGER NOT NULL,
  "evaluatorRole" "GoodsReceiptEvaluatorRole" NOT NULL,
  "overallRating" INTEGER NOT NULL,
  "serviceQualityRating" INTEGER,
  "deliveryRating" INTEGER,
  "complianceRating" INTEGER,
  "comment" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoodsReceiptVendorEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GoodsReceipt_requesterConfirmedById_idx"
  ON "GoodsReceipt"("requesterConfirmedById");
CREATE INDEX IF NOT EXISTS "GoodsReceipt_requesterConfirmedAt_idx"
  ON "GoodsReceipt"("requesterConfirmedAt");

CREATE INDEX IF NOT EXISTS "GoodsReceiptAttachment_goodsReceiptId_createdAt_idx"
  ON "GoodsReceiptAttachment"("goodsReceiptId", "createdAt");
CREATE INDEX IF NOT EXISTS "GoodsReceiptAttachment_uploadedById_idx"
  ON "GoodsReceiptAttachment"("uploadedById");
CREATE INDEX IF NOT EXISTS "GoodsReceiptAttachment_type_createdAt_idx"
  ON "GoodsReceiptAttachment"("type", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "GoodsReceiptVendorEvaluation_goodsReceiptId_evaluatorRole_key"
  ON "GoodsReceiptVendorEvaluation"("goodsReceiptId", "evaluatorRole");
CREATE INDEX IF NOT EXISTS "GoodsReceiptVendorEvaluation_goodsReceiptId_createdAt_idx"
  ON "GoodsReceiptVendorEvaluation"("goodsReceiptId", "createdAt");
CREATE INDEX IF NOT EXISTS "GoodsReceiptVendorEvaluation_createdById_createdAt_idx"
  ON "GoodsReceiptVendorEvaluation"("createdById", "createdAt");
CREATE INDEX IF NOT EXISTS "GoodsReceiptVendorEvaluation_evaluatorRole_createdAt_idx"
  ON "GoodsReceiptVendorEvaluation"("evaluatorRole", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GoodsReceipt_requesterConfirmedById_fkey'
  ) THEN
    ALTER TABLE "GoodsReceipt"
      ADD CONSTRAINT "GoodsReceipt_requesterConfirmedById_fkey"
      FOREIGN KEY ("requesterConfirmedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GoodsReceiptAttachment_goodsReceiptId_fkey'
  ) THEN
    ALTER TABLE "GoodsReceiptAttachment"
      ADD CONSTRAINT "GoodsReceiptAttachment_goodsReceiptId_fkey"
      FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GoodsReceiptAttachment_uploadedById_fkey'
  ) THEN
    ALTER TABLE "GoodsReceiptAttachment"
      ADD CONSTRAINT "GoodsReceiptAttachment_uploadedById_fkey"
      FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GoodsReceiptVendorEvaluation_goodsReceiptId_fkey'
  ) THEN
    ALTER TABLE "GoodsReceiptVendorEvaluation"
      ADD CONSTRAINT "GoodsReceiptVendorEvaluation_goodsReceiptId_fkey"
      FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GoodsReceiptVendorEvaluation_createdById_fkey'
  ) THEN
    ALTER TABLE "GoodsReceiptVendorEvaluation"
      ADD CONSTRAINT "GoodsReceiptVendorEvaluation_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
