-- Add BUNDLE to ProductType enum
-- This migration adds the BUNDLE product type and creates the ProductBundleItem relation table

-- Add ProductBundleItem relation table
CREATE TABLE "ProductBundleItem" (
    "id" SERIAL NOT NULL,
    "bundleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductBundleItem_pkey" PRIMARY KEY ("id")
);

-- Create foreign key constraints
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create unique constraint for bundle-product combination
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_bundleId_productId_key" UNIQUE ("bundleId", "productId");

-- Create indexes for performance
CREATE INDEX "ProductBundleItem_bundleId_idx" ON "ProductBundleItem"("bundleId");
CREATE INDEX "ProductBundleItem_productId_idx" ON "ProductBundleItem"("productId");

-- Note: The ProductType enum update will need to be handled by Prisma
-- when running `prisma migrate dev` or `prisma db push`
