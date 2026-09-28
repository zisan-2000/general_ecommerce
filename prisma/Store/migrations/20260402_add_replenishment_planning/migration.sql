CREATE TYPE "ReplenishmentStrategy" AS ENUM (
  'MIN_MAX',
  'REORDER_POINT'
);

CREATE TABLE "ReplenishmentRule" (
  "id" SERIAL NOT NULL,
  "warehouseId" INTEGER NOT NULL,
  "productVariantId" INTEGER NOT NULL,
  "strategy" "ReplenishmentStrategy" NOT NULL DEFAULT 'MIN_MAX',
  "reorderPoint" INTEGER NOT NULL,
  "targetStockLevel" INTEGER NOT NULL,
  "safetyStock" INTEGER NOT NULL DEFAULT 0,
  "minOrderQty" INTEGER NOT NULL DEFAULT 1,
  "orderMultiple" INTEGER NOT NULL DEFAULT 1,
  "leadTimeDays" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReplenishmentRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReplenishmentRule_warehouseId_productVariantId_key"
  ON "ReplenishmentRule"("warehouseId", "productVariantId");
CREATE INDEX "ReplenishmentRule_warehouseId_isActive_idx"
  ON "ReplenishmentRule"("warehouseId", "isActive");
CREATE INDEX "ReplenishmentRule_productVariantId_isActive_idx"
  ON "ReplenishmentRule"("productVariantId", "isActive");
CREATE INDEX "ReplenishmentRule_createdById_idx"
  ON "ReplenishmentRule"("createdById");
CREATE INDEX "ReplenishmentRule_updatedById_idx"
  ON "ReplenishmentRule"("updatedById");

ALTER TABLE "ReplenishmentRule"
  ADD CONSTRAINT "ReplenishmentRule_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReplenishmentRule"
  ADD CONSTRAINT "ReplenishmentRule_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReplenishmentRule"
  ADD CONSTRAINT "ReplenishmentRule_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReplenishmentRule"
  ADD CONSTRAINT "ReplenishmentRule_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
