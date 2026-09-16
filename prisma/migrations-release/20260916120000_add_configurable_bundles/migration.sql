CREATE TYPE "BundleSelectionType" AS ENUM ('FIXED', 'PRODUCT_SELECT', 'VARIANT_SELECT', 'OPTIONAL');

CREATE TABLE "BundleGroup" (
    "id" SERIAL NOT NULL,
    "bundleId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "selectionType" "BundleSelectionType" NOT NULL DEFAULT 'FIXED',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "minSelect" INTEGER NOT NULL DEFAULT 1,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "defaultQuantity" INTEGER NOT NULL DEFAULT 1,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "maxQuantity" INTEGER NOT NULL DEFAULT 1,
    "allowQuantityChange" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BundleGroupOption" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantId" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "priceAdjustment" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleGroupOption_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CartItem" ADD COLUMN "bundleConfiguration" JSONB;
ALTER TABLE "OrderItem" ADD COLUMN "bundleConfiguration" JSONB;

CREATE TABLE "OrderBundleComponent" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "bundleGroupId" INTEGER,
    "bundleOptionId" INTEGER,
    "groupName" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantId" INTEGER,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT,
    "quantityPerBundle" INTEGER NOT NULL DEFAULT 1,
    "unitPriceSnapshot" DECIMAL(14,2) NOT NULL,
    "priceAdjustmentSnapshot" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderBundleComponent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BundleGroup_bundleId_sortOrder_key" ON "BundleGroup"("bundleId", "sortOrder");
CREATE INDEX "BundleGroup_bundleId_idx" ON "BundleGroup"("bundleId");
CREATE UNIQUE INDEX "BundleGroupOption_groupId_sortOrder_key" ON "BundleGroupOption"("groupId", "sortOrder");
CREATE INDEX "BundleGroupOption_groupId_idx" ON "BundleGroupOption"("groupId");
CREATE INDEX "BundleGroupOption_productId_idx" ON "BundleGroupOption"("productId");
CREATE INDEX "BundleGroupOption_variantId_idx" ON "BundleGroupOption"("variantId");
CREATE INDEX "OrderBundleComponent_orderItemId_idx" ON "OrderBundleComponent"("orderItemId");
CREATE INDEX "OrderBundleComponent_productId_idx" ON "OrderBundleComponent"("productId");
CREATE INDEX "OrderBundleComponent_variantId_idx" ON "OrderBundleComponent"("variantId");

ALTER TABLE "BundleGroup" ADD CONSTRAINT "BundleGroup_bundleId_fkey"
  FOREIGN KEY ("bundleId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BundleGroupOption" ADD CONSTRAINT "BundleGroupOption_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "BundleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BundleGroupOption" ADD CONSTRAINT "BundleGroupOption_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BundleGroupOption" ADD CONSTRAINT "BundleGroupOption_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderBundleComponent" ADD CONSTRAINT "OrderBundleComponent_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderBundleComponent" ADD CONSTRAINT "OrderBundleComponent_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderBundleComponent" ADD CONSTRAINT "OrderBundleComponent_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing fixed bundles remain usable. Every legacy child becomes one fixed
-- selection group, and its active default (or first active) variant is pinned.
INSERT INTO "BundleGroup" (
  "bundleId", "name", "selectionType", "required", "minSelect", "maxSelect",
  "defaultQuantity", "minQuantity", "maxQuantity", "allowQuantityChange",
  "sortOrder", "createdAt", "updatedAt"
)
SELECT
  item."bundleId", product."name", 'FIXED'::"BundleSelectionType", true, 1, 1,
  item."quantity", item."quantity", item."quantity", false,
  item."sortOrder", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ProductBundleItem" item
JOIN "Product" product ON product."id" = item."productId"
WHERE NOT EXISTS (
  SELECT 1 FROM "BundleGroup" existing WHERE existing."bundleId" = item."bundleId"
);

INSERT INTO "BundleGroupOption" (
  "groupId", "productId", "variantId", "isDefault", "priceAdjustment",
  "sortOrder", "createdAt", "updatedAt"
)
SELECT
  grp."id", item."productId",
  (
    SELECT variant."id"
    FROM "ProductVariant" variant
    WHERE variant."productId" = item."productId" AND variant."active" = true
    ORDER BY variant."isDefault" DESC, variant."id" ASC
    LIMIT 1
  ),
  true, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ProductBundleItem" item
JOIN "BundleGroup" grp
  ON grp."bundleId" = item."bundleId" AND grp."sortOrder" = item."sortOrder"
WHERE NOT EXISTS (
  SELECT 1 FROM "BundleGroupOption" existing WHERE existing."groupId" = grp."id"
);
