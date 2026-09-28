-- The release migration baseline predates the storefront specification tables.
-- Keep this idempotent so environments that received the legacy migration can
-- join the release migration chain safely.
CREATE TABLE IF NOT EXISTS "ProductSpecificationGroup" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSpecificationGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductSpecificationItem" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSpecificationItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductSpecificationGroup_productId_position_idx"
ON "ProductSpecificationGroup"("productId", "position");

CREATE INDEX IF NOT EXISTS "ProductSpecificationItem_groupId_position_idx"
ON "ProductSpecificationItem"("groupId", "position");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductSpecificationGroup_productId_fkey'
  ) THEN
    ALTER TABLE "ProductSpecificationGroup"
      ADD CONSTRAINT "ProductSpecificationGroup_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductSpecificationItem_groupId_fkey'
  ) THEN
    ALTER TABLE "ProductSpecificationItem"
      ADD CONSTRAINT "ProductSpecificationItem_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "ProductSpecificationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
