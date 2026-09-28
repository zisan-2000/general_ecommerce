CREATE TYPE "WarehouseTransferStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'PARTIALLY_DISPATCHED',
  'DISPATCHED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED'
);

CREATE TABLE "WarehouseTransfer" (
  "id" SERIAL NOT NULL,
  "transferNumber" TEXT NOT NULL,
  "sourceWarehouseId" INTEGER NOT NULL,
  "destinationWarehouseId" INTEGER NOT NULL,
  "status" "WarehouseTransferStatus" NOT NULL DEFAULT 'DRAFT',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requiredBy" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "dispatchedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "approvedById" TEXT,
  "dispatchedById" TEXT,
  "receivedById" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WarehouseTransfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseTransferItem" (
  "id" SERIAL NOT NULL,
  "warehouseTransferId" INTEGER NOT NULL,
  "productVariantId" INTEGER NOT NULL,
  "description" TEXT,
  "quantityRequested" INTEGER NOT NULL,
  "quantityDispatched" INTEGER NOT NULL DEFAULT 0,
  "quantityReceived" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WarehouseTransferItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseTransfer_transferNumber_key" ON "WarehouseTransfer"("transferNumber");
CREATE INDEX "WarehouseTransfer_sourceWarehouseId_status_idx" ON "WarehouseTransfer"("sourceWarehouseId", "status");
CREATE INDEX "WarehouseTransfer_destinationWarehouseId_status_idx" ON "WarehouseTransfer"("destinationWarehouseId", "status");
CREATE INDEX "WarehouseTransfer_createdById_idx" ON "WarehouseTransfer"("createdById");
CREATE INDEX "WarehouseTransfer_approvedById_idx" ON "WarehouseTransfer"("approvedById");
CREATE INDEX "WarehouseTransfer_requestedAt_idx" ON "WarehouseTransfer"("requestedAt");

CREATE INDEX "WarehouseTransferItem_warehouseTransferId_idx" ON "WarehouseTransferItem"("warehouseTransferId");
CREATE INDEX "WarehouseTransferItem_productVariantId_idx" ON "WarehouseTransferItem"("productVariantId");

ALTER TABLE "WarehouseTransfer"
  ADD CONSTRAINT "WarehouseTransfer_sourceWarehouseId_fkey"
  FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WarehouseTransfer"
  ADD CONSTRAINT "WarehouseTransfer_destinationWarehouseId_fkey"
  FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WarehouseTransfer"
  ADD CONSTRAINT "WarehouseTransfer_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WarehouseTransfer"
  ADD CONSTRAINT "WarehouseTransfer_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WarehouseTransfer"
  ADD CONSTRAINT "WarehouseTransfer_dispatchedById_fkey"
  FOREIGN KEY ("dispatchedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WarehouseTransfer"
  ADD CONSTRAINT "WarehouseTransfer_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WarehouseTransferItem"
  ADD CONSTRAINT "WarehouseTransferItem_warehouseTransferId_fkey"
  FOREIGN KEY ("warehouseTransferId") REFERENCES "WarehouseTransfer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WarehouseTransferItem"
  ADD CONSTRAINT "WarehouseTransferItem_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
