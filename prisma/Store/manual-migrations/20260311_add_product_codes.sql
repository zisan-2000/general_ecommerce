CREATE TYPE "ProductCodeKind" AS ENUM ('BARCODE', 'QRCODE');

CREATE TYPE "ProductCodeSymbology" AS ENUM ('CODE128', 'EAN13', 'QR');

CREATE TABLE "ProductCode" (
  "id" SERIAL NOT NULL,
  "productId" INTEGER,
  "variantId" INTEGER,
  "kind" "ProductCodeKind" NOT NULL,
  "symbology" "ProductCodeSymbology" NOT NULL,
  "value" TEXT NOT NULL,
  "token" TEXT,
  "imageUrl" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductCode_token_key" ON "ProductCode"("token");
CREATE UNIQUE INDEX "ProductCode_symbology_value_key" ON "ProductCode"("symbology", "value");
CREATE INDEX "ProductCode_productId_idx" ON "ProductCode"("productId");
CREATE INDEX "ProductCode_variantId_idx" ON "ProductCode"("variantId");
CREATE INDEX "ProductCode_kind_status_idx" ON "ProductCode"("kind", "status");

ALTER TABLE "ProductCode"
  ADD CONSTRAINT "ProductCode_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "ProductCode"
  ADD CONSTRAINT "ProductCode_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
