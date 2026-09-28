ALTER TABLE "ProductVariant"
ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProductVariant"
ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "ProductVariantOption" (
  "id" SERIAL NOT NULL,
  "productId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductVariantOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductVariantOptionValue" (
  "id" SERIAL NOT NULL,
  "optionId" INTEGER NOT NULL,
  "value" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductVariantOptionValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariantOption_productId_name_key"
ON "ProductVariantOption"("productId", "name");

CREATE INDEX IF NOT EXISTS "ProductVariantOption_productId_position_idx"
ON "ProductVariantOption"("productId", "position");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariantOptionValue_optionId_value_key"
ON "ProductVariantOptionValue"("optionId", "value");

CREATE INDEX IF NOT EXISTS "ProductVariantOptionValue_optionId_position_idx"
ON "ProductVariantOptionValue"("optionId", "position");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ProductVariantOption_productId_fkey'
      AND table_name = 'ProductVariantOption'
  ) THEN
    ALTER TABLE "ProductVariantOption"
      ADD CONSTRAINT "ProductVariantOption_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ProductVariantOptionValue_optionId_fkey'
      AND table_name = 'ProductVariantOptionValue'
  ) THEN
    ALTER TABLE "ProductVariantOptionValue"
      ADD CONSTRAINT "ProductVariantOptionValue_optionId_fkey"
      FOREIGN KEY ("optionId") REFERENCES "ProductVariantOption"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

WITH ranked_variants AS (
  SELECT
    id,
    "productId",
    ROW_NUMBER() OVER (PARTITION BY "productId" ORDER BY id ASC) AS row_num
  FROM "ProductVariant"
),
products_without_default AS (
  SELECT DISTINCT rv."productId"
  FROM ranked_variants rv
  WHERE NOT EXISTS (
    SELECT 1
    FROM "ProductVariant" pv
    WHERE pv."productId" = rv."productId"
      AND pv."isDefault" = true
  )
)
UPDATE "ProductVariant" pv
SET "isDefault" = true
FROM ranked_variants rv
JOIN products_without_default pwd
  ON pwd."productId" = rv."productId"
WHERE pv.id = rv.id
  AND rv.row_num = 1;
