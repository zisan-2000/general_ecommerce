CREATE TYPE "SupplierReturnStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'PARTIALLY_DISPATCHED',
  'DISPATCHED',
  'CLOSED',
  'CANCELLED'
);

CREATE TABLE "SupplierReturn" (
  "id" SERIAL NOT NULL,
  "returnNumber" TEXT NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "warehouseId" INTEGER NOT NULL,
  "purchaseOrderId" INTEGER,
  "goodsReceiptId" INTEGER NOT NULL,
  "supplierInvoiceId" INTEGER,
  "status" "SupplierReturnStatus" NOT NULL DEFAULT 'DRAFT',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requiredBy" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "dispatchedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "ledgerPostedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "approvedById" TEXT,
  "dispatchedById" TEXT,
  "closedById" TEXT,
  "reasonCode" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierReturnItem" (
  "id" SERIAL NOT NULL,
  "supplierReturnId" INTEGER NOT NULL,
  "goodsReceiptItemId" INTEGER,
  "purchaseOrderItemId" INTEGER,
  "productVariantId" INTEGER NOT NULL,
  "description" TEXT,
  "quantityRequested" INTEGER NOT NULL,
  "quantityDispatched" INTEGER NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(12,2) NOT NULL,
  "lineTotal" DECIMAL(12,2) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierReturnItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupplierLedgerEntry"
  ADD COLUMN "supplierReturnId" INTEGER;

CREATE UNIQUE INDEX "SupplierReturn_returnNumber_key" ON "SupplierReturn"("returnNumber");
CREATE INDEX "SupplierReturn_supplierId_status_idx" ON "SupplierReturn"("supplierId", "status");
CREATE INDEX "SupplierReturn_warehouseId_status_idx" ON "SupplierReturn"("warehouseId", "status");
CREATE INDEX "SupplierReturn_goodsReceiptId_idx" ON "SupplierReturn"("goodsReceiptId");
CREATE INDEX "SupplierReturn_purchaseOrderId_idx" ON "SupplierReturn"("purchaseOrderId");
CREATE INDEX "SupplierReturn_supplierInvoiceId_idx" ON "SupplierReturn"("supplierInvoiceId");
CREATE INDEX "SupplierReturn_createdById_idx" ON "SupplierReturn"("createdById");
CREATE INDEX "SupplierReturn_approvedById_idx" ON "SupplierReturn"("approvedById");
CREATE INDEX "SupplierReturn_requestedAt_idx" ON "SupplierReturn"("requestedAt");

CREATE INDEX "SupplierReturnItem_supplierReturnId_idx" ON "SupplierReturnItem"("supplierReturnId");
CREATE INDEX "SupplierReturnItem_goodsReceiptItemId_idx" ON "SupplierReturnItem"("goodsReceiptItemId");
CREATE INDEX "SupplierReturnItem_purchaseOrderItemId_idx" ON "SupplierReturnItem"("purchaseOrderItemId");
CREATE INDEX "SupplierReturnItem_productVariantId_idx" ON "SupplierReturnItem"("productVariantId");

CREATE INDEX "SupplierLedgerEntry_supplierReturnId_idx" ON "SupplierLedgerEntry"("supplierReturnId");

ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_goodsReceiptId_fkey"
  FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_supplierInvoiceId_fkey"
  FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_dispatchedById_fkey"
  FOREIGN KEY ("dispatchedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierReturn"
  ADD CONSTRAINT "SupplierReturn_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierReturnItem"
  ADD CONSTRAINT "SupplierReturnItem_supplierReturnId_fkey"
  FOREIGN KEY ("supplierReturnId") REFERENCES "SupplierReturn"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierReturnItem"
  ADD CONSTRAINT "SupplierReturnItem_goodsReceiptItemId_fkey"
  FOREIGN KEY ("goodsReceiptItemId") REFERENCES "GoodsReceiptItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierReturnItem"
  ADD CONSTRAINT "SupplierReturnItem_purchaseOrderItemId_fkey"
  FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierReturnItem"
  ADD CONSTRAINT "SupplierReturnItem_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierLedgerEntry"
  ADD CONSTRAINT "SupplierLedgerEntry_supplierReturnId_fkey"
  FOREIGN KEY ("supplierReturnId") REFERENCES "SupplierReturn"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
