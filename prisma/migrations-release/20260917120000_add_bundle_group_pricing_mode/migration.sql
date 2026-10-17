CREATE TYPE "BundlePricingMode" AS ENUM ('AUTOMATIC', 'MANUAL');

ALTER TABLE "BundleGroup"
ADD COLUMN "pricingMode" "BundlePricingMode" NOT NULL DEFAULT 'AUTOMATIC';

UPDATE "BundleGroup" AS group_row
SET "pricingMode" = 'MANUAL'
WHERE EXISTS (
  SELECT 1
  FROM "BundleGroupOption" AS option_row
  WHERE option_row."groupId" = group_row."id"
    AND option_row."priceAdjustment" <> 0
);
