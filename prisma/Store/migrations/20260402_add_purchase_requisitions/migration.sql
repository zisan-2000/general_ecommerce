CREATE TYPE "PurchaseRequisitionStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CONVERTED',
  'CANCELLED'
);

CREATE TABLE "PurchaseRequisition" (
  "id" SERIAL NOT NULL,
  "requisitionNumber" TEXT NOT NULL,
  "warehouseId" INTEGER NOT NULL,
  "status" "PurchaseRequisitionStatus" NOT NULL DEFAULT 'DRAFT',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "neededBy" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "approvedById" TEXT,
  "convertedById" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseRequisition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseRequisitionItem" (
  "id" SERIAL NOT NULL,
  "purchaseRequisitionId" INTEGER NOT NULL,
  "productVariantId" INTEGER NOT NULL,
  "description" TEXT,
  "quantityRequested" INTEGER NOT NULL,
  "quantityApproved" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseRequisitionItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PurchaseOrder"
  ADD COLUMN "purchaseRequisitionId" INTEGER;

CREATE UNIQUE INDEX "PurchaseRequisition_requisitionNumber_key" ON "PurchaseRequisition"("requisitionNumber");
CREATE INDEX "PurchaseRequisition_warehouseId_status_idx" ON "PurchaseRequisition"("warehouseId", "status");
CREATE INDEX "PurchaseRequisition_createdById_idx" ON "PurchaseRequisition"("createdById");
CREATE INDEX "PurchaseRequisition_approvedById_idx" ON "PurchaseRequisition"("approvedById");
CREATE INDEX "PurchaseRequisition_requestedAt_idx" ON "PurchaseRequisition"("requestedAt");

CREATE INDEX "PurchaseRequisitionItem_purchaseRequisitionId_idx" ON "PurchaseRequisitionItem"("purchaseRequisitionId");
CREATE INDEX "PurchaseRequisitionItem_productVariantId_idx" ON "PurchaseRequisitionItem"("productVariantId");

CREATE INDEX "PurchaseOrder_purchaseRequisitionId_idx" ON "PurchaseOrder"("purchaseRequisitionId");

ALTER TABLE "PurchaseRequisition"
  ADD CONSTRAINT "PurchaseRequisition_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequisition"
  ADD CONSTRAINT "PurchaseRequisition_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequisition"
  ADD CONSTRAINT "PurchaseRequisition_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequisition"
  ADD CONSTRAINT "PurchaseRequisition_convertedById_fkey"
  FOREIGN KEY ("convertedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequisitionItem"
  ADD CONSTRAINT "PurchaseRequisitionItem_purchaseRequisitionId_fkey"
  FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequisitionItem"
  ADD CONSTRAINT "PurchaseRequisitionItem_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_purchaseRequisitionId_fkey"
  FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
