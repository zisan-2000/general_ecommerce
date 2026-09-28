CREATE TYPE "PurchaseOrderLandedCostComponent" AS ENUM (
  'FREIGHT',
  'CUSTOMS',
  'HANDLING',
  'INSURANCE',
  'CLEARING',
  'OTHER'
);

CREATE TABLE "PurchaseOrderLandedCost" (
  "id" SERIAL NOT NULL,
  "purchaseOrderId" INTEGER NOT NULL,
  "component" "PurchaseOrderLandedCostComponent" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "note" TEXT,
  "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderLandedCost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderLandedCost_purchaseOrderId_incurredAt_idx"
  ON "PurchaseOrderLandedCost"("purchaseOrderId", "incurredAt");
CREATE INDEX "PurchaseOrderLandedCost_createdById_idx"
  ON "PurchaseOrderLandedCost"("createdById");

ALTER TABLE "PurchaseOrderLandedCost"
  ADD CONSTRAINT "PurchaseOrderLandedCost_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderLandedCost"
  ADD CONSTRAINT "PurchaseOrderLandedCost_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
