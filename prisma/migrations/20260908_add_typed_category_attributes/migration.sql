-- Phase 4 is intentionally additive. The legacy ProductAttribute.value column
-- remains the compatibility source until the typed-value cutover is verified.
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'COLOR');

ALTER TABLE "Attribute"
ADD COLUMN "type" "AttributeType" NOT NULL DEFAULT 'SELECT',
ADD COLUMN "unit" TEXT;

ALTER TABLE "ProductAttribute"
ADD COLUMN "valueText" TEXT,
ADD COLUMN "valueNumber" DECIMAL(18,6),
ADD COLUMN "valueBoolean" BOOLEAN,
ADD COLUMN "attributeValueId" INTEGER;

CREATE TABLE "CategoryAttribute" (
  "id" SERIAL NOT NULL,
  "categoryId" INTEGER NOT NULL,
  "attributeId" INTEGER NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "isFilterable" BOOLEAN NOT NULL DEFAULT true,
  "isVariant" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CategoryAttribute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoryAttribute_categoryId_attributeId_key"
ON "CategoryAttribute"("categoryId", "attributeId");
CREATE INDEX "CategoryAttribute_categoryId_sortOrder_idx"
ON "CategoryAttribute"("categoryId", "sortOrder");
CREATE INDEX "CategoryAttribute_attributeId_idx"
ON "CategoryAttribute"("attributeId");
CREATE INDEX "ProductAttribute_attributeId_valueNumber_idx"
ON "ProductAttribute"("attributeId", "valueNumber");
CREATE INDEX "ProductAttribute_attributeId_valueBoolean_idx"
ON "ProductAttribute"("attributeId", "valueBoolean");
CREATE INDEX "ProductAttribute_attributeValueId_idx"
ON "ProductAttribute"("attributeValueId");

ALTER TABLE "CategoryAttribute"
ADD CONSTRAINT "CategoryAttribute_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryAttribute"
ADD CONSTRAINT "CategoryAttribute_attributeId_fkey"
FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAttribute"
ADD CONSTRAINT "ProductAttribute_attributeValueId_fkey"
FOREIGN KEY ("attributeValueId") REFERENCES "AttributeValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
