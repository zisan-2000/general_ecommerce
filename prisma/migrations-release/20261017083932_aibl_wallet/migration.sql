-- DropIndex
DROP INDEX "PcBuilder_Attribute_name_trgm_idx";

-- DropIndex
DROP INDEX "PcBuilder_Brand_name_trgm_idx";

-- DropIndex
DROP INDEX "PcBuilder_Product_name_trgm_idx";

-- DropIndex
DROP INDEX "PcBuilder_Product_sku_trgm_idx";

-- DropIndex
DROP INDEX "PcBuilder_ProductAttribute_value_trgm_idx";

-- AlterTable
ALTER TABLE "BundleGroup" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BundleGroupOption" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StorePolicyContent" ALTER COLUMN "updatedAt" DROP DEFAULT;
