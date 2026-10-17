ALTER TABLE "Product"
  ADD COLUMN "bestSelling" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Product_deleted_available_bestSelling_idx"
  ON "Product"("deleted", "available", "bestSelling");
