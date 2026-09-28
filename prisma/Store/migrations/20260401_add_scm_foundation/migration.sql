-- SCM phase 1 foundation: suppliers, purchase orders, goods receipts

CREATE TYPE "PurchaseOrderStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED'
);

CREATE TYPE "GoodsReceiptStatus" AS ENUM (
  'RECEIVED',
  'CANCELLED'
);

CREATE TABLE "Supplier" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "country" TEXT DEFAULT 'BD',
  "leadTimeDays" INTEGER,
  "paymentTermsDays" INTEGER,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "taxNumber" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

CREATE TABLE "PurchaseOrder" (
  "id" SERIAL NOT NULL,
  "poNumber" TEXT NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "warehouseId" INTEGER NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "approvedById" TEXT,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "shippingTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");
CREATE INDEX "PurchaseOrder_supplierId_status_idx" ON "PurchaseOrder"("supplierId", "status");
CREATE INDEX "PurchaseOrder_warehouseId_status_idx" ON "PurchaseOrder"("warehouseId", "status");
CREATE INDEX "PurchaseOrder_createdById_idx" ON "PurchaseOrder"("createdById");
CREATE INDEX "PurchaseOrder_approvedById_idx" ON "PurchaseOrder"("approvedById");
CREATE INDEX "PurchaseOrder_orderDate_idx" ON "PurchaseOrder"("orderDate");

CREATE TABLE "PurchaseOrderItem" (
  "id" SERIAL NOT NULL,
  "purchaseOrderId" INTEGER NOT NULL,
  "productVariantId" INTEGER NOT NULL,
  "description" TEXT,
  "quantityOrdered" INTEGER NOT NULL,
  "quantityReceived" INTEGER NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(12,2) NOT NULL,
  "lineTotal" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");
CREATE INDEX "PurchaseOrderItem_productVariantId_idx" ON "PurchaseOrderItem"("productVariantId");

CREATE TABLE "GoodsReceipt" (
  "id" SERIAL NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "purchaseOrderId" INTEGER NOT NULL,
  "warehouseId" INTEGER NOT NULL,
  "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedById" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoodsReceipt_receiptNumber_key" ON "GoodsReceipt"("receiptNumber");
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");
CREATE INDEX "GoodsReceipt_warehouseId_receivedAt_idx" ON "GoodsReceipt"("warehouseId", "receivedAt");
CREATE INDEX "GoodsReceipt_receivedById_idx" ON "GoodsReceipt"("receivedById");

CREATE TABLE "GoodsReceiptItem" (
  "id" SERIAL NOT NULL,
  "goodsReceiptId" INTEGER NOT NULL,
  "purchaseOrderItemId" INTEGER NOT NULL,
  "productVariantId" INTEGER NOT NULL,
  "quantityReceived" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoodsReceiptItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GoodsReceiptItem_goodsReceiptId_idx" ON "GoodsReceiptItem"("goodsReceiptId");
CREATE INDEX "GoodsReceiptItem_purchaseOrderItemId_idx" ON "GoodsReceiptItem"("purchaseOrderItemId");
CREATE INDEX "GoodsReceiptItem_productVariantId_idx" ON "GoodsReceiptItem"("productVariantId");

ALTER TABLE "PurchaseOrder"
ADD CONSTRAINT "PurchaseOrder_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder"
ADD CONSTRAINT "PurchaseOrder_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder"
ADD CONSTRAINT "PurchaseOrder_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder"
ADD CONSTRAINT "PurchaseOrder_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem"
ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem"
ADD CONSTRAINT "PurchaseOrderItem_productVariantId_fkey"
FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsReceipt"
ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsReceipt"
ADD CONSTRAINT "GoodsReceipt_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsReceipt"
ADD CONSTRAINT "GoodsReceipt_receivedById_fkey"
FOREIGN KEY ("receivedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GoodsReceiptItem"
ADD CONSTRAINT "GoodsReceiptItem_goodsReceiptId_fkey"
FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoodsReceiptItem"
ADD CONSTRAINT "GoodsReceiptItem_purchaseOrderItemId_fkey"
FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsReceiptItem"
ADD CONSTRAINT "GoodsReceiptItem_productVariantId_fkey"
FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
