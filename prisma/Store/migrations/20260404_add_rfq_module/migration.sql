CREATE TYPE "RfqStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'CLOSED',
  'AWARDED',
  'CANCELLED'
);

CREATE TYPE "RfqInvitationStatus" AS ENUM (
  'INVITED',
  'RESPONDED',
  'DECLINED',
  'AWARDED'
);

CREATE TYPE "QuotationStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'WITHDRAWN'
);

CREATE TYPE "RfqAwardStatus" AS ENUM (
  'AWARDED',
  'CONVERTED_TO_PO',
  'CANCELLED'
);

CREATE TABLE "Rfq" (
  "id" SERIAL NOT NULL,
  "rfqNumber" TEXT NOT NULL,
  "warehouseId" INTEGER NOT NULL,
  "purchaseRequisitionId" INTEGER,
  "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submissionDeadline" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "awardedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdById" TEXT,
  "approvedById" TEXT,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RfqItem" (
  "id" SERIAL NOT NULL,
  "rfqId" INTEGER NOT NULL,
  "productVariantId" INTEGER NOT NULL,
  "description" TEXT,
  "quantityRequested" INTEGER NOT NULL,
  "targetUnitCost" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RfqItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RfqSupplierInvite" (
  "id" SERIAL NOT NULL,
  "rfqId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "status" "RfqInvitationStatus" NOT NULL DEFAULT 'INVITED',
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RfqSupplierInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierQuotation" (
  "id" SERIAL NOT NULL,
  "rfqId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "rfqSupplierInviteId" INTEGER,
  "status" "QuotationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "quotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "submittedById" TEXT,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierQuotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierQuotationItem" (
  "id" SERIAL NOT NULL,
  "supplierQuotationId" INTEGER NOT NULL,
  "rfqItemId" INTEGER NOT NULL,
  "productVariantId" INTEGER NOT NULL,
  "description" TEXT,
  "quantityQuoted" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2) NOT NULL,
  "lineTotal" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierQuotationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RfqAward" (
  "id" SERIAL NOT NULL,
  "rfqId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "supplierQuotationId" INTEGER NOT NULL,
  "status" "RfqAwardStatus" NOT NULL DEFAULT 'AWARDED',
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "awardedById" TEXT,
  "purchaseOrderId" INTEGER,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RfqAward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Rfq_rfqNumber_key" ON "Rfq"("rfqNumber");
CREATE INDEX "Rfq_warehouseId_status_idx" ON "Rfq"("warehouseId", "status");
CREATE INDEX "Rfq_purchaseRequisitionId_idx" ON "Rfq"("purchaseRequisitionId");
CREATE INDEX "Rfq_createdById_idx" ON "Rfq"("createdById");
CREATE INDEX "Rfq_approvedById_idx" ON "Rfq"("approvedById");
CREATE INDEX "Rfq_requestedAt_idx" ON "Rfq"("requestedAt");
CREATE INDEX "Rfq_submissionDeadline_idx" ON "Rfq"("submissionDeadline");

CREATE UNIQUE INDEX "RfqItem_rfqId_productVariantId_key" ON "RfqItem"("rfqId", "productVariantId");
CREATE INDEX "RfqItem_rfqId_idx" ON "RfqItem"("rfqId");
CREATE INDEX "RfqItem_productVariantId_idx" ON "RfqItem"("productVariantId");

CREATE UNIQUE INDEX "RfqSupplierInvite_rfqId_supplierId_key" ON "RfqSupplierInvite"("rfqId", "supplierId");
CREATE INDEX "RfqSupplierInvite_rfqId_status_idx" ON "RfqSupplierInvite"("rfqId", "status");
CREATE INDEX "RfqSupplierInvite_supplierId_status_idx" ON "RfqSupplierInvite"("supplierId", "status");
CREATE INDEX "RfqSupplierInvite_createdById_idx" ON "RfqSupplierInvite"("createdById");

CREATE UNIQUE INDEX "SupplierQuotation_rfqSupplierInviteId_key" ON "SupplierQuotation"("rfqSupplierInviteId");
CREATE UNIQUE INDEX "SupplierQuotation_rfqId_supplierId_key" ON "SupplierQuotation"("rfqId", "supplierId");
CREATE INDEX "SupplierQuotation_rfqId_status_idx" ON "SupplierQuotation"("rfqId", "status");
CREATE INDEX "SupplierQuotation_supplierId_status_idx" ON "SupplierQuotation"("supplierId", "status");
CREATE INDEX "SupplierQuotation_submittedById_idx" ON "SupplierQuotation"("submittedById");
CREATE INDEX "SupplierQuotation_quotedAt_idx" ON "SupplierQuotation"("quotedAt");

CREATE UNIQUE INDEX "SupplierQuotationItem_supplierQuotationId_rfqItemId_key" ON "SupplierQuotationItem"("supplierQuotationId", "rfqItemId");
CREATE INDEX "SupplierQuotationItem_supplierQuotationId_idx" ON "SupplierQuotationItem"("supplierQuotationId");
CREATE INDEX "SupplierQuotationItem_rfqItemId_idx" ON "SupplierQuotationItem"("rfqItemId");
CREATE INDEX "SupplierQuotationItem_productVariantId_idx" ON "SupplierQuotationItem"("productVariantId");

CREATE UNIQUE INDEX "RfqAward_rfqId_key" ON "RfqAward"("rfqId");
CREATE UNIQUE INDEX "RfqAward_supplierQuotationId_key" ON "RfqAward"("supplierQuotationId");
CREATE UNIQUE INDEX "RfqAward_purchaseOrderId_key" ON "RfqAward"("purchaseOrderId");
CREATE INDEX "RfqAward_supplierId_status_idx" ON "RfqAward"("supplierId", "status");
CREATE INDEX "RfqAward_awardedById_idx" ON "RfqAward"("awardedById");
CREATE INDEX "RfqAward_awardedAt_idx" ON "RfqAward"("awardedAt");

ALTER TABLE "Rfq"
  ADD CONSTRAINT "Rfq_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Rfq"
  ADD CONSTRAINT "Rfq_purchaseRequisitionId_fkey"
  FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Rfq"
  ADD CONSTRAINT "Rfq_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Rfq"
  ADD CONSTRAINT "Rfq_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RfqItem"
  ADD CONSTRAINT "RfqItem_rfqId_fkey"
  FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RfqItem"
  ADD CONSTRAINT "RfqItem_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RfqSupplierInvite"
  ADD CONSTRAINT "RfqSupplierInvite_rfqId_fkey"
  FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RfqSupplierInvite"
  ADD CONSTRAINT "RfqSupplierInvite_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RfqSupplierInvite"
  ADD CONSTRAINT "RfqSupplierInvite_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierQuotation"
  ADD CONSTRAINT "SupplierQuotation_rfqId_fkey"
  FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierQuotation"
  ADD CONSTRAINT "SupplierQuotation_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierQuotation"
  ADD CONSTRAINT "SupplierQuotation_rfqSupplierInviteId_fkey"
  FOREIGN KEY ("rfqSupplierInviteId") REFERENCES "RfqSupplierInvite"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierQuotation"
  ADD CONSTRAINT "SupplierQuotation_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierQuotationItem"
  ADD CONSTRAINT "SupplierQuotationItem_supplierQuotationId_fkey"
  FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierQuotationItem"
  ADD CONSTRAINT "SupplierQuotationItem_rfqItemId_fkey"
  FOREIGN KEY ("rfqItemId") REFERENCES "RfqItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierQuotationItem"
  ADD CONSTRAINT "SupplierQuotationItem_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RfqAward"
  ADD CONSTRAINT "RfqAward_rfqId_fkey"
  FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RfqAward"
  ADD CONSTRAINT "RfqAward_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RfqAward"
  ADD CONSTRAINT "RfqAward_supplierQuotationId_fkey"
  FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RfqAward"
  ADD CONSTRAINT "RfqAward_awardedById_fkey"
  FOREIGN KEY ("awardedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RfqAward"
  ADD CONSTRAINT "RfqAward_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
