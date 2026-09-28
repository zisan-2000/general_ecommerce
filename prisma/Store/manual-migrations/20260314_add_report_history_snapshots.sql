ALTER TABLE "OrderItem"
ADD COLUMN IF NOT EXISTS "costPriceSnapshot" DECIMAL(10, 2);

CREATE TABLE IF NOT EXISTS "ShipmentStatusLog" (
  "id" SERIAL PRIMARY KEY,
  "shipmentId" INTEGER NOT NULL REFERENCES "Shipment"("id") ON DELETE CASCADE,
  "fromStatus" "ShipmentStatus",
  "toStatus" "ShipmentStatus" NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'SYSTEM',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ShipmentStatusLog_shipmentId_createdAt_idx"
  ON "ShipmentStatusLog"("shipmentId", "createdAt");

CREATE INDEX IF NOT EXISTS "ShipmentStatusLog_toStatus_createdAt_idx"
  ON "ShipmentStatusLog"("toStatus", "createdAt");

CREATE TABLE IF NOT EXISTS "InventoryDailySnapshot" (
  "id" SERIAL PRIMARY KEY,
  "snapshotDate" DATE NOT NULL,
  "productId" INTEGER NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "variantId" INTEGER NOT NULL REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
  "status" VARCHAR(20) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryDailySnapshot_snapshotDate_variantId_key"
  ON "InventoryDailySnapshot"("snapshotDate", "variantId");

CREATE INDEX IF NOT EXISTS "InventoryDailySnapshot_snapshotDate_idx"
  ON "InventoryDailySnapshot"("snapshotDate");

CREATE TABLE IF NOT EXISTS "InventoryWarehouseDailySnapshot" (
  "id" SERIAL PRIMARY KEY,
  "snapshotDate" DATE NOT NULL,
  "productId" INTEGER NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "variantId" INTEGER NOT NULL REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "warehouseId" INTEGER NOT NULL REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "available" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryWarehouseDailySnapshot_snapshotDate_variantId_warehouseId_key"
  ON "InventoryWarehouseDailySnapshot"("snapshotDate", "variantId", "warehouseId");

CREATE INDEX IF NOT EXISTS "InventoryWarehouseDailySnapshot_snapshotDate_warehouseId_idx"
  ON "InventoryWarehouseDailySnapshot"("snapshotDate", "warehouseId");

INSERT INTO "ShipmentStatusLog" ("shipmentId", "fromStatus", "toStatus", "source", "note", "createdAt")
SELECT
  s."id",
  NULL,
  s."status",
  'BACKFILL_CURRENT_STATUS',
  'Baseline status log created during historical reporting rollout',
  s."createdAt"
FROM "Shipment" s
WHERE NOT EXISTS (
  SELECT 1
  FROM "ShipmentStatusLog" l
  WHERE l."shipmentId" = s."id"
);

INSERT INTO "InventoryDailySnapshot" (
  "snapshotDate",
  "productId",
  "variantId",
  "stock",
  "lowStockThreshold",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  CURRENT_DATE,
  pv."productId",
  pv."id",
  pv."stock",
  pv."lowStockThreshold",
  CASE
    WHEN pv."stock" <= 0 THEN 'OUT_OF_STOCK'
    WHEN pv."stock" <= pv."lowStockThreshold" THEN 'LOW_STOCK'
    ELSE 'IN_STOCK'
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ProductVariant" pv
ON CONFLICT ("snapshotDate", "variantId") DO UPDATE
SET
  "productId" = EXCLUDED."productId",
  "stock" = EXCLUDED."stock",
  "lowStockThreshold" = EXCLUDED."lowStockThreshold",
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "InventoryWarehouseDailySnapshot" (
  "snapshotDate",
  "productId",
  "variantId",
  "warehouseId",
  "quantity",
  "reserved",
  "available",
  "createdAt",
  "updatedAt"
)
SELECT
  CURRENT_DATE,
  pv."productId",
  sl."productVariantId",
  sl."warehouseId",
  sl."quantity",
  sl."reserved",
  GREATEST(sl."quantity" - sl."reserved", 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "StockLevel" sl
JOIN "ProductVariant" pv ON pv."id" = sl."productVariantId"
ON CONFLICT ("snapshotDate", "variantId", "warehouseId") DO UPDATE
SET
  "productId" = EXCLUDED."productId",
  "quantity" = EXCLUDED."quantity",
  "reserved" = EXCLUDED."reserved",
  "available" = EXCLUDED."available",
  "updatedAt" = CURRENT_TIMESTAMP;
