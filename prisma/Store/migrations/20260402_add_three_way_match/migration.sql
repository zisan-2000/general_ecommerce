CREATE TYPE "ThreeWayMatchStatus" AS ENUM (
  'PENDING',
  'MATCHED',
  'VARIANCE'
);

ALTER TABLE "SupplierInvoice"
  ADD COLUMN "matchStatus" "ThreeWayMatchStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "matchedAt" TIMESTAMP(3),
  ADD COLUMN "matchedById" TEXT;

CREATE TABLE "SupplierInvoiceItem" (
  "id" SERIAL NOT NULL,
  "supplierInvoiceId" INTEGER NOT NULL,
  "purchaseOrderItemId" INTEGER,
  "productVariantId" INTEGER NOT NULL,
  "description" TEXT,
  "quantityInvoiced" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2) NOT NULL,
  "lineTotal" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierInvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierInvoice_matchedById_idx" ON "SupplierInvoice"("matchedById");
CREATE INDEX "SupplierInvoice_matchStatus_idx" ON "SupplierInvoice"("matchStatus");
CREATE INDEX "SupplierInvoiceItem_supplierInvoiceId_idx" ON "SupplierInvoiceItem"("supplierInvoiceId");
CREATE INDEX "SupplierInvoiceItem_purchaseOrderItemId_idx" ON "SupplierInvoiceItem"("purchaseOrderItemId");
CREATE INDEX "SupplierInvoiceItem_productVariantId_idx" ON "SupplierInvoiceItem"("productVariantId");

ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_matchedById_fkey"
  FOREIGN KEY ("matchedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoiceItem"
  ADD CONSTRAINT "SupplierInvoiceItem_supplierInvoiceId_fkey"
  FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoiceItem"
  ADD CONSTRAINT "SupplierInvoiceItem_purchaseOrderItemId_fkey"
  FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoiceItem"
  ADD CONSTRAINT "SupplierInvoiceItem_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
