CREATE TYPE "BundleFulfillmentMode" AS ENUM ('VIRTUAL', 'PREASSEMBLED');

ALTER TABLE "Product"
ADD COLUMN "bundleFulfillmentMode" "BundleFulfillmentMode" NOT NULL DEFAULT 'VIRTUAL';

CREATE TABLE "BundleStockLevel" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BundleStockLevel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BundleStockLevel_productId_warehouseId_key"
ON "BundleStockLevel"("productId", "warehouseId");

CREATE INDEX "BundleStockLevel_warehouseId_idx"
ON "BundleStockLevel"("warehouseId");

ALTER TABLE "BundleStockLevel"
ADD CONSTRAINT "BundleStockLevel_quantity_nonnegative_check" CHECK ("quantity" >= 0),
ADD CONSTRAINT "BundleStockLevel_reserved_nonnegative_check" CHECK ("reserved" >= 0),
ADD CONSTRAINT "BundleStockLevel_reserved_lte_quantity_check" CHECK ("reserved" <= "quantity");

CREATE TABLE "BundleStockReservation" (
    "id" SERIAL NOT NULL,
    "bundleStockLevelId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BundleStockReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BundleStockReservation_orderId_idx"
ON "BundleStockReservation"("orderId");

CREATE INDEX "BundleStockReservation_expiresAt_idx"
ON "BundleStockReservation"("expiresAt");

ALTER TABLE "BundleStockReservation"
ADD CONSTRAINT "BundleStockReservation_quantity_positive_check" CHECK ("quantity" > 0);

ALTER TABLE "BundleStockLevel"
ADD CONSTRAINT "BundleStockLevel_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BundleStockLevel"
ADD CONSTRAINT "BundleStockLevel_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BundleStockReservation"
ADD CONSTRAINT "BundleStockReservation_bundleStockLevelId_fkey"
FOREIGN KEY ("bundleStockLevelId") REFERENCES "BundleStockLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BundleStockReservation"
ADD CONSTRAINT "BundleStockReservation_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
