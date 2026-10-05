-- Bind configurable bundles and their order snapshots to a fulfillment warehouse.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "bundleWarehouseId" INTEGER;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "fulfillmentWarehouseId" INTEGER;

ALTER TABLE "OrderBundleComponent"
  ADD COLUMN IF NOT EXISTS "warehouseId" INTEGER;

-- Existing bundles inherit the configured default warehouse, or the first
-- warehouse when no default flag exists. Non-bundle products remain NULL.
WITH primary_warehouse AS (
  SELECT "id"
  FROM "Warehouse"
  ORDER BY "isDefault" DESC, "id" ASC
  LIMIT 1
)
UPDATE "Product"
SET "bundleWarehouseId" = (SELECT "id" FROM primary_warehouse)
WHERE "type" = 'BUNDLE'
  AND "bundleWarehouseId" IS NULL
  AND EXISTS (SELECT 1 FROM primary_warehouse);

CREATE INDEX IF NOT EXISTS "Product_bundleWarehouseId_idx"
  ON "Product"("bundleWarehouseId");

CREATE INDEX IF NOT EXISTS "Order_fulfillmentWarehouseId_idx"
  ON "Order"("fulfillmentWarehouseId");

CREATE INDEX IF NOT EXISTS "OrderBundleComponent_warehouseId_idx"
  ON "OrderBundleComponent"("warehouseId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Product_bundleWarehouseId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_bundleWarehouseId_fkey"
      FOREIGN KEY ("bundleWarehouseId") REFERENCES "Warehouse"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Order_fulfillmentWarehouseId_fkey'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_fulfillmentWarehouseId_fkey"
      FOREIGN KEY ("fulfillmentWarehouseId") REFERENCES "Warehouse"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OrderBundleComponent_warehouseId_fkey'
  ) THEN
    ALTER TABLE "OrderBundleComponent"
      ADD CONSTRAINT "OrderBundleComponent_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

