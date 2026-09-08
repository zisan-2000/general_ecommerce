BEGIN;

CREATE TABLE "BookMetadata" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "writerId" INTEGER,
    "publisherId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookMetadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookMetadata_productId_key" ON "BookMetadata"("productId");
CREATE INDEX "BookMetadata_writerId_idx" ON "BookMetadata"("writerId");
CREATE INDEX "BookMetadata_publisherId_idx" ON "BookMetadata"("publisherId");

-- Preserve every legacy book relation before removing it from the generic Product core.
INSERT INTO "BookMetadata" (
    "productId",
    "writerId",
    "publisherId",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "writerId",
    "publisherId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Product"
WHERE "writerId" IS NOT NULL OR "publisherId" IS NOT NULL;

ALTER TABLE "BookMetadata"
  ADD CONSTRAINT "BookMetadata_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookMetadata"
  ADD CONSTRAINT "BookMetadata_writerId_fkey"
  FOREIGN KEY ("writerId") REFERENCES "Writer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookMetadata"
  ADD CONSTRAINT "BookMetadata_publisherId_fkey"
  FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_writerId_fkey";
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_publisherId_fkey";
DROP INDEX IF EXISTS "Product_writerId_deleted_available_idx";
DROP INDEX IF EXISTS "Product_publisherId_deleted_available_idx";

ALTER TABLE "Product"
  DROP COLUMN "writerId",
  DROP COLUMN "publisherId";

COMMIT;
